import type { FeatureCategory } from "./featureCapabilities";

export type IntensityIndex = 0 | 1 | 2 | 3;
export type MoodId = "epicBoss" | "levelTwist" | "ballFocus" | "ammoFlow" | "moreChaos";
export type ContextKind = "boss" | "level" | "ball";

export interface MoodChoice {
  id: MoodId;
  label: string;
  symbol: string;
  hint: string;
}

export interface RecipeChoice {
  id: string;
  mood: MoodId;
  label: string;
  symbol: string;
  hint: string;
  category: FeatureCategory;
  capabilityKey: string;
  context: ContextKind;
  values: readonly [unknown, unknown, unknown, unknown] | "selectedBallWeight";
}

export const INTENSITIES = ["Soft", "Fun", "Wild", "Insane"] as const;

export const MOODS: MoodChoice[] = [
  { id: "epicBoss", label: "Epic Boss", symbol: "👑", hint: "Make the boss legendary" },
  { id: "levelTwist", label: "Level Twist", symbol: "🏁", hint: "Remix the run" },
  { id: "ballFocus", label: "Ball Focus", symbol: "🔮", hint: "Spotlight one ball" },
  { id: "ammoFlow", label: "Ammo Flow", symbol: "🎯", hint: "Tune your shots" },
  { id: "moreChaos", label: "More Chaos", symbol: "🌀", hint: "Speed up the panic" },
];

export const RECIPES: RecipeChoice[] = [
  {
    id: "hugeBoss",
    mood: "epicBoss",
    label: "Huge Boss",
    symbol: "💪",
    hint: "Boss HP boost",
    category: "boss",
    capabilityKey: "boss.hp",
    context: "boss",
    values: [20, 50, 90, 150],
  },
  {
    id: "hyperBoss",
    mood: "epicBoss",
    label: "Hyper Boss",
    symbol: "⚡",
    hint: "Boss speed rush",
    category: "boss",
    capabilityKey: "boss.horizontal_speed",
    context: "boss",
    values: [4, 9, 16, 25],
  },
  {
    id: "bossSwarm",
    mood: "epicBoss",
    label: "Boss Swarm",
    symbol: "👾",
    hint: "More boss spawns",
    category: "boss",
    capabilityKey: "boss.spawn_count",
    context: "boss",
    values: [1, 2, 3, 5],
  },
  {
    id: "timePressure",
    mood: "levelTwist",
    label: "Time Pressure",
    symbol: "⏱️",
    hint: "Shorter clock",
    category: "level",
    capabilityKey: "timer_seconds",
    context: "level",
    values: [90, 60, 35, 20],
  },
  {
    id: "preciseRun",
    mood: "levelTwist",
    label: "Precise Run",
    symbol: "🎯",
    hint: "Fewer shots",
    category: "level",
    capabilityKey: "ammo_count",
    context: "level",
    values: [50, 25, 12, 6],
  },
  {
    id: "enemyCrowd",
    mood: "levelTwist",
    label: "Enemy Crowd",
    symbol: "👥",
    hint: "More enemy spawns",
    category: "level",
    capabilityKey: "max_balls_spawned",
    context: "level",
    values: [25, 40, 70, 100],
  },
  {
    id: "summonBall",
    mood: "ballFocus",
    label: "Summon Ball",
    symbol: "✨",
    hint: "100% selected ball",
    category: "level",
    capabilityKey: "launch_color_weights",
    context: "ball",
    values: "selectedBallWeight",
  },
  {
    id: "moreAmmo",
    mood: "ammoFlow",
    label: "More Ammo",
    symbol: "💥",
    hint: "Bigger magazine",
    category: "level",
    capabilityKey: "ammo_count",
    context: "level",
    values: [30, 60, 120, 240],
  },
  {
    id: "chaosLoop",
    mood: "moreChaos",
    label: "Chaos Loop",
    symbol: "🔥",
    hint: "Faster reboot loop",
    category: "level",
    capabilityKey: "timer_seconds",
    context: "level",
    values: [70, 45, 25, 15],
  },
  {
    id: "spawnRush",
    mood: "moreChaos",
    label: "Spawn Rush",
    symbol: "⏩",
    hint: "Faster enemy cadence",
    category: "level",
    capabilityKey: "spawn_interval_seconds",
    context: "level",
    values: [0.55, 0.4, 0.25, 0.12],
  },
];
