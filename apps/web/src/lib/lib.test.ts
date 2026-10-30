import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { formatCurrency, formatPercent, formatRelative, toDateInput } from './format';
import { initials, toQueryString } from './utils';

describe('utils', () => {
  it('builds initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('  grace  ')).toBe('G');
    expect(initials('Jean Claude van Damme')).toBe('JD');
    expect(initials('')).toBe('?');
  });

  it('builds query strings without empty values', () => {
    expect(toQueryString({ q: 'acme corp', page: 2, empty: '', none: undefined, flag: false })).toBe('?q=acme+corp&page=2&flag=false');
    expect(toQueryString({})).toBe('');
  });
});

describe('format', () => {
  it('formats currency and percentages', () => {
    expect(formatCurrency(12500, 'USD')).toBe('$12,500');
    expect(formatCurrency(1_250_000, 'USD', { compact: true })).toBe('$1.3M');
    expect(formatPercent(66.666)).toBe('66.7%');
  });

  it('formats relative times', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(formatRelative('2026-06-15T11:59:30Z', now)).toBe('just now');
    expect(formatRelative('2026-06-14T12:00:00Z', now)).toBe('yesterday');
    expect(formatRelative('2026-06-15T15:00:00Z', now)).toBe('in 3 hours');
  });

  it('converts ISO dates for date inputs', () => {
    expect(toDateInput('2026-03-04T00:00:00.000Z')).toBe('2026-03-04');
    expect(toDateInput(null)).toBe('');
  });
});

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })));
    await expect(api('/x')).resolves.toEqual({ ok: true });
  });

  it('turns error payloads into ApiError with field errors', async () => {
    const body = { statusCode: 400, error: 'Bad Request', message: 'Validation failed', code: 'VALIDATION_FAILED', details: [{ path: 'email', message: 'Invalid' }] };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 400, headers: { 'content-type': 'application/json' } })));
    const error = await api('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('VALIDATION_FAILED');
    expect((error as ApiError).fieldErrors()).toEqual({ email: 'Invalid' });
  });

  it('reports network failures with a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const error = (await api('/x').catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    await expect(api('/x')).resolves.toBeUndefined();
  });
});
