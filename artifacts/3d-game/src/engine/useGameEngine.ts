// ============================================================
// useGameEngine — React integration hook
//
// Loads game_config.json, initializes the GameEngine, and
// drives the game loop. Returns a snapshot of GameState each
// frame.
//
// Exposed controls:
//   pause / resume / reset       — game flow
//   setArena(w, h)               — live resize the arena
//   shoot(targetX, targetY, hold)— player click → projectile
//   setLauncherColor(color)      — orange's launched color
//   setPlayerColors(colors)      — pool of player ball colors
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "./game_engine";
import type { BallColor, GameConfig, GameEvent, GameState, ShotKind } from "./types";

export interface UseGameEngineResult {
  gameState: GameState | null;
  config: GameConfig | null;
  lastEvents: GameEvent[];
  isRunning: boolean;
  playerQueue: BallColor[];
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setArena: (width: number, height: number) => void;
  shoot: (targetX: number, targetY: number, holdSeconds: number) => ShotKind | null;
  setLauncherColor: (color: BallColor) => void;
  setPlayerColors: (colors: BallColor[]) => void;
  classifyHold: (holdSeconds: number) => ShotKind;
}

const DEFAULT_STATE: GameState = {
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
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildQueue(size: number, pool: BallColor[]): BallColor[] {
  const colors = pool.length > 0 ? pool : (["gray"] as BallColor[]);
  const out: BallColor[] = [];
  for (let i = 0; i < size; i++) out.push(pickRandom(colors));
  return out;
}

export function useGameEngine(): UseGameEngineResult {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [playerQueue, setPlayerQueue] = useState<BallColor[]>([]);

  const engineRef          = useRef<GameEngine | null>(null);
  const animFrameRef       = useRef<number>(0);
  const lastTimeRef        = useRef<number>(0);
  const pausedRef          = useRef(false);
  const configRef          = useRef<GameConfig | null>(null);
  const queueRef           = useRef<BallColor[]>([]);
  const rebootingRef       = useRef(false);
  const currentLevelIdxRef = useRef(0);

  // Load config and initialize engine
  useEffect(() => {
    const basePath = import.meta.env.BASE_URL ?? "/";
    const configUrl = `${basePath}game_config.json`.replace(/\/\//g, "/");
    fetch(configUrl)
      .then((r) => r.json())
      .then((cfg: GameConfig) => {
        configRef.current = cfg;
        setConfig(cfg);
        currentLevelIdxRef.current = 0;
        engineRef.current = new GameEngine(cfg, currentLevelIdxRef.current);
        const q = buildQueue(cfg.gameplay_controls.queue_size, cfg.gameplay_controls.queue_ball_colors);
        queueRef.current = q;
        setPlayerQueue(q);
        const lvl = engineRef.current.getCurrentLevel();
        setGameState({
          ...DEFAULT_STATE,
          currentLevelIndex: currentLevelIdxRef.current,
          currentLevelId: lvl?.id ?? 0,
          currentLevelName: lvl?.name ?? "",
        });
        setIsRunning(true);
      })
      .catch((err) => {
        console.error("[GameEngine] Failed to load game_config.json:", err);
      });

    return () => { cancelAnimationFrame(animFrameRef.current); };
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

        // ---- Auto-reboot detection ----
        const cfg = configRef.current;
        if (
          cfg &&
          cfg.game_session.auto_reboot_on_clear &&
          state.sessionCleared &&
          !rebootingRef.current
        ) {
          rebootingRef.current = true;
          const delaySec = cfg.game_session.reboot_delay_seconds ?? 1.5;
          // Advance to the next level (with wrap-around) before reboot,
          // unless the config explicitly disables level progression.
          const advance = cfg.game_session.advance_level_on_clear !== false;
          const levelCount = cfg.levels?.list?.length ?? 0;
          if (advance && levelCount > 0) {
            currentLevelIdxRef.current =
              (currentLevelIdxRef.current + 1) % levelCount;
          }
          window.setTimeout(() => {
            doReset();
            rebootingRef.current = false;
          }, delaySec * 1000);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(animFrameRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const doReset = useCallback(() => {
    const cfg = configRef.current;
    if (!cfg) return;
    engineRef.current = new GameEngine(cfg, currentLevelIdxRef.current);
    const q = buildQueue(cfg.gameplay_controls.queue_size, cfg.gameplay_controls.queue_ball_colors);
    queueRef.current = q;
    setPlayerQueue(q);
    const lvl = engineRef.current.getCurrentLevel();
    setGameState({
      ...DEFAULT_STATE,
      currentLevelIndex: currentLevelIdxRef.current,
      currentLevelId: lvl?.id ?? 0,
      currentLevelName: lvl?.name ?? "",
    });
    lastTimeRef.current = performance.now();
    pausedRef.current = false;
    setIsRunning(true);
  }, []);

  const pause  = useCallback(() => { pausedRef.current = true;  setIsRunning(false); }, []);
  const resume = useCallback(() => { pausedRef.current = false; lastTimeRef.current = performance.now(); setIsRunning(true); }, []);
  const reset  = useCallback(() => { rebootingRef.current = false; doReset(); }, [doReset]);

  const setArena = useCallback((width: number, height: number) => {
    const cfg = configRef.current;
    if (!cfg || !engineRef.current) return;
    const newConfig: GameConfig = { ...cfg, graphics: { ...cfg.graphics, arena: { width, height } } };
    configRef.current = newConfig;
    setConfig(newConfig);
    engineRef.current.updateConfig(newConfig);
  }, []);

  /**
   * Player shoot. Pops the leftmost queue color, fires a projectile,
   * shifts the queue and appends a new random from the pool.
   */
  const shoot = useCallback((targetX: number, targetY: number, holdSeconds: number): ShotKind | null => {
    const cfg = configRef.current;
    if (!cfg || !engineRef.current || pausedRef.current) return null;

    // Pop the leftmost queue color
    const queue = queueRef.current;
    if (queue.length === 0) return null;
    const color = queue[0];

    const proj = engineRef.current.playerShoot(targetX, targetY, holdSeconds, color);
    if (!proj) return null;

    // Shift queue and refill
    const pool = cfg.gameplay_controls.queue_ball_colors;
    const next = queue.slice(1);
    next.push(pickRandom(pool.length > 0 ? pool : (["gray"] as BallColor[])));
    queueRef.current = next;
    setPlayerQueue(next);

    return engineRef.current.classifyShot(holdSeconds);
  }, []);

  const classifyHold = useCallback((holdSeconds: number): ShotKind => {
    if (!engineRef.current) return "light";
    return engineRef.current.classifyShot(holdSeconds);
  }, []);

  const setLauncherColor = useCallback((color: BallColor) => {
    const cfg = configRef.current;
    if (!cfg || !engineRef.current) return;
    const newConfig: GameConfig = {
      ...cfg,
      gameplay: {
        ...cfg.gameplay,
        orange: {
          ...cfg.gameplay.orange,
          launch_config: { ...cfg.gameplay.orange.launch_config, color },
        },
      },
    };
    configRef.current = newConfig;
    setConfig(newConfig);
    engineRef.current.updateConfig(newConfig);
  }, []);

  const setPlayerColors = useCallback((colors: BallColor[]) => {
    const cfg = configRef.current;
    if (!cfg || !engineRef.current) return;
    const safe = colors.length > 0 ? colors : (["gray"] as BallColor[]);
    const newConfig: GameConfig = {
      ...cfg,
      gameplay_controls: { ...cfg.gameplay_controls, queue_ball_colors: safe },
    };
    configRef.current = newConfig;
    setConfig(newConfig);
    engineRef.current.updateConfig(newConfig);
    // Regenerate the queue with the new pool
    const q = buildQueue(newConfig.gameplay_controls.queue_size, safe);
    queueRef.current = q;
    setPlayerQueue(q);
  }, []);

  return {
    gameState, config, lastEvents, isRunning, playerQueue,
    pause, resume, reset, setArena,
    shoot, setLauncherColor, setPlayerColors, classifyHold,
  };
}
