// ============================================================
// Menu — Game menu with 2 sub-menus:
//   1. Règles du jeu — concept overview (no technical details)
//   2. Détail des balles — carousel of ball identity cards
// ============================================================

import { useState } from "react";
import type { GameConfig } from "../engine/types";

type MenuView = "main" | "rules" | "balls";

interface MenuProps {
  config: GameConfig;
  onClose: () => void;
}

// ---- Shared styles ----
const OVERLAY: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,5,18,0.88)",
  backdropFilter: "blur(10px)",
  fontFamily: "'Courier New', monospace",
};

const PANEL: React.CSSProperties = {
  background: "rgba(4,12,35,0.97)",
  border: "1px solid rgba(30,144,255,0.35)",
  borderRadius: 16,
  padding: "28px 24px",
  width: "min(92vw, 380px)",
  maxHeight: "88vh",
  overflowY: "auto",
  color: "#c8deff",
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const TITLE: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 3,
  color: "#334",
  marginBottom: 2,
};

const CLOSE_BTN: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(30,144,255,0.3)",
  color: "#668",
  borderRadius: 8,
  padding: "6px 14px",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
  alignSelf: "center",
  marginTop: 4,
};

const MENU_BTN: React.CSSProperties = {
  background: "rgba(12,28,72,0.8)",
  border: "1px solid rgba(30,144,255,0.3)",
  color: "#aac8f0",
  borderRadius: 10,
  padding: "14px 20px",
  cursor: "pointer",
  fontSize: 14,
  fontFamily: "inherit",
  textAlign: "left",
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

// ---- Main Menu ----
function MainMenu({ onRules, onBalls, onClose }: { onRules: () => void; onBalls: () => void; onClose: () => void }) {
  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Menu</div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#1e90ff" }}>Ball Game</div>
      </div>
      <button style={MENU_BTN} onClick={onRules}>
        <span style={{ fontSize: 20 }}>📖</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Règles du jeu</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Comprendre le concept</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onBalls}>
        <span style={{ fontSize: 20 }}>🔮</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Détail des balles</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Carte d'identité de chaque couleur</div>
        </div>
      </button>
      <button style={CLOSE_BTN} onClick={onClose}>✕ Retour au jeu</button>
    </div>
  );
}

