import type { GameConfig, GameState, ShotKind } from "./types";

export const DEFAULT_STATE: GameState = {
  balls: new Map(),
  events: [],
  time: 0,
  orangeSpawnTimer: 0,
  score: 0,
  launchedCount: 0,
  maxBallsSpawned: 20,
  sessionCleared: false,
  currentLevelIndex: 0,
  currentLevelId: 0,
  currentLevelName: "",
  timerSecondsRemaining: 60,
  ammoRemaining: 50,
  retryReason: null,
  isBossPhase: false,
};

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const DEFAULT_LEVEL_TIMER_SECONDS = 15;
export const DEFAULT_LEVEL_AMMO_COUNT = 50;
export const DEFAULT_DIFFICULTY: "easy" | "medium" | "hard" = "medium";
export const FALLBACK_DIFFICULTY_HP_PRESETS: Record<"easy" | "medium" | "hard", number> = { easy: 0, medium: 3, hard: 6 };

export function getDifficultyHpValue(config: GameConfig | null, difficulty: "easy" | "medium" | "hard"): number {
  return config?.gameplay_controls.difficulty_hp?.presets[difficulty] ?? FALLBACK_DIFFICULTY_HP_PRESETS[difficulty];
}

export function getDefaultDifficulty(config: GameConfig | null): "easy" | "medium" | "hard" {
  return config?.gameplay_controls.difficulty_hp?.default ?? DEFAULT_DIFFICULTY;
}

export function clampDifficultyHpValue(config: GameConfig | null, value: number): number {
  const min = config?.gameplay_controls.difficulty_hp?.min ?? -10;
  const max = config?.gameplay_controls.difficulty_hp?.max ?? 10;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function buildQueue(size: number, distribution: Record<ShotKind, number>): ShotKind[] {
  const weighted: ShotKind[] = [];
  (["light", "heavy", "mega"] as ShotKind[]).forEach((k) => {
    const n = Math.max(0, Math.round((distribution[k] ?? 0) * 100));
    for (let i = 0; i < n; i++) weighted.push(k);
  });
  if (weighted.length === 0) weighted.push("light");
  const out: ShotKind[] = [];
  for (let i = 0; i < size; i++) out.push(pickRandom(weighted));
  return out;
}
