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
  "boss.hp",
  "boss.maxHp",
  "boss.horizontal_speed",
  "boss.spawn_count",
]);

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
