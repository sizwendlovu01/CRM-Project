import type { ApiErrorBody } from '@crm/shared';
import { toQueryString } from './utils';

export const API_BASE = '/api/v1';
const CSRF_COOKIE = 'crm_csrf';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: ApiErrorBody['details'] = [],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages keyed by path, for mapping onto form fields. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.details ?? []).map((d) => [d.path, d.message]));
  }
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfPromise: Promise<void> | null = null;
async function ensureCsrf(force = false): Promise<string> {
  if (force || !readCookie(CSRF_COOKIE)) {
    csrfPromise ??= fetch(`${API_BASE}/auth/csrf`, { credentials: 'same-origin' }).then(() => undefined);
    try {
      await csrfPromise;
    } finally {
      csrfPromise = null;
    }
  }
  return readCookie(CSRF_COOKIE) ?? '';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** Return the raw Response (used for file downloads). */
  raw?: boolean;
}

export const UNAUTHORIZED_EVENT = 'crm:unauthorized';

/**
 * Typed fetch wrapper: same-origin cookies, CSRF header, consistent ApiError, network-failure
 * handling and a global 401 signal so the app can redirect to the sign-in page.
 */
export async function api<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (MUTATING.has(method)) headers['X-CSRF-Token'] = await ensureCsrf();

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}${toQueryString(options.query ?? {})}`, {
      method,
      headers,
      body,
      credentials: 'same-origin',
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    let payload: Partial<ApiErrorBody> = {};
    try {
      payload = (await response.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error (e.g. proxy) */
    }
    const message = payload.message ?? (response.status >= 500 ? 'The server encountered an error. Please try again.' : 'Request failed.');
    const error = new ApiError(response.status, payload.code ?? 'ERROR', message, payload.details, payload.requestId);

    // A rotated or missing CSRF cookie: refresh once and retry transparently.
    if (response.status === 403 && /CSRF/i.test(message) && !retried) {
      await ensureCsrf(true);
      return api<T>(path, options, true);
    }
    if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw error;
  }

  if (options.raw) return response as unknown as T;
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? response.json() : response.text()) as Promise<T>;
}

/** Downloads a server-generated file (e.g. CSV export) without exposing data in URLs. */
export async function downloadFile(path: string, filename: string, query?: RequestOptions['query']): Promise<void> {
  const response = await api<Response>(path, { query, raw: true });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
