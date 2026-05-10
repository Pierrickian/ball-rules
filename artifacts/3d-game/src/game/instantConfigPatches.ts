import { BallSize } from "../engine/types";
import type { BallColor, GameConfig, LevelEntry } from "../engine/types";
import type { FeatureIntent } from "./featureCapabilities";

export type InstantPlaytestTarget =
  | { kind: "level"; levelId: number }
  | { kind: "boss"; levelId: number }
  | { kind: "temporaryBall"; levelConfig: LevelEntry; color: BallColor };

export interface InstantConfigPatchResult {
  nextConfig: GameConfig;
  summary: string;
  requiresReset: boolean;
  playtestTarget: InstantPlaytestTarget;
}

export const SUPPORTED_INSTANT_CONFIG_CAPABILITIES = new Set([
  "level.timer_seconds",
  "level.ammo_count",
  "level.launch_color_weights",
  "timer_seconds",
  "ammo_count",
  "launch_color_weights",
  "spawnWeight",
  "ball.spawnWeight",
  "size",
  "ball.size",
  "boss.hp",
  "boss.maxHp",
  "boss.horizontal_speed",
  "boss.spawn_count",
]);


function optionalLevelId(intent: FeatureIntent): number | undefined {
  const raw = intent.context?.levelId;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const levelId = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(levelId)) throw new Error("Choose a valid level before applying this instant change.");
  return levelId;
}

function requireBallColor(config: GameConfig, intent: FeatureIntent): BallColor {
  const raw = intent.context?.color;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Choose a ball before applying this instant playtest.");
  }
  const color = raw as BallColor;
  const ballConfig = config.ball_colors[color];
  if (!ballConfig || color.startsWith("_")) throw new Error(`Unknown ball color "${raw}".`);
  if (ballConfig.system_role) {
    throw new Error(`${ballConfig._label ?? color} is a system ball and cannot be launched as a temporary ball playtest yet.`);
  }
  if (!ballConfig.for_terrain) {
    throw new Error(`${ballConfig._label ?? color} is not marked as a terrain ball, so it cannot be safely launched by the orange launcher yet.`);
  }
  if (!config.ball_rules?.[color]) {
    throw new Error(`${ballConfig._label ?? color} does not have a terrain ball rule yet, so Apply Instantly cannot safely playtest it.`);
  }
  return color;
}

function ballLabel(config: GameConfig, color: BallColor): string {
  return config.ball_colors[color]?._label ?? color;
}

function nextTemporaryLevelId(config: GameConfig): number {
  const ids = (config.levels?.list ?? []).map((level) => level.id).filter(Number.isFinite);
  return Math.max(0, ...ids) + 1;
}

function isBallPlaytestCapability(key: string): boolean {
  return key === "spawnWeight"
    || key === "ball.spawnWeight"
    || key === "size"
    || key === "ball.size"
    || key === "launch_color_weights"
    || key === "level.launch_color_weights";
}

function sizeValue(value: unknown): BallSize {
  if (value !== BallSize.SMALL && value !== BallSize.MEDIUM && value !== BallSize.LARGE) {
    throw new Error("Ball size must be one of: small, medium, large.");
  }
  return value;
}

function patchLevelBallSpawnWeight(config: GameConfig, levelId: number, color: BallColor, weight: number): GameConfig {
  const level = config.levels?.list?.find((entry) => entry.id === levelId);
  if (!level) throw new Error(`Level ${levelId} was not found.`);
  const nextWeights: Partial<Record<BallColor, number>> = { ...(level.launch_color_weights ?? {}), [color]: weight };
  if (!Object.values(nextWeights).some((entry) => typeof entry === "number" && entry > 0)) {
    throw new Error("At least one launch weight on the selected level must remain greater than zero.");
  }
  return patchLevel(config, levelId, { launch_color_weights: nextWeights });
}

function patchLevelBallSize(config: GameConfig, levelId: number, color: BallColor, size: BallSize): GameConfig {
  const level = config.levels?.list?.find((entry) => entry.id === levelId);
  if (!level) throw new Error(`Level ${levelId} was not found.`);
  return patchLevel(config, levelId, {
    launch_overrides: {
      ...(level.launch_overrides ?? {}),
      [color]: {
        ...(level.launch_overrides?.[color] ?? {}),
        size,
      },
    },
  });
}

function withFastTemporaryBallLauncher(config: GameConfig): GameConfig {
  return {
    ...config,
    gameplay: {
      ...config.gameplay,
      orange: {
        ...config.gameplay.orange,
        launch_delay_seconds: 0,
        spawn: {
          ...config.gameplay.orange.spawn,
          interval_seconds: 0.15,
        },
      },
    } as GameConfig["gameplay"],
    game_session: {
      ...config.game_session,
      max_balls_spawned: Math.max(24, config.game_session?.max_balls_spawned ?? 0),
    },
  };
}

