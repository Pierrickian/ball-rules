// ============================================================
// useGameEngine — React integration hook
//
// Loads game_config.json, initializes the GameEngine, and
// drives the game loop. Returns a snapshot of GameState each
// frame. The engine ref is stable; only the snapshot changes.
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

  const engineRef = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pausedRef = useRef(false);

  // Load config and initialize engine
  useEffect(() => {
    const basePath = import.meta.env.BASE_URL ?? "/";
    const configUrl = `${basePath}game_config.json`.replace(/\/\//g, "/");
    fetch(configUrl)
      .then((r) => r.json())
      .then((cfg: GameConfig) => {
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
        if (state.events.length > 0) {
          setLastEvents(state.events);
        }
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

  const pause = useCallback(() => { pausedRef.current = true; setIsRunning(false); }, []);
  const resume = useCallback(() => {
    pausedRef.current = false;
    lastTimeRef.current = performance.now();
    setIsRunning(true);
  }, []);
  const reset = useCallback(() => {
    if (config) {
      engineRef.current = new GameEngine(config);
      setGameState(DEFAULT_STATE);
      lastTimeRef.current = performance.now();
      pausedRef.current = false;
      setIsRunning(true);
    }
  }, [config]);

  return { gameState, config, lastEvents, isRunning, pause, resume, reset };
}
