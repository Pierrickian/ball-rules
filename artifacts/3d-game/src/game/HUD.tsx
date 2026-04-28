// ============================================================
// HUD — Heads-Up Display (pure UI, no game logic)
// Shows ball count, controls, and menu button.
// The ball legend has been removed — colors on screen speak.
// ============================================================

import type { GameConfig, GameState } from "../engine/types";

interface HUDProps {
  gameState: GameState;
  config: GameConfig;
  isRunning: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onMenu: () => void;
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

export function HUD({ gameState, isRunning, onPause, onResume, onReset, onMenu }: HUDProps) {
  const activeBalls = Array.from(gameState.balls.values()).filter((b) => b.isAlive).length;

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
          padding: "6px 14px",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(30,144,255,0.25)",
        }}
      >
        <div>
          <div style={{ fontSize: 9, color: "#445", textTransform: "uppercase", letterSpacing: 3 }}>Balles</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#1e90ff", lineHeight: 1 }}>{activeBalls}</div>
        </div>

        <button
          onClick={onMenu}
          style={{ ...BTN, pointerEvents: "all", padding: "6px 14px", fontSize: 16 }}
          title="Menu"
        >
          ☰
        </button>
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
    </div>
  );
}
