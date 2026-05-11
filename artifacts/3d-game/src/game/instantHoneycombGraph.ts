import type { BallColor } from "../engine/types";
import type { RecipeChoice } from "./instantHoneycombRecipes";
import { MOODS, RECIPES, type IntensityIndex } from "./instantHoneycombRecipes";

export type HoneycombNodeKind = "recipe" | "mood" | "bridge";

export interface HoneycombNode {
  id: string;
  kind: HoneycombNodeKind;
  label: string;
  symbol: string;
  hint: string;
  tags: string[];
  recipeId?: string;
  moodId?: string;
}

const BRIDGE_NODES: HoneycombNode[] = [
  {
    id: "bridge-boss",
    kind: "bridge",
    label: "Boss Energy",
    symbol: "👑",
    hint: "Boss-compatible ideas",
    tags: ["context:boss"],
  },
  {
    id: "bridge-level",
    kind: "bridge",
    label: "Level Remix",
    symbol: "🏁",
    hint: "Level-compatible ideas",
    tags: ["context:level"],
  },
  {
    id: "bridge-ball",
    kind: "bridge",
    label: "Ball Magic",
    symbol: "🔮",
    hint: "Ball-compatible ideas",
    tags: ["context:ball"],
  },
];

export const HONEYCOMB_NODES: HoneycombNode[] = [
  ...MOODS.map(
    (mood): HoneycombNode => ({
      id: `mood-${mood.id}`,
      kind: "mood",
      label: mood.label,
      symbol: mood.symbol,
      hint: mood.hint,
      moodId: mood.id,
      tags: [`mood:${mood.id}`],
    }),
  ),
  ...RECIPES.map(
    (recipe): HoneycombNode => ({
      id: `recipe-${recipe.id}`,
      kind: "recipe",
      label: recipe.label,
      symbol: recipe.symbol,
      hint: recipe.hint,
      recipeId: recipe.id,
      moodId: recipe.mood,
      tags: [
        `mood:${recipe.mood}`,
        `context:${recipe.context}`,
        `capability:${recipe.capabilityKey}`,
      ],
    }),
  ),
  ...BRIDGE_NODES,
];

export const DEFAULT_VISIBLE_NODE_COUNT = 7;

function selectedNodes(selectedIds: Set<string>): HoneycombNode[] {
  return HONEYCOMB_NODES.filter((node) => selectedIds.has(node.id));
}

function selectedRecipes(selected: HoneycombNode[]): HoneycombNode[] {
  return selected.filter((node) => node.kind === "recipe");
}

function hasSharedTag(a: HoneycombNode, b: HoneycombNode): boolean {
  return a.tags.some((tag) => b.tags.includes(tag));
}

export function areHoneycombNodesCompatible(
  node: HoneycombNode,
  selectedIds: Set<string>,
): boolean {
  const selected = selectedNodes(selectedIds);
  if (selected.length === 0 || selectedIds.has(node.id)) return true;

  const recipes = selectedRecipes(selected);
  if (node.kind === "recipe" && recipes.some((recipe) => recipe.id !== node.id))
    return false;
  if (recipes.length > 0 && node.kind === "mood")
    return recipes.some((recipe) => recipe.moodId === node.moodId);
  if (recipes.length > 0 && node.kind === "bridge")
    return recipes.some((recipe) => hasSharedTag(recipe, node));
  return selected.some((entry) => {
    if (entry.kind === "mood" && node.kind === "recipe")
      return entry.moodId === node.moodId;
    if (entry.kind === "bridge" && node.kind === "recipe")
      return hasSharedTag(entry, node);
    return hasSharedTag(entry, node);
  });
}

export function compatibleHoneycombNodes(
  selectedIds: Set<string>,
): HoneycombNode[] {
  return HONEYCOMB_NODES.filter((node) =>
    areHoneycombNodesCompatible(node, selectedIds),
  );
}

function scoreRandomCandidate(
  node: HoneycombNode,
  selectedIds: Set<string>,
): number {
  const selected = selectedNodes(selectedIds);
  if (selected.length === 0) return node.kind === "recipe" ? 3 : 2;
  const sharedTagCount = selected.reduce(
    (sum, entry) =>
      sum + entry.tags.filter((tag) => node.tags.includes(tag)).length,
    0,
  );
  return sharedTagCount * 4 + (node.kind === "recipe" ? 2 : 1);
}

export function randomHoneycombSubset(
  selectedIds: Set<string>,
  count = DEFAULT_VISIBLE_NODE_COUNT,
): string[] {
  const selected = selectedNodes(selectedIds).map((node) => node.id);
  const candidates = compatibleHoneycombNodes(selectedIds).filter(
    (node) => !selectedIds.has(node.id),
  );
  const shuffled = [...candidates]
    .map((node) => ({
      node,
      rank: Math.random() * 10 + scoreRandomCandidate(node, selectedIds),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, Math.max(0, count - selected.length))
    .map(({ node }) => node.id);
  return [...selected, ...shuffled];
}

export function recipeForNode(node?: HoneycombNode): RecipeChoice | undefined {
  if (!node?.recipeId) return undefined;
  return RECIPES.find((recipe) => recipe.id === node.recipeId);
}

export function selectedRecipe(
  selectedIds: Set<string>,
): RecipeChoice | undefined {
  return recipeForNode(
    HONEYCOMB_NODES.find(
      (node) => selectedIds.has(node.id) && node.kind === "recipe",
    ),
  );
}

export function recipeValue(
  recipe: RecipeChoice,
  intensity: IntensityIndex,
  ballColor: BallColor,
): unknown {
  if (recipe.values === "selectedBallWeight") return { [ballColor]: 1 };
  return recipe.values[intensity];
}

export function buildEvolutionPreprompt(nodes: HoneycombNode[]): string {
  const selected = nodes.length > 0 ? nodes : [];
  const labels = selected
    .map((node) => `${node.symbol} ${node.label}`)
    .join(" + ");
  const tags = Array.from(new Set(selected.flatMap((node) => node.tags))).join(
    ", ",
  );
  return [
    "Je veux faire évoluer Ball Game à partir du graphe Instant.",
    labels
      ? `Intentions sélectionnées: ${labels}.`
      : "Intention: surprise arcade autour d'une nouvelle mécanique jouable.",
    tags
      ? `Compatibilités ressenties: ${tags}.`
      : "Compatibilités ressenties: à proposer librement.",
    "Ajoute une vraie évolution si ce n'est pas possible avec les patchs Instant runtime-only actuels.",
    "Garde le résultat fun, visuel, jouable immédiatement, et explique les changements de règles/config nécessaires.",
  ].join("\n");
}
