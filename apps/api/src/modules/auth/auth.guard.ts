import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators';
import { AppException } from '../../common/errors';
import { SESSION_COOKIE } from './auth.constants';
import { SessionService } from './session.service';

/**
 * Global guard: resolves the session cookie on every request and rejects unauthenticated
 * access to non-public routes.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token) {
      const user = await this.sessions.validate(token);
      if (user) {
        request.user = user;
        request.sessionToken = token;
      }
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    if (!request.user) throw AppException.unauthorized('Your session has expired. Please sign in again.');
    return true;
  }
}
