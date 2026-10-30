import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lightweight edge gate: requests to app routes without a session cookie are sent to sign-in.
 * The API remains the authority - it validates the session on every request.
 */
export function middleware(request: NextRequest) {
  if (!request.cookies.get('crm_session')?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/app/:path*', '/w/:path*', '/onboarding'] };
