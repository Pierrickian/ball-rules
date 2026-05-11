export type ModifierSynergy = {
  requiredModifierIds: string[];
  unlockModifierIds: string[];
};

export const CHANGE_SYNERGIES: ModifierSynergy[] = [
  { requiredModifierIds: ["purple_balls", "more_chaos"], unlockModifierIds: ["purple_swarm"] },
  { requiredModifierIds: ["precision_shots", "stronger_boss"], unlockModifierIds: ["hardcore"] },
  { requiredModifierIds: ["boss_faster", "more_chaos"], unlockModifierIds: ["arena_panic"] },
  { requiredModifierIds: ["more_ammo", "more_chaos"], unlockModifierIds: ["bullet_party"] },
];

export function unlockedSynergyIds(selectedIds: string[], historyIds: string[]): string[] {
  const known = new Set([...selectedIds, ...historyIds]);
  return CHANGE_SYNERGIES
    .filter((synergy) => synergy.requiredModifierIds.every((id) => known.has(id)))
    .flatMap((synergy) => synergy.unlockModifierIds);
}
