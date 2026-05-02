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
//   setLauncherColor(color)      — orange's launched color (also enters
//                                   single-color mode: one looping level
//                                   with 100% of the chosen color, no
//                                   level progression)
//   setPlayerColors(colors)      — pool of player ball colors
//   setActiveLevel(idx)          — jump to a level and (re)enter story mode
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "./game_engine";
import type { BallColor, GameConfig, GameEvent, GameState, ShotKind, Vec2 } from "./types";

export interface UseGameEngineResult {
  gameState: GameState | null;
  config: GameConfig | null;
  lastEvents: GameEvent[];
  isRunning: boolean;
  playerQueue: ShotKind[];
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setArena: (width: number, height: number) => void;
  shoot: (targetX: number, targetY: number, holdSeconds: number, forcedKind?: ShotKind) => ShotKind | null;
  setLauncherColor: (color: BallColor) => void;
  setCustomTerrainDistribution: (weights: Record<BallColor, number>) => void;
  setPlayerProjectileDistribution: (distribution: Record<ShotKind, number>) => void;
  setActiveLevel: (index: number) => void;
  setLevelWeights: (index: number, weights: Record<BallColor, number>) => void;
  classifyHold: (holdSeconds: number) => ShotKind;
  toggleGrenade: (dir: Vec2) => boolean;
  grenadesLeft: number;
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

function buildQueue(size: number, distribution: Record<ShotKind, number>): ShotKind[] {
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

export function useGameEngine(): UseGameEngineResult {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [playerQueue, setPlayerQueue] = useState<ShotKind[]>([]);
  const [grenadesLeft, setGrenadesLeft] = useState(5);

  const engineRef          = useRef<GameEngine | null>(null);
  const animFrameRef       = useRef<number>(0);
  const lastTimeRef        = useRef<number>(0);
  const pausedRef          = useRef(false);
  const configRef          = useRef<GameConfig | null>(null);
  const queueRef           = useRef<ShotKind[]>([]);
  const rebootingRef       = useRef(false);
  const currentLevelIdxRef = useRef(0);
  // "levels"       — story mode: use level weights, advance on clear (loop)
  // "single_color" — one looping level, 100% of launch_config.color, no progression
  const sessionModeRef     = useRef<"levels" | "single_color">("levels");

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
    setGrenadesLeft(engineRef.current.getGrenadesLeft());
        setGrenadesLeft(engineRef.current.getGrenadesLeft());
        const q = buildQueue(cfg.gameplay_controls.queue_size, cfg.gameplay_controls.player_projectile_distribution ?? { light: 0.6, heavy: 0.3, mega: 0.1 });
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
          // unless: (a) config disables progression, OR (b) we are in
          // single-color mode (a single looping level, no story).
          const advance =
            cfg.game_session.advance_level_on_clear !== false &&
            sessionModeRef.current === "levels";
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
        setGrenadesLeft(engineRef.current.getGrenadesLeft());
    // Re-apply the persistent session mode so resets keep the user's choice
    // (single-color mode survives auto-reboot, manual reset, etc.).
    if (sessionModeRef.current === "single_color") {
      engineRef.current.setSingleColorMode(true);
    }
    const q = buildQueue(cfg.gameplay_controls.queue_size, cfg.gameplay_controls.player_projectile_distribution ?? { light: 0.6, heavy: 0.3, mega: 0.1 });
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
  const shoot = useCallback((targetX: number, targetY: number, holdSeconds: number, forcedKind?: ShotKind): ShotKind | null => {
    const cfg = configRef.current;
    if (!cfg || !engineRef.current || pausedRef.current) return null;

    // Pop the leftmost queue color
    const queue = queueRef.current;
    if (queue.length === 0) return null;
    const requested = queue[0];
    const types = cfg.gameplay_controls.shot_types;
    const effective: ShotKind = holdSeconds >= (types.mega?.max_hold_seconds ?? 0.8) ? "mega" : holdSeconds >= (types.heavy?.max_hold_seconds ?? 0.3) ? "heavy" : "light";
    const resolved: ShotKind = forcedKind ?? (
      requested === "light" ? effective :
      requested === "heavy" ? (effective === "mega" ? "mega" : effective) :
      (effective === "mega" ? "mega" : null)
    ) as ShotKind;
    if (!resolved) return null;
    const holdForResolved = resolved === "mega" ? 0.81 : resolved === "heavy" ? 0.31 : 0.01;
    const projectileColor: BallColor = resolved === "light" ? "white" : resolved === "heavy" ? "yellow" : "gray";
    const proj = engineRef.current.playerShoot(targetX, targetY, holdForResolved, projectileColor);
    if (!proj) return null;

    // Shift queue and refill
    const next = queue.slice(1);
    const distribution = cfg.gameplay_controls.player_projectile_distribution ?? { light: 0.6, heavy: 0.3, mega: 0.1 };
    next.push(buildQueue(1, distribution)[0]);
    queueRef.current = next;
    setPlayerQueue(next);

    return resolved;
  }, []);

  const toggleGrenade = useCallback((dir: Vec2): boolean => {
    if (!engineRef.current || pausedRef.current) return false;
    const ok = engineRef.current.toggleGrenade(dir);
    setGrenadesLeft(engineRef.current.getGrenadesLeft());
    return ok;
  }, []);

  const classifyHold = useCallback((holdSeconds: number): ShotKind => {
    if (!engineRef.current) return "light";
    return engineRef.current.classifyShot(holdSeconds);
  }, []);

  /**
   * Pick the orange-launcher color AND switch to single-color mode:
   * a fresh single-level session that loops with 100% of the chosen
   * color (no story-mode level progression). The current game is
   * reset so the new color takes effect immediately.
   */
  const setLauncherColor = useCallback((color: BallColor) => {
    const cfg = configRef.current;
    if (!cfg) return;
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
    sessionModeRef.current = "single_color";
    rebootingRef.current = false;
    doReset();
  }, [doReset]);

  /**
   * Jump to an arbitrary level and (re)enter story mode. The current
   * game is reset so the new level starts fresh.
   */
  const setActiveLevel = useCallback((index: number) => {
    const cfg = configRef.current;
    if (!cfg) return;
    const list = cfg.levels?.list ?? [];
    if (list.length === 0) return;
    const safe = ((index % list.length) + list.length) % list.length;
    sessionModeRef.current = "levels";
    currentLevelIdxRef.current = safe;
    rebootingRef.current = false;
    doReset();
  }, [doReset]);

  const setLevelWeights = useCallback((index: number, weights: Record<BallColor, number>) => {
    const cfg = configRef.current;
    if (!cfg || !cfg.levels?.list?.length) return;
    const list = cfg.levels.list.map((lvl, i) =>
      i === index ? { ...lvl, launch_color_weights: { ...weights } } : lvl
    );
    const newConfig: GameConfig = { ...cfg, levels: { ...cfg.levels, list } };
    configRef.current = newConfig;
    setConfig(newConfig);
    engineRef.current?.updateConfig(newConfig);
  }, []);

  const setCustomTerrainDistribution = useCallback((weights: Record<BallColor, number>) => {
    const cfg = configRef.current;
    if (!cfg) return;
    const customLevel = {
      id: 1,
      name: "Partie custom",
      description: "Répartition personnalisée depuis le menu Couleur terrain.",
      launch_color_weights: { ...weights },
    };
    const newConfig: GameConfig = { ...cfg, levels: { ...cfg.levels, list: [customLevel] } };
    configRef.current = newConfig;
    setConfig(newConfig);
    sessionModeRef.current = "levels";
    currentLevelIdxRef.current = 0;
    rebootingRef.current = false;
    doReset();
  }, [doReset]);

  const setPlayerProjectileDistribution = useCallback((distribution: Record<ShotKind, number>) => {
    const cfg = configRef.current;
    if (!cfg || !engineRef.current) return;
    const newConfig: GameConfig = {
      ...cfg,
      gameplay_controls: { ...cfg.gameplay_controls, player_projectile_distribution: distribution },
    };
    configRef.current = newConfig;
    setConfig(newConfig);
    engineRef.current.updateConfig(newConfig);
    const q = buildQueue(newConfig.gameplay_controls.queue_size, distribution);
    queueRef.current = q;
    setPlayerQueue(q);
  }, []);

  return {
    gameState, config, lastEvents, isRunning, playerQueue,
    pause, resume, reset, setArena,
    shoot, setLauncherColor, setCustomTerrainDistribution, setPlayerProjectileDistribution, setActiveLevel, setLevelWeights, classifyHold, toggleGrenade, grenadesLeft,
  };
}
