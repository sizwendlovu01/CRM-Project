import { NextResponse, type NextRequest } from 'next/server';

const PROXY_SECRET_HEADER = 'x-crm-proxy-secret';
const CLIENT_IP_HEADER = 'x-crm-client-ip';

/**
 * /api/* is rewritten to the API (next.config.ts), which then sees the proxy's address instead
 * of the visitor's. When PROXY_SECRET is configured (shared with the API), forward the visitor's
 * IP with the secret so rate limits and session records stay per client. Client-supplied copies
 * of these headers are always discarded.
 */
function forwardClientIp(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(PROXY_SECRET_HEADER);
  headers.delete(CLIENT_IP_HEADER);
  const secret = process.env.PROXY_SECRET;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
  if (secret && ip) {
    headers.set(PROXY_SECRET_HEADER, secret);
    headers.set(CLIENT_IP_HEADER, ip);
  }
  return NextResponse.next({ request: { headers } });
}

/**
 * Lightweight edge gate: requests to app routes without a session cookie are sent to sign-in.
 * The API remains the authority - it validates the session on every request.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) return forwardClientIp(request);
  if (!request.cookies.get('crm_session')?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*', '/app/:path*', '/w/:path*', '/onboarding'] };
