import { useState } from "react";
import type { BallColor, GameConfig } from "../../engine/types";
import { CLOSE_BTN } from "./menuStyles";


export function normalizeWeights(weights: Record<BallColor, number>): Record<BallColor, number> {
  const entries = Object.entries(weights).filter(([, value]) => Number.isFinite(value) && value > 0) as Array<[BallColor, number]>;
  if (entries.length === 0) return {} as Record<BallColor, number>;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const next = {} as Record<BallColor, number>;
  entries.forEach(([color, value]) => { next[color] = value / total; });
  return next;
}

export function rebalanceWeight(weights: Record<BallColor, number>, color: BallColor, value: number): Record<BallColor, number> {
  const keys = Array.from(new Set([...Object.keys(weights), color])) as BallColor[];
  const clamped = Math.max(0, Math.min(1, value));
  const others = keys.filter((key) => key !== color);
  const remaining = 1 - clamped;
  const otherSum = others.reduce((sum, key) => sum + Math.max(0, weights[key] ?? 0), 0);
  const next = { ...weights, [color]: clamped } as Record<BallColor, number>;
  others.forEach((key, index) => {
    next[key] = otherSum <= 0 ? (index === 0 ? remaining : 0) : ((Math.max(0, weights[key] ?? 0) / otherSum) * remaining);
  });
  return normalizeWeights(next);
}

export function addColorToWeights(weights: Record<BallColor, number>, color: BallColor): Record<BallColor, number> {
  if (weights[color] !== undefined) return normalizeWeights(weights);
  const normalized = normalizeWeights(weights);
  const existing = Object.keys(normalized) as BallColor[];
  if (existing.length === 0) return { [color]: 1 } as Record<BallColor, number>;
  const share = 1 / (existing.length + 1);
  const next = {} as Record<BallColor, number>;
  existing.forEach((key) => { next[key] = (normalized[key] ?? 0) * (1 - share); });
  next[color] = share;
  return normalizeWeights(next);
}

export function firstAvailableColor(colors: BallColor[], weights: Record<BallColor, number>): BallColor | "" {
  return colors.find((color) => weights[color] === undefined) ?? "";
}

export function WeightsEditor({
  config,
  colors,
  weights,
  onChange,
  compact = false,
}: {
  config: GameConfig;
  colors: BallColor[];
  weights: Record<BallColor, number>;
  onChange: (weights: Record<BallColor, number>) => void;
  compact?: boolean;
}) {
  const normalized = normalizeWeights(weights);
  const entries = (Object.keys(normalized) as BallColor[]).filter((color) => colors.includes(color));
  const selectable = colors.filter((color) => !entries.includes(color));
  const [selectedColor, setSelectedColor] = useState<BallColor | "">(() => firstAvailableColor(colors, normalized));
  const selectedOption = selectedColor && selectable.includes(selectedColor) ? selectedColor : (selectable[0] ?? "");
  const addColor = () => {
    const color = selectedOption as BallColor | "";
    if (!color) return;
    const next = addColorToWeights(normalized, color);
    onChange(next);
    setSelectedColor(firstAvailableColor(colors, next));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: "#778", fontStyle: "italic" }}>Aucune balle sélectionnée.</div>
      ) : entries.map((color) => {
        const entry = config.ball_colors[color];
        const pct = Math.round((normalized[color] ?? 0) * 100);
        return (
          <div key={color} style={{ background: "rgba(8,18,40,0.6)", border: "1px solid rgba(30,144,255,0.18)", borderRadius: 10, padding: compact ? 8 : 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, marginBottom: 8, color: "#aac8f0" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: entry?.hex ?? "#888", border: color === "white" ? "1px solid #555" : "none", boxShadow: `0 0 8px ${entry?.hex ?? "#888"}88`, flexShrink: 0 }} />
                {entry?._label ?? color}
              </span>
              <span style={{ fontFamily: "monospace", color: "#7fb3ff" }}>{pct}%</span>
            </div>
            <input type="range" min={0} max={100} value={pct} onChange={(e) => onChange(rebalanceWeight(normalized, color, Number(e.target.value) / 100))} style={{ width: "100%", accentColor: entry?.hex ?? "#1e90ff" }} />
          </div>
        );
      })}

      {selectable.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
          <select
            value={selectedOption}
            onChange={(event) => setSelectedColor(event.currentTarget.value as BallColor)}
            style={{ minWidth: 0, borderRadius: 8, border: "1px solid rgba(30,144,255,0.35)", background: "rgba(0,5,20,0.75)", color: "#cfe0ff", padding: "9px 10px", fontFamily: "inherit" }}
          >
            {selectable.map((color) => <option key={color} value={color}>● {config.ball_colors[color]?._label ?? color}</option>)}
          </select>
          <button onClick={addColor} aria-label="Ajouter une balle" title="Ajouter une balle" style={{ ...CLOSE_BTN, marginTop: 0, alignSelf: "stretch", minWidth: 44, padding: "8px 12px", fontSize: 18, color: "#0a1628", background: "#66ffbb", borderColor: "#66ffbb", fontWeight: 900 }}>+</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Snap Slider — unchanged
