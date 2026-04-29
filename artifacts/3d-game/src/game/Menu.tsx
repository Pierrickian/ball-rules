// ============================================================
// Menu — Game menu with sub-menus:
//   1. Règles du jeu        — concept overview
//   2. Détail des balles    — carousel of ball identity cards
//   3. Terrain              — aspect ratio + resolution
//   4. Couleur lancée       — color spawned by orange launcher
//   5. Couleur joueur       — pool of colors used in player queue
// ============================================================

import { useState, useRef, useCallback } from "react";
import type { BallColor, GameConfig } from "../engine/types";

type MenuView = "main" | "rules" | "balls" | "terrain" | "launcher_color" | "player_colors" | "how_to_ask" | "release_notes";

interface MenuProps {
  config: GameConfig;
  onClose: () => void;
  onArenaChange: (width: number, height: number) => void;
  onLauncherColorChange: (color: BallColor) => void;
  onPlayerColorsChange: (colors: BallColor[]) => void;
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

// Colors available for the launcher / player pool (orange excluded — special role).
// Kept in sync with `ball_rules` in game_config.json: only colors with an
// active rule entry can be safely spawned or used as projectiles.
const SELECTABLE_COLORS: BallColor[] = ["white", "dark_green", "gray"];

// ============================================================
// Snap Slider — unchanged
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
      const onMove = (ev: MouseEvent) => { if (isDragging.current) onChange(indexFromX(ev.clientX)); };
      const onUp = () => { isDragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [indexFromX, onChange]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isDragging.current = true;
      onChange(indexFromX(e.touches[0].clientX));
      const onMove = (ev: TouchEvent) => { if (isDragging.current && ev.touches[0]) onChange(indexFromX(ev.touches[0].clientX)); };
      const onEnd = () => { isDragging.current = false; window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
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

      <div style={{ background: "rgba(6,16,48,0.8)", border: "1px solid rgba(30,144,255,0.2)", borderRadius: 12, padding: "14px 14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ ...TITLE, marginBottom: 0 }}>Ratio d'aspect</div>
          <div style={{ fontSize: 11, color: "#556" }}>{ratio._market}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
                  borderRadius: 8, padding: "7px 12px", cursor: "pointer",
                  fontSize: 12, fontFamily: "inherit",
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

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, background: "rgba(6,16,48,0.6)", borderRadius: 10, padding: "12px 18px", border: "1px solid rgba(30,144,255,0.12)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#334", letterSpacing: 2, textTransform: "uppercase" }}>Largeur</div>
          <div style={{ fontSize: 26, fontWeight: "bold", color: "#1e90ff", lineHeight: 1.1 }}>{Math.round(width)}</div>
        </div>
        <div style={{ color: "#223", fontSize: 22 }}>×</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#334", letterSpacing: 2, textTransform: "uppercase" }}>Hauteur</div>
          <div style={{ fontSize: 26, fontWeight: "bold", color: "#1e90ff", lineHeight: 1.1 }}>{Math.round(height)}</div>
        </div>
      </div>

      <div style={{ background: "rgba(6,16,48,0.8)", border: "1px solid rgba(30,144,255,0.2)", borderRadius: 12, padding: "14px 16px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ ...TITLE, marginBottom: 0 }}>Résolution</div>
          <div style={{ fontSize: 10, color: "#334" }}>{resRule.widths.length} niveaux · aimantés</div>
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
// Launcher Color Sub-Menu (single-pick: orange spawns this color)
// ============================================================
function LauncherColorMenu({
  config, onLauncherColorChange, onBack,
}: {
  config: GameConfig;
  onLauncherColorChange: (color: BallColor) => void;
  onBack: () => void;
}) {
  const current = config.gameplay.orange.launch_config.color as BallColor | "random";
  const [selected, setSelected] = useState<BallColor | "random">(current);

  const pick = (c: BallColor | "random") => {
    setSelected(c);
    if (c === "random") {
      // Use first available as fallback (engine handles "random" via allow_colors)
      onLauncherColorChange("dark_green");
    } else {
      onLauncherColorChange(c);
    }
  };

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Couleur lancée</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#1e90ff" }}>Spawn du lanceur orange</div>
      </div>

      <div style={{ fontSize: 12, color: "#7a9fcc", lineHeight: 1.5 }}>
        Choisis la couleur des balles que la balle orange (lanceur) fait apparaître. Appliqué au runtime.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {SELECTABLE_COLORS.map((c) => {
          const entry = config.ball_colors[c];
          const isActive = selected === c;
          return (
            <button
              key={c}
              onClick={() => pick(c)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                background: isActive ? "rgba(30,144,255,0.2)" : "rgba(8,18,40,0.7)",
                border: isActive ? `2px solid ${entry?.hex ?? "#1e90ff"}` : "1px solid rgba(30,144,255,0.18)",
                borderRadius: 10, padding: "10px 6px", cursor: "pointer",
                fontFamily: "inherit", color: isActive ? "#fff" : "#7a9fcc",
                boxShadow: isActive ? `0 0 8px ${entry?.hex ?? "#1e90ff"}55` : "none",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: entry?.hex ?? "#888",
                boxShadow: `0 0 8px ${entry?.hex ?? "#888"}77`,
                border: c === "white" ? "1px solid #444" : "none",
              }} />
              <div style={{ fontSize: 10, textAlign: "center" }}>{entry?._label}</div>
            </button>
          );
        })}
      </div>

      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ============================================================
// Player Colors Sub-Menu (multi-pick: pool for player queue)
// ============================================================
function PlayerColorsMenu({
  config, onPlayerColorsChange, onBack,
}: {
  config: GameConfig;
  onPlayerColorsChange: (colors: BallColor[]) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<BallColor[]>(
    config.gameplay_controls.queue_ball_colors as BallColor[]
  );

  const toggle = (c: BallColor) => {
    setSelected((prev) => {
      const has = prev.includes(c);
      const next = has ? prev.filter((x) => x !== c) : [...prev, c];
      const safe = next.length > 0 ? next : (["gray"] as BallColor[]);
      onPlayerColorsChange(safe);
      return safe;
    });
  };

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Couleur joueur</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#1e90ff" }}>File d'attente du joueur</div>
      </div>

      <div style={{ fontSize: 12, color: "#7a9fcc", lineHeight: 1.5 }}>
        Choisis les couleurs disponibles pour les balles que le joueur tire. Plusieurs couleurs = tirage aléatoire.
        Au moins une couleur doit rester active.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {SELECTABLE_COLORS.map((c) => {
          const entry = config.ball_colors[c];
          const isActive = selected.includes(c);
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                background: isActive ? "rgba(30,144,255,0.2)" : "rgba(8,18,40,0.7)",
                border: isActive ? `2px solid ${entry?.hex ?? "#1e90ff"}` : "1px solid rgba(30,144,255,0.18)",
                borderRadius: 10, padding: "10px 6px", cursor: "pointer",
                fontFamily: "inherit", color: isActive ? "#fff" : "#556",
                boxShadow: isActive ? `0 0 8px ${entry?.hex ?? "#1e90ff"}55` : "none",
                opacity: isActive ? 1 : 0.55,
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: entry?.hex ?? "#888",
                boxShadow: isActive ? `0 0 8px ${entry?.hex ?? "#888"}77` : "none",
                border: c === "white" ? "1px solid #444" : "none",
              }} />
              <div style={{ fontSize: 10, textAlign: "center" }}>{entry?._label}</div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "#445", textAlign: "center" }}>
        {selected.length} couleur(s) active(s)
      </div>

      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ============================================================
// Main Menu
// ============================================================
function MainMenu({
  onRules, onBalls, onTerrain, onLauncherColor, onPlayerColors, onHowToAsk, onReleaseNotes, onClose,
}: {
  onRules:          () => void;
  onBalls:          () => void;
  onTerrain:        () => void;
  onLauncherColor:  () => void;
  onPlayerColors:   () => void;
  onHowToAsk:       () => void;
  onReleaseNotes:   () => void;
  onClose:          () => void;
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
      <button style={MENU_BTN} onClick={onLauncherColor}>
        <span style={{ fontSize: 20 }}>🟠</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Couleur lancée</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Spawn du lanceur orange</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onPlayerColors}>
        <span style={{ fontSize: 20 }}>🎯</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Couleur joueur</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>File d'attente du joueur (multi-couleur)</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onTerrain}>
        <span style={{ fontSize: 20 }}>⬛</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Terrain</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Ratio d'aspect &amp; résolution</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onHowToAsk}>
        <span style={{ fontSize: 20 }}>💬</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Comment demander</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Tutos pour interroger l'agent</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onReleaseNotes}>
        <span style={{ fontSize: 20 }}>📝</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Notes de version</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Les dernières évolutions du jeu</div>
        </div>
      </button>
      <button style={CLOSE_BTN} onClick={onClose}>✕ Retour au jeu</button>
    </div>
  );
}

// ============================================================
// Release Notes View
// ============================================================
function ReleaseNotesView({ config, onBack }: { config: GameConfig; onBack: () => void }) {
  const notes = config.release_notes ?? [];
  const MAX_NOTES = 20;
  const visible = notes.slice(0, MAX_NOTES);

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Notes de version</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#1e90ff", marginBottom: 6 }}>
          Dernières évolutions
        </div>
        <div style={{ fontSize: 12, color: "#7a8fa8", marginBottom: 14, lineHeight: 1.5 }}>
          Les {MAX_NOTES} évolutions les plus récentes du jeu, de la plus récente à la plus ancienne.
        </div>

        {visible.length === 0 ? (
          <div style={{ fontSize: 13, color: "#778", fontStyle: "italic" }}>
            Aucune note de version pour l'instant.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visible.map((note, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr",
                  gap: 10,
                  alignItems: "baseline",
                  padding: "8px 10px",
                  background: i === 0 ? "rgba(30,144,255,0.10)" : "rgba(6,16,45,0.55)",
                  border: i === 0 ? "1px solid rgba(30,144,255,0.35)" : "1px solid rgba(30,144,255,0.10)",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: i === 0 ? "#7fb3ff" : "#556",
                    fontWeight: i === 0 ? "bold" : "normal",
                  }}
                >
                  #{visible.length - i}
                </div>
                <div style={{ fontSize: 13, color: i === 0 ? "#dfecff" : "#aac2dc", lineHeight: 1.5 }}>
                  {note}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
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
  const hasRule = !!ruleEntry;
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

  // HP info for hp_grow_bouncer
  let hpInfo: string | null = null;
  if (ruleEntry?.rule === "hp_grow_bouncer") {
    const p = config.rule_parameters.hp_grow_bouncer;
    if (p) hpInfo = `${p.default_hp} PV (max ${p.max_hp}) · +${p.hp_gained_per_traversal} PV par traversée`;
  }

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
        opacity: hasRule ? 1 : 0.85,
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
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: "bold", color: "#ddeeff" }}>
            {colorEntry?._label ?? colorKey}
          </div>
          <div style={{ fontSize: 11, color: "#445", fontFamily: "monospace", marginTop: 2 }}>
            {colorEntry?.hex} &nbsp;|&nbsp; rgb({colorEntry?.rgb?.join(", ")})
          </div>
        </div>
      </div>

      {!hasRule ? (
        <div
          style={{
            background: "rgba(60,60,30,0.25)",
            border: "1px dashed rgba(220,180,80,0.5)",
            borderRadius: 10,
            padding: "14px 14px",
            color: "#e0c887",
            fontSize: 12,
            lineHeight: 1.55,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: "bold", letterSpacing: 1, fontSize: 11, color: "#f0d896" }}>
            ⏳ EN ATTENTE DE RÈGLE
          </div>
          <div style={{ color: "#cbb98a" }}>
            Cette couleur fait partie de la palette mais n'a pas encore de comportement défini en
            jeu. Tu peux demander à l'agent d'en créer un (voir le menu « Comment demander »,
            tutoriels « Ajouter une nouvelle couleur » et « Éditer / créer les règles d'une couleur »).
          </div>
        </div>
      ) : (
        <>
          <div>
            <div style={TITLE}>Règle</div>
            <div style={{ fontSize: 13, color: "#7a9fcc", fontStyle: "italic", marginBottom: 3 }}>{ruleEntry?.rule}</div>
            <div style={{ fontSize: 12, color: "#99b0d4", lineHeight: 1.6 }}>{ruleEntry?._description}</div>
          </div>

          {hpInfo && (
            <div>
              <div style={TITLE}>Points de vie</div>
              <div style={{ fontSize: 12, color: "#88dd88" }}>{hpInfo}</div>
            </div>
          )}

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
        </>
      )}
    </div>
  );
}

// ============================================================
// Balls Carousel
// ============================================================
function BallsCarousel({ config, onBack }: { config: GameConfig; onBack: () => void }) {
  // Show every color in the palette, including those without an active
  // rule. The card itself flags missing rules with an "En attente de
  // règle" badge so the player can see the full inventory of colors
  // they may activate via the agent.
  const colors = Object.keys(config.ball_colors).filter(
    (c) => c !== "_description" && c !== "_color_format"
  );
  const [index, setIndex] = useState(0);
  const prev = () => setIndex((i) => (i - 1 + colors.length) % colors.length);
  const next = () => setIndex((i) => (i + 1) % colors.length);
  const colorKey = colors[index];

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
// How To Ask — Carousel of 3 tutorials
//
// Each tutorial explains comment formuler une demande à l'agent.
// Tutos 1 & 2 fournissent un prompt prêt à copier ; le tuto 3
// se résout in-game et pointe vers le bon sous-menu.
// ============================================================
interface HowToAskTuto {
  id: string;
  emoji: string;
  title: string;
  intro: string;
  /** Si défini, on affiche un bouton "Copier le prompt". */
  prompt?: string;
  /** Si défini, on affiche un encart "C'est dans le jeu !". */
  inGame?: { menuName: string; instructions: string };
}

const HOW_TO_ASK_TUTOS: HowToAskTuto[] = [
  {
    id: "add_color",
    emoji: "🎨",
    title: "Ajouter une nouvelle couleur",
    intro:
      "Demande à l'agent qu'une nouvelle couleur de balle entre en jeu, et précise à quelle fréquence elle doit apparaître dans l'arène.",
    prompt:
      "Je voudrais que la couleur [NOM_COULEUR] apparaisse dans l'arène. Fais en sorte qu'une nouvelle balle de cette couleur entre en jeu environ toutes les [FREQUENCE_EN_SECONDES] secondes.",
  },
  {
    id: "edit_color_rules",
    emoji: "✏️",
    title: "Éditer / créer les règles d'une couleur",
    intro:
      "Demande à l'agent de définir ou modifier le comportement d'une couleur de balle : sur quoi elle rebondit, ses points de vie, ses dégâts, comment elle apparaît et comment elle disparaît.",
    prompt:
      "Je voudrais définir le comportement de la couleur [NOM_COULEUR]. Voici ce que je veux qu'elle fasse en jeu : [DÉCRIS_LE_COMPORTEMENT — par exemple : « elle rebondit sur les murs et sur les autres balles, démarre avec 3 points de vie, perd 1 point de vie à chaque rebond contre un mur, disparaît à 0 point de vie, et fait 2 dégâts à chaque balle qu'elle touche »].",
  },
  {
    id: "color_rules",
    emoji: "📋",
    title: "Connaître les règles d'une couleur",
    intro:
      "Demande à l'agent un récapitulatif complet d'une couleur : son comportement, ses points de vie, ses dégâts, ses rebonds, ses conditions d'apparition et de disparition.",
    prompt:
      "Décris-moi en détail le comportement de la couleur [NOM_COULEUR] en jeu : ses points de vie de départ, ses dégâts, comment elle se déplace, sur quoi elle rebondit, comment elle apparaît, comment elle disparaît, et tout effet spécial qu'elle peut avoir.",
  },
  {
    id: "player_colors",
    emoji: "🎯",
    title: "Tirer d'autres couleurs en tant que joueur",
    intro:
      "Pas besoin de prompt pour ça : la sélection des couleurs disponibles dans la file de tir du joueur se fait directement depuis le menu, en jeu.",
    inGame: {
      menuName: "Couleur joueur",
      instructions:
        "Ouvre le menu, puis va dans « Couleur joueur ». Active ou désactive les couleurs que tu veux voir apparaître dans ta file de tir (sélection multiple = tirage aléatoire). Au moins une couleur doit rester active.",
    },
  },
];

// ---- Glossary used in the intro panel of the "How to ask" carousel ----
interface GlossaryEntry {
  term: string;
  definition: string;
}

const HOW_TO_ASK_GLOSSARY: GlossaryEntry[] = [
  {
    term: "Arène",
    definition: "Le terrain de jeu rectangulaire dans lequel évoluent toutes les balles.",
  },
  {
    term: "Balle",
    definition: "N'importe quelle bille colorée présente dans l'arène (les balles ennemies, les balles spéciales, etc.).",
  },
  {
    term: "Lanceur (balle orange)",
    definition: "La balle orange qui apparaît sur les bords de l'arène et fait entrer en jeu de nouvelles balles.",
  },
  {
    term: "Couleur",
    definition: "Le « type » d'une balle. Chaque couleur a son propre comportement (= sa règle).",
  },
  {
    term: "Règle",
    definition: "Le comportement associé à une couleur : rebonds, dégâts, points de vie, effets spéciaux, conditions d'apparition et de disparition.",
  },
  {
    term: "Points de vie (PV)",
    definition: "Quantité de dégâts qu'une balle peut encaisser avant de disparaître. Affichés au-dessus de chaque balle en jeu.",
  },
  {
    term: "Tir / Projectile",
    definition: "La balle lancée par le joueur depuis le bas de l'écran. Il en existe trois types selon la durée d'appui : tir léger, tir appuyé, méga tir.",
  },
  {
    term: "File d'attente",
    definition: "Les 3 prochaines balles que le joueur va tirer, visibles en bas de l'écran. La gauche est la prochaine à partir.",
  },
  {
    term: "Menu « Couleur lancée »",
    definition: "Sous-menu qui choisit la couleur des balles que la balle orange fait entrer en jeu.",
  },
  {
    term: "Menu « Couleur joueur »",
    definition: "Sous-menu qui choisit le pool de couleurs piochées pour la file d'attente des tirs du joueur.",
  },
  {
    term: "Menu « Détail des balles »",
    definition: "Carrousel qui présente chaque couleur de la palette, avec sa règle si elle est définie ou un statut « en attente de règle » sinon.",
  },
  {
    term: "Menu « Terrain »",
    definition: "Sous-menu qui règle le ratio d'aspect et la résolution de l'arène.",
  },
];

function HowToAskIntro() {
  return (
    <div
      style={{
        background: "rgba(6,16,48,0.8)",
        border: "1px solid rgba(30,144,255,0.25)",
        borderRadius: 12,
        padding: "14px 16px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>📖</span>
        <div style={{ fontSize: 13, fontWeight: "bold", color: "#cfe0ff", letterSpacing: 0.3 }}>
          Comment parler à l'agent
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#8aa6cc", lineHeight: 1.55 }}>
        Pour que l'agent comprenne tes demandes du premier coup, utilise le vocabulaire ci-dessous quand
        tu décris des objets du jeu ou que tu parles d'un menu. Tous les tutos suivants reprennent ces
        termes : remplace simplement les valeurs entre <span style={{ color: "#cfe0ff" }}>[…]</span> par
        ce que tu veux.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          maxHeight: 180,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {HOW_TO_ASK_GLOSSARY.map((g) => (
          <div
            key={g.term}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(110px, 38%) 1fr",
              gap: 8,
              alignItems: "baseline",
              padding: "5px 0",
              borderBottom: "1px solid rgba(30,144,255,0.08)",
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: "bold", color: "#7fb3ff" }}>{g.term}</div>
            <div style={{ fontSize: 11, color: "#aac2dc", lineHeight: 1.5 }}>{g.definition}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowToAskCard({ tuto }: { tuto: HowToAskTuto }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!tuto.prompt) return;
    try {
      await navigator.clipboard.writeText(tuto.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for older / restricted browsers
      const ta = document.createElement("textarea");
      ta.value = tuto.prompt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  };

  return (
    <div
      style={{
        background: "rgba(6,16,48,0.8)",
        border: "1px solid rgba(30,144,255,0.2)",
        borderRadius: 12,
        padding: "16px 16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26 }}>{tuto.emoji}</span>
        <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff" }}>{tuto.title}</div>
      </div>

      <div style={{ fontSize: 12, color: "#8aa6cc", lineHeight: 1.55 }}>
        {tuto.intro}
      </div>

      {tuto.prompt && (
        <>
          <div
            style={{
              background: "rgba(0,5,20,0.7)",
              border: "1px dashed rgba(30,144,255,0.35)",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 11.5,
              color: "#cfe0ff",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              fontFamily: "'Courier New', monospace",
            }}
          >
            {tuto.prompt}
          </div>
          <button
            onClick={onCopy}
            style={{
              background: copied ? "rgba(60,200,120,0.22)" : "rgba(30,144,255,0.2)",
              border: copied ? "1px solid #3cc878" : "1px solid rgba(30,144,255,0.55)",
              color: copied ? "#7fe6a8" : "#cfe0ff",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: "bold",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {copied ? "✓ Copié !" : "📋 Copier le prompt"}
          </button>
          <div style={{ fontSize: 10.5, color: "#556", lineHeight: 1.5 }}>
            Remplace les valeurs entre crochets <span style={{ color: "#8aa6cc" }}>[…]</span> avant d'envoyer le message à l'agent.
          </div>
        </>
      )}

      {tuto.inGame && (
        <div
          style={{
            background: "rgba(20,60,30,0.35)",
            border: "1px solid rgba(60,200,120,0.4)",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎮</span>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#7fe6a8", letterSpacing: 1 }}>
              C'EST DANS LE JEU
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#cfe0ff", lineHeight: 1.55 }}>
            Menu : <strong style={{ color: "#fff" }}>« {tuto.inGame.menuName} »</strong>
          </div>
          <div style={{ fontSize: 11.5, color: "#aac8b6", lineHeight: 1.55 }}>
            {tuto.inGame.instructions}
          </div>
        </div>
      )}
    </div>
  );
}

function HowToAskCarousel({ onBack }: { onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const tutos = HOW_TO_ASK_TUTOS;
  const prev = () => setIndex((i) => (i - 1 + tutos.length) % tutos.length);
  const next = () => setIndex((i) => (i + 1) % tutos.length);
  const tuto = tutos[index];

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Comment demander</div>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#1e90ff" }}>
          {index + 1} / {tutos.length}
        </div>
      </div>

      <HowToAskIntro />

      <HowToAskCard tuto={tuto} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button onClick={prev} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>
          ← Précédent
        </button>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {tutos.map((t, i) => (
            <div
              key={t.id}
              onClick={() => setIndex(i)}
              style={{
                width: i === index ? 10 : 6, height: i === index ? 10 : 6,
                borderRadius: "50%",
                background: i === index ? "#1e90ff" : "rgba(255,255,255,0.18)",
                cursor: "pointer",
                boxShadow: i === index ? "0 0 6px #1e90ff" : "none",
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>
        <button onClick={next} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>
          Suivant →
        </button>
      </div>

      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ============================================================
// Root Menu Component
// ============================================================
export function Menu({ config, onClose, onArenaChange, onLauncherColorChange, onPlayerColorsChange }: MenuProps) {
  const [view, setView] = useState<MenuView>("main");

  return (
    <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {view === "main" && (
        <MainMenu
          onRules={() => setView("rules")}
          onBalls={() => setView("balls")}
          onTerrain={() => setView("terrain")}
          onLauncherColor={() => setView("launcher_color")}
          onPlayerColors={() => setView("player_colors")}
          onHowToAsk={() => setView("how_to_ask")}
          onReleaseNotes={() => setView("release_notes")}
          onClose={onClose}
        />
      )}
      {view === "rules"          && <RulesView      config={config} onBack={() => setView("main")} />}
      {view === "balls"          && <BallsCarousel  config={config} onBack={() => setView("main")} />}
      {view === "terrain"        && <TerrainMenu    config={config} onArenaChange={onArenaChange} onBack={() => setView("main")} />}
      {view === "launcher_color" && <LauncherColorMenu config={config} onLauncherColorChange={onLauncherColorChange} onBack={() => setView("main")} />}
      {view === "player_colors"  && <PlayerColorsMenu  config={config} onPlayerColorsChange={onPlayerColorsChange}   onBack={() => setView("main")} />}
      {view === "how_to_ask"     && <HowToAskCarousel onBack={() => setView("main")} />}
      {view === "release_notes"  && <ReleaseNotesView config={config} onBack={() => setView("main")} />}
    </div>
  );
}
