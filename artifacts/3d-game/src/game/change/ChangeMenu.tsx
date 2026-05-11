import { useEffect, useMemo, useState } from "react";
import type { GameConfig } from "../../engine/types";
import { CLOSE_BTN, PANEL, TITLE } from "../menu/menuStyles";
import { PERSONALITY_TRAITS } from "./changePersonality";
import { proposeChangeGraph } from "./changeGraph";
import { applyChangeSelection, loadChangeSession, saveChangeSession, withSelectedModifier, type ChangeSessionState } from "./changeSelection";

const TRAIT_LABELS: Record<(typeof PERSONALITY_TRAITS)[number], string> = {
  aggression: "attaque",
  chaos: "chaos",
  precision: "précision",
  bossFocus: "boss",
  survival: "survie",
  experimentation: "expé",
};

function HoneycombNode({
  node,
  index,
  onClick,
}: {
  node: ReturnType<typeof proposeChangeGraph>[number];
  index: number;
  onClick: () => void;
}) {
  const ring = node.selected ? "0 0 0 3px rgba(255,255,255,0.16), 0 0 28px" : node.unlocked ? "0 0 22px" : "0 0 12px";
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: node.selected ? 112 : 104,
        aspectRatio: "1 / 0.88",
        clipPath: "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)",
        border: "none",
        background: node.selected
          ? `linear-gradient(145deg, ${node.tone}55, rgba(8,14,32,0.98) 64%)`
          : node.unlocked
            ? `linear-gradient(145deg, ${node.tone}36, rgba(8,14,32,0.96) 68%)`
            : "linear-gradient(145deg, rgba(20,32,62,0.94), rgba(6,10,24,0.98))",
        color: "#edf7ff",
        padding: "18px 12px",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "center",
        position: "relative",
        transform: node.selected ? "translateY(-3px) scale(1.04)" : `translateY(${index % 2 === 0 ? 0 : 10}px)`,
        transition: "transform 220ms ease, filter 220ms ease, opacity 180ms ease",
        boxShadow: `${ring} ${node.tone}${node.selected ? "99" : "55"}`,
        filter: node.selected ? "saturate(1.18)" : "saturate(0.98)",
      }}
    >
      <div style={{ fontSize: node.kind === "add" ? 34 : 24, lineHeight: 1 }}>{node.icon}</div>
      <div style={{ marginTop: 7, fontSize: 13, fontWeight: 950, lineHeight: 1.08 }}>{node.title}</div>
      <div style={{ marginTop: 5, fontSize: 10.5, color: node.selected ? "#f4fbff" : "#9bb1cf", lineHeight: 1.25 }}>{node.subtitle}</div>
      <div style={{ marginTop: 7, display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
        {node.evolution?.evolutionLevel && node.evolution.evolutionLevel > 1 ? <span style={{ fontSize: 9, color: node.tone }}>◆{node.evolution.evolutionLevel}</span> : null}
        <span style={{ fontSize: 9, color: node.selected ? "#d9fff0" : node.tone }}>{node.reason}</span>
      </div>
    </button>
  );
}

export function ChangeMenu({
  config,
  currentLevelIndex,
  currentLevelNumber,
  onApplyChangeConfig,
  onOpenEvolution,
  onClose,
  onBack,
}: {
  config: GameConfig;
  currentLevelIndex: number;
  currentLevelNumber: number;
  onApplyChangeConfig: (nextConfig: GameConfig, options?: { reset?: boolean; playtestTarget?: unknown }) => void;
  onOpenEvolution: (prefillText: string) => void;
  onClose: () => void;
  onBack: () => void;
}) {
  const [session, setSession] = useState<ChangeSessionState>(() => loadChangeSession());
  const [message, setMessage] = useState("Façonne la prochaine mutation de cette partie.");

  useEffect(() => saveChangeSession(session), [session]);

  const proposals = useMemo(() => proposeChangeGraph({ config, currentLevelIndex, currentLevelNumber, session }), [config, currentLevelIndex, currentLevelNumber, session]);
  const selectedCount = session.selectedModifierIds.length;
  const maxTrait = Math.max(1, ...PERSONALITY_TRAITS.map((trait) => session.personality[trait]));

  const toggleNode = (id: string) => {
    const node = proposals.find((proposal) => proposal.id === id);
    if (node?.kind === "add") {
      onOpenEvolution(node.evolutionPrompt ?? "Propose une évolution contextualisée pour la partie actuelle.");
      return;
    }
    setSession((current) => withSelectedModifier(current, id));
  };

  const play = () => {
    const nextConfig = applyChangeSelection(config, session.selectedModifierIds, { currentLevelIndex, currentLevelNumber });
    saveChangeSession(session);
    setMessage(selectedCount > 0 ? "Mutation appliquée à cette session." : "Aucun changement sélectionné.");
    onApplyChangeConfig(nextConfig, { reset: selectedCount > 0 });
  };

  return (
    <div style={{ ...PANEL, maxWidth: 430, width: "min(94vw, 430px)", gap: 13 }}>
      <div>
        <div style={TITLE}>Change</div>
        <div style={{ fontSize: 20, fontWeight: 950, color: "#66ffbb" }}>Graphe vivant</div>
        <div style={{ fontSize: 12, color: "#8aa6cc", lineHeight: 1.45, marginTop: 5 }}>
          Les choix proposés se recalculent selon l'historique, le niveau {currentLevelNumber}, les synergies et la personnalité de la session.
        </div>
      </div>

      <div style={{ border: "1px solid rgba(102,255,187,0.24)", background: "rgba(5,20,25,0.52)", borderRadius: 14, padding: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: "#d9fff0", fontSize: 12, fontWeight: 900 }}>
          <span>Personnalité</span><span>{selectedCount} sélection{selectedCount > 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 9 }}>
          {PERSONALITY_TRAITS.map((trait) => (
            <div key={trait} style={{ display: "grid", gridTemplateColumns: "62px 1fr", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#91a7c7", fontSize: 10 }}>{TRAIT_LABELS[trait]}</span>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (session.personality[trait] / maxTrait) * 100)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #66ffbb, #38bdf8)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px 10px", alignItems: "center", justifyItems: "center" }}>
        {proposals.map((node, index) => <HoneycombNode key={node.id} node={node} index={index} onClick={() => toggleNode(node.id)} />)}
      </div>

      <div style={{ color: "#a9bdd8", fontSize: 11, lineHeight: 1.4 }}>{message}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...CLOSE_BTN, flex: 1 }} onClick={onBack}>← Retour</button>
        <button style={{ ...CLOSE_BTN, flex: 1, color: "#061122", background: "#66ffbb", borderColor: "#66ffbb", fontWeight: 950 }} onClick={play}>▶ Jouer</button>
        <button style={{ ...CLOSE_BTN, width: 44 }} onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
