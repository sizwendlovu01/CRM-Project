/** Pure helpers for the Kanban board's local ordering state (stageId -> ordered deal ids). */
export type ColumnsState = Record<string, string[]>;

export const STAGE_PREFIX = 'stage:';

export function findContainer(state: ColumnsState, id: string): string | undefined {
  if (id.startsWith(STAGE_PREFIX)) return id.slice(STAGE_PREFIX.length);
  return Object.keys(state).find((stageId) => state[stageId]?.includes(id));
}

/** Moves `itemId` into `toStage` at `toIndex` (clamped), returning a new state object. */
export function moveItem(state: ColumnsState, itemId: string, toStage: string, toIndex: number): ColumnsState {
  const fromStage = findContainer(state, itemId);
  if (!fromStage || !(toStage in state)) return state;
  const next: ColumnsState = { ...state, [fromStage]: state[fromStage]!.filter((id) => id !== itemId) };
  const target = [...(next[toStage] ?? [])];
  const index = Math.max(0, Math.min(toIndex, target.length));
  target.splice(index, 0, itemId);
  next[toStage] = target;
  return next;
}

export function positionOf(state: ColumnsState, itemId: string): { stageId: string; index: number } | null {
  const stageId = findContainer(state, itemId);
  if (!stageId) return null;
  return { stageId, index: state[stageId]!.indexOf(itemId) };
}
