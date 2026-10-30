import { customerToCsvRow, parseCustomerCsv } from './customer-csv';
import type { Customer } from '@crm/shared';

describe('customer CSV parsing', () => {
  it('maps flexible headers and enum values', () => {
    const csv = 'Name,Company Name,E-mail Address,Telephone,Status,Source\nAda Lovelace,Engines Ltd,ADA@example.com,+27 11 555 0100,active,social media\n';
    const { rows, fatal } = parseCustomerCsv(csv.replace('E-mail Address', 'Email'));
    expect(fatal).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data).toMatchObject({
      fullName: 'Ada Lovelace',
      company: 'Engines Ltd',
      email: 'ada@example.com',
      status: 'ACTIVE',
      source: 'SOCIAL_MEDIA',
      type: 'BUSINESS',
    });
  });

  it('reports invalid rows with their line number', () => {
    const csv = 'Full Name,Email\nValid Person,valid@example.com\n,missing@example.com\nBad Email,not-an-email\n';
    const { rows } = parseCustomerCsv(csv);
    expect(rows.map((r) => r.row)).toEqual([2, 3, 4]);
    expect(rows[0]!.data).toBeDefined();
    expect(rows[1]!.error).toMatch(/fullName/);
    expect(rows[2]!.error).toMatch(/email/);
  });

  it('rejects files without a name column', () => {
    expect(parseCustomerCsv('Email\na@b.com\n').fatal).toMatch(/Full Name/);
  });

  it('defaults the source of imported rows to IMPORT', () => {
    const { rows } = parseCustomerCsv('Full Name\nGrace Hopper\n');
    expect(rows[0]!.data?.source).toBe('IMPORT');
  });

  it('exports rows with formula protection', () => {
    const customer = {
      fullName: '=cmd()',
      company: 'Acme, Inc',
      email: null,
      phone: null,
      address: null,
      industry: null,
      type: 'BUSINESS',
      status: 'ACTIVE',
      source: 'WEBSITE',
      assignedTo: null,
      lastInteractionAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    } as unknown as Customer;
    expect(customerToCsvRow(customer)).toBe(`'=cmd(),"Acme, Inc",,,,,Business,Active,Website,,,2026-01-01T00:00:00.000Z`);
  });
});
