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
import { addGrenadeZones, createGrenadeZoneStore, updateGrenadeZones } from "./grenade_lingering";
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
  playBossRush: (levelIds: number[]) => void;
  classifyHold: (holdSeconds: number) => ShotKind;
  toggleGrenade: (dir: Vec2, effect?: string) => boolean;
  grenadesLeft: number;
  setDifficulty: (difficulty: "easy" | "medium" | "hard") => void;
  difficulty: "easy" | "medium" | "hard";
  retryReason: "timeout" | "ammo" | null;
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
  timerSecondsRemaining: 60,
  ammoRemaining: 50,
  retryReason: null,
  isBossPhase: false,
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DEFAULT_LEVEL_TIMER_SECONDS = 60;
const DEFAULT_LEVEL_AMMO_COUNT = 50;

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
  const [difficulty, setDifficultyState] = useState<"easy" | "medium" | "hard">("easy");
  const [retryReason, setRetryReason] = useState<"timeout" | "ammo" | null>(null);

  const engineRef          = useRef<GameEngine | null>(null);
  const grenadeZonesRef    = useRef(createGrenadeZoneStore());
  const animFrameRef       = useRef<number>(0);
  const lastTimeRef        = useRef<number>(0);
  const pausedRef          = useRef(false);
  const configRef          = useRef<GameConfig | null>(null);
  const queueRef           = useRef<ShotKind[]>([]);
  const rebootingRef       = useRef(false);
  const currentLevelIdxRef = useRef(0);
  // "levels"       — story mode: use level weights, advance on clear (loop)
  // "single_color" — one looping level, 100% of launch_config.color, no progression
  const sessionModeRef     = useRef<"levels" | "single_color" | "boss_rush">("levels");
  const bossRushOrderRef   = useRef<number[]>([]);
  const defaultMaxSpawnRef = useRef<number>(20);
  const timerRemainingRef = useRef(DEFAULT_LEVEL_TIMER_SECONDS);
  const ammoRemainingRef = useRef(DEFAULT_LEVEL_AMMO_COUNT);
  const timerTickAccumulatorRef = useRef(0);
  const retryReasonRef = useRef<"timeout" | "ammo" | null>(null);
  const retryResetInProgressRef = useRef(false);

  const getLevelLimits = useCallback(() => {
    const lvl = engineRef.current?.getCurrentLevel();
    return {
      timer: lvl?.timer_seconds ?? DEFAULT_LEVEL_TIMER_SECONDS,
      ammo: lvl?.ammo_count ?? DEFAULT_LEVEL_AMMO_COUNT,
    };
  }, []);

  const applyLevelLimits = useCallback(() => {
    const limits = getLevelLimits();
    timerRemainingRef.current = limits.timer;
    ammoRemainingRef.current = limits.ammo;
    timerTickAccumulatorRef.current = 0;
  }, [getLevelLimits]);

  const publishRetryReason = useCallback((reason: "timeout" | "ammo" | null) => {
    retryReasonRef.current = reason;
    setRetryReason(reason);
  }, []);

  // Load config and initialize engine
  useEffect(() => {
    const basePath = import.meta.env.BASE_URL ?? "/";
    const configUrl = `${basePath}game_config.json`.replace(/\/\//g, "/");
    fetch(configUrl)
      .then((r) => r.json())
      .then((cfg: GameConfig) => {
        configRef.current = cfg;
        defaultMaxSpawnRef.current = cfg.game_session?.max_balls_spawned ?? 20;
        setConfig(cfg);
        currentLevelIdxRef.current = 0;
        engineRef.current = new GameEngine(cfg, currentLevelIdxRef.current);
        applyLevelLimits();
        publishRetryReason(null);
        retryResetInProgressRef.current = false;
        engineRef.current.setDifficultyBonusHp(0);
        grenadeZonesRef.current = createGrenadeZoneStore();
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
          timerSecondsRemaining: timerRemainingRef.current,
          ammoRemaining: ammoRemainingRef.current,
          retryReason: null,
          isBossPhase: engineRef.current.isBossPhase(),
        });
        setIsRunning(true);
      })
      .catch((err) => {
        console.error("[GameEngine] Failed to load game_config.json:", err);
      });

    return () => { cancelAnimationFrame(animFrameRef.current); };
  }, [difficulty, applyLevelLimits, publishRetryReason]);

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
        const cfg = configRef.current;
        if (cfg) {
          addGrenadeZones(state.events, grenadeZonesRef.current, cfg);
          updateGrenadeZones(engineRef.current, grenadeZonesRef.current, delta);
        }
        const visibleState = engineRef.current.getState();
        const bossPhase = engineRef.current.isBossPhase();
        if (cfg && !bossPhase && !retryReasonRef.current && !retryResetInProgressRef.current && !visibleState.sessionCleared) {
          timerTickAccumulatorRef.current += delta;
          while (timerTickAccumulatorRef.current >= 0.1 && !retryReasonRef.current) {
            timerTickAccumulatorRef.current -= 0.1;
            timerRemainingRef.current = Math.max(0, Math.round((timerRemainingRef.current - 0.1) * 10) / 10);
            if (timerRemainingRef.current <= 0) {
              publishRetryReason("timeout");
              pausedRef.current = true;
              setIsRunning(false);
            }
          }
          if (ammoRemainingRef.current <= 0) {
            publishRetryReason("ammo");
            pausedRef.current = true;
            setIsRunning(false);
          }
        }
        if (state.events.length > 0) setLastEvents(state.events);
        setGameState({
          ...visibleState,
          time: timestamp / 1000,
          timerSecondsRemaining: bossPhase ? Infinity : timerRemainingRef.current,
          ammoRemaining: bossPhase ? Infinity : ammoRemainingRef.current,
          retryReason: retryReasonRef.current,
          isBossPhase: bossPhase,
        });

        // ---- Auto-reboot detection ----
        if (
          cfg &&
          cfg.game_session.auto_reboot_on_clear &&
          visibleState.sessionCleared &&
          !rebootingRef.current
        ) {
          rebootingRef.current = true;
          const delaySec = cfg.game_session.reboot_delay_seconds ?? 1.5;
          // Advance to the next level (with wrap-around) before reboot,
          // unless: (a) config disables progression, OR (b) we are in
          // single-color mode (a single looping level, no story).
          const levelCount = cfg.levels?.list?.length ?? 0;
          if (sessionModeRef.current === "boss_rush" && bossRushOrderRef.current.length > 0) {
            const order = bossRushOrderRef.current;
            const pos = Math.max(0, order.indexOf(currentLevelIdxRef.current));
            currentLevelIdxRef.current = order[(pos + 1) % order.length];
          } else {
            const advance =
              cfg.game_session.advance_level_on_clear !== false &&
              sessionModeRef.current === "levels";
            if (advance && levelCount > 0) {
              currentLevelIdxRef.current =
                (currentLevelIdxRef.current + 1) % levelCount;
            }
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

  const doReset = useCallback((forcedDifficulty?: "easy" | "medium" | "hard") => {
    const cfg = configRef.current;
    if (!cfg) return;
    retryResetInProgressRef.current = true;
    publishRetryReason(null);
    engineRef.current = new GameEngine(cfg, currentLevelIdxRef.current);
    const activeDifficulty = forcedDifficulty ?? difficulty;
    const bonus = activeDifficulty === "easy" ? 0 : activeDifficulty === "medium" ? 2 : 6;
    engineRef.current.setDifficultyBonusHp(bonus);
    grenadeZonesRef.current = createGrenadeZoneStore();
    setGrenadesLeft(engineRef.current.getGrenadesLeft());
    // Re-apply the persistent session mode so resets keep the user's choice
    // (single-color mode survives auto-reboot, manual reset, etc.).
    if (sessionModeRef.current === "single_color") {
      engineRef.current.setSingleColorMode(true);
    }
    applyLevelLimits();
    const q = buildQueue(cfg.gameplay_controls.queue_size, cfg.gameplay_controls.player_projectile_distribution ?? { light: 0.6, heavy: 0.3, mega: 0.1 });
    queueRef.current = q;
    setPlayerQueue(q);
    const lvl = engineRef.current.getCurrentLevel();
    setGameState({
      ...DEFAULT_STATE,
      currentLevelIndex: currentLevelIdxRef.current,
      currentLevelId: lvl?.id ?? 0,
      currentLevelName: lvl?.name ?? "",
      timerSecondsRemaining: timerRemainingRef.current,
      ammoRemaining: ammoRemainingRef.current,
      retryReason: null,
      isBossPhase: engineRef.current.isBossPhase(),
    });
    lastTimeRef.current = performance.now();
    pausedRef.current = false;
    setIsRunning(true);
    window.setTimeout(() => { retryResetInProgressRef.current = false; }, 0);
  }, [difficulty, applyLevelLimits, publishRetryReason]);

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
   * Player shoot resolved directly from hold duration.
   * Queue stays visible but no longer gates or feeds shot execution.
   */
  const shoot = useCallback((targetX: number, targetY: number, holdSeconds: number, forcedKind?: ShotKind): ShotKind | null => {
    const cfg = configRef.current;
    if (!cfg || !engineRef.current || pausedRef.current || retryReasonRef.current) return null;
    const bossPhase = engineRef.current.isBossPhase();
    if (!bossPhase && ammoRemainingRef.current <= 0) {
      publishRetryReason("ammo");
      pausedRef.current = true;
      setIsRunning(false);
      return null;
    }
    const types = cfg.gameplay_controls.shot_types;
    const effective: ShotKind = holdSeconds >= (types.mega?.max_hold_seconds ?? 0.8) ? "mega" : holdSeconds >= (types.heavy?.max_hold_seconds ?? 0.3) ? "heavy" : "light";
    const resolved: ShotKind = forcedKind ?? effective;
    const holdForResolved = holdSeconds;
    const projectileColor: BallColor = resolved === "light" ? "white" : resolved === "heavy" ? "yellow" : "pink";
    const proj = engineRef.current.playerShoot(targetX, targetY, holdForResolved, projectileColor);
    if (!proj) return null;

    if (!bossPhase) {
      ammoRemainingRef.current = Math.max(0, ammoRemainingRef.current - 1);
      const nextReason = ammoRemainingRef.current <= 0 ? "ammo" : retryReasonRef.current;
      setGameState((prev) => prev ? {
        ...prev,
        ammoRemaining: ammoRemainingRef.current,
        retryReason: nextReason,
      } : prev);
      if (ammoRemainingRef.current <= 0) {
        publishRetryReason("ammo");
        pausedRef.current = true;
        setIsRunning(false);
      }
    }

    return resolved;
  }, [publishRetryReason]);

  const toggleGrenade = useCallback((dir: Vec2, effect: string = "ring"): boolean => {
    if (!engineRef.current || pausedRef.current) return false;
    const ok = engineRef.current.toggleGrenade(dir, effect);
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
    const restored: GameConfig = { ...newConfig, game_session: { ...newConfig.game_session, max_balls_spawned: defaultMaxSpawnRef.current } };
    configRef.current = restored;
    setConfig(restored);
    sessionModeRef.current = "single_color";
    bossRushOrderRef.current = [];
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
    const restored: GameConfig = { ...cfg, game_session: { ...cfg.game_session, max_balls_spawned: defaultMaxSpawnRef.current } };
    configRef.current = restored;
    setConfig(restored);
    sessionModeRef.current = "levels";
    bossRushOrderRef.current = [];
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
    const levels = cfg.levels?.list ?? [];
    let newConfig: GameConfig;

    if (levels.length > 0) {
      const safe = ((currentLevelIdxRef.current % levels.length) + levels.length) % levels.length;
      const list = levels.map((lvl, i) =>
        i === safe ? { ...lvl, launch_color_weights: { ...weights } } : lvl
      );
      newConfig = { ...cfg, levels: { ...cfg.levels, list } };
      currentLevelIdxRef.current = safe;
    } else {
      const customLevel = {
        id: 1,
        name: "Partie custom",
        description: "Répartition personnalisée depuis le menu Couleur terrain.",
        launch_color_weights: { ...weights },
      };
      newConfig = { ...cfg, levels: { ...cfg.levels, list: [customLevel] } };
      currentLevelIdxRef.current = 0;
    }

    configRef.current = newConfig;
    setConfig(newConfig);
    sessionModeRef.current = "levels";
    bossRushOrderRef.current = [];
    rebootingRef.current = false;
    doReset();
  }, [doReset]);


  const playBossRush = useCallback((levelIds: number[]) => {
    const cfg = configRef.current;
    if (!cfg || !cfg.levels?.list?.length) return;
    const wanted = new Set(levelIds);
    const order = cfg.levels.list
      .map((lvl, idx) => ({ lvl, idx }))
      .filter(({ lvl }) => wanted.has(lvl.id) && lvl.boss)
      .map(({ idx }) => idx);
    if (order.length === 0) return;

    const newConfig: GameConfig = {
      ...cfg,
      game_session: { ...cfg.game_session, max_balls_spawned: 0 },
    };
    configRef.current = newConfig;
    setConfig(newConfig);
    sessionModeRef.current = "boss_rush";
    bossRushOrderRef.current = order;
    currentLevelIdxRef.current = order[0];
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

  const setDifficulty = useCallback((next: "easy" | "medium" | "hard") => {
    setDifficultyState(next);
    const bonus = next === "easy" ? 0 : next === "medium" ? 2 : 6;
    engineRef.current?.setDifficultyBonusHp(bonus);
    rebootingRef.current = false;
    doReset(next);
  }, [doReset]);

  return {
    gameState, config, lastEvents, isRunning, playerQueue,
    pause, resume, reset, setArena,
    shoot, setLauncherColor, setCustomTerrainDistribution, setPlayerProjectileDistribution, setActiveLevel, setLevelWeights, playBossRush, classifyHold, toggleGrenade, grenadesLeft,
    setDifficulty, difficulty, retryReason,
  };
}
