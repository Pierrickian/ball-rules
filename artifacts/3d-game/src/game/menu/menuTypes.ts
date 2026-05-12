import type { BallColor, EvolutionRequestConfig, GameConfig } from "../../engine/types";
import type { RuntimeModifiers } from "../../engine/runtimeModifiers";

export type MenuView = "main" | "settings" | "change" | "evolution" | "rules" | "balls" | "terrain" | "player_colors" | "how_to_ask" | "release_notes" | "levels" | "boss" | "effects" | "difficulty";

const APK_DOWNLOAD_URL = "https://github.com/Pierrickian/ball-rules/releases/latest/download/ball-rules.apk";

export type Difficulty = "easy" | "medium" | "hard";
export const FALLBACK_DIFFICULTY_HP_PRESETS: Record<Difficulty, number> = { easy: 0, medium: 3, hard: 6 };

export function difficultyHpSettings(config: GameConfig) {
  return config.gameplay_controls.difficulty_hp ?? {
    min: -10,
    max: 10,
    presets: FALLBACK_DIFFICULTY_HP_PRESETS,
    default: "medium" as Difficulty,
  };
}
export interface MenuProps {
  config: GameConfig;
  onClose: () => void;
  onArenaChange: (width: number, height: number) => void;
  onTerrainDistributionPlay: (weights: Record<BallColor, number>) => void;
  /** Jump to a specific story-mode level (0-based index). Resets the game. */
  onLevelSelect: (index: number) => void;
  onLevelWeightsChange: (index: number, weights: Record<BallColor, number>) => void;
  onPlayBossRush: (levelIds: number[]) => void;
  onApplyInstantConfig: (nextConfig: GameConfig, options?: { reset?: boolean; playtestTarget?: unknown }) => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
  difficulty: Difficulty;
  hpAdjustment: number;
  onHpAdjustmentChange: (adjustment: number) => void;
  evolutionRequest?: EvolutionRequestConfig;
  evolutionInitialText?: string;
  currentLevelNumber: number;
  /** Index 0-based of the currently active level, or -1 if no levels are configured. */
  currentLevelIndex: number;
  ballEffect: string;
  grenadeEffect: string;
  onBallEffectChange: (effect: string) => void;
  onGrenadeEffectChange: (effect: string) => void;
  debugExplosionTexture: boolean;
  onDebugExplosionTextureChange: (value: boolean) => void;
  runtimeModifiers: RuntimeModifiers;
  onRuntimeModifiersChange: (modifiers: RuntimeModifiers) => void;
  onRuntimeModifiersReset: () => void;
}