function buildTemporaryBallLevel(config: GameConfig, color: BallColor, size?: BallSize): LevelEntry {
  const label = ballLabel(config, color);
  return {
    id: nextTemporaryLevelId(config),
    name: `Instant Test — ${label}`,
    description: `Runtime-only playtest that immediately launches ${label} balls with a focused 100% color weight.`,
    launch_color_weights: { [color]: 1 },
    ...(size ? { launch_overrides: { [color]: { size } } } : {}),
    timer_seconds: 90,
    ammo_count: 99,
  };
}

function buildBallPlaytestPatch(config: GameConfig, intent: FeatureIntent, key: string, value: unknown): InstantConfigPatchResult {
  const color = requireBallColor(config, intent);
  const levelId = optionalLevelId(intent);
  let nextConfig = config;
  let sizeOverride: BallSize | undefined;
  let summaryDetail: string;

  if (key === "spawnWeight" || key === "ball.spawnWeight") {
    const spawnWeight = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(spawnWeight) || spawnWeight < 0) {
      throw new Error("Ball spawn weight must be a number greater than or equal to 0.");
    }
    if (levelId !== undefined) nextConfig = patchLevelBallSpawnWeight(nextConfig, levelId, color, spawnWeight);
    summaryDetail = levelId !== undefined
      ? `level ${levelId} ${ballLabel(config, color)} spawn weight is now ${spawnWeight}`
      : `${ballLabel(config, color)} spawn weight will be tested`;
  } else if (key === "size" || key === "ball.size") {
    sizeOverride = sizeValue(value);
    if (levelId !== undefined) nextConfig = patchLevelBallSize(nextConfig, levelId, color, sizeOverride);
    summaryDetail = levelId !== undefined
      ? `level ${levelId} ${ballLabel(config, color)} launch size is now ${sizeOverride}`
      : `${ballLabel(config, color)} launch size override is ${sizeOverride}`;
  } else if (key === "launch_color_weights" || key === "level.launch_color_weights") {
    if (levelId !== undefined) {
      const weights = value && typeof value === "object" && !Array.isArray(value)
        ? weightsValue(value, config)
        : { [color]: 1 };
      nextConfig = patchLevel(nextConfig, levelId, { launch_color_weights: weights });
    }
    summaryDetail = levelId !== undefined
      ? `level ${levelId} launch weights updated`
      : `${ballLabel(config, color)} launch weights will be tested`;
  } else {
    throw new Error(`The ball capability "${key}" is not safely patchable as a runtime playtest yet.`);
  }

  nextConfig = withFastTemporaryBallLauncher(nextConfig);
  const levelConfig = buildTemporaryBallLevel(nextConfig, color, sizeOverride);
  return {
    nextConfig,
    summary: `Applied for this session: ${summaryDetail}. Starting a temporary 100% ${ballLabel(config, color)} playtest now.`,
    requiresReset: true,
    playtestTarget: { kind: "temporaryBall", levelConfig, color },
  };
}

function requireLevelId(intent: FeatureIntent): number {
  const raw = intent.context?.levelId;
  const levelId = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(levelId)) throw new Error("Choose a level before applying this instant change.");
  return levelId;
}

function getSingleRequestedProperty(intent: FeatureIntent): [string, unknown] {
  const entries = Object.entries(intent.requestedProperties ?? {}).filter(([, value]) => value !== undefined);
  if (entries.length !== 1) throw new Error("Apply Instantly supports one config property at a time for now.");
  const [key, value] = entries[0];
  if (!SUPPORTED_INSTANT_CONFIG_CAPABILITIES.has(key)) {
    throw new Error(`The capability "${key}" is not supported by runtime config patches yet.`);
  }
  return [key, value];
}

function numberValue(value: unknown, label: string, min: number): number {
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next) || next < min) throw new Error(`${label} must be a number greater than or equal to ${min}.`);
  return Math.round(next);
}

