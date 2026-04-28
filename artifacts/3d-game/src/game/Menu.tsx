// ============================================================
// Menu — Game menu with 3 sub-menus:
//   1. Règles du jeu — concept overview
//   2. Détail des balles — carousel of ball identity cards
//   3. Terrain — aspect ratio (chips) + resolution snap slider
//                 height = width × (ratio.h / ratio.w)
// ============================================================

import { useState, useRef, useCallback } from "react";
import type { GameConfig } from "../engine/types";

type MenuView = "main" | "rules" | "balls" | "terrain";

interface MenuProps {
  config: GameConfig;
  onClose: () => void;
  onArenaChange: (width: number, height: number) => void;
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
  padding: "26px 22px",
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

// ============================================================
// Snap Slider — N magnetic levels, NO labels on the track
// ============================================================
interface SnapSliderProps {
  count: number;
  selected: number;
  onChange: (index: number) => void;
  defaultIndex?: number;
  accentColor?: string;
}

function SnapSlider({ count, selected, onChange, defaultIndex, accentColor = "#1e90ff" }: SnapSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const indexFromX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return selected;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(pct * (count - 1));
    },
    [count, selected]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      onChange(indexFromX(e.clientX));
      const onMove = (ev: MouseEvent) => {
        if (isDragging.current) onChange(indexFromX(ev.clientX));
      };
      const onUp = () => {
        isDragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [indexFromX, onChange]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isDragging.current = true;
      onChange(indexFromX(e.touches[0].clientX));
      const onMove = (ev: TouchEvent) => {
        if (isDragging.current && ev.touches[0]) onChange(indexFromX(ev.touches[0].clientX));
      };
      const onEnd = () => {
        isDragging.current = false;
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
      };
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", onEnd);
    },
    [indexFromX, onChange]
  );

  const thumbPct = count > 1 ? (selected / (count - 1)) * 100 : 50;

  return (
    <div style={{ position: "relative", padding: "20px 10px 10px" }}>
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={{
          position: "relative",
          height: 4,
          borderRadius: 2,
          background: "rgba(30,144,255,0.18)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0, top: 0, height: "100%",
            width: `${thumbPct}%`,
            borderRadius: 2,
            background: `linear-gradient(to right, rgba(30,144,255,0.4), ${accentColor})`,
            transition: "width 0.08s",
          }}
        />

        {/* Snap dots — no labels */}
        {Array.from({ length: count }).map((_, i) => {
          const pct = count > 1 ? (i / (count - 1)) * 100 : 50;
          const isActive = i === selected;
          const isDefault = defaultIndex === i;
          return (
            <div
              key={i}
              onClick={() => onChange(i)}
              style={{
                position: "absolute",
                top: "50%",
                left: `${pct}%`,
                transform: "translate(-50%, -50%)",
                width:  isActive ? 14 : 8,
                height: isActive ? 14 : 8,
                borderRadius: "50%",
                background: isActive ? accentColor : (isDefault ? "rgba(30,144,255,0.55)" : "rgba(30,144,255,0.3)"),
                boxShadow: isActive ? `0 0 8px ${accentColor}` : "none",
                border: isActive ? `2px solid ${accentColor}` : "2px solid rgba(30,144,255,0.18)",
                transition: "all 0.15s",
                cursor: "pointer",
                zIndex: 2,
              }}
            />
          );
        })}

        {/* Thumb (magnet) */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${thumbPct}%`,
            transform: "translate(-50%, -50%)",
            width: 22, height: 22,
            borderRadius: "50%",
            background: "rgba(4,12,35,0.9)",
            border: `2px solid ${accentColor}`,
            boxShadow: `0 0 12px ${accentColor}66`,
            zIndex: 3,
            pointerEvents: "none",
            transition: "left 0.08s",
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Terrain Sub-Menu
// ============================================================
interface TerrainMenuProps {
  config: GameConfig;
  onArenaChange: (width: number, height: number) => void;
  onBack: () => void;
}

function TerrainMenu({ config, onArenaChange, onBack }: TerrainMenuProps) {
  const aspectRule = config.level_rules.aspect_ratio;
  const resRule    = config.level_rules.arena_resolution;

  // Init from current arena (find closest matching ratio + width)
  const [ratioIdx, setRatioIdx] = useState(() => {
    const currentR = config.graphics.arena.height / config.graphics.arena.width;
    let best = aspectRule.default_index, bestDiff = Infinity;
    aspectRule.ratios.forEach((r, i) => {
      const diff = Math.abs((r.h / r.w) - currentR);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return best;
  });

  const [resIdx, setResIdx] = useState(() => {
    const currentW = config.graphics.arena.width;
    let best = resRule.default_index, bestDiff = Infinity;
    resRule.widths.forEach((w, i) => {
      const diff = Math.abs(w - currentW);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return best;
  });

  const apply = useCallback(
    (newRatioIdx: number, newResIdx: number) => {
      const r = aspectRule.ratios[newRatioIdx];
      const w = resRule.widths[newResIdx];
      const h = w * (r.h / r.w);
      onArenaChange(w, h);
    },
    [aspectRule, resRule, onArenaChange]
  );

  const handleRatio = (i: number) => { setRatioIdx(i); apply(i, resIdx); };
  const handleRes   = (i: number) => { setResIdx(i);   apply(ratioIdx, i); };

  const ratio  = aspectRule.ratios[ratioIdx];
  const width  = resRule.widths[resIdx];
  const height = width * (ratio.h / ratio.w);

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Terrain</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#1e90ff" }}>Ratio &amp; Résolution</div>
      </div>

      {/* === RATIO CHIPS === */}
      <div
        style={{
          background: "rgba(6,16,48,0.8)",
          border: "1px solid rgba(30,144,255,0.2)",
          borderRadius: 12,
          padding: "14px 14px 16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ ...TITLE, marginBottom: 0 }}>Ratio d'aspect</div>
          <div style={{ fontSize: 11, color: "#556" }}>
            {ratio._market}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {aspectRule.ratios.map((r, i) => {
            const isActive = i === ratioIdx;
            return (
              <button
                key={r.id}
                onClick={() => handleRatio(i)}
                style={{
                  background: isActive ? "rgba(30,144,255,0.25)" : "rgba(12,28,72,0.5)",
                  border: isActive ? "1px solid #1e90ff" : "1px solid rgba(30,144,255,0.2)",
                  color: isActive ? "#fff" : "#7a9fcc",
                  borderRadius: 8,
                  padding: "7px 12px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: isActive ? "bold" : "normal",
                  boxShadow: isActive ? "0 0 8px rgba(30,144,255,0.4)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {r._label}
              </button>
            );
          })}
        </div>
      </div>

      {/* === RESOLUTION DISPLAY === */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          background: "rgba(6,16,48,0.6)",
          borderRadius: 10,
          padding: "12px 18px",
          border: "1px solid rgba(30,144,255,0.12)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#334", letterSpacing: 2, textTransform: "uppercase" }}>Largeur</div>
          <div style={{ fontSize: 26, fontWeight: "bold", color: "#1e90ff", lineHeight: 1.1 }}>
            {Math.round(width)}
          </div>
        </div>
        <div style={{ color: "#223", fontSize: 22 }}>×</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#334", letterSpacing: 2, textTransform: "uppercase" }}>Hauteur</div>
          <div style={{ fontSize: 26, fontWeight: "bold", color: "#1e90ff", lineHeight: 1.1 }}>
            {Math.round(height)}
          </div>
        </div>
      </div>

      {/* === RESOLUTION SNAP SLIDER === */}
      <div
        style={{
          background: "rgba(6,16,48,0.8)",
          border: "1px solid rgba(30,144,255,0.2)",
          borderRadius: 12,
          padding: "14px 16px 8px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ ...TITLE, marginBottom: 0 }}>Résolution</div>
          <div style={{ fontSize: 10, color: "#334" }}>
            {resRule.widths.length} niveaux · aimantés
          </div>
        </div>
        <SnapSlider
          count={resRule.widths.length}
          selected={resIdx}
          onChange={handleRes}
          defaultIndex={resRule.default_index}
          accentColor="#1e90ff"
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, padding: "0 6px" }}>
          <div style={{ fontSize: 9, color: "#223" }}>−</div>
          <div style={{ fontSize: 9, color: resIdx === resRule.default_index ? "#1e90ff" : "#334" }}>
            {resIdx === resRule.default_index ? "● défaut" : "○"}
          </div>
          <div style={{ fontSize: 9, color: "#223" }}>+</div>
        </div>
      </div>

      {/* Reset */}
      <button
        style={{ ...CLOSE_BTN, color: "#6fa8dc", borderColor: "rgba(30,144,255,0.35)" }}
        onClick={() => {
          setRatioIdx(aspectRule.default_index);
          setResIdx(resRule.default_index);
          apply(aspectRule.default_index, resRule.default_index);
        }}
      >
        ↺ Réinitialiser au défaut
      </button>

      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ============================================================
// Main Menu
// ============================================================
function MainMenu({
  onRules, onBalls, onTerrain, onClose,
}: {
  onRules:   () => void;
  onBalls:   () => void;
  onTerrain: () => void;
  onClose:   () => void;
}) {
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
      <button style={MENU_BTN} onClick={onTerrain}>
        <span style={{ fontSize: 20 }}>⬛</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Terrain</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Ratio d'aspect &amp; résolution</div>
        </div>
      </button>
      <button style={CLOSE_BTN} onClick={onClose}>✕ Retour au jeu</button>
    </div>
  );
}

// ============================================================
// Rules View
// ============================================================
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
            <div key={i} style={{ borderLeft: "2px solid rgba(30,144,255,0.5)", paddingLeft: 12 }}>
              <div style={{ fontSize: 12, fontWeight: "bold", color: "#6fa8dc", marginBottom: 3 }}>{s.heading}</div>
              <div style={{ fontSize: 12, color: "#8899bb", lineHeight: 1.6 }}>{s.text}</div>
            </div>
          ))}
        </div>
      </div>
      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ============================================================
// Ball Detail Card
// ============================================================
function BallCard({ colorKey, config }: { colorKey: string; config: GameConfig }) {
  const colorEntry = config.ball_colors[colorKey as keyof typeof config.ball_colors];
  const ruleEntry  = config.ball_rules[colorKey  as keyof typeof config.ball_rules];
  const bounceCondition = config.bounce_conditions?.ball_bounce_conditions?.[colorKey] ?? "—";
  const spawnCond  = config.gameplay[colorKey]?.spawn?.condition  ?? "—";
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
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: "50%",
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

      <div>
        <div style={TITLE}>Règle</div>
        <div style={{ fontSize: 13, color: "#7a9fcc", fontStyle: "italic", marginBottom: 3 }}>{ruleEntry?.rule}</div>
        <div style={{ fontSize: 12, color: "#99b0d4", lineHeight: 1.6 }}>{ruleEntry?._description}</div>
      </div>

      <div>
        <div style={TITLE}>Condition de rebond</div>
        <div style={{
          fontSize: 12, color: "#66aacc",
          background: "rgba(30,90,180,0.12)", borderRadius: 6,
          padding: "5px 10px", display: "inline-block",
          fontFamily: "monospace", marginBottom: 3,
        }}>
          {bounceCondition}
        </div>
        <div style={{ fontSize: 11, color: "#556", marginTop: 4 }}>
          {bounceLabels[bounceCondition] ?? bounceCondition}
        </div>
      </div>

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

// ============================================================
// Balls Carousel
// ============================================================
function BallsCarousel({ config, onBack }: { config: GameConfig; onBack: () => void }) {
  const colors = Object.keys(config.ball_colors);
  const [index, setIndex] = useState(0);
  const prev = () => setIndex((i) => (i - 1 + colors.length) % colors.length);
  const next = () => setIndex((i) => (i + 1) % colors.length);
  const colorKey   = colors[index];
  const colorEntry = config.ball_colors[colorKey as keyof typeof config.ball_colors];

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Détail des balles</div>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#1e90ff" }}>{index + 1} / {colors.length}</div>
      </div>
      <BallCard colorKey={colorKey} config={config} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button onClick={prev} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>
          ← Précédente
        </button>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {colors.map((c, i) => {
            const ce = config.ball_colors[c as keyof typeof config.ball_colors];
            return (
              <div
                key={c}
                onClick={() => setIndex(i)}
                style={{
                  width: i === index ? 10 : 6, height: i === index ? 10 : 6,
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
        <button onClick={next} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>
          Suivante →
        </button>
      </div>
      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ============================================================
// Root Menu Component
// ============================================================
export function Menu({ config, onClose, onArenaChange }: MenuProps) {
  const [view, setView] = useState<MenuView>("main");

  return (
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {view === "main"    && <MainMenu onRules={() => setView("rules")} onBalls={() => setView("balls")} onTerrain={() => setView("terrain")} onClose={onClose} />}
      {view === "rules"   && <RulesView config={config} onBack={() => setView("main")} />}
      {view === "balls"   && <BallsCarousel config={config} onBack={() => setView("main")} />}
      {view === "terrain" && <TerrainMenu config={config} onArenaChange={onArenaChange} onBack={() => setView("main")} />}
    </div>
  );
}
