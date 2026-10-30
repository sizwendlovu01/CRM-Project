const currencyCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(value: number, currency = 'USD', options: { compact?: boolean } = {}): string {
  const key = `${currency}:${options.compact ? 'c' : 'f'}`;
  let formatter = currencyCache.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        notation: options.compact ? 'compact' : 'standard',
        maximumFractionDigits: options.compact ? 1 : 0,
      });
    } catch {
      formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    }
    currencyCache.set(key, formatter);
  }
  return formatter.format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

export function formatDate(value: string | Date | null | undefined, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export function formatRelative(value: string | Date | null | undefined, now = new Date()): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

/** ISO string -> value for <input type="date">. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

/** ISO string -> value for <input type="datetime-local"> in the browser's timezone. */
export function toDateTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
