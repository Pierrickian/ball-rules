// ============================================================
// useGameEngine — React integration hook
//
// Loads game_config.json, initializes the GameEngine, and
// drives the game loop. Returns a snapshot of GameState each
// frame.
//
// Exposed controls:
//   pause / resume / reset   — game flow
//   setArena(w, h)           — live resize the arena (level rule)
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "./game_engine";
import type { GameConfig, GameEvent, GameState } from "./types";

export interface UseGameEngineResult {
  gameState: GameState | null;
  config: GameConfig | null;
  lastEvents: GameEvent[];
  isRunning: boolean;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setArena: (width: number, height: number) => void;
}

const DEFAULT_STATE: GameState = {
  balls: new Map(),
  events: [],
  time: 0,
  orangeSpawnTimer: 0,
  score: 0,
};

export function useGameEngine(): UseGameEngineResult {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);

  const engineRef    = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef  = useRef<number>(0);
  const pausedRef    = useRef(false);
  // Keep a mutable ref for the config so setArena doesn't close over a stale value
  const configRef    = useRef<GameConfig | null>(null);

  // Load config and initialize engine
  useEffect(() => {
    const basePath = import.meta.env.BASE_URL ?? "/";
    const configUrl = `${basePath}game_config.json`.replace(/\/\//g, "/");
    fetch(configUrl)
      .then((r) => r.json())
      .then((cfg: GameConfig) => {
        configRef.current = cfg;
        setConfig(cfg);
        engineRef.current = new GameEngine(cfg);
        setGameState(DEFAULT_STATE);
        setIsRunning(true);
      })
      .catch((err) => {
        console.error("[GameEngine] Failed to load game_config.json:", err);
      });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (!isRunning || !engineRef.current) return;

    const loop = (timestamp: number) => {
      if (pausedRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }
      const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      if (engineRef.current) {
        const state = engineRef.current.update(delta);
        if (state.events.length > 0) setLastEvents(state.events);
        setGameState({ ...state, time: timestamp / 1000 });
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRunning]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    lastTimeRef.current = performance.now();
    setIsRunning(true);
  }, []);

  const reset = useCallback(() => {
    const cfg = configRef.current;
    if (cfg) {
      engineRef.current = new GameEngine(cfg);
      setGameState(DEFAULT_STATE);
      lastTimeRef.current = performance.now();
      pausedRef.current = false;
      setIsRunning(true);
    }
  }, []);

  /**
   * Live-resize the arena.
   * Called from the Terrain sub-menu when the user moves a slider.
   * Updates both the engine config (physics) and the React config
   * state (camera / scene re-render).
   */
  const setArena = useCallback((width: number, height: number) => {
    const cfg = configRef.current;
    if (!cfg || !engineRef.current) return;
    const newConfig: GameConfig = {
      ...cfg,
      graphics: {
        ...cfg.graphics,
        arena: { width, height },
      },
    };
    configRef.current = newConfig;
    setConfig(newConfig);
    engineRef.current.updateConfig(newConfig);
  }, []);

  return { gameState, config, lastEvents, isRunning, pause, resume, reset, setArena };
}
