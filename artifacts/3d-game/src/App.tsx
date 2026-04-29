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
import type { BallColor, GameConfig, ShotKind } from "./engine/types";

function App() {
  const {
    gameState, config, lastEvents, isRunning, playerQueue,
    pause, resume, reset, setArena,
    shoot, setLauncherColor, setPlayerColors, classifyHold,
  } = useGameEngine();

  const [menuOpen, setMenuOpen] = useState(false);
  const [holdTime, setHoldTime] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdStartRef = useRef<number | null>(null);
  const animRef = useRef<number>(0);
  // Latest game-space pointer position, updated on every move; used as a
  // fallback target if a pointerup arrives at the window level (e.g. the
  // user released outside the canvas DOM).
  const lastTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Refs that mirror UI state so window-level listeners (installed once at
  // mount) always read the latest values without re-subscribing.
  const menuOpenRef = useRef(menuOpen);
  const isRunningRef = useRef(isRunning);
  useEffect(() => { menuOpenRef.current = menuOpen; }, [menuOpen]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  const handleMenuOpen = () => { pause(); setMenuOpen(true); };
  const handleMenuClose = () => { setMenuOpen(false); resume(); };

  // ---- Charge tracking (drives the visual ChargeBar) ----
  useEffect(() => {
    if (!isHolding) {
      cancelAnimationFrame(animRef.current);
      setHoldTime(0);
      return;
    }
    const tick = () => {
      if (holdStartRef.current != null) {
        setHoldTime((performance.now() - holdStartRef.current) / 1000);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isHolding]);

  const handlePointerDown = (gameX: number, gameY: number) => {
    if (menuOpenRef.current || !isRunningRef.current) return;
    holdStartRef.current = performance.now();
    lastTargetRef.current = { x: gameX, y: gameY };
    setIsHolding(true);
  };

  const handlePointerMove = (gameX: number, gameY: number) => {
    // Only track position while we are charging a shot.
    if (holdStartRef.current == null) return;
    lastTargetRef.current = { x: gameX, y: gameY };
  };

  const handlePointerUp = (gameX: number, gameY: number) => {
    if (holdStartRef.current == null) return; // already released
    const hold = (performance.now() - holdStartRef.current) / 1000;
    holdStartRef.current = null;
    setIsHolding(false);
    if (!menuOpenRef.current && isRunningRef.current) shoot(gameX, gameY, hold);
  };

  const handlePointerCancel = () => {
    holdStartRef.current = null;
    setIsHolding(false);
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
      if (holdStartRef.current == null) return;
      const { x, y } = lastTargetRef.current;
      handlePointerUp(x, y);
    };
    const onWindowCancel = () => {
      if (holdStartRef.current == null) return;
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

  const currentShotKind: ShotKind = classifyHold(holdTime);

  return (
    <div
      style={{
        width: "100vw", height: "100vh",
        maxWidth: "100vh", margin: "0 auto",
        background: "#020810", position: "relative", overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* 3D Scene */}
      <div style={{ position: "absolute", inset: 0 }}>
        <GameScene
          gameState={gameState}
          config={config}
          events={lastEvents}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      </div>

      {/* Player queue (bottom strip) */}
      <PlayerQueue queue={playerQueue} config={config} />

      {/* Charge bar (visible while holding) */}
      {isHolding && (
        <ChargeBar holdTime={holdTime} shotKind={currentShotKind} config={config} />
      )}

      {/* HUD */}
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
      {gameState.sessionCleared && <SessionClearOverlay config={config} />}

      {/* Menu overlay */}
      {menuOpen && (
        <Menu
          config={config}
          onClose={handleMenuClose}
          onArenaChange={setArena}
          onLauncherColorChange={setLauncherColor}
          onPlayerColorsChange={setPlayerColors}
        />
      )}
    </div>
  );
}

// ============================================================
// PlayerQueue — strip showing next balls (left = next to shoot)
// ============================================================
function PlayerQueue({ queue, config }: { queue: BallColor[]; config: GameConfig }) {
  if (queue.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0, right: 0, bottom: 64,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: 14,
        pointerEvents: "none",
        zIndex: 8,
      }}
    >
      {queue.map((color, i) => {
        const entry = config.ball_colors[color];
        const isNext = i === 0;
        const sz = isNext ? 46 : 30;
        return (
          <div
            key={i}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              opacity: i === 0 ? 1 : (i === 1 ? 0.78 : 0.55),
              transform: isNext ? "translateY(-6px)" : "none",
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
              <div style={{
                fontSize: 9, color: "#1e90ff", letterSpacing: 2,
                fontFamily: "'Courier New', monospace", textTransform: "uppercase",
              }}>
                ▲ tirer
              </div>
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
function SessionClearOverlay({ config }: { config: GameConfig }) {
  const delay = config.game_session?.reboot_delay_seconds ?? 1.5;
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
      <div style={{ fontSize: 12, color: "#88aaff", letterSpacing: 2 }}>
        Nouvelle partie dans {delay.toFixed(1)}s…
      </div>
    </div>
  );
}

export default App;
