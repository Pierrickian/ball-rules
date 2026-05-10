import type { GameConfig } from "../../engine/types";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";

export function ReleaseNotesMenu({ config, onBack }: { config: GameConfig; onBack: () => void }) {
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
