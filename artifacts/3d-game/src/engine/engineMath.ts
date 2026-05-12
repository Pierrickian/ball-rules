import type { Ball } from "./Ball";
import type { BallColor, BallRule, GameConfig, GameEvent, Vec2 } from "./types";
import { BallSize } from "./types";

export type PendingCommand =
  | { type: "launch_grenade"; direction: Vec2; effect: string }
  | { type: "detonate_active_grenade" }
  | { type: "place_mine"; position: Vec2; effect: string };

export interface Arena2D {
  halfW: number;
  halfH: number;
}

export interface MagnetFieldParams {
  field_diameter_multiplier: number;
  attraction_strength: number;
  boost_speed_multiplier: number;
  boost_duration_seconds: number;
  contact_velocity_damping?: number;
}

export interface RuleContext {
  allBalls: Ball[];
  config: GameConfig;
  events: GameEvent[];
  arena: Arena2D;
  elapsedTime: number;
  logEnabled: boolean;
  spawnBall: (
    color: BallColor,
    size: BallSize,
    position: Vec2,
    velocity: Vec2,
    overrideRule?: BallRule,
    overrideHp?: { hp: number; maxHp: number }
  ) => Ball;
  despawnBall: (ball: Ball, reason: string) => void;
  damageBall: (ball: Ball, amount: number, reason?: string) => boolean;
  computeHpGrowDiameter: (ball: Ball) => number;
  getComboStreak: () => number;
  setComboStreak: (streak: number) => void;
  clearActiveGrenade: (grenadeId: string) => void;
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Pick a color from a weights map. Ignores zero/negative weights and unknown colors. */
export function weightedPickColor(
  config: GameConfig,
  weights: Partial<Record<BallColor, number>>
): BallColor | null {
  const entries: Array<[BallColor, number]> = [];
  let total = 0;
  for (const [k, v] of Object.entries(weights)) {
    const color = k as BallColor;
    const weight = typeof v === "number" ? v : 0;
    if (weight > 0 && config.ball_colors[color]) {
      entries.push([color, weight]);
      total += weight;
    }
  }
  if (entries.length === 0 || total <= 0) return null;
  let r = Math.random() * total;
  for (const [color, weight] of entries) {
    r -= weight;
    if (r <= 0) return color;
  }
  return entries[entries.length - 1][0];
}
