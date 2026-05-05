// ============================================================
// HUD — Heads-Up Display (pure UI, no game logic)
// Shows ball count, session progress (X/20), pause/reset/menu.
// ============================================================

import type { GameConfig, GameState } from "../engine/types";

interface HUDProps {
  gameState: GameState;
  config: GameConfig;
  isRunning: boolean;
  levelTimerSeconds: number | null;
  shotsRemaining: number | null;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

const BTN: React.CSSProperties = {
  background: "rgba(10,20,50,0.85)",
  color: "#c0d8ff",
  border: "1px solid rgba(30,144,255,0.4)",
  borderRadius: 8,
  padding: "7px 18px",
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "'Courier New', monospace",
  backdropFilter: "blur(6px)",
  letterSpacing: 1,
};

export function HUD({ gameState, config, isRunning, levelTimerSeconds, shotsRemaining, onPause, onResume, onReset }: HUDProps) {
  const activeBalls = Array.from(gameState.balls.values()).filter(
    (b) => b.isAlive && b.color !== "orange" && b.metadata?.isProjectile !== true
  ).length;

  const launched = gameState.launchedCount;
  const max = gameState.maxBallsSpawned;
  const sessionPct = max > 0 ? Math.min(1, launched / max) : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "10px 12px",
        fontFamily: "'Courier New', monospace",
        color: "#e0f0ff",
        zIndex: 10,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0,8,24,0.72)",
          borderRadius: 10,
          padding: "8px 14px",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(30,144,255,0.25)",
          gap: 14,
        }}
      >
        <div style={{ minWidth: 72 }}>
          <div style={{ fontSize: 9, color: "#445", textTransform: "uppercase", letterSpacing: 3 }}>Restantes</div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#1e90ff", lineHeight: 1 }}>{activeBalls}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, minWidth: 210 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <span style={{ fontSize: 20, fontWeight: "bold", color: "#ffd166", minWidth: 48, textAlign: "center" }}>
              {levelTimerSeconds === null ? "∞" : `${Math.max(0, Math.ceil(levelTimerSeconds))}s`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <span style={{ fontSize: 20, fontWeight: "bold", color: "#7afcff", minWidth: 32, textAlign: "center" }}>
              {shotsRemaining === null ? "∞" : shotsRemaining}
            </span>
          </div>
        </div>

        {/* Session progress */}
        <div style={{ flex: 1, minWidth: 80 }}>
          <div style={{ fontSize: 9, color: "#445", textTransform: "uppercase", letterSpacing: 3, marginBottom: 3 }}>
            Vague {launched}/{max}
          </div>
          <div style={{
            height: 5, background: "rgba(30,144,255,0.15)",
            borderRadius: 3, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", width: `${sessionPct * 100}%`,
              background: launched >= max ? "#5EFF5E" : "#1e90ff",
              transition: "width 0.3s",
              boxShadow: launched >= max ? "0 0 8px #5EFF5E" : "0 0 6px #1e90ff",
            }} />
          </div>
        </div>

      </div>

      {/* Bottom controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
          pointerEvents: "all",
        }}
      >
        <button onClick={isRunning ? onPause : onResume} style={BTN}>
          {isRunning ? "⏸" : "▶"}
        </button>
        <button onClick={onReset} style={BTN}>↺</button>
      </div>

      {/* config-driven keepalive */}
      <span style={{ display: "none" }}>{config.game_session.max_balls_spawned}</span>
    </div>
  );
}