function weightsValue(value: unknown, config: GameConfig): Partial<Record<BallColor, number>> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Launch color weights must be a JSON object like { \"white\": 1 }.");
  }

  const knownColors = new Set(Object.keys(config.ball_colors).filter((key) => !key.startsWith("_")));
  const weights: Partial<Record<BallColor, number>> = {};
  for (const [color, rawWeight] of Object.entries(parsed as Record<string, unknown>)) {
    if (!knownColors.has(color)) throw new Error(`Unknown ball color "${color}" in launch weights.`);
    const weight = typeof rawWeight === "number" ? rawWeight : Number(rawWeight);
    if (!Number.isFinite(weight) || weight < 0) throw new Error(`Weight for "${color}" must be a positive number.`);
    if (weight > 0) weights[color as BallColor] = weight;
  }
  if (Object.keys(weights).length === 0) throw new Error("At least one launch weight must be greater than zero.");
  return weights;
}

function patchLevel(config: GameConfig, levelId: number, patch: Partial<LevelEntry>): GameConfig {
  const levels = config.levels?.list ?? [];
  const found = levels.some((level) => level.id === levelId);
  if (!found) throw new Error(`Level ${levelId} was not found.`);
  return {
    ...config,
    levels: {
      ...config.levels,
      list: levels.map((level) => level.id === levelId ? { ...level, ...patch } : level),
    },
  };
}

function patchBoss(config: GameConfig, levelId: number, patch: Partial<NonNullable<LevelEntry["boss"]>>): GameConfig {
  const level = config.levels?.list?.find((entry) => entry.id === levelId);
  if (!level) throw new Error(`Level ${levelId} was not found.`);
  if (!level.boss) throw new Error(`Level ${levelId} does not have a boss to modify.`);
  return patchLevel(config, levelId, { boss: { ...level.boss, ...patch } });
}

export function buildInstantConfigPatch(config: GameConfig, intent: FeatureIntent): InstantConfigPatchResult {
  const [key, value] = getSingleRequestedProperty(intent);

  if (intent.context?.color && isBallPlaytestCapability(key)) {
    return buildBallPlaytestPatch(config, intent, key, value);
  }

  const levelId = requireLevelId(intent);

  if (key === "level.timer_seconds" || key === "timer_seconds") {
    const timerSeconds = numberValue(value, "Timer duration", 1);
    return {
      nextConfig: patchLevel(config, levelId, { timer_seconds: timerSeconds }),
      summary: `Applied for this session: level ${levelId} timer is now ${timerSeconds}s.`,
      requiresReset: true,
      playtestTarget: { kind: "level", levelId },
    };
  }

  if (key === "level.ammo_count" || key === "ammo_count") {
    const ammoCount = numberValue(value, "Ammo count", 1);
    return {
      nextConfig: patchLevel(config, levelId, { ammo_count: ammoCount }),
      summary: `Applied for this session: level ${levelId} ammo is now ${ammoCount}.`,
      requiresReset: true,
      playtestTarget: { kind: "level", levelId },
    };
  }

  if (key === "level.launch_color_weights" || key === "launch_color_weights") {
    const weights = weightsValue(value, config);
    return {
      nextConfig: patchLevel(config, levelId, { launch_color_weights: weights }),
      summary: `Applied for this session: level ${levelId} launch weights updated.`,
      requiresReset: true,
      playtestTarget: { kind: "level", levelId },
    };
  }

  if (key === "boss.hp") {
    const hp = numberValue(value, "Boss HP", 1);
    return {
      nextConfig: patchBoss(config, levelId, { hp }),
      summary: `Applied for this session: level ${levelId} boss HP is now ${hp}.`,
      requiresReset: true,
      playtestTarget: { kind: "boss", levelId },
    };
  }

  if (key === "boss.maxHp") {
    const maxHp = numberValue(value, "Boss max HP", 1);
    return {
      nextConfig: patchBoss(config, levelId, { maxHp }),
      summary: `Applied for this session: level ${levelId} boss max HP is now ${maxHp}.`,
      requiresReset: true,
      playtestTarget: { kind: "boss", levelId },
    };
  }

  if (key === "boss.horizontal_speed") {
    const horizontalSpeed = numberValue(value, "Boss horizontal speed", 0);
    return {
      nextConfig: patchBoss(config, levelId, { horizontal_speed: horizontalSpeed }),
      summary: `Applied for this session: level ${levelId} boss speed is now ${horizontalSpeed}.`,
      requiresReset: true,
      playtestTarget: { kind: "boss", levelId },
    };
  }

  if (key === "boss.spawn_count") {
    const spawnCount = numberValue(value, "Boss spawn count", 1);
    return {
      nextConfig: patchBoss(config, levelId, { spawn_count: spawnCount }),
      summary: `Applied for this session: level ${levelId} boss spawn count is now ${spawnCount}.`,
      requiresReset: true,
      playtestTarget: { kind: "boss", levelId },
    };
  }

  throw new Error(`The capability "${key}" is not supported by runtime config patches yet.`);
}
