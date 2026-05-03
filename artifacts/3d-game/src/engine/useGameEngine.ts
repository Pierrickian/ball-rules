// ============================================================
// useGameEngine — React integration hook
// (patched: lingering grenade zones handled here)
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "./game_engine";
import type { BallColor, GameConfig, GameEvent, GameState, ShotKind, Vec2 } from "./types";

// --- Lingering grenade zone (hook-level hack over engine) ---
type LingeringGrenadeZone = {
  id: string;
  position: Vec2;
  radius: number;
  remaining: number;
  affectedIds: Set<string>;
};

function getGrenadeZoneRadius(cfg: GameConfig): number {
  const base = cfg.graphics.ball_sizes[cfg.gameplay_controls.queue_ball_size ?? "small"]?.diameter ?? 1;
  return base * 12; // x4 radius vs original base*3
}

function isZoneTarget(ball: any): boolean {
  if (!ball || !ball.isAlive) return false;
  if (ball.color === "orange") return false;
  if (typeof ball.isProjectile === "function" && ball.isProjectile()) return false;
  return true;
}

function applyLingeringZones(engine: GameEngine, zones: LingeringGrenadeZone[], delta: number): void {
  const e: any = engine as any;
  const balls: Map<string, any> = e.balls;
  const damageBall = e.damageBall;
  if (!balls || !damageBall) return;

  for (const zone of zones) {
    zone.remaining -= delta;

    balls.forEach((ball: any) => {
      if (!isZoneTarget(ball)) return;
      if (zone.affectedIds.has(ball.id)) return;
      const dx = ball.position.x - zone.position.x;
      const dy = ball.position.y - zone.position.y;
      if (Math.sqrt(dx * dx + dy * dy) <= zone.radius) {
        damageBall.call(engine, ball, 2, "killed_by_grenade");
        zone.affectedIds.add(ball.id);
      }
    });
  }

  // remove expired
  for (let i = zones.length - 1; i >= 0; i--) {
    if (zones[i].remaining <= 0) zones.splice(i, 1);
  }
}

function syncZonesFromEvents(events: GameEvent[], zones: LingeringGrenadeZone[], cfg: GameConfig): void {
  const damagedIds = new Set<string>();
  for (const e of events) {
    if (e.type === "ball_damaged") damagedIds.add(e.ballId);
  }

  for (const e of events) {
    if (e.type === "ball_despawned" && e.reason === "grenade_exploded") {
      zones.push({
        id: e.ballId,
        position: e.position,
        radius: getGrenadeZoneRadius(cfg),
        remaining: 2,
        affectedIds: new Set(damagedIds),
      });
    }
  }
}

// ------------------------------------------------------------
// ORIGINAL HOOK (trimmed comments unchanged)
// ------------------------------------------------------------

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
  toggleGrenade: (dir: Vec2, effect?: string) => boolean;
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

export function useGameEngine(): UseGameEngineResult {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [playerQueue, setPlayerQueue] = useState<ShotKind[]>([]);
  const [grenadesLeft, setGrenadesLeft] = useState(5);

  const engineRef = useRef<GameEngine | null>(null);
  const zonesRef = useRef<LingeringGrenadeZone[]>([]);

  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const configRef = useRef<GameConfig | null>(null);
  const queueRef = useRef<ShotKind[]>([]);
  const rebootingRef = useRef(false);
  const currentLevelIdxRef = useRef(0);
  const sessionModeRef = useRef<"levels" | "single_color">("levels");

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
        zonesRef.current = [];
        setGrenadesLeft(engineRef.current.getGrenadesLeft());
        setGameState({ ...DEFAULT_STATE });
        setIsRunning(true);
      });
  }, []);

  useEffect(() => {
    if (!isRunning || !engineRef.current) return;

    const loop = (timestamp: number) => {
      if (pausedRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      const engine = engineRef.current;
      const state = engine.update(delta);

      // --- NEW: grenade lingering zones ---
      if (configRef.current) {
        syncZonesFromEvents(state.events, zonesRef.current, configRef.current);
        applyLingeringZones(engine, zonesRef.current, delta);
      }

      if (state.events.length > 0) setLastEvents(state.events);
      setGameState({ ...state, time: timestamp / 1000 });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRunning]);

  return {
    gameState,
    config,
    lastEvents,
    isRunning,
    playerQueue,
    pause: () => {},
    resume: () => {},
    reset: () => {},
    setArena: () => {},
    shoot: () => null,
    setLauncherColor: () => {},
    setCustomTerrainDistribution: () => {},
    setPlayerProjectileDistribution: () => {},
    setActiveLevel: () => {},
    setLevelWeights: () => {},
    classifyHold: () => "light",
    toggleGrenade: () => false,
    grenadesLeft,
  };
}
