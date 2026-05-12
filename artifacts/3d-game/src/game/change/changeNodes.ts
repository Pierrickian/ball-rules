import type { BallColor, GameConfig, LevelEntry } from "../../engine/types";
import type { PersonalityPatch } from "./changePersonality";

export type ModifierEvolution = {
  nextModifierIds?: string[];
  evolutionLevel?: number;
};

export type ChangeModifierNode = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: string;
  tags: string[];
  personality: PersonalityPatch;
  evolution?: ModifierEvolution;
  requiresAny?: string[];
  conflictsWith?: string[];
  kind?: "modifier" | "synergy" | "evolution" | "add";
  apply?: (config: GameConfig, context: ChangePatchContext) => GameConfig;
  evolutionPrompt?: string;
};

export type ChangePatchContext = {
  currentLevelIndex: number;
  currentLevelNumber: number;
};

function patchLevelAt(config: GameConfig, index: number, patcher: (level: LevelEntry) => LevelEntry): GameConfig {
  const list = config.levels?.list ?? [];
  if (list.length === 0) return config;
  const safeIndex = Math.max(0, Math.min(index, list.length - 1));
  return {
    ...config,
    levels: {
      ...config.levels,
      list: list.map((level, levelIndex) => levelIndex === safeIndex ? patcher(level) : level),
    },
  };
}

function patchBossLevel(config: GameConfig, context: ChangePatchContext, patch: Partial<NonNullable<LevelEntry["boss"]>>): GameConfig {
  const list = config.levels?.list ?? [];
  if (list.length === 0) return config;
  const currentHasBoss = Boolean(list[context.currentLevelIndex]?.boss);
  const targetIndex = currentHasBoss ? context.currentLevelIndex : list.findIndex((level) => Boolean(level.boss));
  if (targetIndex < 0) return config;
  return {
    ...config,
    levels: {
      ...config.levels,
      list: list.map((level, levelIndex) => levelIndex === targetIndex && level.boss
        ? { ...level, boss: { ...level.boss, ...patch } }
        : level),
    },
  };
}

function multiplyCurrentWeights(config: GameConfig, context: ChangePatchContext, multipliers: Partial<Record<BallColor, number>>): GameConfig {
  return patchLevelAt(config, context.currentLevelIndex, (level) => {
    const weights = { ...(level.launch_color_weights ?? {}) };
    for (const [color, multiplier] of Object.entries(multipliers)) {
      const ballColor = color as BallColor;
      const current = weights[ballColor] ?? 0.12;
      weights[ballColor] = Math.max(0.01, Math.round(current * (multiplier ?? 1) * 100) / 100);
    }
    return { ...level, launch_color_weights: weights };
  });
}

function patchCurrentLevel(config: GameConfig, context: ChangePatchContext, patch: Partial<LevelEntry>): GameConfig {
  return patchLevelAt(config, context.currentLevelIndex, (level) => ({ ...level, ...patch }));
}

type OrangePatch = Omit<Partial<GameConfig["gameplay"]["orange"]>, "spawn" | "launch_config"> & {
  spawn?: Partial<GameConfig["gameplay"]["orange"]["spawn"]>;
  launch_config?: Partial<GameConfig["gameplay"]["orange"]["launch_config"]>;
};

function patchOrange(config: GameConfig, patch: OrangePatch): GameConfig {
  return {
    ...config,
    gameplay: {
      ...config.gameplay,
      orange: {
        ...config.gameplay.orange,
        ...patch,
        spawn: { ...config.gameplay.orange.spawn, ...(patch.spawn ?? {}) },
        launch_config: { ...config.gameplay.orange.launch_config, ...(patch.launch_config ?? {}) },
      },
    } as GameConfig["gameplay"],
  };
}

