import type { GameConfig } from "../../engine/types";
import { buildPersonalityFromHistory, EMPTY_PERSONALITY, type SessionPersonality } from "./changePersonality";
import { CHANGE_NODE_BY_ID, modifierTraits, type ChangePatchContext } from "./changeNodes";
import { unlockedEvolutionIds } from "./changeEvolution";
import { unlockedSynergyIds } from "./changeSynergies";

export type ChangeSessionState = {
  selectedModifierIds: string[];
  modifierHistory: string[];
  personality: SessionPersonality;
  unlockedEvolutionIds: string[];
  unlockedSynergyIds: string[];
};

export const EMPTY_CHANGE_SESSION: ChangeSessionState = {
  selectedModifierIds: [],
  modifierHistory: [],
  personality: EMPTY_PERSONALITY,
  unlockedEvolutionIds: [],
  unlockedSynergyIds: [],
};

export const CHANGE_SESSION_STORAGE_KEY = "bg_change_session_v2";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function loadChangeSession(): ChangeSessionState {
  try {
    const raw = window.localStorage.getItem(CHANGE_SESSION_STORAGE_KEY);
    if (!raw) return EMPTY_CHANGE_SESSION;
    const parsed = JSON.parse(raw) as Partial<ChangeSessionState>;
    const selectedModifierIds = isStringArray(parsed.selectedModifierIds) ? parsed.selectedModifierIds : [];
    const modifierHistory = isStringArray(parsed.modifierHistory) ? parsed.modifierHistory : [];
    const history = Array.from(new Set([...modifierHistory, ...selectedModifierIds])).filter((id) => CHANGE_NODE_BY_ID.has(id));
    return {
      selectedModifierIds: selectedModifierIds.filter((id) => CHANGE_NODE_BY_ID.has(id)),
      modifierHistory: history,
      personality: buildPersonalityFromHistory(history, modifierTraits),
      unlockedEvolutionIds: unlockedEvolutionIds(selectedModifierIds, history),
      unlockedSynergyIds: unlockedSynergyIds(selectedModifierIds, history),
    };
  } catch {
    return EMPTY_CHANGE_SESSION;
  }
}

export function saveChangeSession(session: ChangeSessionState): void {
  window.localStorage.setItem(CHANGE_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function withSelectedModifier(session: ChangeSessionState, modifierId: string): ChangeSessionState {
  const selected = session.selectedModifierIds.includes(modifierId)
    ? session.selectedModifierIds.filter((id) => id !== modifierId)
    : [...session.selectedModifierIds, modifierId];
  const history = Array.from(new Set([...session.modifierHistory, modifierId])).filter((id) => CHANGE_NODE_BY_ID.has(id));
  return {
    selectedModifierIds: selected,
    modifierHistory: history,
    personality: buildPersonalityFromHistory(history, modifierTraits),
    unlockedEvolutionIds: unlockedEvolutionIds(selected, history),
    unlockedSynergyIds: unlockedSynergyIds(selected, history),
  };
}

export function applyChangeSelection(config: GameConfig, selectedModifierIds: string[], context: ChangePatchContext): GameConfig {
  return selectedModifierIds.reduce((nextConfig, modifierId) => {
    const node = CHANGE_NODE_BY_ID.get(modifierId);
    return node?.apply ? node.apply(nextConfig, context) : nextConfig;
  }, config);
}
