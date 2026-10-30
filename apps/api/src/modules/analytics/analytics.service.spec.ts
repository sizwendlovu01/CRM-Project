import { pickGranularity, resolveRange } from './analytics.service';

describe('analytics range helpers', () => {
  const day = 86_400_000;
  const to = new Date('2026-06-30T00:00:00Z');

  it('chooses granularity by range length', () => {
    expect(pickGranularity(new Date(to.getTime() - 7 * day), to)).toBe('day');
    expect(pickGranularity(new Date(to.getTime() - 31 * day), to)).toBe('day');
    expect(pickGranularity(new Date(to.getTime() - 90 * day), to)).toBe('week');
    expect(pickGranularity(new Date(to.getTime() - 365 * day), to)).toBe('month');
  });

  it('defaults to the last 30 days', () => {
    const range = resolveRange(undefined, to);
    expect(range.to).toEqual(to);
    expect((range.to.getTime() - range.from.getTime()) / day).toBe(30);
  });

  it('caps extremely long ranges', () => {
    const range = resolveRange(new Date('2000-01-01T00:00:00Z'), to);
    expect((range.to.getTime() - range.from.getTime()) / day).toBeLessThanOrEqual(3 * 366);
  });
});
