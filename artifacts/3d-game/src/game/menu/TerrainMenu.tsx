import { useCallback, useState } from "react";
import type { GameConfig } from "../../engine/types";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";
import { useI18n } from "../i18n";
import { SnapSlider } from "./SnapSlider";

export interface TerrainMenuProps {
  config: GameConfig;
  onArenaChange: (width: number, height: number) => void;
  onBack: () => void;
}

export function TerrainMenu({ config, onArenaChange, onBack }: TerrainMenuProps) {
  const { t } = useI18n();
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
        <div style={TITLE}>{t("menu.terrain")}</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#1e90ff" }}>{t("terrain.heading")}</div>
      </div>

      <div style={{ background: "rgba(6,16,48,0.8)", border: "1px solid rgba(30,144,255,0.2)", borderRadius: 12, padding: "14px 14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ ...TITLE, marginBottom: 0 }}>{t("terrain.aspect")}</div>
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
          <div style={{ fontSize: 9, color: "#334", letterSpacing: 2, textTransform: "uppercase" }}>{t("terrain.width")}</div>
          <div style={{ fontSize: 26, fontWeight: "bold", color: "#1e90ff", lineHeight: 1.1 }}>{Math.round(width)}</div>
        </div>
        <div style={{ color: "#223", fontSize: 22 }}>×</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#334", letterSpacing: 2, textTransform: "uppercase" }}>{t("terrain.height")}</div>
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

      <button style={CLOSE_BTN} onClick={onBack}>{t("menu.back")}</button>
    </div>
  );
}

// ============================================================
// Player Colors Sub-Menu (multi-pick: pool for player queue)
