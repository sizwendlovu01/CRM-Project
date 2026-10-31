import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import { safeEqual } from './crypto';

export const PROXY_SECRET_HEADER = 'x-crm-proxy-secret';
export const CLIENT_IP_HEADER = 'x-crm-client-ip';

/**
 * Behind the web app's proxy (for example a Vercel rewrite) every request arrives from the
 * proxy's address, so rate limits and session records would see one IP for everyone. The web
 * middleware forwards the visitor's IP together with a shared secret; the IP is trusted only when
 * the secret matches. The secret header is removed before anything else can read or log it.
 */
export function trustedClientIp(secret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const provided = req.headers[PROXY_SECRET_HEADER];
    const ip = req.headers[CLIENT_IP_HEADER];
    if (typeof provided === 'string' && typeof ip === 'string' && isIP(ip) && safeEqual(provided, secret)) {
      Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true });
    }
    delete req.headers[PROXY_SECRET_HEADER];
    next();
  };
}
