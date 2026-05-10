import type { GameConfig } from "../../engine/types";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";

export function RulesMenu({ config, onBack }: { config: GameConfig; onBack: () => void }) {
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
