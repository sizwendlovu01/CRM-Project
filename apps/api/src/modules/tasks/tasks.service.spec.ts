import { isTaskOverdue } from './tasks.service';

describe('isTaskOverdue', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('flags open tasks past their due date', () => {
    expect(isTaskOverdue({ status: 'TODO', dueAt: new Date('2026-06-15T11:59:00Z') }, now)).toBe(true);
    expect(isTaskOverdue({ status: 'IN_PROGRESS', dueAt: new Date('2026-06-01T00:00:00Z') }, now)).toBe(true);
  });

  it('ignores completed, cancelled, undated and future tasks', () => {
    expect(isTaskOverdue({ status: 'COMPLETED', dueAt: new Date('2026-06-01T00:00:00Z') }, now)).toBe(false);
    expect(isTaskOverdue({ status: 'CANCELLED', dueAt: new Date('2026-06-01T00:00:00Z') }, now)).toBe(false);
    expect(isTaskOverdue({ status: 'TODO', dueAt: null }, now)).toBe(false);
    expect(isTaskOverdue({ status: 'TODO', dueAt: new Date('2026-06-16T00:00:00Z') }, now)).toBe(false);
  });
});
