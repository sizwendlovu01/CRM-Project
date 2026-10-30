import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Cryptographically random URL-safe token (256 bits by default). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Keyed hash used to store tokens at rest. A leaked database row cannot be replayed as a cookie. */
export function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Signed double-submit CSRF token: "<nonce>.<hmac(nonce)>". */
export function createCsrfToken(secret: string): string {
  const nonce = generateToken(24);
  return `${nonce}.${createHmac('sha256', secret).update(`csrf:${nonce}`).digest('base64url')}`;
}

export function isValidCsrfToken(token: string, secret: string): boolean {
  const [nonce, signature] = token.split('.');
  if (!nonce || !signature) return false;
  const expected = createHmac('sha256', secret).update(`csrf:${nonce}`).digest('base64url');
  return safeEqual(signature, expected);
}

export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace'
  );
}
