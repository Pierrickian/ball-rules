import type { BallColor, GameConfig, LevelEntry } from "../../engine/types";

export type ChangeReason = "manual" | "level_clear" | "boss_clear" | "failure";

export type ChangeContext = {
  currentLevelIndex: number;
  currentLevelId: number;
  nextLevelIndex: number;
  isBossPhase: boolean;
  reason: ChangeReason;
};

export type ChangeModifierResult = {
  config: GameConfig;
  nextLevelIndex?: number;
  promptKey?: string;
};

export type ChangeModifier = {
  id: string;
  labelKey: string;
  apply: (config: GameConfig, context: ChangeContext) => ChangeModifierResult;
};

export type ChangeApplyResult = {
  nextConfig: GameConfig;
  nextLevelIndex: number;
  appliedModifierIds: string[];
  promptKeys: string[];
};

function cloneConfig(config: GameConfig): GameConfig {
  return JSON.parse(JSON.stringify(config)) as GameConfig;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function targetLevelIndex(config: GameConfig, context: ChangeContext): number {
  const levels = config.levels?.list ?? [];
  if (levels.length === 0) return 0;
  return ((context.nextLevelIndex % levels.length) + levels.length) % levels.length;
}

function updateTargetLevel(config: GameConfig, context: ChangeContext, updater: (level: LevelEntry) => LevelEntry): GameConfig {
  const levels = config.levels?.list ?? [];
  if (levels.length === 0) return config;
  const index = targetLevelIndex(config, context);
  const list = levels.map((level, levelIndex) => levelIndex === index ? updater(level) : level);
  return { ...config, levels: { ...config.levels, list } };
}

function validTerrainColors(config: GameConfig, level: LevelEntry | undefined): BallColor[] {
  const weighted = Object.keys(level?.launch_color_weights ?? {}) as BallColor[];
  const ruled = Object.keys(config.ball_rules ?? {}) as BallColor[];
  const colors = new Set<BallColor>([...weighted, ...ruled]);
  return [...colors].filter((color) => {
    const meta = config.ball_colors[color];
    return Boolean(meta?.for_terrain && !meta.system_role && config.ball_rules[color]);
  });
}

function pickTerrainColor(config: GameConfig, level: LevelEntry | undefined, salt: string): BallColor | null {
  const colors = validTerrainColors(config, level);
  if (colors.length === 0) return null;
  return colors[seededIndex(salt, colors.length)];
}

function amplifyWeight(level: LevelEntry, config: GameConfig, factor: number, minimum: number, salt: string): LevelEntry {
  const color = pickTerrainColor(config, level, salt);
  if (!color) return level;
  return {
    ...level,
    launch_color_weights: {
      ...level.launch_color_weights,
      [color]: Math.max(minimum, (level.launch_color_weights[color] ?? 1) * factor),
    },
  };
}

function softenWeight(level: LevelEntry, config: GameConfig, salt: string): LevelEntry {
  const color = pickTerrainColor(config, level, salt);
  if (!color) return level;
  const nextWeights = { ...level.launch_color_weights };
  nextWeights[color] = Math.max(0, (nextWeights[color] ?? 1) * 0.25);
  return { ...level, launch_color_weights: nextWeights };
}

function rebalanceWeights(level: LevelEntry, config: GameConfig): LevelEntry {
  const colors = validTerrainColors(config, level);
  if (colors.length === 0) return level;
  const launch_color_weights = colors.reduce<Partial<Record<BallColor, number>>>((acc, color) => {
    acc[color] = 1;
    return acc;
  }, {});
  return { ...level, launch_color_weights };
}

function findBossLevel(config: GameConfig, startIndex: number): number | null {
  const levels = config.levels?.list ?? [];
  if (levels.length === 0) return null;
  for (let offset = 0; offset < levels.length; offset += 1) {
    const index = (startIndex + offset) % levels.length;
    if (levels[index]?.boss) return index;
  }
  return null;
}

function updateTargetBoss(config: GameConfig, context: ChangeContext, updater: (level: LevelEntry) => LevelEntry): ChangeModifierResult {
  const levels = config.levels?.list ?? [];
  const start = targetLevelIndex(config, context);
  const bossIndex = levels[start]?.boss ? start : findBossLevel(config, start);
  if (bossIndex === null) return { config };
  const list = levels.map((level, index) => index === bossIndex ? updater(level) : level);
  return { config: { ...config, levels: { ...config.levels, list } }, nextLevelIndex: bossIndex };
}

function withProjectileDistribution(config: GameConfig, distribution: Record<"light" | "heavy" | "mega", number>): GameConfig {
  return {
    ...config,
    gameplay_controls: {
      ...config.gameplay_controls,
      player_projectile_distribution: distribution,
    },
  };
}

export const CHANGE_MODIFIERS: Record<string, ChangeModifier> = {
  dominant_ball: {
    id: "dominant_ball",
    labelKey: "change.node.add",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => amplifyWeight(level, config, 2.5, 8, `${context.currentLevelIndex}:dominant`)) }),
  },
  remove_ball: {
    id: "remove_ball",
    labelKey: "change.node.remove",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => softenWeight(level, config, `${context.currentLevelIndex}:remove`)) }),
  },
  accelerate_ball: {
    id: "accelerate_ball",
    labelKey: "change.node.accelerate",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...amplifyWeight(level, config, 1.8, 6, "accelerate"), spawn_interval_seconds: Math.max(0.25, (level.spawn_interval_seconds ?? config.gameplay.orange.spawn.interval_seconds ?? 1) * 0.85) })) }),
  },
  decelerate_ball: {
    id: "decelerate_ball",
    labelKey: "change.node.decelerate",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...softenWeight(level, config, "decelerate"), spawn_interval_seconds: (level.spawn_interval_seconds ?? config.gameplay.orange.spawn.interval_seconds ?? 1) * 1.2 })) }),
  },
  stronger_ball: {
    id: "stronger_ball",
    labelKey: "change.node.stronger",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...amplifyWeight(level, config, 2, 7, "stronger"), max_balls_spawned: (level.max_balls_spawned ?? config.game_session.max_balls_spawned ?? 20) + 3 })) }),
  },
  weaker_ball: {
    id: "weaker_ball",
    labelKey: "change.node.weaker",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...softenWeight(level, config, "weaker"), max_balls_spawned: Math.max(3, (level.max_balls_spawned ?? config.game_session.max_balls_spawned ?? 20) - 3) })) }),
  },
  rebalance_ball: {
    id: "rebalance_ball",
    labelKey: "change.node.rebalance",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => rebalanceWeights(level, config)) }),
  },
  new_ball: {
    id: "new_ball",
    labelKey: "change.node.newBall",
    apply: (config) => ({ config, promptKey: "change.prompt.newBall" }),
  },
  add_skill: {
    id: "add_skill",
    labelKey: "change.node.addSkill",
    apply: (config) => ({ config, promptKey: "change.prompt.addSkill" }),
  },
  less_time: {
    id: "less_time",
    labelKey: "change.node.lessTime",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, timer_seconds: Math.max(15, (level.timer_seconds ?? 60) - 15) })) }),
  },
  more_time: {
    id: "more_time",
    labelKey: "change.node.moreTime",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, timer_seconds: (level.timer_seconds ?? 60) + 20 })) }),
  },
  faster_restart: {
    id: "faster_restart",
    labelKey: "change.node.fasterRestart",
    apply: (config) => ({ config: { ...config, game_session: { ...config.game_session, reboot_delay_seconds: Math.max(0.4, (config.game_session.reboot_delay_seconds ?? 1.5) - 0.3) } } }),
  },
  time_pressure: {
    id: "time_pressure",
    labelKey: "change.node.timePressure",
    apply: (config, context) => CHANGE_MODIFIERS.less_time.apply(updateTargetLevel(config, context, (level) => amplifyWeight(level, config, 1.5, 5, "pressure")), context),
  },
  slower_pace: {
    id: "slower_pace",
    labelKey: "change.node.slowerPace",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, spawn_interval_seconds: (level.spawn_interval_seconds ?? config.gameplay.orange.spawn.interval_seconds ?? 1) * 1.25 })) }),
  },
  relaxed_timer: {
    id: "relaxed_timer",
    labelKey: "change.node.relaxedTimer",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, timer_seconds: (level.timer_seconds ?? 60) + 35 })) }),
  },
  random_timer: {
    id: "random_timer",
    labelKey: "change.node.randomTimer",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, timer_seconds: 25 + seededIndex(`${Date.now()}:timer`, 76) })) }),
  },
  short_burst: {
    id: "short_burst",
    labelKey: "change.node.shortBurst",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, timer_seconds: 25, ammo_count: Math.max(8, level.ammo_count ?? 30) })) }),
  },
  long_challenge: {
    id: "long_challenge",
    labelKey: "change.node.longChallenge",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => amplifyWeight({ ...level, timer_seconds: (level.timer_seconds ?? 60) + 40 }, config, 1.6, 6, "long")) }),
  },
  less_ammo: {
    id: "less_ammo",
    labelKey: "change.node.lessAmmo",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, ammo_count: Math.max(3, (level.ammo_count ?? 50) - 10) })) }),
  },
  more_ammo: {
    id: "more_ammo",
    labelKey: "change.node.moreAmmo",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, ammo_count: (level.ammo_count ?? 50) + 10 })) }),
  },
  precision_shots: {
    id: "precision_shots",
    labelKey: "change.node.precisionShots",
    apply: (config, context) => CHANGE_MODIFIERS.less_ammo.apply(withProjectileDistribution(config, { light: 0.35, heavy: 0.45, mega: 0.2 }), context),
  },
  no_waste: {
    id: "no_waste",
    labelKey: "change.node.noWaste",
    apply: (config, context) => CHANGE_MODIFIERS.less_ammo.apply(config, context),
  },
  bonus_ammo: {
    id: "bonus_ammo",
    labelKey: "change.node.bonusAmmo",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, ammo_count: (level.ammo_count ?? 50) + 18 })) }),
  },
  practice_shots: {
    id: "practice_shots",
    labelKey: "change.node.practiceShots",
    apply: (config, context) => CHANGE_MODIFIERS.more_ammo.apply(withProjectileDistribution(config, { light: 0.75, heavy: 0.2, mega: 0.05 }), context),
  },
  random_ammo: {
    id: "random_ammo",
    labelKey: "change.node.randomAmmo",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => ({ ...level, ammo_count: 8 + seededIndex(`${Date.now()}:ammo`, 63) })) }),
  },
  mega_focus: {
    id: "mega_focus",
    labelKey: "change.node.megaFocus",
    apply: (config) => ({ config: withProjectileDistribution(config, { light: 0.2, heavy: 0.3, mega: 0.5 }) }),
  },
  light_focus: {
    id: "light_focus",
    labelKey: "change.node.lightFocus",
    apply: (config) => ({ config: withProjectileDistribution(config, { light: 0.9, heavy: 0.08, mega: 0.02 }) }),
  },
  boss_next: {
    id: "boss_next",
    labelKey: "change.node.bossNext",
    apply: (config, context) => ({ config, nextLevelIndex: findBossLevel(config, targetLevelIndex(config, context)) ?? context.nextLevelIndex }),
  },
  random_boss_level: {
    id: "random_boss_level",
    labelKey: "change.node.randomBoss",
    apply: (config, context) => {
      const bosses = (config.levels?.list ?? []).map((level, index) => ({ level, index })).filter(({ level }) => level.boss);
      return { config, nextLevelIndex: bosses[seededIndex(`${Date.now()}:boss`, bosses.length)]?.index ?? context.nextLevelIndex };
    },
  },
  boss_color_change: {
    id: "boss_color_change",
    labelKey: "change.node.bossColor",
    apply: (config) => ({ config, promptKey: "change.prompt.bossColor" }),
  },
  bigger_boss: {
    id: "bigger_boss",
    labelKey: "change.node.biggerBoss",
    apply: (config, context) => updateTargetBoss(config, context, (level) => level.boss ? { ...level, boss: { ...level.boss, hp: Math.ceil(level.boss.hp * 1.25), maxHp: Math.ceil((level.boss.maxHp ?? level.boss.hp) * 1.25) } } : level),
  },
  faster_boss: {
    id: "faster_boss",
    labelKey: "change.node.fasterBoss",
    apply: (config, context) => updateTargetBoss(config, context, (level) => level.boss ? { ...level, boss: { ...level.boss, horizontal_speed: (level.boss.horizontal_speed ?? 8) * 1.2 } } : level),
  },
  boss_swarm: {
    id: "boss_swarm",
    labelKey: "change.node.bossSwarm",
    apply: (config, context) => updateTargetBoss(config, context, (level) => level.boss ? { ...level, boss: { ...level.boss, spawn_count: clamp((level.boss.spawn_count ?? 1) + 1, 1, 8) } } : level),
  },
  weaker_boss: {
    id: "weaker_boss",
    labelKey: "change.node.weakerBoss",
    apply: (config, context) => updateTargetBoss(config, context, (level) => level.boss ? { ...level, boss: { ...level.boss, hp: Math.max(1, Math.floor(level.boss.hp * 0.75)), maxHp: Math.max(1, Math.floor((level.boss.maxHp ?? level.boss.hp) * 0.75)) } } : level),
  },
  slower_boss: {
    id: "slower_boss",
    labelKey: "change.node.slowerBoss",
    apply: (config, context) => updateTargetBoss(config, context, (level) => level.boss ? { ...level, boss: { ...level.boss, horizontal_speed: Math.max(1, (level.boss.horizontal_speed ?? 8) * 0.8) } } : level),
  },
  fewer_bosses: {
    id: "fewer_bosses",
    labelKey: "change.node.fewerBosses",
    apply: (config, context) => updateTargetBoss(config, context, (level) => level.boss ? { ...level, boss: { ...level.boss, spawn_count: Math.max(1, (level.boss.spawn_count ?? 1) - 1) } } : level),
  },
  jump_level: {
    id: "jump_level",
    labelKey: "change.node.jumpLevel",
    apply: (config, context) => ({ config, nextLevelIndex: targetLevelIndex(config, { ...context, nextLevelIndex: context.nextLevelIndex + 1 }) }),
  },
  random_level: {
    id: "random_level",
    labelKey: "change.node.randomLevel",
    apply: (config, context) => ({ config, nextLevelIndex: seededIndex(`${Date.now()}:level`, config.levels?.list?.length ?? 1) }),
  },
  harder_distribution: {
    id: "harder_distribution",
    labelKey: "change.node.dangerWeights",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => amplifyWeight(level, config, 2.2, 8, "harder_distribution")) }),
  },
  easier_distribution: {
    id: "easier_distribution",
    labelKey: "change.node.easyWeights",
    apply: (config, context) => ({ config: updateTargetLevel(config, context, (level) => softenWeight(level, config, "easier_distribution")) }),
  },
};

export function applyChangeModifiers(config: GameConfig, context: ChangeContext, modifierIds: string[]): ChangeApplyResult {
  let nextConfig = cloneConfig(config);
  let nextLevelIndex = targetLevelIndex(nextConfig, context);
  const appliedModifierIds: string[] = [];
  const promptKeys: string[] = [];

  for (const id of modifierIds) {
    const modifier = CHANGE_MODIFIERS[id];
    if (!modifier) continue;
    const result = modifier.apply(nextConfig, { ...context, nextLevelIndex });
    nextConfig = result.config;
    if (typeof result.nextLevelIndex === "number") nextLevelIndex = targetLevelIndex(nextConfig, { ...context, nextLevelIndex: result.nextLevelIndex });
    if (result.promptKey) promptKeys.push(result.promptKey);
    appliedModifierIds.push(id);
  }

  return { nextConfig, nextLevelIndex, appliedModifierIds, promptKeys };
}
