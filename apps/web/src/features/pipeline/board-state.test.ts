import { describe, expect, it } from 'vitest';
import { findContainer, moveItem, positionOf } from './board-state';

const state = { a: ['d1', 'd2', 'd3'], b: ['d4'], c: [] as string[] };

describe('board state', () => {
  it('finds the container of a deal or stage id', () => {
    expect(findContainer(state, 'd4')).toBe('b');
    expect(findContainer(state, 'stage:c')).toBe('c');
    expect(findContainer(state, 'missing')).toBeUndefined();
  });

  it('moves within a column', () => {
    expect(moveItem(state, 'd3', 'a', 0).a).toEqual(['d3', 'd1', 'd2']);
  });

  it('moves across columns and clamps the index', () => {
    const next = moveItem(state, 'd2', 'c', 99);
    expect(next.a).toEqual(['d1', 'd3']);
    expect(next.c).toEqual(['d2']);
    expect(positionOf(next, 'd2')).toEqual({ stageId: 'c', index: 0 });
  });

  it('does not mutate the previous state (needed for rollback)', () => {
    moveItem(state, 'd1', 'b', 0);
    expect(state).toEqual({ a: ['d1', 'd2', 'd3'], b: ['d4'], c: [] });
  });

  it('ignores unknown items and stages', () => {
    expect(moveItem(state, 'nope', 'a', 0)).toBe(state);
    expect(moveItem(state, 'd1', 'zzz', 0)).toBe(state);
  });
});