export const CHANGE_MODIFIER_NODES: ChangeModifierNode[] = [
  {
    id: "faster_balls",
    title: "Faster Balls",
    subtitle: "Les tirs du niveau prennent plus d'élan.",
    icon: "💨",
    tone: "#38bdf8",
    tags: ["aggression", "speed"],
    personality: { aggression: 1 },
    evolution: { nextModifierIds: ["hyper_balls"], evolutionLevel: 1 },
    apply: (config) => patchOrange(config, { launch_config: { speed: Math.round(config.gameplay.orange.launch_config.speed * 1.15) } }),
  },
  {
    id: "hyper_balls",
    title: "Hyper Balls",
    subtitle: "Version nerveuse de Faster Balls.",
    icon: "⚡",
    tone: "#67e8f9",
    tags: ["aggression", "speed"],
    personality: { aggression: 1.4, chaos: 0.3 },
    requiresAny: ["faster_balls"],
    evolution: { nextModifierIds: ["ball_frenzy"], evolutionLevel: 2 },
    kind: "evolution",
    apply: (config) => patchOrange(config, { launch_config: { speed: Math.round(config.gameplay.orange.launch_config.speed * 1.32) } }),
  },
  {
    id: "ball_frenzy",
    title: "Ball Frenzy",
    subtitle: "Le lanceur respire plus vite et plus fort.",
    icon: "🌪️",
    tone: "#22d3ee",
    tags: ["aggression", "chaos", "speed"],
    personality: { aggression: 1.8, chaos: 0.8 },
    requiresAny: ["hyper_balls"],
    evolution: { evolutionLevel: 3 },
    kind: "evolution",
    apply: (config) => patchOrange(config, { spawn: { interval_seconds: Math.max(0.22, config.gameplay.orange.spawn.interval_seconds * 0.72) }, launch_config: { speed: Math.round(config.gameplay.orange.launch_config.speed * 1.42) } }),
  },
  {
    id: "more_chaos",
    title: "More Chaos",
    subtitle: "Plus de violet et d'imprévu dans l'arène.",
    icon: "🌀",
    tone: "#c084fc",
    tags: ["chaos", "experimentation"],
    personality: { chaos: 1, experimentation: 0.4 },
    evolution: { nextModifierIds: ["chaos_plus"], evolutionLevel: 1 },
    apply: (config, context) => multiplyCurrentWeights(config, context, { purple: 2.2, pink: 1.4 }),
  },
  {
    id: "chaos_plus",
    title: "Chaos+",
    subtitle: "Le chaos devient un vrai style de partie.",
    icon: "✨",
    tone: "#d8b4fe",
    tags: ["chaos", "experimentation"],
    personality: { chaos: 1.5, experimentation: 0.5 },
    requiresAny: ["more_chaos"],
    evolution: { nextModifierIds: ["chaos_storm"], evolutionLevel: 2 },
    kind: "evolution",
    apply: (config, context) => multiplyCurrentWeights(config, context, { purple: 3, pink: 1.7, turquoise: 1.4 }),
  },
  {
    id: "chaos_storm",
    title: "Chaos Storm",
    subtitle: "Une tempête lisible, intense, colorée.",
    icon: "⛈️",
    tone: "#e879f9",
    tags: ["chaos", "aggression"],
    personality: { chaos: 2, aggression: 0.8 },
    requiresAny: ["chaos_plus"],
    evolution: { evolutionLevel: 3 },
    kind: "evolution",
    apply: (config, context) => multiplyCurrentWeights(patchOrange(config, { spawn: { interval_seconds: Math.max(0.3, config.gameplay.orange.spawn.interval_seconds * 0.82) } }), context, { purple: 3.2, pink: 2, turquoise: 1.8 }),
  },
  {
    id: "boss_faster",
    title: "Faster Boss",
    subtitle: "Le boss bouge avec plus d'intention.",
    icon: "👑",
    tone: "#fb7185",
    tags: ["bossFocus", "aggression"],
    personality: { bossFocus: 1, aggression: 0.6 },
    evolution: { nextModifierIds: ["hyper_boss"], evolutionLevel: 1 },
    apply: (config, context) => patchBossLevel(config, context, { horizontal_speed: 16 }),
  },
  {
    id: "hyper_boss",
    title: "Hyper Boss",
    subtitle: "Le duel devient plus direct.",
    icon: "🔥",
    tone: "#f43f5e",
    tags: ["bossFocus", "aggression"],
    personality: { bossFocus: 1.5, aggression: 0.8 },
    requiresAny: ["boss_faster"],
    evolution: { nextModifierIds: ["boss_rush"], evolutionLevel: 2 },
    kind: "evolution",
    apply: (config, context) => patchBossLevel(config, context, { horizontal_speed: 23, reward_grenades_on_spawn: 1 }),
  },
  {
    id: "boss_rush",
    title: "Boss Rush",
    subtitle: "Plusieurs présences de boss, sans nouveau système.",
    icon: "🏁",
    tone: "#ff6b8a",
    tags: ["bossFocus", "aggression"],
    personality: { bossFocus: 2, aggression: 1 },
    requiresAny: ["hyper_boss"],
    evolution: { evolutionLevel: 3 },
    kind: "evolution",
    apply: (config, context) => patchBossLevel(config, context, { horizontal_speed: 24, spawn_count: 3, spawn_spacing_x: 1.8 }),
  },
  {
    id: "precision_shots",
    title: "Precision Shots",
    subtitle: "Moins de munitions, plus de sens à chaque tir.",
    icon: "🎯",
    tone: "#facc15",
    tags: ["precision"],
    personality: { precision: 1 },
    conflictsWith: ["more_ammo"],
    evolution: { nextModifierIds: ["no_waste"], evolutionLevel: 1 },
    apply: (config, context) => patchCurrentLevel(config, context, { ammo_count: Math.max(8, Math.round(((config.levels?.list[context.currentLevelIndex]?.ammo_count ?? 40) * 0.78))) }),
  },
  {
    id: "no_waste",
    title: "No Waste",
    subtitle: "La précision devient la règle de la partie.",
    icon: "🪡",
    tone: "#fde047",
    tags: ["precision"],
    personality: { precision: 1.6 },
    requiresAny: ["precision_shots"],
    conflictsWith: ["more_ammo"],
    evolution: { nextModifierIds: ["hardcore_precision"], evolutionLevel: 2 },
    kind: "evolution",
    apply: (config, context) => patchCurrentLevel(config, context, { ammo_count: Math.max(6, Math.round(((config.levels?.list[context.currentLevelIndex]?.ammo_count ?? 40) * 0.62))) }),
  },
  {
    id: "hardcore_precision",
    title: "Hardcore Precision",
    subtitle: "Très peu de marge, beaucoup de maîtrise.",
    icon: "💎",
    tone: "#fef08a",
    tags: ["precision", "bossFocus"],
    personality: { precision: 2, bossFocus: 0.5 },
    requiresAny: ["no_waste"],
    conflictsWith: ["more_ammo"],
    evolution: { evolutionLevel: 3 },
    kind: "evolution",
    apply: (config, context) => patchCurrentLevel(config, context, { ammo_count: Math.max(5, Math.round(((config.levels?.list[context.currentLevelIndex]?.ammo_count ?? 40) * 0.5))) }),
  },
  {
    id: "more_time",
    title: "More Time",
    subtitle: "Un peu plus d'air pour respirer.",
    icon: "⏳",
    tone: "#86efac",
    tags: ["survival"],
    personality: { survival: 1 },
    apply: (config, context) => patchCurrentLevel(config, context, { timer_seconds: Math.round(((config.levels?.list[context.currentLevelIndex]?.timer_seconds ?? 60) * 1.25)) }),
  },
  {
    id: "more_ammo",
    title: "More Ammo",
    subtitle: "La partie devient plus généreuse et joueuse.",
    icon: "🧃",
    tone: "#34d399",
    tags: ["survival", "chaos"],
    personality: { survival: 0.8, chaos: 0.3 },
    conflictsWith: ["precision_shots", "no_waste", "hardcore_precision"],
    apply: (config, context) => patchCurrentLevel(config, context, { ammo_count: Math.round(((config.levels?.list[context.currentLevelIndex]?.ammo_count ?? 40) * 1.35)) }),
  },
  {
    id: "random_level",
    title: "Random Level",
    subtitle: "Répartition plus surprenante sur le niveau actif.",
    icon: "🎲",
    tone: "#a78bfa",
    tags: ["experimentation", "chaos"],
    personality: { experimentation: 1, chaos: 0.4 },
    apply: (config, context) => patchCurrentLevel(config, context, { launch_color_weights: { white: 0.8, yellow: 0.7, light_green: 0.7, dark_green: 0.6, blue: 0.6, purple: 0.5, pink: 0.4 } }),
  },
  {
    id: "purple_balls",
    title: "Purple Balls",
    subtitle: "Le violet prend plus de place.",
    icon: "🟣",
    tone: "#a855f7",
    tags: ["chaos"],
    personality: { chaos: 0.8 },
    apply: (config, context) => multiplyCurrentWeights(config, context, { purple: 2.8 }),
  },
  {
    id: "stronger_boss",
    title: "Stronger Boss",
    subtitle: "Le boss encaisse davantage.",
    icon: "🛡️",
    tone: "#f97316",
    tags: ["bossFocus", "survival"],
    personality: { bossFocus: 1, survival: 0.2 },
    apply: (config, context) => patchBossLevel(config, context, { hp: 140, maxHp: 140 }),
  },
  {
    id: "purple_swarm",
    title: "Purple Swarm",
    subtitle: "Synergie: violet + chaos.",
    icon: "🟪",
    tone: "#9333ea",
    tags: ["chaos", "synergy"],
    personality: { chaos: 1.4 },
    kind: "synergy",
    apply: (config, context) => multiplyCurrentWeights(config, context, { purple: 4, pink: 1.6 }),
  },
  {
    id: "hardcore",
    title: "Hardcore",
    subtitle: "Synergie: peu de tirs, boss solide.",
    icon: "🧱",
    tone: "#fb923c",
    tags: ["precision", "bossFocus", "synergy"],
    personality: { precision: 1, bossFocus: 1 },
    kind: "synergy",
    apply: (config, context) => patchBossLevel(patchCurrentLevel(config, context, { ammo_count: Math.max(5, Math.round(((config.levels?.list[context.currentLevelIndex]?.ammo_count ?? 40) * 0.6))) }), context, { hp: 155, maxHp: 155 }),
  },
  {
    id: "arena_panic",
    title: "Arena Panic",
    subtitle: "Synergie: boss rapide + chaos.",
    icon: "🚨",
    tone: "#ef4444",
    tags: ["chaos", "bossFocus", "synergy"],
    personality: { chaos: 1, bossFocus: 1 },
    kind: "synergy",
    apply: (config, context) => patchBossLevel(patchOrange(config, { spawn: { interval_seconds: Math.max(0.35, config.gameplay.orange.spawn.interval_seconds * 0.85) } }), context, { horizontal_speed: 22 }),
  },
  {
    id: "bullet_party",
    title: "Bullet Party",
    subtitle: "Synergie: plus de tirs + chaos lisible.",
    icon: "🎉",
    tone: "#2dd4bf",
    tags: ["chaos", "survival", "synergy"],
    personality: { chaos: 1, survival: 0.7 },
    kind: "synergy",
    apply: (config, context) => multiplyCurrentWeights(patchCurrentLevel(config, context, { ammo_count: Math.round(((config.levels?.list[context.currentLevelIndex]?.ammo_count ?? 40) * 1.45)) }), context, { purple: 2.2, pink: 1.6 }),
  },
  {
    id: "add_evolution",
    title: "Add / Evolution",
    subtitle: "Demander une idée que le moteur ne sait pas encore faire.",
    icon: "+",
    tone: "#66ffbb",
    tags: ["experimentation"],
    personality: { experimentation: 0.5 },
    kind: "add",
    evolutionPrompt: "Propose une évolution compatible avec la partie actuelle, sans coût, sans hasard rare, et en utilisant les systèmes existants quand c'est possible.",
  },
];

export const CHANGE_NODE_BY_ID = new Map(CHANGE_MODIFIER_NODES.map((node) => [node.id, node]));

export function modifierTraits(modifierId: string): PersonalityPatch {
  return CHANGE_NODE_BY_ID.get(modifierId)?.personality ?? {};
}
