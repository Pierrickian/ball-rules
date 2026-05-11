import type { BallColor, GameConfig, LevelEntry } from "../engine/types";

export type RunTwistId = "add_time" | "add_ammo" | "chaos_timer" | "dominant_ball" | "boss_next";

export interface RunTwistChoice {
  id: RunTwistId;
  titleKey: string;
  descriptionKey: string;
}

export interface AppliedRunTwist {
  nextConfig: GameConfig;
  nextLevelIndex: number;
  summary: string;
}

const RUN_TWIST_CHOICES: RunTwistChoice[] = [
  { id: "add_time", titleKey: "run.twist.addTime.title", descriptionKey: "run.twist.addTime.description" },
  { id: "add_ammo", titleKey: "run.twist.addAmmo.title", descriptionKey: "run.twist.addAmmo.description" },
  { id: "chaos_timer", titleKey: "run.twist.chaosTimer.title", descriptionKey: "run.twist.chaosTimer.description" },
  { id: "dominant_ball", titleKey: "run.twist.dominantBall.title", descriptionKey: "run.twist.dominantBall.description" },
  { id: "boss_next", titleKey: "run.twist.bossNext.title", descriptionKey: "run.twist.bossNext.description" },
];

function cloneConfig(config: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(config)) as GameConfig;
}

function seededIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

function orderedChoices(currentLevelIndex: number, selectedTwists: string[]) {
  const seed = `${currentLevelIndex}:${selectedTwists.join("|")}:${Date.now()}`;
  const start = seededIndex(seed, RUN_TWIST_CHOICES.length);
  return RUN_TWIST_CHOICES.map((_, offset) => RUN_TWIST_CHOICES[(start + offset) % RUN_TWIST_CHOICES.length]);
}

function hasLaterBoss(config: GameConfig, nextLevelIndex: number): boolean {
  const levels = config.levels?.list ?? [];
  return levels.some((level, index) => index >= nextLevelIndex && Boolean(level.boss));
}

function getValidTerrainColors(config: GameConfig, level: LevelEntry | undefined): BallColor[] {
  const fromWeights = Object.keys(level?.launch_color_weights ?? {}) as BallColor[];
  const fromRules = Object.keys(config.ball_rules ?? {}) as BallColor[];
  const seen = new Set<BallColor>([...fromWeights, ...fromRules]);
  return [...seen].filter((color) => {
    const colorConfig = config.ball_colors[color];
    return Boolean(colorConfig?.for_terrain && !colorConfig.system_role && config.ball_rules[color]);
  });
}

function pickTerrainColor(config: GameConfig, level: LevelEntry | undefined, seed: string): BallColor | null {
  const colors = getValidTerrainColors(config, level);
  if (colors.length === 0) return null;
  return colors[seededIndex(seed, colors.length)];
}

function withNextLevel(config: GameConfig, currentLevelIndex: number, updater: (level: LevelEntry) => LevelEntry): GameConfig {
  const levels = config.levels?.list ?? [];
  if (levels.length === 0) return config;
  const nextLevelIndex = (currentLevelIndex + 1) % levels.length;
  const list = levels.map((level, index) => index === nextLevelIndex ? updater(level) : level);
  return { ...config, levels: { ...config.levels, list } };
}

export function getDefaultNextLevelIndex(config: GameConfig, currentLevelIndex: number): number {
  const levelCount = config.levels?.list?.length ?? 0;
  if (levelCount === 0) return 0;
  return (currentLevelIndex + 1) % levelCount;
}

export function getTwistChoices(config: GameConfig, currentLevelIndex: number, selectedTwists: string[]): RunTwistChoice[] {
  const recent = new Set(selectedTwists.slice(-2));
  const preferred = orderedChoices(currentLevelIndex, selectedTwists).filter((choice) => !recent.has(choice.id));
  const pool = preferred.length >= 2 ? preferred : orderedChoices(currentLevelIndex + 1, selectedTwists);
  const nextLevelIndex = getDefaultNextLevelIndex(config, currentLevelIndex);
  const safePool = pool.filter((choice) => choice.id !== "boss_next" || hasLaterBoss(config, nextLevelIndex));
  const finalPool = safePool.length >= 2 ? safePool : pool;
  return finalPool.slice(0, 2);
}

export function applyRunTwist(config: GameConfig, currentLevelIndex: number, twist: RunTwistChoice): AppliedRunTwist {
  const levels = config.levels?.list ?? [];
  const defaultNextLevelIndex = getDefaultNextLevelIndex(config, currentLevelIndex);
  if (levels.length === 0) {
    return { nextConfig: config, nextLevelIndex: 0, summary: "No level available" };
  }

  if (twist.id === "boss_next") {
    const target = levels.findIndex((level, index) => index >= defaultNextLevelIndex && Boolean(level.boss));
    return {
      nextConfig: config,
      nextLevelIndex: target >= 0 ? target : defaultNextLevelIndex,
      summary: "Boss level prioritized",
    };
  }

  const nextConfig = cloneConfig(config);
  const nextLevel = nextConfig.levels?.list?.[defaultNextLevelIndex];
  if (!nextLevel) {
    return { nextConfig, nextLevelIndex: defaultNextLevelIndex, summary: "Next level kept" };
  }

  if (twist.id === "add_time") {
    nextLevel.timer_seconds = (nextLevel.timer_seconds ?? 60) + 20;
    return { nextConfig, nextLevelIndex: defaultNextLevelIndex, summary: "+20 seconds on next level" };
  }

  if (twist.id === "add_ammo") {
    nextLevel.ammo_count = (nextLevel.ammo_count ?? 50) + 10;
    return { nextConfig, nextLevelIndex: defaultNextLevelIndex, summary: "+10 ammo on next level" };
  }

  if (twist.id === "chaos_timer") {
    nextLevel.timer_seconds = Math.max(15, (nextLevel.timer_seconds ?? 60) - 15);
    const dominant = pickTerrainColor(nextConfig, nextLevel, `${currentLevelIndex}:${twist.id}:chaos`);
    if (dominant) {
      nextLevel.launch_color_weights = { ...nextLevel.launch_color_weights, [dominant]: Math.max(8, (nextLevel.launch_color_weights[dominant] ?? 1) * 2) };
    }
    return { nextConfig, nextLevelIndex: defaultNextLevelIndex, summary: "Shorter timer with a stronger terrain weight" };
  }

  if (twist.id === "dominant_ball") {
    const dominant = pickTerrainColor(nextConfig, nextLevel, `${currentLevelIndex}:${twist.id}:${Date.now()}`);
    if (dominant) {
      nextLevel.launch_color_weights = { ...nextLevel.launch_color_weights, [dominant]: Math.max(10, (nextLevel.launch_color_weights[dominant] ?? 1) * 3) };
    }
    return { nextConfig, nextLevelIndex: defaultNextLevelIndex, summary: "One terrain ball is dominant next level" };
  }

  return { nextConfig: withNextLevel(config, currentLevelIndex, (level) => level), nextLevelIndex: defaultNextLevelIndex, summary: "Twist applied" };
}
