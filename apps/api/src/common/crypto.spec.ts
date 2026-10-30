import { createCsrfToken, generateToken, hashToken, isValidCsrfToken, safeEqual, slugify } from './crypto';

describe('crypto helpers', () => {
  const secret = 'x'.repeat(40);

  it('generates unique url-safe tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes tokens deterministically with the secret', () => {
    expect(hashToken('abc', secret)).toEqual(hashToken('abc', secret));
    expect(hashToken('abc', secret)).not.toEqual(hashToken('abc', 'y'.repeat(40)));
  });

  it('validates signed csrf tokens and rejects tampering', () => {
    const token = createCsrfToken(secret);
    expect(isValidCsrfToken(token, secret)).toBe(true);
    expect(isValidCsrfToken(`${token}x`, secret)).toBe(false);
    expect(isValidCsrfToken('nonce.signature', secret)).toBe(false);
    expect(isValidCsrfToken('garbage', secret)).toBe(false);
    expect(isValidCsrfToken(token, 'z'.repeat(40))).toBe(false);
  });

  it('compares strings in constant time', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('slugifies workspace names', () => {
    expect(slugify('Acme Holdings (Pty) Ltd')).toBe('acme-holdings-pty-ltd');
    expect(slugify('Café Société')).toBe('cafe-societe');
    expect(slugify('!!!')).toBe('workspace');
  });
});
