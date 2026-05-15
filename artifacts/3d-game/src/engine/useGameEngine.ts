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
import type { BallColor, GameConfig, GameEvent, GameState, LevelEntry, RuntimePhase, ShotKind, Vec2 } from "./types";
import { LocalRandomAlveoleProvider } from "./localAlveoleProvider";
import { DEFAULT_RUNTIME_MODIFIERS, applyAlveoleModifier, applyRuntimeModifiersToConfig, toEngineRuntimeModifiers, type GameplayAlveole, type RuntimeModifiers } from "./runtimeModifiers";
import { DEFAULT_DIFFICULTY, DEFAULT_LEVEL_AMMO_COUNT, DEFAULT_LEVEL_TIMER_SECONDS, DEFAULT_STATE, FALLBACK_DIFFICULTY_HP_PRESETS, buildQueue, clampDifficultyHpValue, getDefaultDifficulty, getDifficultyHpValue } from "./useGameEngineHelpers";
import { installBallDebugApi } from "./debugApi";

export type BreathingWaveEndReason = "time_expired" | "terrain_cleared" | "boss_defeated";

export interface BreathingWaveState {
  waveNumber: number;
  phase: "active" | "breathing";
  countdownRemaining: number;
  message: string;
  aiAnalyzing: boolean;
  alveoles: GameplayAlveole[];
  victoryPulse: boolean;
  outcome?: "victory" | "defeat" | null;
  endReason?: BreathingWaveEndReason | null;
}

export interface GameplayFeedback {
  ammoAdded: number;
  grenadesAdded: number;
  effects?: Partial<RuntimeModifiers>;
}

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
  applyRuntimeConfig: (nextConfig: GameConfig, options?: { reset?: boolean; playtestTarget?: unknown }) => void;
  launchLevel: (levelId: number) => void;
  launchBossLevel: (levelId: number) => void;
  launchTemporaryBallTest: (levelConfig: LevelEntry) => void;
  openRetryMenu: () => void;
  goToBoss: () => void;
  playBossRush: (levelIds: number[]) => void;
  classifyHold: (holdSeconds: number) => ShotKind;
  toggleGrenade: (dir: Vec2, effect?: string) => boolean;
  placeMine: (position: Vec2, effect?: string) => boolean;
  upgradeBetterShot: () => number;
  grenadesLeft: number;
  setDifficulty: (difficulty: "easy" | "medium" | "hard") => void;
  difficulty: "easy" | "medium" | "hard";
  setHpAdjustment: (adjustment: number) => void;
  hpAdjustment: number;
  breathingWave: BreathingWaveState;
  runtimeModifiers: RuntimeModifiers;
  applyAlveole: (alveole: GameplayAlveole) => GameplayFeedback;
  reloadWave: () => GameplayFeedback;
  launchNextWave: () => void;
  requestContextualAlveoles: () => void;
  setRuntimeModifiersFromSettings: (modifiers: RuntimeModifiers) => void;
  resetRuntimeModifiers: () => void;
  recordRuntimePhaseChange: (phase: RuntimePhase) => void;
}

