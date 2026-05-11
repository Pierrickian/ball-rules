export type SessionPersonality = {
  aggression: number;
  chaos: number;
  precision: number;
  bossFocus: number;
  survival: number;
  experimentation: number;
};

export const PERSONALITY_TRAITS = [
  "aggression",
  "chaos",
  "precision",
  "bossFocus",
  "survival",
  "experimentation",
] as const satisfies readonly (keyof SessionPersonality)[];

export const EMPTY_PERSONALITY: SessionPersonality = {
  aggression: 0,
  chaos: 0,
  precision: 0,
  bossFocus: 0,
  survival: 0,
  experimentation: 0,
};

export type PersonalityPatch = Partial<Record<keyof SessionPersonality, number>>;

export function addPersonalityPatch(base: SessionPersonality, patch: PersonalityPatch): SessionPersonality {
  return PERSONALITY_TRAITS.reduce<SessionPersonality>((next, trait) => {
    next[trait] = Math.max(0, Math.round(((base[trait] ?? 0) + (patch[trait] ?? 0)) * 10) / 10);
    return next;
  }, { ...EMPTY_PERSONALITY });
}

export function buildPersonalityFromHistory(history: string[], traitByModifier: (modifierId: string) => PersonalityPatch): SessionPersonality {
  return history.reduce((personality, modifierId) => addPersonalityPatch(personality, traitByModifier(modifierId)), { ...EMPTY_PERSONALITY });
}

export function strongestPersonalityTrait(personality: SessionPersonality): keyof SessionPersonality | null {
  let best: keyof SessionPersonality | null = null;
  let bestValue = 0;
  for (const trait of PERSONALITY_TRAITS) {
    if (personality[trait] > bestValue) {
      best = trait;
      bestValue = personality[trait];
    }
  }
  return best;
}
