import type { NextFunction, Request, Response } from 'express';
import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER, trustedClientIp } from './client-ip';

describe('trustedClientIp', () => {
  const secret = 's'.repeat(40);
  const middleware = trustedClientIp(secret);

  function run(headers: Record<string, string>): Request {
    const req = { headers: { ...headers } } as unknown as Request;
    Object.defineProperty(req, 'ip', { value: '10.0.0.1', configurable: true });
    const next = jest.fn() as NextFunction;
    middleware(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    return req;
  }

  it('uses the forwarded client IP when the proxy secret matches', () => {
    const req = run({ [PROXY_SECRET_HEADER]: secret, [CLIENT_IP_HEADER]: '203.0.113.7' });
    expect(req.ip).toBe('203.0.113.7');
  });

  it('ignores the forwarded IP when the secret is wrong or missing', () => {
    expect(run({ [PROXY_SECRET_HEADER]: 'wrong', [CLIENT_IP_HEADER]: '203.0.113.7' }).ip).toBe('10.0.0.1');
    expect(run({ [CLIENT_IP_HEADER]: '203.0.113.7' }).ip).toBe('10.0.0.1');
  });

  it('rejects values that are not IP addresses', () => {
    expect(run({ [PROXY_SECRET_HEADER]: secret, [CLIENT_IP_HEADER]: 'not-an-ip' }).ip).toBe('10.0.0.1');
  });

  it('removes the secret header so it is never logged or passed on', () => {
    const req = run({ [PROXY_SECRET_HEADER]: secret, [CLIENT_IP_HEADER]: '203.0.113.7' });
    expect(req.headers[PROXY_SECRET_HEADER]).toBeUndefined();
  });
});