export function useGameEngine(): UseGameEngineResult {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [playerQueue, setPlayerQueue] = useState<ShotKind[]>([]);
  const [grenadesLeft, setGrenadesLeft] = useState(5);
  const [difficulty, setDifficultyState] = useState<"easy" | "medium" | "hard">(DEFAULT_DIFFICULTY);
  const [hpAdjustment, setHpAdjustmentState] = useState(FALLBACK_DIFFICULTY_HP_PRESETS[DEFAULT_DIFFICULTY]);
  const [runtimeModifiers, setRuntimeModifiers] = useState<RuntimeModifiers>(DEFAULT_RUNTIME_MODIFIERS);
  const [breathingWave, setBreathingWave] = useState<BreathingWaveState>({
    waveNumber: 1,
    phase: "active",
    countdownRemaining: 0,
    message: "vague 1 active",
    aiAnalyzing: false,
    alveoles: [],
    victoryPulse: false,
    outcome: null,
    endReason: null,
  });

  const engineRef          = useRef<GameEngine | null>(null);
  const grenadeZonesRef    = useRef(createGrenadeZoneStore());
  const animFrameRef       = useRef<number>(0);
  const lastTimeRef        = useRef<number>(0);
  const pausedRef          = useRef(false);
  const configRef          = useRef<GameConfig | null>(null);
  const baseConfigRef      = useRef<GameConfig | null>(null);
  const queueRef           = useRef<ShotKind[]>([]);
  const rebootingRef       = useRef(false);
  const currentLevelIdxRef = useRef(0);
  // "levels"       — story mode: use level weights, advance on clear (loop)
  // "single_color" — one looping level, 100% of launch_config.color, no progression
  // "temporary_ball_test" — runtime-only level created to immediately test one ball
  const sessionModeRef     = useRef<"levels" | "single_color" | "boss_rush" | "temporary_ball_test">("levels");
  const bossRushOrderRef   = useRef<number[]>([]);
  const defaultMaxSpawnRef = useRef<number>(20);
  const hpAdjustmentRef = useRef(FALLBACK_DIFFICULTY_HP_PRESETS[DEFAULT_DIFFICULTY]);
  const timerRemainingRef = useRef<number>(DEFAULT_LEVEL_TIMER_SECONDS);
  const ammoRemainingRef = useRef<number>(DEFAULT_LEVEL_AMMO_COUNT);
  const retryReasonRef = useRef<"timeout" | "ammo" | "manual" | null>(null);
  const retryResetInProgressRef = useRef(false);
  const timerTickAccumulatorRef = useRef(0);
  const runtimeModifiersRef = useRef<RuntimeModifiers>(DEFAULT_RUNTIME_MODIFIERS);
  const alveoleProviderRef = useRef(new LocalRandomAlveoleProvider());
  const waveNumberRef = useRef(1);
  const breathingActiveRef = useRef(false);
  const breathingCountdownRef = useRef(0);
  const breathingTotalRef = useRef(10);
  const aiRequestIdRef = useRef(0);
  const nextWaveSpawnBudgetRef = useRef(8);
  const lastWaveColorRef = useRef<BallColor | null>(null);
  const finalCountdownActiveRef = useRef(false);
  const finalCountdownRemainingRef = useRef<number>(Infinity);
  const waveEndSpawnPausedRef = useRef(false);
  const lowAmmoHysteresisArmedRef = useRef(true);
  const bossNoticeRemainingRef = useRef(0);

  useEffect(() => { runtimeModifiersRef.current = runtimeModifiers; }, [runtimeModifiers]);


  const recordRuntimePhaseChange = useCallback((phase: RuntimePhase) => {
    setLastEvents([{ type: "phase_changed", phase }]);
  }, []);

  const publishRetryReason = useCallback((reason: "timeout" | "ammo" | "manual" | null) => {
    retryReasonRef.current = reason;
    setGameState((prev) => prev ? { ...prev, retryReason: reason } : prev);
  }, []);

  const publishDebugState = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const visibleState = engine.getState();
    setGameState((prev) => ({
      ...visibleState,
      time: prev?.time ?? visibleState.time,
      timerSecondsRemaining: engine.isBossPhase() ? Infinity : (finalCountdownActiveRef.current ? finalCountdownRemainingRef.current : Infinity),
      ammoRemaining: engine.isBossPhase() ? Infinity : ammoRemainingRef.current,
      retryReason: retryReasonRef.current,
      isBossPhase: engine.isBossPhase(),
      lightShotDamage: engine.getCurrentLightShotDamage(),
      betterShotLevel: engine.getBetterShotLevel(),
    }));
  }, []);

  const applyLevelLimits = useCallback(() => {
    const lvl = engineRef.current?.getCurrentLevel();
    const bossPhase = engineRef.current?.isBossPhase() ?? false;
    timerRemainingRef.current = Infinity;
    ammoRemainingRef.current = bossPhase ? Infinity : Math.round((lvl?.ammo_count ?? DEFAULT_LEVEL_AMMO_COUNT) * runtimeModifiersRef.current.ammo_count);
    lowAmmoHysteresisArmedRef.current = ammoRemainingRef.current > 15;
    timerTickAccumulatorRef.current = 0;
  }, []);

  const pickDifferentWaveColor = useCallback((cfg: GameConfig): BallColor | null => {
    const allowed = (cfg.gameplay.orange.launch_config.allow_colors ?? [])
      .filter((color): color is BallColor => Boolean(cfg.ball_rules[color] && cfg.ball_colors[color]?.for_terrain));
    if (allowed.length === 0) return null;
    const candidates = allowed.filter((color) => color !== lastWaveColorRef.current);
    const pool = candidates.length > 0 ? candidates : allowed;
    const color = pool[Math.floor(Math.random() * pool.length)];
    lastWaveColorRef.current = color;
    return color;
  }, []);

  const withSingleWaveColor = useCallback((cfg: GameConfig, color: BallColor | null): GameConfig => {
    if (!color || !cfg.levels?.list?.length) return cfg;
    const index = ((currentLevelIdxRef.current % cfg.levels.list.length) + cfg.levels.list.length) % cfg.levels.list.length;
    return {
      ...cfg,
      levels: {
        ...cfg.levels,
        list: cfg.levels.list.map((level, levelIndex) => levelIndex === index ? { ...level, launch_color_weights: { [color]: 1 } } : level),
      },
    };
  }, []);

  const removeCurrentLevelBoss = useCallback((cfg: GameConfig): GameConfig => {
    if (!cfg.levels?.list?.length) return cfg;
    const index = ((currentLevelIdxRef.current % cfg.levels.list.length) + cfg.levels.list.length) % cfg.levels.list.length;
    return {
      ...cfg,
      levels: {
        ...cfg.levels,
        list: cfg.levels.list.map((level, levelIndex) => {
          if (levelIndex !== index || !level.boss) return level;
          const { boss: _boss, ...levelWithoutBoss } = level;
          return levelWithoutBoss;
        }),
      },
    };
  }, []);

  const syncRuntimeConfig = useCallback((nextModifiers: RuntimeModifiers, breathingSpawnBrake = 1) => {
    const base = baseConfigRef.current;
    if (!base) return;
    const nextConfig = applyRuntimeModifiersToConfig(base, nextModifiers);
    configRef.current = nextConfig;
    setConfig(nextConfig);
    engineRef.current?.updateConfig(nextConfig);
    engineRef.current?.setRuntimeModifiers(toEngineRuntimeModifiers(nextModifiers, breathingSpawnBrake));
  }, []);

  const requestBreathingAlveoles = useCallback((reason: "breathing_wave" | "idle_micro_pause", ids?: string[]) => {
    const requestId = ++aiRequestIdRef.current;
    setBreathingWave((prev) => ({ ...prev, aiAnalyzing: true, alveoles: ids ? [] : prev.alveoles }));
    alveoleProviderRef.current.recommend({
      waveNumber: waveNumberRef.current,
      ammoRemaining: Number.isFinite(ammoRemainingRef.current) ? ammoRemainingRef.current : 0,
      activeEnemies: engineRef.current?.getEnemyBallCount() ?? 0,
      grenadesLeft: engineRef.current?.getGrenadesLeft() ?? 0,
      reason,
    }, { count: ids ? 2 : undefined, ids }).then((alveoles) => {
      if (requestId !== aiRequestIdRef.current) return;
      setBreathingWave((prev) => ({ ...prev, aiAnalyzing: false, alveoles }));
    });
  }, []);

  const beginBreathingWave = useCallback((outcome: "victory" | "defeat", options?: { phaseAlreadyRecorded?: boolean; endReason?: BreathingWaveEndReason }) => {
    if (breathingActiveRef.current || !engineRef.current) return;
    if (!options?.phaseAlreadyRecorded) recordRuntimePhaseChange("reward_notice");
    breathingActiveRef.current = true;
    const activeEnemies = engineRef.current.getEnemyBallCount();
    nextWaveSpawnBudgetRef.current = Math.max(4, Math.ceil((activeEnemies + Math.max(1, DEFAULT_LEVEL_AMMO_COUNT)) * 0.55 * runtimeModifiersRef.current.enemy_density));
    breathingCountdownRef.current = Math.round(DEFAULT_LEVEL_TIMER_SECONDS * runtimeModifiersRef.current.wave_duration);
    breathingTotalRef.current = breathingCountdownRef.current;
    const endReason = options?.endReason ?? (outcome === "victory" ? "terrain_cleared" : "time_expired");
    if (endReason === "time_expired") engineRef.current.setOrangeSpawningPaused(true);
    const cfg = configRef.current;
    if (cfg) {
      const rewardConfig = endReason === "time_expired" ? removeCurrentLevelBoss(cfg) : cfg;
      const frozenConfig = { ...rewardConfig, game_session: { ...rewardConfig.game_session, max_balls_spawned: engineRef.current.getLaunchedCount() } };
      configRef.current = frozenConfig;
      setConfig(frozenConfig);
      engineRef.current.updateConfig(frozenConfig);
    }
    engineRef.current.setRuntimeModifiers(toEngineRuntimeModifiers(runtimeModifiersRef.current, 99));
    setBreathingWave((prev) => ({
      ...prev,
      waveNumber: waveNumberRef.current,
      phase: "breathing",
      countdownRemaining: breathingCountdownRef.current,
      message: endReason === "time_expired" ? "Time up / Temps écoulé" : "Rewards / Récompenses",
      aiAnalyzing: true,
      alveoles: [],
      victoryPulse: outcome === "victory",
      outcome,
      endReason,
    }));
    requestBreathingAlveoles("breathing_wave");
  }, [recordRuntimePhaseChange, removeCurrentLevelBoss, requestBreathingAlveoles]);

  // Load config and initialize engine
  useEffect(() => {
    const basePath = import.meta.env.BASE_URL ?? "/";
    const configUrl = `${basePath}game_config.json`.replace(/\/\//g, "/");
    fetch(configUrl)
      .then((r) => r.json())
      .then((cfg: GameConfig) => {
        baseConfigRef.current = cfg;
        configRef.current = applyRuntimeModifiersToConfig(cfg, runtimeModifiersRef.current);
        defaultMaxSpawnRef.current = cfg.game_session?.max_balls_spawned ?? 20;
        setConfig(configRef.current);
        const configuredDifficulty = getDefaultDifficulty(cfg);
        const configuredHpAdjustment = clampDifficultyHpValue(cfg, getDifficultyHpValue(cfg, configuredDifficulty));
        setDifficultyState(configuredDifficulty);
        setHpAdjustmentState(configuredHpAdjustment);
        hpAdjustmentRef.current = configuredHpAdjustment;
        currentLevelIdxRef.current = 0;
        engineRef.current = new GameEngine(configRef.current, currentLevelIdxRef.current);
        engineRef.current.setRuntimeModifiers(toEngineRuntimeModifiers(runtimeModifiersRef.current));
        applyLevelLimits();
        publishRetryReason(null);
        retryResetInProgressRef.current = false;
        engineRef.current.setDifficultyBonusHp(0);
        engineRef.current.setHpAdjustment(hpAdjustmentRef.current);
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
          lightShotDamage: engineRef.current.getCurrentLightShotDamage(),
          betterShotLevel: engineRef.current.getBetterShotLevel(),
        });
        setIsRunning(true);
      })
      .catch((err) => {
        console.error("[GameEngine] Failed to load game_config.json:", err);
      });

    return () => { cancelAnimationFrame(animFrameRef.current); };
  }, [applyLevelLimits, publishRetryReason]);

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
        bossNoticeRemainingRef.current = visibleState.bossIntroActive ? 1 : 0;
        setGrenadesLeft(engineRef.current.getGrenadesLeft());
        const bossPhase = engineRef.current.isBossPhase();
        if (cfg && !bossPhase && !retryResetInProgressRef.current) {
          timerTickAccumulatorRef.current += delta;
          while (timerTickAccumulatorRef.current >= 0.1) {
            timerTickAccumulatorRef.current -= 0.1;
            if (breathingActiveRef.current) {
              setBreathingWave((prev) => ({ ...prev, countdownRemaining: breathingCountdownRef.current }));
            } else {
              const activeEnemies = engineRef.current.getEnemyBallCount();
              const waveHadActivity = engineRef.current.getLaunchedCount() > 0 || waveEndSpawnPausedRef.current || finalCountdownActiveRef.current;
              const regularWaveCleared = activeEnemies === 0 && waveHadActivity;
              if (regularWaveCleared && engineRef.current.hasCurrentLevelBoss() && !visibleState.sessionCleared) {
                finalCountdownActiveRef.current = false;
                finalCountdownRemainingRef.current = Infinity;
                timerRemainingRef.current = Infinity;
              } else {
                if (ammoRemainingRef.current > 15) lowAmmoHysteresisArmedRef.current = true;
                if (lowAmmoHysteresisArmedRef.current && ammoRemainingRef.current <= 15 && !waveEndSpawnPausedRef.current) {
                  waveEndSpawnPausedRef.current = true;
                  engineRef.current.setOrangeSpawningPaused(true);
                }
                if (lowAmmoHysteresisArmedRef.current && ammoRemainingRef.current <= 10 && !finalCountdownActiveRef.current) {
                  finalCountdownActiveRef.current = true;
                  finalCountdownRemainingRef.current = DEFAULT_LEVEL_TIMER_SECONDS;
                  timerRemainingRef.current = finalCountdownRemainingRef.current;
                }
                if (finalCountdownActiveRef.current) {
                  finalCountdownRemainingRef.current = Math.max(0, Math.round((finalCountdownRemainingRef.current - 0.1) * 10) / 10);
                  timerRemainingRef.current = finalCountdownRemainingRef.current;
                  if (finalCountdownRemainingRef.current <= 0 && activeEnemies > 0) beginBreathingWave("defeat", { endReason: "time_expired" });
                } else {
                  timerRemainingRef.current = Infinity;
                }
              }
            }
          }
        }
        const rewardNoticeEvent = state.events.find((event): event is Extract<GameEvent, { type: "phase_changed" }> => event.type === "phase_changed" && event.phase === "reward_notice");
        if (rewardNoticeEvent) {
          beginBreathingWave("victory", {
            phaseAlreadyRecorded: true,
            endReason: rewardNoticeEvent.rewardTrigger === "boss_defeated" ? "boss_defeated" : "terrain_cleared",
          });
        }
        if (state.events.length > 0) setLastEvents(state.events);
        setGameState({
          ...visibleState,
          time: timestamp / 1000,
          timerSecondsRemaining: bossPhase ? Infinity : (finalCountdownActiveRef.current ? finalCountdownRemainingRef.current : Infinity),
          ammoRemaining: bossPhase ? Infinity : ammoRemainingRef.current,
          retryReason: retryReasonRef.current,
          isBossPhase: bossPhase,
          lightShotDamage: engineRef.current.getCurrentLightShotDamage(),
          betterShotLevel: engineRef.current.getBetterShotLevel(),
        });

        // ---- Auto-reboot detection ----
        if (
          cfg &&
          cfg && cfg.game_session.auto_reboot_on_clear && false &&
          visibleState.sessionCleared &&
          !rebootingRef.current
        ) {
          rebootingRef.current = true;
          const delaySec = cfg!.game_session.reboot_delay_seconds ?? 1.5;
          // Advance to the next level (with wrap-around) before reboot,
          // unless: (a) config disables progression, OR (b) we are in
          // single-color mode (a single looping level, no story).
          const levelCount = cfg!.levels?.list?.length ?? 0;
          if (sessionModeRef.current === "boss_rush" && bossRushOrderRef.current.length > 0) {
            const order = bossRushOrderRef.current;
            const pos = Math.max(0, order.indexOf(currentLevelIdxRef.current));
            currentLevelIdxRef.current = order[(pos + 1) % order.length];
          } else {
            const advance =
              cfg!.game_session.advance_level_on_clear !== false &&
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

  const doReset = useCallback(() => {
    const cfg = configRef.current;
    if (!cfg) return;
    retryResetInProgressRef.current = true;
    publishRetryReason(null);
    engineRef.current = new GameEngine(cfg, currentLevelIdxRef.current);
    engineRef.current.setDifficultyBonusHp(0);
    engineRef.current.setHpAdjustment(hpAdjustmentRef.current);
    grenadeZonesRef.current = createGrenadeZoneStore();
    setGrenadesLeft(engineRef.current.getGrenadesLeft());
    // Re-apply the persistent session mode so resets keep the user's choice
    // (single-color mode survives auto-reboot, manual reset, etc.).
    if (sessionModeRef.current === "single_color") {
      engineRef.current.setSingleColorMode(true);
    }
    applyLevelLimits();
    waveNumberRef.current = 1;
    lastWaveColorRef.current = null;
    finalCountdownActiveRef.current = false;
    finalCountdownRemainingRef.current = Infinity;
    lowAmmoHysteresisArmedRef.current = ammoRemainingRef.current > 15;
    waveEndSpawnPausedRef.current = false;
    engineRef.current.setOrangeSpawningPaused(false);
    breathingActiveRef.current = false;
    breathingCountdownRef.current = 0;
    syncRuntimeConfig(runtimeModifiersRef.current, 1);
    setBreathingWave({ waveNumber: 1, phase: "active", countdownRemaining: 0, message: "vague 1 active", aiAnalyzing: false, alveoles: [], victoryPulse: false, outcome: null, endReason: null });
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
      lightShotDamage: engineRef.current.getCurrentLightShotDamage(),
      betterShotLevel: engineRef.current.getBetterShotLevel(),
    });
    lastTimeRef.current = performance.now();
    pausedRef.current = false;
    setIsRunning(true);
    window.setTimeout(() => { retryResetInProgressRef.current = false; }, 0);
  }, [applyLevelLimits, publishRetryReason]);

  const debugClearRegularWave = useCallback((): number => {
    const cleared = engineRef.current?.debugClearRegularWave() ?? 0;
    publishDebugState();
    return cleared;
  }, [publishDebugState]);

  const debugFinishBossNotice = useCallback((): void => {
    bossNoticeRemainingRef.current = 0;
    engineRef.current?.debugFinishBossNotice();
    publishDebugState();
  }, [publishDebugState]);

  const debugWeakenBoss = useCallback((): number => {
    const weakened = engineRef.current?.debugWeakenBoss() ?? 0;
    publishDebugState();
    return weakened;
  }, [publishDebugState]);

  const debugKillBoss = useCallback((): number => {
    const killed = engineRef.current?.debugKillBoss() ?? 0;
    publishDebugState();
    return killed;
  }, [publishDebugState]);

  const debugStartRewardNotice = useCallback((): void => {
    beginBreathingWave("victory");
    publishDebugState();
  }, [beginBreathingWave, publishDebugState]);

  useEffect(() => installBallDebugApi({
    debugClearRegularWave,
    debugFinishBossNotice,
    debugWeakenBoss,
    debugKillBoss,
    debugStartRewardNotice,
  }), [debugClearRegularWave, debugFinishBossNotice, debugKillBoss, debugStartRewardNotice, debugWeakenBoss]);

  const pause  = useCallback(() => { pausedRef.current = true;  setIsRunning(false); }, []);
  const resume = useCallback(() => { pausedRef.current = false; lastTimeRef.current = performance.now(); setIsRunning(true); }, []);
  const reset  = useCallback(() => { rebootingRef.current = false; doReset(); }, [doReset]);
  const openRetryMenu = useCallback(() => {
    publishRetryReason("manual");
    pausedRef.current = true;
    setIsRunning(false);
  }, [beginBreathingWave]);

  const goToBoss = useCallback(() => {
    const cfg = configRef.current;
    if (!cfg || !cfg.levels?.list?.length) return;
    const levels = cfg.levels.list;
    const start = ((currentLevelIdxRef.current % levels.length) + levels.length) % levels.length;
    let target = -1;
    for (let offset = 0; offset < levels.length; offset += 1) {
      const idx = (start + offset) % levels.length;
      if (levels[idx]?.boss) { target = idx; break; }
    }
    if (target < 0) return;

    const restored: GameConfig = {
      ...cfg,
      game_session: { ...cfg.game_session, max_balls_spawned: defaultMaxSpawnRef.current },
    };
    const bossConfig: GameConfig = {
      ...restored,
      game_session: { ...restored.game_session, max_balls_spawned: 0 },
    };

    sessionModeRef.current = "levels";
    bossRushOrderRef.current = [];
    currentLevelIdxRef.current = target;
    rebootingRef.current = false;
    configRef.current = bossConfig;
    doReset();
    configRef.current = restored;
    setConfig(restored);
  }, [doReset]);


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
      return null;
    }
    const types = cfg.gameplay_controls.shot_types;
    const effective: ShotKind = holdSeconds >= (types.mega?.min_hold_seconds ?? 0.8) ? "mega" : holdSeconds >= (types.heavy?.min_hold_seconds ?? 0.3) ? "heavy" : "light";
    const resolved: ShotKind = forcedKind ?? effective;
    const holdForResolved = holdSeconds;
    const projectileColor: BallColor = resolved === "light" ? "white" : resolved === "heavy" ? "yellow" : "pink";
    const proj = engineRef.current.playerShoot(targetX, targetY, holdForResolved, projectileColor, resolved);
    if (!proj) return null;

    if (!bossPhase) {
      ammoRemainingRef.current = Math.max(0, ammoRemainingRef.current - 1);
      setGameState((prev) => prev ? {
        ...prev,
        ammoRemaining: ammoRemainingRef.current,
        retryReason: null,
      } : prev);
    }

    return resolved;
  }, [beginBreathingWave]);

  const toggleGrenade = useCallback((dir: Vec2, effect: string = "ring"): boolean => {
    if (!engineRef.current || pausedRef.current) return false;
    const ok = engineRef.current.toggleGrenade(dir, effect);
    setGrenadesLeft(engineRef.current.getGrenadesLeft());
    return ok;
  }, []);

  const placeMine = useCallback((position: Vec2, effect: string = "mine"): boolean => {
    if (!engineRef.current || pausedRef.current) return false;
    return engineRef.current.placeMine(position, effect);
  }, []);

  const upgradeBetterShot = useCallback((): number => {
    const level = engineRef.current?.upgradeBetterShot() ?? 0;
    setGameState((prev) => prev ? { ...prev, betterShotLevel: level, lightShotDamage: engineRef.current?.getCurrentLightShotDamage() ?? prev.lightShotDamage } : prev);
    return level;
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

  const launchLevel = useCallback((levelId: number) => {
    const cfg = configRef.current;
    if (!cfg || !cfg.levels?.list?.length) return;
    const index = cfg.levels.list.findIndex((level) => level.id === levelId);
    if (index < 0) return;
    configRef.current = { ...cfg, game_session: { ...cfg.game_session, max_balls_spawned: defaultMaxSpawnRef.current } };
    setConfig(configRef.current);
    sessionModeRef.current = "levels";
    bossRushOrderRef.current = [];
    currentLevelIdxRef.current = index;
    rebootingRef.current = false;
    doReset();
  }, [doReset]);

  const launchBossLevel = useCallback((levelId: number) => {
    const cfg = configRef.current;
    if (!cfg || !cfg.levels?.list?.length) return;
    const index = cfg.levels.list.findIndex((level) => level.id === levelId && level.boss);
    if (index < 0) return;
    const bossConfig: GameConfig = {
      ...cfg,
      game_session: { ...cfg.game_session, max_balls_spawned: 0 },
    };
    configRef.current = bossConfig;
    setConfig(bossConfig);
    sessionModeRef.current = "levels";
    bossRushOrderRef.current = [];
    currentLevelIdxRef.current = index;
    rebootingRef.current = false;
    doReset();
  }, [doReset]);

  const launchTemporaryBallTest = useCallback((levelConfig: LevelEntry) => {
    const cfg = configRef.current;
    if (!cfg) return;
    const list = [...(cfg.levels?.list ?? []), levelConfig];
    const nextConfig: GameConfig = {
      ...cfg,
      game_session: {
        ...cfg.game_session,
        max_balls_spawned: Math.max(1, cfg.game_session?.max_balls_spawned ?? defaultMaxSpawnRef.current),
        advance_level_on_clear: false,
      },
      levels: { ...cfg.levels, list },
    };
    configRef.current = nextConfig;
    setConfig(nextConfig);
    sessionModeRef.current = "temporary_ball_test";
    bossRushOrderRef.current = [];
    currentLevelIdxRef.current = list.length - 1;
    rebootingRef.current = false;
    doReset();
  }, [doReset]);

  const applyRuntimeConfig = useCallback((nextConfig: GameConfig, options?: { reset?: boolean; playtestTarget?: unknown }) => {
    configRef.current = nextConfig;
    setConfig(nextConfig);
    engineRef.current?.updateConfig(nextConfig);

    const target = options?.playtestTarget as
      | { kind?: unknown; levelId?: unknown; levelConfig?: unknown }
      | undefined;

    if (target?.kind === "boss" && typeof target.levelId === "number") {
      launchBossLevel(target.levelId);
      return;
    }
    if (target?.kind === "level" && typeof target.levelId === "number") {
      launchLevel(target.levelId);
      return;
    }
    if (target?.kind === "temporaryBall" && target.levelConfig && typeof target.levelConfig === "object") {
      launchTemporaryBallTest(target.levelConfig as LevelEntry);
      return;
    }
    if (options?.reset) {
      rebootingRef.current = false;
      doReset();
    }
  }, [doReset, launchBossLevel, launchLevel, launchTemporaryBallTest]);

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
  }, []);

  const setHpAdjustment = useCallback((next: number) => {
    const safe = clampDifficultyHpValue(configRef.current, next);
    hpAdjustmentRef.current = safe;
    setHpAdjustmentState(safe);
    engineRef.current?.setHpAdjustment(safe);
    rebootingRef.current = false;
    doReset();
  }, [doReset]);


  const applyAlveole = useCallback((alveole: GameplayAlveole): GameplayFeedback => {
    const next = applyAlveoleModifier(runtimeModifiersRef.current, alveole);
    runtimeModifiersRef.current = next;
    setRuntimeModifiers(next);
    syncRuntimeConfig(next, breathingActiveRef.current ? 2 : 1);
    let ammoAdded = 0;
    let grenadesAdded = 0;
    if (alveole.effects.ammo_count && alveole.effects.ammo_count > 1) {
      ammoAdded = Math.max(2, Math.round(4 * (alveole.effects.ammo_count - 1) * 5));
      ammoRemainingRef.current += ammoAdded;
      if (ammoRemainingRef.current > 15) lowAmmoHysteresisArmedRef.current = true;
    }
    if (alveole.effects.grenade_count && alveole.effects.grenade_count > 1) {
      grenadesAdded = Math.max(1, Math.round((alveole.effects.grenade_count - 1) * 4));
      engineRef.current?.addGrenades(grenadesAdded);
      setGrenadesLeft(engineRef.current?.getGrenadesLeft() ?? grenadesLeft);
    }
    setGameState((prev) => prev ? { ...prev, ammoRemaining: ammoRemainingRef.current } : prev);
    setBreathingWave((prev) => ({ ...prev, message: `${alveole.label} appliqué`, alveoles: prev.alveoles.filter((item) => item.id !== alveole.id) }));
    return { ammoAdded, grenadesAdded, effects: alveole.effects };
  }, [grenadesLeft, syncRuntimeConfig]);

  const reloadWave = useCallback((): GameplayFeedback => {
    const activeRemainder = engineRef.current?.getEnemyBallCount() ?? 0;
    const add = Math.max(6, Math.ceil((nextWaveSpawnBudgetRef.current + activeRemainder) * 1.25 * runtimeModifiersRef.current.ammo_count));
    const grenadesAdded = Math.max(1, Math.ceil(add / 20));
    ammoRemainingRef.current += add;
    if (ammoRemainingRef.current > 15) lowAmmoHysteresisArmedRef.current = true;
    engineRef.current?.addGrenades(grenadesAdded);
    setGrenadesLeft(engineRef.current?.getGrenadesLeft() ?? grenadesLeft);
    engineRef.current?.resetShotProgression();
    setGameState((prev) => prev ? { ...prev, ammoRemaining: ammoRemainingRef.current, lightShotDamage: engineRef.current?.getCurrentLightShotDamage() ?? prev.lightShotDamage } : prev);
    return { ammoAdded: add, grenadesAdded };
  }, [grenadesLeft]);

  const launchNextWave = useCallback(() => {
    const cfg = configRef.current;
    if (!cfg || !engineRef.current || !breathingActiveRef.current) return;
    const spawnBudget = Math.max(4, nextWaveSpawnBudgetRef.current);
    finalCountdownActiveRef.current = false;
    finalCountdownRemainingRef.current = Infinity;
    lowAmmoHysteresisArmedRef.current = ammoRemainingRef.current > 15;
    waveEndSpawnPausedRef.current = false;
    engineRef.current.setOrangeSpawningPaused(false);
    timerRemainingRef.current = Infinity;
    waveNumberRef.current += 1;
    const baseForWave = baseConfigRef.current ?? cfg;
    const waveColor = pickDifferentWaveColor(baseForWave);
    const coloredBase = withSingleWaveColor(baseForWave, waveColor);
    const currentMax = coloredBase.game_session?.max_balls_spawned ?? engineRef.current.getLaunchedCount();
    const nextConfig = { ...coloredBase, game_session: { ...coloredBase.game_session, max_balls_spawned: Math.max(currentMax, engineRef.current.getLaunchedCount() + spawnBudget) } };
    baseConfigRef.current = nextConfig;
    configRef.current = nextConfig;
    setConfig(nextConfig);
    engineRef.current.updateConfig(nextConfig);
    engineRef.current.prepareNextRewardWave();
    syncRuntimeConfig(runtimeModifiersRef.current, 1);
    breathingActiveRef.current = false;
    breathingCountdownRef.current = 0;
    engineRef.current.spawnChaosBurst(3);
    recordRuntimePhaseChange("wave_active");
    setBreathingWave((prev) => ({ ...prev, waveNumber: waveNumberRef.current, phase: "active", countdownRemaining: 0, message: `vague ${waveNumberRef.current} active`, victoryPulse: false, outcome: null, endReason: null }));
  }, [pickDifferentWaveColor, recordRuntimePhaseChange, syncRuntimeConfig, withSingleWaveColor]);

  const requestContextualAlveoles = useCallback(() => {
    requestBreathingAlveoles("idle_micro_pause", ["longer_waves", "different_enemy_balls"]);
  }, [requestBreathingAlveoles]);

  const setRuntimeModifiersFromSettings = useCallback((next: RuntimeModifiers) => {
    runtimeModifiersRef.current = next;
    setRuntimeModifiers(next);
    syncRuntimeConfig(next, breathingActiveRef.current ? 2 : 1);
  }, [syncRuntimeConfig]);

  const resetRuntimeModifiers = useCallback(() => {
    runtimeModifiersRef.current = DEFAULT_RUNTIME_MODIFIERS;
    setRuntimeModifiers(DEFAULT_RUNTIME_MODIFIERS);
    syncRuntimeConfig(DEFAULT_RUNTIME_MODIFIERS, breathingActiveRef.current ? 2 : 1);
  }, [syncRuntimeConfig]);

  return {
    gameState, config, lastEvents, isRunning, playerQueue,
    pause, resume, reset, setArena,
    shoot, setLauncherColor, setCustomTerrainDistribution, setPlayerProjectileDistribution, setActiveLevel, setLevelWeights, applyRuntimeConfig, launchLevel, launchBossLevel, launchTemporaryBallTest, openRetryMenu, goToBoss, playBossRush, classifyHold, toggleGrenade, placeMine, upgradeBetterShot, grenadesLeft,
    setDifficulty, difficulty, setHpAdjustment, hpAdjustment,
    breathingWave, runtimeModifiers, applyAlveole, reloadWave, launchNextWave, requestContextualAlveoles, setRuntimeModifiersFromSettings, resetRuntimeModifiers, recordRuntimePhaseChange,
  };
}
