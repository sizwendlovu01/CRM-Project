import Papa from 'papaparse';
import {
  createCustomerSchema,
  CUSTOMER_CSV_COLUMNS,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  humanize,
  normalizeHeader,
  RECORD_SOURCES,
  toCsvRow,
  type CreateCustomerInput,
  type Customer,
} from '@crm/shared';

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export interface ParsedImportRow {
  row: number;
  data?: CreateCustomerInput;
  error?: string;
}

/** Maps human-friendly enum values ("Social media", "social-media") to enum constants. */
function toEnum<T extends string>(value: unknown, allowed: readonly T[]): T | unknown {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return (allowed as readonly string[]).includes(key) ? (key as T) : value;
}

export function parseCustomerCsv(content: string): { rows: ParsedImportRow[]; fatal?: string } {
  const parsed = Papa.parse<Record<string, string>>(content.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => normalizeHeader(header),
  });

  const headers = parsed.meta.fields ?? [];
  const columnFor = new Map<string, string>();
  for (const column of CUSTOMER_CSV_COLUMNS) {
    const match = headers.find((h) => h === normalizeHeader(column.key) || (column.aliases as readonly string[]).includes(h));
    if (match) columnFor.set(column.key, match);
  }
  if (!columnFor.has('fullName')) {
    return { rows: [], fatal: 'The CSV must include a "Full Name" (or "Name") column.' };
  }
  if (parsed.data.length > MAX_IMPORT_ROWS) {
    return { rows: [], fatal: `A single import can contain at most ${MAX_IMPORT_ROWS} rows.` };
  }

  const rows = parsed.data.map((raw, index): ParsedImportRow => {
    const pick = (key: string) => {
      const header = columnFor.get(key);
      return header ? raw[header] : undefined;
    };
    const candidate = {
      fullName: pick('fullName'),
      company: pick('company'),
      email: pick('email'),
      phone: pick('phone'),
      address: pick('address'),
      industry: pick('industry'),
      type: toEnum(pick('type'), CUSTOMER_TYPES),
      status: toEnum(pick('status'), CUSTOMER_STATUSES),
      source: toEnum(pick('source'), RECORD_SOURCES) ?? 'IMPORT',
    };
    const result = createCustomerSchema.safeParse(candidate);
    const rowNumber = index + 2; // +1 for header, +1 for 1-based numbering
    if (!result.success) {
      const issue = result.error.issues[0];
      return { row: rowNumber, error: `${issue?.path.join('.') || 'row'}: ${issue?.message ?? 'invalid'}` };
    }
    return { row: rowNumber, data: { ...result.data, assignedToId: undefined } };
  });

  return { rows };
}

export const CUSTOMER_EXPORT_HEADERS = [
  'Full Name',
  'Company',
  'Email',
  'Phone',
  'Address',
  'Industry',
  'Type',
  'Status',
  'Source',
  'Assigned To',
  'Last Interaction',
  'Created At',
];

export function customerToCsvRow(customer: Customer): string {
  return toCsvRow([
    customer.fullName,
    customer.company,
    customer.email,
    customer.phone,
    customer.address,
    customer.industry,
    humanize(customer.type),
    humanize(customer.status),
    humanize(customer.source),
    customer.assignedTo?.name ?? '',
    customer.lastInteractionAt ?? '',
    customer.createdAt,
  ]);
}