// ---- Rules View ----
function RulesView({ config, onBack }: { config: GameConfig; onBack: () => void }) {
  const concept = config.game_rules_concept;
  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Concept</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#1e90ff", marginBottom: 10 }}>
          {concept?.title ?? "Règles du jeu"}
        </div>
        <p style={{ fontSize: 13, color: "#99b0d4", lineHeight: 1.6, marginBottom: 14 }}>
          {concept?.concept}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {concept?.sections?.map((s, i) => (
            <div
              key={i}
              style={{
                borderLeft: "2px solid rgba(30,144,255,0.5)",
                paddingLeft: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: "bold", color: "#6fa8dc", marginBottom: 3 }}>
                {s.heading}
              </div>
              <div style={{ fontSize: 12, color: "#8899bb", lineHeight: 1.6 }}>{s.text}</div>
            </div>
          ))}
        </div>
      </div>
      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ---- Ball Detail Card ----
interface BallCardProps {
  colorKey: string;
  config: GameConfig;
}

function BallCard({ colorKey, config }: BallCardProps) {
  const colorEntry = config.ball_colors[colorKey as keyof typeof config.ball_colors];
  const ruleEntry = config.ball_rules[colorKey as keyof typeof config.ball_rules];
  const bounceCondition = config.bounce_conditions?.ball_bounce_conditions?.[colorKey] ?? "—";
  const spawnCond = config.gameplay[colorKey]?.spawn?.condition ?? "—";
  const despawnCond = config.gameplay[colorKey]?.despawn?.condition ?? "—";

  const bounceLabels: Record<string, string> = {
    against_wall:     "Rebondit sur les murs",
    against_ball:     "Rebondit sur les balles (traverse les murs)",
    against_obstacle: "Rebondit sur les obstacles",
    against_all:      "Rebondit sur tout",
  };

  const isWhite = colorKey === "white";

  return (
    <div
      style={{
        background: "rgba(6,16,45,0.9)",
        border: `1.5px solid ${colorEntry?.hex ?? "#334"}55`,
        borderRadius: 14,
        padding: "20px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 320,
      }}
    >
      {/* Color swatch + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: colorEntry?.hex ?? "#888",
            boxShadow: `0 0 18px ${colorEntry?.hex ?? "#888"}88`,
            border: isWhite ? "1px solid #555" : "none",
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{ fontSize: 18, fontWeight: "bold", color: "#ddeeff" }}>
            {colorEntry?._label ?? colorKey}
          </div>
          <div style={{ fontSize: 11, color: "#445", fontFamily: "monospace", marginTop: 2 }}>
            {colorEntry?.hex} &nbsp;|&nbsp; rgb({colorEntry?.rgb?.join(", ")})
          </div>
        </div>
      </div>

      {/* Rule */}
      <div>
        <div style={TITLE}>Règle</div>
        <div style={{ fontSize: 13, color: "#7a9fcc", fontStyle: "italic", marginBottom: 3 }}>
          {ruleEntry?.rule}
        </div>
        <div style={{ fontSize: 12, color: "#99b0d4", lineHeight: 1.6 }}>
          {ruleEntry?._description}
        </div>
      </div>

      {/* Bounce condition */}
      <div>
        <div style={TITLE}>Condition de rebond</div>
        <div
          style={{
            fontSize: 12,
            color: "#66aacc",
            background: "rgba(30,90,180,0.12)",
            borderRadius: 6,
            padding: "5px 10px",
            display: "inline-block",
            fontFamily: "monospace",
            marginBottom: 3,
          }}
        >
          {bounceCondition}
        </div>
        <div style={{ fontSize: 11, color: "#556", marginTop: 4 }}>
          {bounceLabels[bounceCondition] ?? bounceCondition}
        </div>
      </div>

      {/* Spawn / despawn */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={TITLE}>Apparition</div>
          <div style={{ fontSize: 11, color: "#6faa88" }}>{spawnCond}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={TITLE}>Disparition</div>
          <div style={{ fontSize: 11, color: "#aa6f6f" }}>{despawnCond}</div>
        </div>
      </div>
    </div>
  );
}

// ---- Balls Carousel ----
function BallsCarousel({ config, onBack }: { config: GameConfig; onBack: () => void }) {
  const colors = Object.keys(config.ball_colors);
  const [index, setIndex] = useState(0);

  const prev = () => setIndex((i) => (i - 1 + colors.length) % colors.length);
  const next = () => setIndex((i) => (i + 1) % colors.length);

  const colorKey = colors[index];
  const colorEntry = config.ball_colors[colorKey as keyof typeof config.ball_colors];

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Détail des balles</div>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#1e90ff" }}>
          {index + 1} / {colors.length}
        </div>
      </div>

      {/* Card */}
      <BallCard colorKey={colorKey} config={config} />

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button
          onClick={prev}
          style={{
            ...CLOSE_BTN,
            flex: 1,
            textAlign: "center",
            color: "#aac8f0",
            borderColor: "rgba(30,144,255,0.4)",
          }}
        >
          ← Précédente
        </button>

        {/* Dot indicators */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {colors.map((c, i) => {
            const ce = config.ball_colors[c as keyof typeof config.ball_colors];
            return (
              <div
                key={c}
                onClick={() => setIndex(i)}
                style={{
                  width: i === index ? 10 : 6,
                  height: i === index ? 10 : 6,
                  borderRadius: "50%",
                  background: i === index ? (ce?.hex ?? "#1e90ff") : "rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  boxShadow: i === index ? `0 0 6px ${ce?.hex ?? "#1e90ff"}` : "none",
                  transition: "all 0.2s",
                }}
              />
            );
          })}
        </div>

        <button
          onClick={next}
          style={{
            ...CLOSE_BTN,
            flex: 1,
            textAlign: "center",
            color: "#aac8f0",
            borderColor: "rgba(30,144,255,0.4)",
          }}
        >
          Suivante →
        </button>
      </div>

      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ---- Root Menu Component ----
export function Menu({ config, onClose }: MenuProps) {
  const [view, setView] = useState<MenuView>("main");

  return (
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {view === "main" && (
        <MainMenu
          onRules={() => setView("rules")}
          onBalls={() => setView("balls")}
          onClose={onClose}
        />
      )}
      {view === "rules" && <RulesView config={config} onBack={() => setView("main")} />}
      {view === "balls" && <BallsCarousel config={config} onBack={() => setView("main")} />}
    </div>
  );
}
