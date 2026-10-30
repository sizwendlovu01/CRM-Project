import { describe, expect, it } from 'vitest';
import {
  canChangeRole,
  canInviteRole,
  canModifyRecord,
  canRemoveMember,
  hasPermission,
} from './permissions';
import { ROLES } from './enums';
import { exceededLimits, planHasFeature, withinLimit } from './plans';
import { sanitizeCsvCell, toCsvRow } from './csv';
import {
  createActivitySchema,
  createCustomerSchema,
  passwordSchema,
  registerSchema,
  updateCustomerSchema,
} from './schemas';

describe('permissions', () => {
  it('grants owners every permission', () => {
    expect(hasPermission('OWNER', 'workspace:delete')).toBe(true);
    expect(hasPermission('OWNER', 'billing:manage')).toBe(true);
  });

  it('keeps billing and deletion away from admins', () => {
    expect(hasPermission('ADMIN', 'billing:manage')).toBe(false);
    expect(hasPermission('ADMIN', 'workspace:delete')).toBe(false);
    expect(hasPermission('ADMIN', 'members:manage')).toBe(true);
  });

  it('makes viewers read-only', () => {
    expect(hasPermission('VIEWER', 'records:read')).toBe(true);
    expect(hasPermission('VIEWER', 'records:create')).toBe(false);
    expect(hasPermission('VIEWER', 'records:update_own')).toBe(false);
  });

  it('lets reps edit only their own records', () => {
    const own = { assignedToId: 'u1', createdById: 'x' };
    const other = { assignedToId: 'u2', createdById: 'u2' };
    expect(canModifyRecord('SALES_REPRESENTATIVE', 'u1', own)).toBe(true);
    expect(canModifyRecord('SALES_REPRESENTATIVE', 'u1', other)).toBe(false);
    expect(canModifyRecord('MANAGER', 'u1', other)).toBe(true);
    expect(canModifyRecord('VIEWER', 'u1', own)).toBe(false);
  });

  it('enforces role hierarchy for role changes', () => {
    expect(canChangeRole('ADMIN', 'VIEWER', 'MANAGER')).toBe(true);
    expect(canChangeRole('ADMIN', 'VIEWER', 'ADMIN')).toBe(false);
    expect(canChangeRole('ADMIN', 'ADMIN', 'VIEWER')).toBe(false);
    expect(canChangeRole('OWNER', 'ADMIN', 'VIEWER')).toBe(true);
    expect(canChangeRole('OWNER', 'ADMIN', 'OWNER')).toBe(false);
    expect(canChangeRole('MANAGER', 'VIEWER', 'SALES_REPRESENTATIVE')).toBe(false);
  });

  it('never allows removing or inviting owners', () => {
    for (const role of ROLES) {
      expect(canRemoveMember(role, 'OWNER')).toBe(false);
      expect(canInviteRole(role, 'OWNER')).toBe(false);
    }
    expect(canRemoveMember('ADMIN', 'MANAGER')).toBe(true);
    expect(canInviteRole('ADMIN', 'ADMIN')).toBe(false);
    expect(canInviteRole('OWNER', 'ADMIN')).toBe(true);
  });
});

describe('plans', () => {
  it('applies limits', () => {
    expect(withinLimit('FREE', 'members', 2)).toBe(true);
    expect(withinLimit('FREE', 'members', 3)).toBe(false);
    expect(withinLimit('ENTERPRISE', 'customers', 1_000_000, 500)).toBe(true);
  });

  it('gates features', () => {
    expect(planHasFeature('FREE', 'csv_import')).toBe(false);
    expect(planHasFeature('STARTER', 'csv_import')).toBe(true);
    expect(planHasFeature('GROWTH', 'audit_log')).toBe(false);
    expect(planHasFeature('ENTERPRISE', 'audit_log')).toBe(true);
  });

  it('reports exceeded limits for downgrades', () => {
    const usage = { members: 5, customers: 10, leads: 300, deals: 1, pipelines: 1 };
    expect(exceededLimits('FREE', usage).sort()).toEqual(['leads', 'members']);
    expect(exceededLimits('STARTER', usage)).toEqual([]);
  });
});

describe('csv', () => {
  it('neutralises spreadsheet formulas', () => {
    expect(sanitizeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(sanitizeCsvCell('+27 11 555')).toBe(`'+27 11 555`);
    expect(sanitizeCsvCell('@cmd')).toBe(`'@cmd`);
  });

  it('quotes commas and newlines', () => {
    expect(toCsvRow(['a,b', 'line\nbreak', null, 3])).toBe('"a,b","line\nbreak",,3');
  });
});

describe('schemas', () => {
  it('validates password strength', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('longpassword').success).toBe(false);
    expect(passwordSchema.safeParse('longpassword1').success).toBe(true);
  });

  it('normalises emails and empty strings', () => {
    const parsed = registerSchema.parse({
      name: 'Ada Lovelace',
      email: '  Ada@Example.COM ',
      password: 'correcthorse1',
      workspaceName: 'Analytical Engines',
    });
    expect(parsed.email).toBe('ada@example.com');

    const customer = createCustomerSchema.parse({ fullName: 'Grace', email: '', phone: '' });
    expect(customer.email).toBeNull();
    expect(customer.phone).toBeNull();
    expect(customer.status).toBe('PROSPECT');
  });

  it('does not apply create defaults on partial updates', () => {
    expect(updateCustomerSchema.parse({ fullName: 'x' })).toEqual({ fullName: 'x' });
  });

  it('rejects invalid email and phone', () => {
    expect(createCustomerSchema.safeParse({ fullName: 'A', email: 'nope' }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ fullName: 'A', phone: 'abc' }).success).toBe(false);
  });

  it('requires activities to be linked to a record', () => {
    expect(createActivitySchema.safeParse({ type: 'CALL', subject: 'Intro' }).success).toBe(false);
    expect(
      createActivitySchema.safeParse({
        type: 'CALL',
        subject: 'Intro',
        customerId: '2f1d4f0e-7a43-4c1e-9a55-5d0a3b0f8c11',
      }).success,
    ).toBe(true);
  });
});
