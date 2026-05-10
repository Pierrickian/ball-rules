import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { BallColor, GameConfig } from "../engine/types";
import type { FeatureIntent } from "./featureCapabilities";
import { buildInstantConfigPatch } from "./instantConfigPatches";
import { INTENSITIES } from "./instantHoneycombRecipes";
import {
  HONEYCOMB_NODES,
  areHoneycombNodesCompatible,
  buildEvolutionPreprompt,
  randomHoneycombSubset,
  recipeValue,
  selectedIntensity,
  selectedRecipe,
  type HoneycombNode,
} from "./instantHoneycombGraph";

const toggleButtonStyle = (isOpen: boolean): CSSProperties => ({
  border: "1px solid rgba(255,225,120,0.55)",
  background: isOpen
    ? "linear-gradient(90deg, rgba(255,210,80,0.24), rgba(255,120,40,0.18))"
    : "rgba(255,210,80,0.10)",
  color: "#ffe18a",
  borderRadius: 12,
  padding: "13px 16px",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  gap: 12,
  boxShadow: isOpen ? "0 0 18px rgba(255,210,80,0.22)" : "none",
  width: "100%",
  textAlign: "left",
});

const PANEL: CSSProperties = {
  border: "1px solid rgba(255,225,120,0.34)",
  background: "radial-gradient(circle at 18% 0%, rgba(255,190,64,0.20), transparent 28%), linear-gradient(180deg, rgba(40,28,8,0.96), rgba(6,12,30,0.98))",
  borderRadius: 18,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  boxShadow: "0 0 26px rgba(255,200,80,0.16)",
};

const SELECT: CSSProperties = {
  border: "1px solid rgba(255,225,120,0.28)",
  background: "rgba(0,5,20,0.78)",
  color: "#fff1bf",
  borderRadius: 10,
  padding: "10px 11px",
  fontFamily: "inherit",
  fontSize: 12,
  width: "100%",
};

function realColorKeys(config: GameConfig): BallColor[] {
  return Object.keys(config.ball_colors).filter((color) => !color.startsWith("_")) as BallColor[];
}

function playableBallColors(config: GameConfig): BallColor[] {
  return realColorKeys(config).filter((color) => {
    const ball = config.ball_colors[color];
    return Boolean(ball?.for_terrain && !ball.system_role && config.ball_rules?.[color]);
  });
}

function colorLabel(config: GameConfig, color: BallColor): string {
  return config.ball_colors[color]?._label ?? color;
}

function buildIntent(recipe: NonNullable<ReturnType<typeof selectedRecipe>>, intensity: number, levelId: number, ballColor: BallColor): FeatureIntent {
  const context = recipe.context === "boss"
    ? { levelId, scope: "boss" }
    : recipe.context === "level"
      ? { levelId }
      : { color: ballColor };

  return {
    category: recipe.category,
    title: recipe.label,
    description: `Instant graph recipe: ${recipe.label}`,
    context,
    requestedProperties: {
      [recipe.capabilityKey]: recipeValue(recipe, intensity as 0 | 1 | 2 | 3, ballColor),
    },
  };
}

function HoneycombButton({
  active,
  compatible = true,
  label,
  symbol,
  hint,
  onClick,
  variant = "node",
}: {
  active: boolean;
  compatible?: boolean;
  label: string;
  symbol: string;
  hint: string;
  onClick: () => void;
  variant?: "node" | "random" | "add";
}) {
  const isAction = variant !== "node";
  return (
    <button
      onClick={onClick}
      style={{
        width: isAction ? 112 : 104,
        minHeight: isAction ? 84 : 92,
        border: "none",
        clipPath: "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)",
        background: active
          ? "linear-gradient(160deg, rgba(255,225,120,0.48), rgba(255,122,54,0.28), rgba(20,8,34,0.98))"
          : variant === "add"
            ? "linear-gradient(160deg, rgba(80,190,255,0.26), rgba(25,16,46,0.95))"
            : variant === "random"
              ? "linear-gradient(160deg, rgba(190,120,255,0.24), rgba(25,16,46,0.95))"
              : "linear-gradient(160deg, rgba(255,225,120,0.16), rgba(25,16,46,0.95))",
        color: active ? "#fff8d5" : compatible ? "#ffe18a" : "#867850",
        cursor: "pointer",
        fontFamily: "inherit",
        padding: "15px 13px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        transform: active ? "translateY(-2px) scale(1.04)" : "none",
        opacity: compatible || active || isAction ? 1 : 0.48,
        boxShadow: active
          ? "0 0 26px rgba(255,214,96,0.48), inset 0 0 24px rgba(255,255,255,0.08)"
          : isAction
            ? "0 0 18px rgba(120,190,255,0.16), inset 0 0 18px rgba(255,255,255,0.04)"
            : "0 0 14px rgba(255,214,96,0.12), inset 0 0 18px rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{symbol}</span>
      <span style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.1 }}>{label}</span>
      <span style={{ fontSize: 9, color: active ? "#fff0a6" : "#9f8b57", lineHeight: 1.15 }}>{hint}</span>
    </button>
  );
}

