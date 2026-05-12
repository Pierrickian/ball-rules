import type { GameConfig } from "../../engine/types";
import { PERSONALITY_TRAITS, strongestPersonalityTrait } from "./changePersonality";
import { CHANGE_MODIFIER_NODES, type ChangeModifierNode } from "./changeNodes";
import type { ChangeSessionState } from "./changeSelection";
import { unlockedEvolutionIds } from "./changeEvolution";
import { unlockedSynergyIds } from "./changeSynergies";

export type ProposedChangeNode = ChangeModifierNode & {
  score: number;
  reason: string;
  selected: boolean;
  unlocked: boolean;
};

export type ChangeGraphContext = {
  config: GameConfig;
  currentLevelIndex: number;
  currentLevelNumber: number;
  session: ChangeSessionState;
};

function hasConflict(node: ChangeModifierNode, selectedIds: Set<string>): boolean {
  return (node.conflictsWith ?? []).some((id) => selectedIds.has(id));
}

function dependencyUnlocked(node: ChangeModifierNode, knownIds: Set<string>, evolutionIds: Set<string>, synergyIds: Set<string>): boolean {
  if (node.kind === "add") return true;
  if (node.kind === "synergy") return synergyIds.has(node.id) || knownIds.has(node.id);
  if ((node.requiresAny ?? []).length > 0) return node.requiresAny?.some((id) => knownIds.has(id)) ?? false;
  if (node.kind === "evolution") return evolutionIds.has(node.id) || knownIds.has(node.id);
  return true;
}

function scoreNode(node: ChangeModifierNode, context: ChangeGraphContext, knownIds: Set<string>, evolutionIds: Set<string>, synergyIds: Set<string>): number {
  const { personality, selectedModifierIds } = context.session;
  let score = 1;
  for (const trait of PERSONALITY_TRAITS) {
    if (node.tags.includes(trait)) score += personality[trait] * 1.2;
    score += (node.personality[trait] ?? 0) * Math.max(0.15, personality[trait] * 0.25);
  }
  if (evolutionIds.has(node.id)) score += 7 + (node.evolution?.evolutionLevel ?? 0);
  if (synergyIds.has(node.id)) score += 8;
  if (selectedModifierIds.includes(node.id)) score += 20;
  if (node.tags.includes("bossFocus") && context.config.levels?.list[context.currentLevelIndex]?.boss) score += 2;
  if (node.tags.includes("survival") && (context.config.levels?.list[context.currentLevelIndex]?.timer_seconds ?? 60) < 60) score += 1.5;
  if (node.tags.includes("experimentation") && knownIds.size < 2) score += 1;
  if (node.kind === "add") score += 0.25;
  return score;
}

function reasonFor(node: ChangeModifierNode, context: ChangeGraphContext, evolutionIds: Set<string>, synergyIds: Set<string>): string {
  if (context.session.selectedModifierIds.includes(node.id)) return "Sélection active";
  if (synergyIds.has(node.id)) return "Synergie débloquée";
  if (evolutionIds.has(node.id)) return "Évolution naturelle";
  const best = strongestPersonalityTrait(context.session.personality);
  if (best && node.tags.includes(best)) return `Résonne avec ${best}`;
  if (node.kind === "add") return "Sortie créative";
  return "Diversité";
}

export function proposeChangeGraph(context: ChangeGraphContext): ProposedChangeNode[] {
  const selectedIds = new Set(context.session.selectedModifierIds);
  const knownIds = new Set([...context.session.modifierHistory, ...context.session.selectedModifierIds]);
  const evolutionIds = new Set([...context.session.unlockedEvolutionIds, ...unlockedEvolutionIds(context.session.selectedModifierIds, context.session.modifierHistory)]);
  const synergyIds = new Set([...context.session.unlockedSynergyIds, ...unlockedSynergyIds(context.session.selectedModifierIds, context.session.modifierHistory)]);

  const selectedNodes = CHANGE_MODIFIER_NODES.filter((node) => selectedIds.has(node.id));
  const candidates = CHANGE_MODIFIER_NODES
    .filter((node) => !selectedIds.has(node.id))
    .filter((node) => !hasConflict(node, selectedIds))
    .filter((node) => dependencyUnlocked(node, knownIds, evolutionIds, synergyIds))
    .map((node) => ({
      ...node,
      score: scoreNode(node, context, knownIds, evolutionIds, synergyIds),
      reason: reasonFor(node, context, evolutionIds, synergyIds),
      selected: false,
      unlocked: evolutionIds.has(node.id) || synergyIds.has(node.id),
    }))
    .sort((a, b) => b.score - a.score);

  const primary = candidates.slice(0, 8);
  const diversity = candidates
    .slice(8)
    .filter((node) => !primary.some((chosen) => chosen.tags.some((tag) => node.tags.includes(tag))))
    .slice(0, 2);

  return [
    ...selectedNodes.map((node) => ({
      ...node,
      score: scoreNode(node, context, knownIds, evolutionIds, synergyIds),
      reason: reasonFor(node, context, evolutionIds, synergyIds),
      selected: true,
      unlocked: true,
    })),
    ...primary,
    ...diversity,
  ].slice(0, 12);
}
