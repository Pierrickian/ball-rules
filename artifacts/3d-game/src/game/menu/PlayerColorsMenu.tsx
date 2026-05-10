import { useState } from "react";
import type { BallColor, GameConfig } from "../../engine/types";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";
import { launcherColors } from "./colorHelpers";
import { normalizeWeights, WeightsEditor } from "./weightsHelpers";

export function PlayerColorsMenu({
  config, onTerrainDistributionPlay, onClose, onBack,
}: {
  config: GameConfig;
  onTerrainDistributionPlay: (weights: Record<BallColor, number>) => void;
  onClose: () => void;
  onBack: () => void;
}) {
  const colors = launcherColors(config);
  const [weights, setWeights] = useState<Record<BallColor, number>>(() => {
    const base = {} as Record<BallColor, number>;
    if (colors[colors.length - 1]) base[colors[colors.length - 1]] = 1;
    return base;
  });

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Couleur terrain</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#1e90ff" }}>Répartition des balles de terrain</div>
      </div>
      <div style={{ fontSize: 12, color: "#7a9fcc", lineHeight: 1.5 }}>
        Ajuste les pourcentages des couleurs de terrain pour une partie custom. Le total reste à 100% et chaque balle ajoutée obtient son propre curseur.
      </div>
      <WeightsEditor config={config} colors={colors} weights={weights} onChange={setWeights} />
      <button style={{ ...CLOSE_BTN, color: "#0a1628", background: "#1e90ff", borderColor: "#1e90ff", fontWeight: "bold" }} onClick={() => { onTerrainDistributionPlay(normalizeWeights(weights)); onClose(); }}>▶ Play</button>
      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ============================================================
// Main Menu
