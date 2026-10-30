/**
 * CSV helpers shared by export and import paths.
 *
 * Exported cells are protected against spreadsheet formula injection (OWASP "CSV Injection"):
 * any value starting with =, +, -, @, tab or carriage return is prefixed with a single quote.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsvRow(values: readonly unknown[]): string {
  return values.map(sanitizeCsvCell).join(',');
}

/** Normalises a CSV header ("Full Name", "full_name", "fullName") to a lookup key. */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const CUSTOMER_CSV_COLUMNS = [
  { key: 'fullName', header: 'Full Name', aliases: ['fullname', 'name', 'customername'] },
  { key: 'company', header: 'Company', aliases: ['company', 'companyname', 'organisation', 'organization'] },
  { key: 'email', header: 'Email', aliases: ['email', 'emailaddress'] },
  { key: 'phone', header: 'Phone', aliases: ['phone', 'telephone', 'phonenumber', 'mobile'] },
  { key: 'address', header: 'Address', aliases: ['address'] },
  { key: 'industry', header: 'Industry', aliases: ['industry'] },
  { key: 'type', header: 'Type', aliases: ['type', 'customertype'] },
  { key: 'status', header: 'Status', aliases: ['status', 'customerstatus'] },
  { key: 'source', header: 'Source', aliases: ['source', 'customersource'] },
] as const;
