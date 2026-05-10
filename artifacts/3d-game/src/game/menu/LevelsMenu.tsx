import { useState } from "react";
import type { BallColor, GameConfig } from "../../engine/types";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";
import { launcherColors } from "./colorHelpers";
import { normalizeWeights, WeightsEditor } from "./weightsHelpers";

export function LevelsMenu({
  config,
  currentLevelIndex,
  onLevelSelect,
  onLevelWeightsChange,
  onTerrainDistributionPlay,
  onClose,
  onBack,
}: {
  config: GameConfig;
  currentLevelIndex: number;
  onLevelSelect: (index: number) => void;
  onLevelWeightsChange: (index: number, weights: Record<BallColor, number>) => void;
  onTerrainDistributionPlay: (weights: Record<BallColor, number>) => void;
  onClose: () => void;
  onBack: () => void;
}) {
  const levels = config.levels?.list ?? [];
  const colors = launcherColors(config);
  const [index, setIndex] = useState(() =>
    levels.length > 0 && currentLevelIndex >= 0 && currentLevelIndex < levels.length
      ? currentLevelIndex + 1
      : 0
  );
  const [customWeights, setCustomWeights] = useState<Record<BallColor, number>>(() => {
    const base = {} as Record<BallColor, number>;
    if (colors[colors.length - 1]) base[colors[colors.length - 1]] = 1;
    return base;
  });

  const pageCount = levels.length + 1;
  const prev = () => setIndex((i) => (i - 1 + pageCount) % pageCount);
  const next = () => setIndex((i) => (i + 1) % pageCount);
  const isCustom = index === 0;
  const levelIndex = index - 1;
  const lvl = !isCustom ? levels[levelIndex] : null;
  const isCurrent = !isCustom && levelIndex === currentLevelIndex;

  if (pageCount === 0) return null;

  const renderLevelWeights = () => {
    if (!lvl) return null;
    const levelWeights = normalizeWeights((lvl.launch_color_weights ?? {}) as Record<BallColor, number>);
    return (
      <WeightsEditor
        config={config}
        colors={colors}
        weights={levelWeights}
        onChange={(nextWeights) => onLevelWeightsChange(levelIndex, nextWeights)}
        compact
      />
    );
  };

  return (
    <div style={{ ...PANEL, width: "min(94vw, 440px)", maxHeight: "94vh", padding: "22px 18px", overflow: "hidden" }}>
      <div style={{ flexShrink: 0 }}>
        <div style={TITLE}>Niveau</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#1e90ff" }}>{index + 1} / {pageCount}</div>
          {isCurrent && <div style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: "bold", color: "#0a1628", background: "#1e90ff", padding: "3px 8px", borderRadius: 8 }}>★ NIVEAU ACTIF</div>}
          {isCustom && <div style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: "bold", color: "#062016", background: "#66ffbb", padding: "3px 8px", borderRadius: 8 }}>CUSTOM</div>}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", paddingRight: 4 }}>
        <div style={{ background: "rgba(6,16,45,0.9)", border: `1.5px solid ${isCurrent || isCustom ? "rgba(30,144,255,0.7)" : "rgba(30,144,255,0.25)"}`, borderRadius: 14, padding: "22px 18px", display: "flex", flexDirection: "column", gap: 14, minHeight: "min(64vh, 520px)" }}>
          {isCustom ? (
            <>
              <div>
                <div style={{ fontSize: 10, color: "#445", letterSpacing: 1.5 }}>NIVEAU CUSTOM</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#ddeeff", marginTop: 4 }}>Partie custom</div>
              </div>
              <div style={{ fontSize: 13, color: "#aac2dc", lineHeight: 1.6 }}>
                Compose une répartition de balles de terrain avec le même contrôleur que « Couleur terrain », puis lance directement la partie depuis le carrousel.
              </div>
              <div>
                <div style={TITLE}>Répartition terrain</div>
                <WeightsEditor config={config} colors={colors} weights={customWeights} onChange={setCustomWeights} />
              </div>
            </>
          ) : lvl ? (
            <>
              <div>
                <div style={{ fontSize: 10, color: "#445", letterSpacing: 1.5 }}>NIVEAU {lvl.id}</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#ddeeff", marginTop: 4 }}>{lvl.name}</div>
              </div>
              <div style={{ fontSize: 13, color: "#aac2dc", lineHeight: 1.6 }}>{lvl.description}</div>
              <div>
                <div style={TITLE}>Pondération des balles lancées</div>
                {renderLevelWeights()}
              </div>
              <div style={{ fontSize: 11, color: "#556677", lineHeight: 1.5, marginTop: "auto" }}>
                Tu progresses au niveau suivant en nettoyant le terrain. Quand le dernier niveau est nettoyé, le jeu repart au niveau 1.
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
        {Array.from({ length: pageCount }).map((_, i) => (
          <div key={i} onClick={() => setIndex(i)} style={{ width: i === index ? 10 : 6, height: i === index ? 10 : 6, borderRadius: "50%", background: i === 0 ? (i === index ? "#66ffbb" : "rgba(102,255,187,0.28)") : (i - 1 === currentLevelIndex ? "#1e90ff" : i === index ? "#7fb3ff" : "rgba(255,255,255,0.18)"), cursor: "pointer", boxShadow: i === index ? "0 0 6px #1e90ff" : "none", transition: "all 0.2s" }} />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={prev} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>← Précédent</button>
        <button
          onClick={() => {
            if (isCustom) onTerrainDistributionPlay(normalizeWeights(customWeights));
            else onLevelSelect(levelIndex);
            onClose();
          }}
          title={isCustom ? "Lancer une partie custom" : isCurrent && lvl ? `Relancer le niveau ${lvl.id} (${lvl.name})` : lvl ? `Jouer le niveau ${lvl.id} (${lvl.name})` : "Jouer"}
          style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#0a1628", background: isCustom ? "#66ffbb" : "#1e90ff", borderColor: isCustom ? "#66ffbb" : "#1e90ff", fontWeight: "bold", boxShadow: "0 0 12px rgba(30,144,255,0.55)" }}
        >
          {isCustom ? "▶ Custom" : isCurrent ? "▶ Rejouer" : "▶ Jouer"}
        </button>
        <button onClick={next} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>Suivant →</button>
      </div>

      <button style={{ ...CLOSE_BTN, flexShrink: 0 }} onClick={onBack}>← Retour</button>
    </div>
  );
}
