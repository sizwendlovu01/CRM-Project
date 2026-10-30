export const SESSION_COOKIE = 'crm_session';
export const CSRF_COOKIE = 'crm_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export const MAX_FAILED_LOGINS = 10;
export const LOCKOUT_MINUTES = 15;
export const PASSWORD_RESET_TTL_MINUTES = 60;
export const EMAIL_VERIFICATION_TTL_HOURS = 48;
export const INVITATION_TTL_DAYS = 7;
/** Sessions are refreshed (sliding expiry) at most this often to limit write load. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
