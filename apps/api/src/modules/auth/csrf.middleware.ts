import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { isValidCsrfToken, safeEqual } from '../../common/crypto';
import { AppException } from '../../common/errors';
import { CSRF_COOKIE, CSRF_HEADER } from './auth.constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Signed double-submit CSRF protection for state-changing requests. Defence in depth on top of
 * SameSite=Lax session cookies: the client must echo the readable CSRF cookie in a header.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(@Inject(ENV) private readonly env: Env) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) return next();

    const cookie: unknown = req.cookies?.[CSRF_COOKIE];
    const header = req.headers[CSRF_HEADER];
    const valid =
      typeof cookie === 'string' &&
      typeof header === 'string' &&
      safeEqual(cookie, header) &&
      isValidCsrfToken(cookie, this.env.SESSION_SECRET);

    if (!valid) {
      return next(AppException.forbidden('Invalid or missing CSRF token. Refresh the page and try again.'));
    }
    next();
  }
}