function nodeById(id: string): HoneycombNode | undefined {
  return HONEYCOMB_NODES.find((node) => node.id === id);
}

export function InstantHoneycombWizard({
  config,
  onApplyInstantConfig,
  onOpenEvolution,
}: {
  config: GameConfig;
  onApplyInstantConfig: (nextConfig: GameConfig, options?: { reset?: boolean; playtestTarget?: unknown }) => void;
  onOpenEvolution: (preprompt: string) => void;
}) {
  const bossLevels = useMemo(() => (config.levels?.list ?? []).filter((level) => level.boss), [config.levels?.list]);
  const levels = config.levels?.list ?? [];
  const ballColors = useMemo(() => playableBallColors(config), [config]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [visibleIds, setVisibleIds] = useState<string[]>(() => randomHoneycombSubset(new Set()));
  const [bossLevelId, setBossLevelId] = useState(bossLevels[0]?.id ?? levels[0]?.id ?? 1);
  const [levelId, setLevelId] = useState(levels[0]?.id ?? 1);
  const [ballColor, setBallColor] = useState<BallColor>(ballColors[0] ?? "white");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const activeRecipe = selectedRecipe(selectedIds);
  const activeIntensity = selectedIntensity(selectedIds);
  const selectedLevelId = activeRecipe?.context === "boss" ? bossLevelId : levelId;
  const activeValue = activeRecipe ? recipeValue(activeRecipe, activeIntensity, ballColor) : undefined;
  const canApply = Boolean(activeRecipe) && (activeRecipe?.context !== "boss" || bossLevels.length > 0);
  const selectedNodes = HONEYCOMB_NODES.filter((node) => selectedIds.has(node.id));
  const visibleNodes = visibleIds.map(nodeById).filter((node): node is HoneycombNode => Boolean(node));
  const selectedVisibleNodes = visibleNodes.filter((node) => selectedIds.has(node.id));
  const openVisibleNodes = visibleNodes.filter((node) => !selectedIds.has(node.id));

  const refreshVisible = (nextSelectedIds: Set<string>) => {
    setVisibleIds(randomHoneycombSubset(nextSelectedIds));
  };

  const toggleNode = (node: HoneycombNode) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        if (node.kind === "recipe") {
          HONEYCOMB_NODES.filter((entry) => entry.kind === "recipe").forEach((entry) => next.delete(entry.id));
        }
        if (node.kind === "intensity") {
          HONEYCOMB_NODES.filter((entry) => entry.kind === "intensity").forEach((entry) => next.delete(entry.id));
        }
        next.add(node.id);
      }
      refreshVisible(next);
      return next;
    });
    setMessage(null);
  };

  const randomizeOpenNodes = () => {
    refreshVisible(selectedIds);
    setMessage(null);
  };

  const openEvolution = () => {
    onOpenEvolution(buildEvolutionPreprompt(selectedNodes));
  };

  const applyRecipe = () => {
    if (!activeRecipe) {
      setMessage({ kind: "error", text: "Choose a glowing instant node before playing." });
      return;
    }
    if (!canApply) {
      setMessage({ kind: "error", text: "Pick a boss level before playing this creation." });
      return;
    }

    try {
      const intent = buildIntent(activeRecipe, activeIntensity, selectedLevelId, ballColor);
      const patch = buildInstantConfigPatch(config, intent);
      onApplyInstantConfig(patch.nextConfig, { reset: patch.requiresReset, playtestTarget: patch.playtestTarget });
      setMessage({ kind: "success", text: patch.summary || "Creation launched for this session." });
      setIsOpen(false);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not launch this creation." });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button onClick={() => setIsOpen((value) => !value)} style={toggleButtonStyle(isOpen)}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>
          <div style={{ fontWeight: 900 }}>Instant</div>
          <div style={{ fontSize: 11, color: "#8d7a4a", marginTop: 2 }}>Explorer un graphe de créations jouables</div>
        </div>
      </button>

      {isOpen && (
        <div style={PANEL}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#b59750" }}>Instant graph</div>
            <div style={{ fontSize: 17, fontWeight: 950, color: "#ffe18a", marginTop: 3 }}>Explore a living honeycomb</div>
            <div style={{ fontSize: 11, color: "#9f8b57", marginTop: 3 }}>Pick nodes. Compatible ideas move closer. Random keeps the arcade buzzing.</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center" }}>
            <HoneycombButton active={false} label="Random" symbol="🎲" hint="Refresh open nodes" variant="random" onClick={randomizeOpenNodes} />
            <HoneycombButton active={false} label="Add / Evolution" symbol="🧬" hint="Ask for more" variant="add" onClick={openEvolution} />
          </div>

          {selectedVisibleNodes.length > 0 && (
            <div style={{ border: "1px solid rgba(255,225,120,0.22)", borderRadius: 18, padding: 10, background: "rgba(255,208,95,0.07)", boxShadow: "inset 0 0 22px rgba(255,225,120,0.05)" }}>
              <div style={{ color: "#fff0a6", fontSize: 10, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Selected cluster</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {selectedVisibleNodes.map((node) => (
                  <HoneycombButton key={node.id} active label={node.label} symbol={node.symbol} hint={node.hint} onClick={() => toggleNode(node)} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center" }}>
            {openVisibleNodes.map((node) => (
              <HoneycombButton
                key={node.id}
                active={false}
                compatible={areHoneycombNodesCompatible(node, selectedIds)}
                label={node.label}
                symbol={node.symbol}
                hint={node.hint}
                onClick={() => toggleNode(node)}
              />
            ))}
          </div>

          {activeRecipe?.context === "boss" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#ffe18a", fontSize: 12, fontWeight: 800 }}>
              Boss level
              <select value={bossLevelId} onChange={(event) => { setBossLevelId(Number(event.target.value)); setMessage(null); }} style={SELECT}>
                {bossLevels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
              </select>
            </label>
          )}

          {activeRecipe?.context === "level" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#ffe18a", fontSize: 12, fontWeight: 800 }}>
              Test level
              <select value={levelId} onChange={(event) => { setLevelId(Number(event.target.value)); setMessage(null); }} style={SELECT}>
                {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
              </select>
            </label>
          )}

          {activeRecipe?.context === "ball" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#ffe18a", fontSize: 12, fontWeight: 800 }}>
              Ball
              <select value={ballColor} onChange={(event) => { setBallColor(event.target.value as BallColor); setMessage(null); }} style={SELECT}>
                {ballColors.map((color) => <option key={color} value={color}>{colorLabel(config, color)}</option>)}
              </select>
            </label>
          )}

          <div style={{ border: "1px solid rgba(255,225,120,0.18)", borderRadius: 12, padding: 10, color: "#d8c078", fontSize: 11, background: "rgba(255,255,255,0.04)" }}>
            {activeRecipe ? (
              <>Ready: <strong style={{ color: "#fff1bf" }}>{activeRecipe.label}</strong> · Intensity: <strong style={{ color: "#fff1bf" }}>{INTENSITIES[activeIntensity]}</strong>{activeRecipe.values !== "selectedBallWeight" && <> · Power: <strong style={{ color: "#fff1bf" }}>{String(activeValue)}</strong></>}</>
            ) : (
              <>Select a recipe honeycomb to create a runtime-only playable variant, or hit Add / Evolution for a bigger idea.</>
            )}
          </div>

          <button
            onClick={applyRecipe}
            disabled={!canApply}
            style={{
              border: "1px solid rgba(255,225,120,0.62)",
              background: canApply ? "linear-gradient(90deg, #ffd05f, #ff7b3d)" : "rgba(110,96,60,0.4)",
              color: canApply ? "#201000" : "#9f8b57",
              borderRadius: 14,
              padding: "13px 14px",
              fontFamily: "inherit",
              fontWeight: 950,
              cursor: canApply ? "pointer" : "not-allowed",
              boxShadow: canApply ? "0 0 20px rgba(255,165,64,0.32)" : "none",
            }}
          >
            ⚡ Play My Creation
          </button>
        </div>
      )}

      {message && (
        <div style={{ color: message.kind === "success" ? "#78f29a" : "#ff9d9d", fontSize: 11, lineHeight: 1.35 }}>
          {message.kind === "success" ? "✅" : "⚠️"} {message.text}
        </div>
      )}
    </div>
  );
}
