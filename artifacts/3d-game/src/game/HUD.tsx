// ============================================================
// HUD — Heads-Up Display (pure UI, no game logic)
// ============================================================

import type { GameConfig, GameState } from "../engine/types";

interface HUDProps {
  gameState: GameState;
  config: GameConfig;
  isRunning: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

export function HUD({ gameState, config, isRunning, onPause, onResume, onReset }: HUDProps) {
  const activeBalls = Array.from(gameState.balls.values()).filter((b) => b.isAlive);
  const colorCounts: Record<string, number> = {};
  for (const b of activeBalls) {
    colorCounts[b.color] = (colorCounts[b.color] ?? 0) + 1;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "12px",
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
          alignItems: "flex-start",
          background: "rgba(0,10,30,0.7)",
          borderRadius: 8,
          padding: "8px 12px",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(30,144,255,0.3)",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "#668", textTransform: "uppercase", letterSpacing: 2 }}>
            Ball Game
          </div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#1e90ff" }}>
            {activeBalls.length} <span style={{ fontSize: 11, color: "#88a", fontWeight: "normal" }}>balles actives</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#668", textTransform: "uppercase", letterSpacing: 2 }}>
            Score
          </div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#ffcc00" }}>
            {gameState.score}
          </div>
        </div>
      </div>

      {/* Ball legend */}
      <div
        style={{
          background: "rgba(0,10,30,0.7)",
          borderRadius: 8,
          padding: "8px 10px",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(30,144,255,0.2)",
          maxHeight: 200,
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 10, color: "#556", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
          Couleurs actives
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {Object.entries(config.ball_colors).map(([color, entry]) => {
            const count = colorCounts[color] ?? 0;
            if (count === 0) return null;
            const rule = config.ball_rules[color as keyof typeof config.ball_rules]?.rule ?? "";
            return (
              <div
                key={color}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 4,
                  padding: "2px 6px",
                  border: `1px solid ${entry.hex}44`,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: entry.hex,
                    flexShrink: 0,
                    boxShadow: `0 0 4px ${entry.hex}`,
                  }}
                />
                <span style={{ fontSize: 9, color: "#aac" }}>{entry._label ?? color}</span>
                <span style={{ fontSize: 9, color: "#668" }}>×{count}</span>
                <span style={{ fontSize: 8, color: "#445", fontStyle: "italic" }}>{rule}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          pointerEvents: "all",
        }}
      >
        <button
          onClick={isRunning ? onPause : onResume}
          style={{
            background: "rgba(30,90,180,0.8)",
            color: "#fff",
            border: "1px solid rgba(30,144,255,0.5)",
            borderRadius: 6,
            padding: "6px 16px",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "inherit",
            backdropFilter: "blur(4px)",
          }}
        >
          {isRunning ? "⏸ Pause" : "▶ Reprendre"}
        </button>
        <button
          onClick={onReset}
          style={{
            background: "rgba(20,40,80,0.8)",
            color: "#aac",
            border: "1px solid rgba(30,144,255,0.3)",
            borderRadius: 6,
            padding: "6px 16px",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "inherit",
            backdropFilter: "blur(4px)",
          }}
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
