import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { createCsrfToken, generateToken, hashToken } from '../../common/crypto';
import type { AuthUser } from '../../common/types';
import { CSRF_COOKIE, SESSION_COOKIE, SESSION_TOUCH_INTERVAL_MS } from './auth.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get ttlMs(): number {
    return this.env.SESSION_TTL_DAYS * DAY_MS;
  }

  private cookieOptions(httpOnly: boolean): CookieOptions {
    return {
      httpOnly,
      sameSite: 'lax',
      secure: this.env.COOKIE_SECURE,
      path: '/',
      maxAge: this.ttlMs,
    };
  }

  async create(userId: string, meta: { ip: string | null; userAgent: string | null }): Promise<string> {
    const token = generateToken();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token, this.env.SESSION_SECRET),
        ipAddress: meta.ip,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
        expiresAt: new Date(Date.now() + this.ttlMs),
      },
    });
    return token;
  }

  /** Resolves a session cookie to a user, applying sliding expiry. Returns null when invalid. */
  async validate(token: string): Promise<AuthUser | null> {
    if (token.length < 20 || token.length > 200) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token, this.env.SESSION_SECRET) },
      include: { user: { select: { id: true, email: true, name: true, emailVerifiedAt: true } } },
    });
    const now = Date.now();
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now) return null;

    if (now - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(now + this.ttlMs) },
      });
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: Boolean(session.user.emailVerifiedAt),
      sessionId: session.id,
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  setCookies(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(true));
    // Rotate the CSRF token whenever the session changes.
    res.cookie(CSRF_COOKIE, createCsrfToken(this.env.SESSION_SECRET), this.cookieOptions(false));
  }

  clearCookies(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  issueCsrfCookie(res: Response): string {
    const token = createCsrfToken(this.env.SESSION_SECRET);
    res.cookie(CSRF_COOKIE, token, this.cookieOptions(false));
    return token;
  }
}
