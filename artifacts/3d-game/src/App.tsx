// ============================================================
// App — Entry point for the Ball Game
//
// Layers:
// 1. useGameEngine() — logic loop (config-driven)
// 2. GameScene       — 3D Three.js rendering
// 3. HUD             — top bar + bottom controls
// 4. PlayerQueue     — bottom strip with the next 3 balls
// 5. ChargeBar       — visualize hold duration / shot tier
// 6. Menu            — Game menu
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useGameEngine } from "./engine/useGameEngine";
import { GameScene } from "./scenes/GameScene";
import { HUD } from "./game/HUD";
import { Menu } from "./game/Menu";
import type { GameConfig, GameState, ShotKind, Vec2 } from "./engine/types";

function App() {
  const {
    gameState, config, lastEvents, isRunning, playerQueue,
    pause, resume, reset, setArena,
    shoot, setCustomTerrainDistribution, setActiveLevel, setLevelWeights, playBossRush, classifyHold, toggleGrenade, grenadesLeft, setDifficulty, difficulty,
  } = useGameEngine();

  const [menuOpen, setMenuOpen] = useState(false);
  const [holdTime, setHoldTime] = useState(0);
  const animRef = useRef<number>(0);
  const cycleStartRef = useRef<number>(performance.now());
  const pointerActiveRef = useRef(false);
  // Latest game-space pointer position, updated on every move; used as a
  // fallback target if a pointerup arrives at the window level (e.g. the
  // user released outside the canvas DOM).
  const lastTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 1000 });
  const lastDirectionRef = useRef<Vec2>({ x: 0, y: 1 });
  const [aimDirection, setAimDirection] = useState<Vec2>({ x: 0, y: 1 });
  const [ballEffect, setBallEffect] = useState(() => localStorage.getItem("bg_effect_ball") ?? "spark");
  const [grenadeEffect, setGrenadeEffect] = useState(() => localStorage.getItem("bg_effect_grenade") ?? "spark");
  const [debugExplosionTexture, setDebugExplosionTexture] = useState(() => localStorage.getItem("bg_debug_explosion_texture") === "1");
  useEffect(() => { localStorage.setItem("bg_effect_ball", ballEffect); }, [ballEffect]);
  useEffect(() => { localStorage.setItem("bg_effect_grenade", grenadeEffect); }, [grenadeEffect]);
  useEffect(() => { localStorage.setItem("bg_debug_explosion_texture", debugExplosionTexture ? "1" : "0"); }, [debugExplosionTexture]);
  // Refs that mirror UI state so window-level listeners (installed once at
  // mount) always read the latest values without re-subscribing.
  const menuOpenRef = useRef(menuOpen);
  const isRunningRef = useRef(isRunning);
  useEffect(() => { menuOpenRef.current = menuOpen; }, [menuOpen]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  const handleMenuOpen = () => { pause(); setMenuOpen(true); };
  const handleMenuClose = () => { setMenuOpen(false); resume(); };

  const getDisplayMax = (): number => {
    if (!config) return 1.2;
    const types = config.gameplay_controls.shot_types;
    return Math.max((types.heavy?.max_hold_seconds ?? 0.8) * 1.2, 1.2);
  };

  const tryShootBall = (targetX: number, targetY: number, holdSeconds: number): boolean => {
    const fired = shoot(targetX, targetY, holdSeconds);
    if (!fired) return false;
    return true;
  };

  // ---- Charge tracking (always visible cursor) ----
  useEffect(() => {
    const tick = () => {
      const hold = (performance.now() - cycleStartRef.current) / 1000;
      setHoldTime(Math.min(hold, getDisplayMax()));
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [config]);

  const handlePointerDown = (gameX: number, gameY: number) => {
    if (menuOpenRef.current || !isRunningRef.current) return;
    pointerActiveRef.current = true;
    lastTargetRef.current = { x: gameX, y: gameY };
    const dx = gameX;
    const dy = gameY + (config?.graphics.arena.height ?? 0) * 0.5;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) {
      const next = { x: dx / len, y: dy / len };
      lastDirectionRef.current = next;
      setAimDirection(next);
    }
  };

  const handlePointerMove = (gameX: number, gameY: number) => {
    lastTargetRef.current = { x: gameX, y: gameY };
    const dx = gameX;
    const dy = gameY + (config?.graphics.arena.height ?? 0) * 0.5;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) {
      const next = { x: dx / len, y: dy / len };
      lastDirectionRef.current = next;
      setAimDirection(next);
    }
  };

  const handlePointerUp = (gameX: number, gameY: number) => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    if (!menuOpenRef.current && isRunningRef.current) {
      tryShootBall(gameX, gameY, holdTime);
    }
    cycleStartRef.current = performance.now();
    setHoldTime(0);
  };

  const handlePointerCancel = () => {
    // The browser fires `pointercancel` quite aggressively on mobile
    // (e.g. when it decides a drag should become a scroll, even after
    // we set touch-action: none on some surfaces). Treating it as a
    // pure abort would silently swallow legitimate shots. Instead we
    // promote it to a release at the last tracked position — this is
    // the same idempotent path as a normal pointerup.
    const { x, y } = lastTargetRef.current;
    handlePointerUp(x, y);
  };

  // ---- Window-level pointerup safety net (installed once at mount) ----
  // If the user releases outside the canvas R3F won't emit onPointerUp,
  // so we always listen at the window. The handlers are gated by
  // holdStartRef so they no-op when no charge is in progress, and they
  // share the same idempotent path as the in-canvas handlers (no double
  // shot when both fire for the same release). Installed at mount to
  // close the small race window that would otherwise exist between
  // pointerdown and a `[isHolding]` effect remounting.
  useEffect(() => {
    const onWindowUp = () => {
      const { x, y } = lastTargetRef.current;
      handlePointerUp(x, y);
    };
    const onWindowCancel = () => {
      if (!pointerActiveRef.current) return;
      handlePointerCancel();
    };
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowCancel);
    return () => {
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  if (!gameState || !config) {
    return (
      <div
        style={{
          width: "100vw", height: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#020810", color: "#1e90ff",
          fontFamily: "monospace", flexDirection: "column", gap: 12,
        }}
      >
        <div style={{ fontSize: 32 }}>◉</div>
        <div style={{ fontSize: 14, color: "#4466aa" }}>Chargement du moteur de jeu…</div>
      </div>
    );
  }

  const currentShotKind: ShotKind = (() => {
    const types = config.gameplay_controls.shot_types;
    if (holdTime > types.mega.min_hold_seconds) return "mega";
    if (holdTime > types.heavy.min_hold_seconds) return "heavy";
    return "light";
  })();

  return (
    <div
      style={{
        width: "100vw", height: "100vh",
        maxWidth: "100vh", margin: "0 auto",
        background: "#020810", position: "relative", overflow: "hidden",
        userSelect: "none",
        // Disable native touch gestures (scroll/pan/zoom) on the whole game
        // surface. Without this, mobile browsers fire a synthetic
        // `pointercancel` as soon as the finger drags far enough to be
        // interpreted as a scroll, which aborts the charge.
        touchAction: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        overscrollBehavior: "none",
      }}
    >
      {/* 3D Scene */}
      <div style={{ position: "absolute", inset: 0, touchAction: "none" }}>
        <GameScene
          gameState={gameState}
          config={config}
          events={lastEvents}
          ballEffect={ballEffect}
          grenadeEffect={grenadeEffect}
          aimDirection={aimDirection}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          debugExplosionTexture={debugExplosionTexture}
        />
      </div>

      {/* Charge bar (always visible) */}
      <ChargeBar holdTime={holdTime} shotKind={currentShotKind} config={config} />


      {gameState.bossIntroActive && (
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", pointerEvents:"none", zIndex:11 }}>
          <div style={{ fontSize:64, fontWeight:900, letterSpacing:8, color:"#fff", textShadow:"0 0 24px #ff3b3b, 0 0 8px #000" }}>BOSS</div>
        </div>
      )}

      {/* HUD */}
      <button
        onClick={() => toggleGrenade(lastDirectionRef.current, grenadeEffect)}
        style={{position:"absolute", right:16, bottom:140, width:56, height:56, borderRadius:"50%", border:"2px solid #ffcc66", background:"radial-gradient(circle at 30% 30%, #667, #223)", color:"#fff", zIndex:12, fontWeight:"bold"}}
      >
        💣 {grenadesLeft}
      </button>

      <HUD
        gameState={gameState}
        config={config}
        isRunning={isRunning}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        onMenu={handleMenuOpen}
      />

      {/* Game-over flash */}
      {gameState.sessionCleared && (
        <SessionClearOverlay config={config} gameState={gameState} />
      )}

      {/* Menu overlay */}
      {menuOpen && (
        <Menu
          config={config}
          onClose={handleMenuClose}
          onArenaChange={setArena}
          onTerrainDistributionPlay={setCustomTerrainDistribution}
          onLevelSelect={setActiveLevel}
          onLevelWeightsChange={setLevelWeights}
          onPlayBossRush={playBossRush}
          onDifficultyChange={setDifficulty}
          difficulty={difficulty}
          currentLevelIndex={gameState.currentLevelIndex}
          ballEffect={ballEffect}
          grenadeEffect={grenadeEffect}
          onBallEffectChange={setBallEffect}
          onGrenadeEffectChange={setGrenadeEffect}
          debugExplosionTexture={debugExplosionTexture}
          onDebugExplosionTextureChange={setDebugExplosionTexture}
        />
      )}
    </div>
  );
}

// ============================================================
// IncomingBallsOverlay — centered balls preview above arena frame
// ============================================================
function IncomingBallsOverlay({ queue }: { queue: ShotKind[] }) {
  if (queue.length === 0) return null;

  const readyKind = queue[0];
  let readyCount = 0;
  for (const kind of queue) {
    if (kind !== readyKind) break;
    readyCount += 1;
  }

  const tint = readyKind === "light" ? "#F5F5F5" : readyKind === "heavy" ? "#FFE600" : "#ff66ff";

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 9,
        display: "flex",
        gap: 4,
        padding: "4px 8px",
        borderRadius: 999,
        background: "rgba(0, 8, 24, 0.72)",
        border: "1px solid rgba(30,144,255,0.3)",
      }}
    >
      {Array.from({ length: readyCount }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${tint}, ${tint}cc 70%, #000 100%)`,
            border: `1px solid ${tint}`,
            boxShadow: `0 0 8px ${tint}aa`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// PlayerQueue — strip showing next balls (left = next to shoot)
// ============================================================
function PlayerQueue({ queue, config }: { queue: ShotKind[]; config: GameConfig }) {
  if (queue.length === 0) return null;

  const readyKind = queue[0];
  let readyCount = 0;
  for (const kind of queue) {
    if (kind !== readyKind) break;
    readyCount += 1;
  }
  const readyTint = readyKind === "light" ? "#ffffff" : readyKind === "heavy" ? "#FFE600" : "#ff66ff";

  return (
    <div
      style={{
        position: "absolute",
        left: 0, right: 0, bottom: 64,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: 8,
        flexWrap: "wrap",
        maxWidth: 280,
        pointerEvents: "none",
        zIndex: 8,
      }}
    >
      {queue.map((kind, i) => {
        const entry = kind === "light" ? { hex: "#F5F5F5" } : kind === "heavy" ? { hex: "#FFE600" } : { hex: "#ff66ff" };
        const isNext = i === 0;
        const base = kind === "light" ? 12 : kind === "heavy" ? 15 : 18;
        const sz = isNext ? base + 2 : base;
        return (
          <div
            key={i}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              opacity: i === 0 ? 1 : (i === 1 ? 0.78 : 0.55),
              transform: isNext ? "translateY(-2px)" : "none",
              transition: "all 0.25s",
            }}
          >
            <div
              style={{
                width: sz, height: sz, borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${entry?.hex ?? "#888"}ff, ${entry?.hex ?? "#444"}aa 70%, #000 100%)`,
                boxShadow: isNext
                  ? `0 0 14px ${entry?.hex ?? "#888"}, inset 0 0 4px rgba(255,255,255,0.4)`
                  : `0 0 6px ${entry?.hex ?? "#555"}66`,
                border: isNext ? `2px solid ${entry?.hex ?? "#aaa"}` : "1px solid rgba(255,255,255,0.15)",
              }}
            />
            {isNext && (
              <>
                <div style={{
                  fontSize: 9, color: "#1e90ff", letterSpacing: 2,
                  fontFamily: "'Courier New', monospace", textTransform: "uppercase",
                }}>
                  ▲ tirer
                </div>
                <div
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 2,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: `1px solid ${readyTint}`,
                    background: "rgba(8,12,20,0.85)",
                    color: readyTint,
                    fontFamily: "'Courier New', monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textShadow: `0 0 8px ${readyTint}`,
                    boxShadow: `0 0 8px ${readyTint}55`,
                  }}
                >
                  x{readyCount}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ChargeBar — power meter while clicking
// ============================================================
function ChargeBar({ holdTime, shotKind, config }: { holdTime: number; shotKind: ShotKind; config: GameConfig }) {
  const types = config.gameplay_controls.shot_types;
  const lightMax = types.light.max_hold_seconds;  // ~0.5s
  const heavyMax = types.heavy.max_hold_seconds;  // ~1.0s
  const displayMax = Math.max(heavyMax * 1.2, 1.2);
  const pct = Math.min(1, holdTime / displayMax);

  const tint = types[shotKind].color_tint ?? "#1e90ff";
  const label = types[shotKind]._label;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%", transform: "translateX(-50%)",
        bottom: 130,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        pointerEvents: "none",
        zIndex: 9,
        fontFamily: "'Courier New', monospace",
      }}
    >
      <div style={{
        fontSize: 11, color: tint, letterSpacing: 2, textTransform: "uppercase", fontWeight: "bold",
        textShadow: `0 0 6px ${tint}`,
      }}>
        {label}
      </div>
      <div style={{
        width: 180, height: 6, background: "rgba(255,255,255,0.12)",
        borderRadius: 3, overflow: "hidden", position: "relative",
      }}>
        <div style={{
          height: "100%", width: `${pct * 100}%`,
          background: `linear-gradient(to right, #888, ${tint})`,
          boxShadow: `0 0 8px ${tint}`,
          transition: "width 0.05s",
        }} />
        {/* Tier markers */}
        <div style={{ position: "absolute", top: -2, left: `${(lightMax / displayMax) * 100}%`, width: 1, height: 10, background: "#fff8" }} />
        <div style={{ position: "absolute", top: -2, left: `${(heavyMax / displayMax) * 100}%`, width: 1, height: 10, background: "#fff8" }} />
      </div>
      <div style={{ fontSize: 9, color: "#446", letterSpacing: 1 }}>{holdTime.toFixed(2)}s</div>
    </div>
  );
}

// ============================================================
// Session clear overlay
// ============================================================
function SessionClearOverlay({
  config,
  gameState,
}: {
  config: GameConfig;
  gameState: GameState;
}) {
  const delay = config.game_session?.reboot_delay_seconds ?? 1.5;
  const advance = config.game_session?.advance_level_on_clear !== false;
  const levels = config.levels?.list ?? [];
  let nextLabel: string | null = null;
  if (advance && levels.length > 0) {
    const nextIdx = (gameState.currentLevelIndex + 1) % levels.length;
    const next = levels[nextIdx];
    if (next) nextLabel = `Niveau ${next.id} — ${next.name.replace(/^Niveau\s*\d+\s*[—-]\s*/i, "")}`;
  }
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,5,20,0.45)",
        backdropFilter: "blur(2px)",
        pointerEvents: "none",
        zIndex: 50,
        fontFamily: "'Courier New', monospace",
        flexDirection: "column", gap: 8,
        animation: "ballGameFadeIn 0.4s",
      }}
    >
      <div style={{ fontSize: 28, color: "#1e90ff", letterSpacing: 4, textShadow: "0 0 14px #1e90ff" }}>
        TERRAIN NETTOYÉ
      </div>
      {nextLabel && (
        <div style={{ fontSize: 16, color: "#dfecff", letterSpacing: 1.5, marginTop: 4 }}>
          → {nextLabel}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#88aaff", letterSpacing: 2 }}>
        {nextLabel ? `Démarrage dans ${delay.toFixed(1)}s…` : `Nouvelle partie dans ${delay.toFixed(1)}s…`}
      </div>
    </div>
  );
}

export default App;
