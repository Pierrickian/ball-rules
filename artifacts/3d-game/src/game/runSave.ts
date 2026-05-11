import type { GameConfig } from "../engine/types";

export const SAVED_RUN_STORAGE_KEY = "ball_game_saved_run";

export type SavedRun = {
  saveVersion: 1;
  runId: string;
  currentLevelIndex: number;
  selectedTwists: string[];
  runtimeConfig: GameConfig;
  createdAt: number;
  updatedAt: number;
};

function isSavedRun(value: unknown): value is SavedRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<SavedRun>;
  return run.saveVersion === 1 &&
    typeof run.runId === "string" &&
    typeof run.currentLevelIndex === "number" &&
    Array.isArray(run.selectedTwists) &&
    Boolean(run.runtimeConfig) &&
    typeof run.createdAt === "number" &&
    typeof run.updatedAt === "number";
}

export function createRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadSavedRun(): SavedRun | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(SAVED_RUN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isSavedRun(parsed)) return parsed;
  } catch (err) {
    console.warn("[RunSave] Invalid saved run ignored", err);
  }
  localStorage.removeItem(SAVED_RUN_STORAGE_KEY);
  return null;
}

export function saveRun(run: SavedRun): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SAVED_RUN_STORAGE_KEY, JSON.stringify(run));
}

export function clearSavedRun(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SAVED_RUN_STORAGE_KEY);
}
