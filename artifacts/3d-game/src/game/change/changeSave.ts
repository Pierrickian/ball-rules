import type { GameConfig } from "../../engine/types";

export const CHANGE_SAVE_STORAGE_KEY = "ball_game_saved_run";

export type SavedChangeSession = {
  saveVersion: 1;
  sessionId: string;
  currentLevelIndex: number;
  selectedModifiers: string[];
  runtimeConfig: GameConfig;
  createdAt: number;
  updatedAt: number;
};

function isSavedChangeSession(value: unknown): value is SavedChangeSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<SavedChangeSession>;
  return session.saveVersion === 1 &&
    typeof session.sessionId === "string" &&
    typeof session.currentLevelIndex === "number" &&
    Array.isArray(session.selectedModifiers) &&
    Boolean(session.runtimeConfig) &&
    typeof session.createdAt === "number" &&
    typeof session.updatedAt === "number";
}

export function createChangeSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `change_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadSavedChangeSession(): SavedChangeSession | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(CHANGE_SAVE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isSavedChangeSession(parsed)) return parsed;
  } catch (err) {
    console.warn("[ChangeSave] Invalid saved session ignored", err);
  }
  localStorage.removeItem(CHANGE_SAVE_STORAGE_KEY);
  return null;
}

export function saveChangeSession(session: SavedChangeSession): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CHANGE_SAVE_STORAGE_KEY, JSON.stringify(session));
}

export function clearSavedChangeSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CHANGE_SAVE_STORAGE_KEY);
}
