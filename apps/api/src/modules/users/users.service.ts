import { Injectable } from '@nestjs/common';
import type { SessionInfo } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/errors';
import type { AuthUser } from '../../common/types';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
  ) {}

  async updateProfile(userId: string, input: { name: string; jobTitle?: string | null; phone?: string | null; timezone: string }) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name, jobTitle: input.jobTitle ?? null, phone: input.phone ?? null, timezone: input.timezone },
    });
    return this.auth.me(userId);
  }

  async changePassword(user: AuthUser, currentPassword: string, newPassword: string): Promise<void> {
    const record = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!record) throw AppException.unauthorized();
    if (!(await this.passwords.verify(record.passwordHash, currentPassword))) {
      throw AppException.badRequest('INVALID_PASSWORD', 'Your current password is incorrect.', [
        { path: 'currentPassword', message: 'Incorrect password' },
      ]);
    }
    if (currentPassword === newPassword) {
      throw AppException.badRequest('PASSWORD_UNCHANGED', 'Choose a password different from your current one.', [
        { path: 'newPassword', message: 'Must differ from the current password' },
      ]);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(newPassword), passwordChangedAt: new Date() },
    });
    await this.sessions.revokeAllForUser(user.id, user.sessionId);
  }

  async listSessions(user: AuthUser): Promise<SessionInfo[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      current: s.id === user.sessionId,
    }));
  }

  async revokeSession(user: AuthUser, sessionId: string): Promise<void> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw AppException.notFound('Session');
  }

  async revokeOtherSessions(user: AuthUser): Promise<void> {
    await this.sessions.revokeAllForUser(user.id, user.sessionId);
  }
}
