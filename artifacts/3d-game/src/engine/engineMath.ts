import type { BallColor, GameConfig, Vec2 } from "./types";

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
