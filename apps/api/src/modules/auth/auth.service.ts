import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AuthTokenType } from '@prisma/client';
import type { CurrentUser, RegisterInput } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { AppException } from '../../common/errors';
import { generateToken, hashToken } from '../../common/crypto';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/mail.templates';
import { createWorkspaceWithDefaults } from '../workspaces/workspace-factory';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
  PASSWORD_RESET_TTL_MINUTES,
} from './auth.constants';

interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<{ token: string; user: CurrentUser }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) {
      throw AppException.conflict('EMAIL_TAKEN', 'An account with this email already exists. Try signing in instead.', [
        { path: 'email', message: 'Email is already registered' },
      ]);
    }

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash } });
      await createWorkspaceWithDefaults(tx, created.id, input.workspaceName);
      return created;
    });

    await this.sendVerificationEmail(user.id, user.email, user.name);
    const token = await this.sessions.create(user.id, meta);
    return { token, user: await this.me(user.id) };
  }

  async login(email: string, password: string, meta: RequestMeta): Promise<{ token: string; user: CurrentUser }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await this.passwords.verifyDummy(password);
      throw this.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'ACCOUNT_LOCKED',
        `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'} or reset your password.`,
      );
    }

    const valid = await this.passwords.verify(user.passwordHash, password);
    if (!valid) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : user.lockedUntil,
        },
      });
      throw this.invalidCredentials();
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    }

    const token = await this.sessions.create(user.id, meta);
    return { token, user: await this.me(user.id) };
  }

  async me(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { workspace: { select: { id: true, name: true, slug: true, plan: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) throw AppException.unauthorized();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      jobTitle: user.jobTitle,
      phone: user.phone,
      timezone: user.timezone,
      createdAt: user.createdAt.toISOString(),
      memberships: user.memberships.map((m) => ({ role: m.role, workspace: m.workspace })),
    };
  }

  /** Always resolves successfully so the endpoint cannot be used to enumerate accounts. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
    if (!user) return;
    const token = await this.issueToken(user.id, 'PASSWORD_RESET', PASSWORD_RESET_TTL_MINUTES * 60_000);
    const url = `${this.env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mail.send({ to: user.email, ...templates.passwordReset(user.name, url) });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.consumeToken(token, 'PASSWORD_RESET');
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    await this.sessions.revokeAllForUser(record.userId);
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.consumeToken(token, 'EMAIL_VERIFICATION');
    await this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppException.unauthorized();
    if (user.emailVerifiedAt) {
      throw AppException.badRequest('ALREADY_VERIFIED', 'Your email address is already verified.');
    }
    await this.sendVerificationEmail(user.id, user.email, user.name);
  }

  private async sendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
    const token = await this.issueToken(userId, 'EMAIL_VERIFICATION', EMAIL_VERIFICATION_TTL_HOURS * 3_600_000);
    const url = `${this.env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await this.mail.send({ to: email, ...templates.verifyEmail(name, url) });
  }

  /** Issues a single-use token, invalidating any previous unused token of the same type. */
  private async issueToken(userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
    const token = generateToken();
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.authToken.create({
        data: { userId, type, tokenHash: hashToken(token, this.env.SESSION_SECRET), expiresAt: new Date(Date.now() + ttlMs) },
      }),
    ]);
    return token;
  }

  /** Atomically marks a token as used. Concurrent reuse attempts fail. */
  private async consumeToken(token: string, type: AuthTokenType) {
    const tokenHash = hashToken(token, this.env.SESSION_SECRET);
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash } });
    const invalid = AppException.badRequest('INVALID_TOKEN', 'This link is invalid or has expired. Please request a new one.');
    if (!record || record.type !== type || record.usedAt || record.expiresAt.getTime() <= Date.now()) throw invalid;
    const claimed = await this.prisma.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw invalid;
    return record;
  }

  private invalidCredentials(): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }
}
