import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type LoginInput,
  type RegisterInput,
} from '@crm/shared';
import type { z } from 'zod';
import { clientIp, CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { ZBody } from '../../common/zod';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

/** Strict per-IP limit for credential endpoints, configurable for tests. */
const AUTH_LIMIT = { default: { limit: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 10), ttl: 60_000 } };

function meta(req: Request) {
  return { ip: clientIp(req), userAgent: req.headers['user-agent'] ?? null };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Get('csrf')
  csrf(@Res({ passthrough: true }) res: Response) {
    return { csrfToken: this.sessions.issueCsrfCookie(res) };
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('register')
  async register(@ZBody(registerSchema) body: RegisterInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.register(body, meta(req));
    this.sessions.setCookies(res, token);
    return user;
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('login')
  @HttpCode(200)
  async login(@ZBody(loginSchema) body: LoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.login(body.email, body.password, meta(req));
    this.sessions.setCookies(res, token);
    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.user) await this.sessions.revoke(req.user.sessionId);
    this.sessions.clearCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@ZBody(forgotPasswordSchema) body: z.infer<typeof forgotPasswordSchema>) {
    await this.auth.forgotPassword(body.email);
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@ZBody(resetPasswordSchema) body: z.infer<typeof resetPasswordSchema>) {
    await this.auth.resetPassword(body.token, body.password);
    return { message: 'Your password has been reset. Please sign in.' };
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@ZBody(verifyEmailSchema) body: z.infer<typeof verifyEmailSchema>) {
    await this.auth.verifyEmail(body.token);
    return { message: 'Email verified.' };
  }

  @Throttle(AUTH_LIMIT)
  @Post('resend-verification')
  @HttpCode(200)
  async resendVerification(@CurrentUser() user: AuthUser) {
    await this.auth.resendVerification(user.id);
    return { message: 'Verification email sent.' };
  }
}
