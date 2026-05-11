import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { CHANGE_MAIN_NODES, getCategoryNodes, getFinalNodes, type ChangeCategory, type ChangeNode, type ChangeTone } from "./changeNodes";

function HoneyButton({ node, active, selected, onClick }: { node: ChangeNode; active?: boolean; selected?: boolean; onClick: () => void }) {
  const { t } = useI18n();
  const accent = selected ? "#ffd166" : active ? "#72f1b8" : "#55b8ff";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "min(29vw, 126px)",
        minWidth: 92,
        height: 106,
        border: `1px solid ${accent}`,
        background: selected
          ? "linear-gradient(145deg, rgba(82,52,6,0.96), rgba(10,10,20,0.95))"
          : "linear-gradient(145deg, rgba(5,18,38,0.96), rgba(4,8,18,0.92))",
        color: selected ? "#ffe8a3" : "#eaf5ff",
        cursor: "pointer",
        padding: "14px 10px",
        clipPath: "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)",
        boxShadow: selected ? `0 0 22px ${accent}aa` : `0 0 14px ${accent}55`,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        fontFamily: "'Courier New', monospace",
        fontSize: 13,
        fontWeight: 900,
        lineHeight: 1.15,
        textTransform: "uppercase",
        touchAction: "manipulation",
      }}
    >
      {t(node.labelKey)}
    </button>
  );
}

export function ChangeMenu({
  isBossPhase,
  selectedModifiers,
  onToggleModifier,
  onPlay,
  onClose,
}: {
  isBossPhase: boolean;
  selectedModifiers: string[];
  onToggleModifier: (modifierId: string) => void;
  onPlay: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [tone, setTone] = useState<ChangeTone | null>(null);
  const [category, setCategory] = useState<ChangeCategory | null>(null);
  const categories = useMemo(() => tone ? getCategoryNodes(tone, isBossPhase) : [], [isBossPhase, tone]);
  const finals = useMemo(() => tone && category ? getFinalNodes(tone, category) : [], [category, tone]);

  const selectedFinalNodes = useMemo(() => {
    const nodes: ChangeNode[] = [];
    for (const main of CHANGE_MAIN_NODES) {
      if (!main.tone) continue;
      for (const cat of getCategoryNodes(main.tone, isBossPhase)) {
        if (!cat.category) continue;
        nodes.push(...getFinalNodes(main.tone, cat.category).filter((node) => node.modifierId && selectedModifiers.includes(node.modifierId)));
      }
    }
    return nodes;
  }, [isBossPhase, selectedModifiers]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 85, background: "rgba(0, 6, 18, 0.82)", backdropFilter: "blur(6px)", pointerEvents: "auto", display: "grid", placeItems: "center", padding: 12 }}>
      <div style={{ position: "relative", width: "min(96vw, 560px)", maxHeight: "calc(100vh - 24px)", overflowY: "auto", border: "1px solid rgba(85,184,255,0.42)", borderRadius: 22, background: "radial-gradient(circle at top, rgba(15,39,70,0.98), rgba(4,8,18,0.98))", boxShadow: "0 0 34px rgba(30,144,255,0.32)", padding: "22px 14px 18px", fontFamily: "'Courier New', monospace" }}>
        <button type="button" onClick={onClose} aria-label={t("change.close")} style={{ position: "absolute", top: 10, right: 10, width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.4)", color: "#d6e8ff", cursor: "pointer", fontSize: 20, fontWeight: 900 }}>×</button>
        <div style={{ textAlign: "center", color: "#7ce8ff", fontSize: 30, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 18px #1e90ff", marginBottom: 6 }}>{t("change.title")}</div>
        <div style={{ textAlign: "center", color: "#b9d7ff", fontSize: 13, letterSpacing: 1, marginBottom: 16 }}>{t("change.subtitle")}</div>

        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {CHANGE_MAIN_NODES.map((node) => (
            <HoneyButton key={node.id} node={node} active={tone === node.tone} selected={tone === node.tone} onClick={() => { setTone(tone === node.tone ? null : node.tone ?? null); setCategory(null); }} />
          ))}
        </div>

        {tone && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {categories.map((node) => (
              <HoneyButton key={node.id} node={node} active={category === node.category} selected={category === node.category} onClick={() => setCategory(category === node.category ? null : node.category ?? null)} />
            ))}
          </div>
        )}

        {tone && category && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {finals.map((node) => {
              const selected = Boolean(node.modifierId && selectedModifiers.includes(node.modifierId));
              return <HoneyButton key={node.id} node={node} selected={selected} onClick={() => node.modifierId && onToggleModifier(node.modifierId)} />;
            })}
          </div>
        )}

        {selectedFinalNodes.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 14 }}>
            {selectedFinalNodes.map((node) => (
              <button key={`${node.id}-${node.modifierId}`} type="button" onClick={() => node.modifierId && onToggleModifier(node.modifierId)} style={{ border: "1px solid #ffd166", borderRadius: 999, background: "rgba(255,209,102,0.16)", color: "#ffe8a3", padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}>
                {t(node.labelKey)} ×
              </button>
            ))}
          </div>
        )}

        <button type="button" onClick={onPlay} style={{ width: "100%", border: "1px solid #72f1b8", borderRadius: 16, background: "linear-gradient(180deg, #9cffd2, #36d897)", color: "#031811", padding: "14px 18px", fontSize: 18, fontWeight: 1000, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", boxShadow: "0 0 22px rgba(114,241,184,0.45)" }}>
          {t("change.play")}
        </button>
      </div>
    </div>
  );
}

export function ContinueChangeOverlay({ onContinue, onNew }: { onContinue: () => void; onNew: () => void }) {
  const { t } = useI18n();
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 90, display: "grid", placeItems: "center", background: "rgba(0, 5, 18, 0.78)", backdropFilter: "blur(5px)", pointerEvents: "auto", fontFamily: "'Courier New', monospace", padding: 18 }}>
      <div style={{ width: "min(92vw, 360px)", border: "1px solid rgba(124,232,255,0.55)", borderRadius: 18, background: "rgba(4, 12, 28, 0.96)", boxShadow: "0 0 30px rgba(30,144,255,0.35)", padding: 22, textAlign: "center" }}>
        <div style={{ color: "#7ce8ff", fontSize: 24, fontWeight: 900, letterSpacing: 1.5 }}>{t("change.continueTitle")}</div>
        <div style={{ color: "#cfe3ff", fontSize: 13, marginTop: 8, lineHeight: 1.4 }}>{t("change.continueSubtitle")}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={onContinue} style={{ border: "1px solid #72f1b8", borderRadius: 12, background: "#72f1b8", color: "#031811", padding: "10px 16px", fontWeight: 900, cursor: "pointer" }}>{t("change.continue")}</button>
          <button type="button" onClick={onNew} style={{ border: "1px solid #7f9ec6", borderRadius: 12, background: "rgba(255,255,255,0.05)", color: "#d6e8ff", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>{t("change.newGame")}</button>
        </div>
      </div>
    </div>
  );
}
