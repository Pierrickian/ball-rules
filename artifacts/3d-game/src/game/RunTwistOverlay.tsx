import type { CSSProperties } from "react";
import type { RunTwistChoice } from "./runTwists";
import { useI18n } from "./i18n";

const cardStyle = (accent: string): CSSProperties => ({
  width: "min(42vw, 172px)",
  minHeight: 150,
  border: `1px solid ${accent}`,
  background: `linear-gradient(145deg, rgba(5,18,38,0.96), rgba(4,8,18,0.92))`,
  color: "#eaf5ff",
  cursor: "pointer",
  padding: "18px 14px",
  clipPath: "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)",
  boxShadow: `0 0 20px ${accent}66, inset 0 0 18px rgba(255,255,255,0.04)`,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  textAlign: "center",
  fontFamily: "'Courier New', monospace",
  touchAction: "manipulation",
});

export function RunTwistOverlay({ choices, onChoose }: { choices: RunTwistChoice[]; onChoose: (choice: RunTwistChoice) => void }) {
  const { t } = useI18n();
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 6, 18, 0.76)", backdropFilter: "blur(5px)", pointerEvents: "auto", padding: 18 }}>
      <div style={{ width: "min(94vw, 520px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ textAlign: "center", fontFamily: "'Courier New', monospace" }}>
          <div style={{ color: "#7ce8ff", fontSize: 28, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 18px #1e90ff" }}>{t("run.twist.title")}</div>
          <div style={{ color: "#cfe3ff", fontSize: 14, letterSpacing: 1.4, marginTop: 8 }}>{t("run.twist.subtitle")}</div>
        </div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", alignItems: "stretch", flexWrap: "wrap" }}>
          {choices.map((choice, index) => {
            const accent = index === 0 ? "#ffd166" : "#72f1b8";
            return (
              <button key={choice.id} type="button" onClick={() => onChoose(choice)} style={cardStyle(accent)}>
                <div style={{ fontSize: 16, fontWeight: 900, color: accent, textTransform: "uppercase", lineHeight: 1.15 }}>{t(choice.titleKey)}</div>
                <div style={{ fontSize: 12, color: "#d6e8ff", lineHeight: 1.35, maxWidth: 128 }}>{t(choice.descriptionKey)}</div>
                <div style={{ fontSize: 10, color: "#7f9ec6", letterSpacing: 1.5, textTransform: "uppercase" }}>{t("run.twist.tapToContinue")}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ContinueRunOverlay({ onContinue, onNewRun }: { onContinue: () => void; onNewRun: () => void }) {
  const { t } = useI18n();
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 90, display: "grid", placeItems: "center", background: "rgba(0, 5, 18, 0.78)", backdropFilter: "blur(5px)", pointerEvents: "auto", fontFamily: "'Courier New', monospace", padding: 18 }}>
      <div style={{ width: "min(92vw, 360px)", border: "1px solid rgba(124,232,255,0.55)", borderRadius: 18, background: "rgba(4, 12, 28, 0.96)", boxShadow: "0 0 30px rgba(30,144,255,0.35)", padding: 22, textAlign: "center" }}>
        <div style={{ color: "#7ce8ff", fontSize: 24, fontWeight: 900, letterSpacing: 1.5 }}>{t("run.continue.title")}</div>
        <div style={{ color: "#cfe3ff", fontSize: 13, marginTop: 8, lineHeight: 1.4 }}>{t("run.continue.subtitle")}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={onContinue} style={{ border: "1px solid #72f1b8", borderRadius: 12, background: "#72f1b8", color: "#031811", padding: "10px 16px", fontWeight: 900, cursor: "pointer" }}>{t("run.continue.continue")}</button>
          <button type="button" onClick={onNewRun} style={{ border: "1px solid #7f9ec6", borderRadius: 12, background: "rgba(255,255,255,0.05)", color: "#d6e8ff", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("run.continue.newRun")}</button>
        </div>
      </div>
    </div>
  );
}
