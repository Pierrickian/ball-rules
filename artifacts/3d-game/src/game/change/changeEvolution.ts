import { CHANGE_NODE_BY_ID } from "./changeNodes";

export function unlockedEvolutionIds(selectedIds: string[], historyIds: string[]): string[] {
  const known = new Set([...selectedIds, ...historyIds]);
  const unlocked: string[] = [];
  for (const id of known) {
    const node = CHANGE_NODE_BY_ID.get(id);
    for (const nextId of node?.evolution?.nextModifierIds ?? []) unlocked.push(nextId);
  }
  return Array.from(new Set(unlocked));
}
