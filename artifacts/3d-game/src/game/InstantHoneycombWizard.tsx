import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { BallColor, GameConfig } from "../engine/types";
import type { FeatureIntent } from "./featureCapabilities";
import { buildInstantConfigPatch } from "./instantConfigPatches";
import { INTENSITIES, MOODS, RECIPES, type IntensityIndex, type MoodId, type RecipeChoice } from "./instantHoneycombRecipes";

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

function recipeValue(recipe: RecipeChoice, intensity: IntensityIndex, ballColor: BallColor): unknown {
  if (recipe.values === "selectedBallWeight") return { [ballColor]: 1 };
  return recipe.values[intensity];
}

function buildIntent(recipe: RecipeChoice, intensity: IntensityIndex, levelId: number, ballColor: BallColor): FeatureIntent {
  const context = recipe.context === "boss"
    ? { levelId, scope: "boss" }
    : recipe.context === "level"
      ? { levelId }
      : { color: ballColor };

  return {
    category: recipe.category,
    title: recipe.label,
    description: `Instant wizard recipe: ${recipe.label}`,
    context,
    requestedProperties: {
      [recipe.capabilityKey]: recipeValue(recipe, intensity, ballColor),
    },
  };
}

function HoneycombButton({
  active,
  label,
  symbol,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  symbol: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 104,
        minHeight: 92,
        border: "none",
        clipPath: "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)",
        background: active
          ? "linear-gradient(160deg, rgba(255,225,120,0.42), rgba(255,122,54,0.22), rgba(20,8,34,0.98))"
          : "linear-gradient(160deg, rgba(255,225,120,0.16), rgba(25,16,46,0.95))",
        color: active ? "#fff8d5" : "#ffe18a",
        cursor: "pointer",
        fontFamily: "inherit",
        padding: "15px 13px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        boxShadow: active
          ? "0 0 26px rgba(255,214,96,0.42), inset 0 0 24px rgba(255,255,255,0.08)"
          : "0 0 14px rgba(255,214,96,0.12), inset 0 0 18px rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{symbol}</span>
      <span style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.1 }}>{label}</span>
      <span style={{ fontSize: 9, color: active ? "#fff0a6" : "#9f8b57", lineHeight: 1.15 }}>{hint}</span>
    </button>
  );
}

export function InstantHoneycombWizard({
  config,
  onApplyInstantConfig,
}: {
  config: GameConfig;
  onApplyInstantConfig: (nextConfig: GameConfig, options?: { reset?: boolean; playtestTarget?: unknown }) => void;
}) {
  const bossLevels = useMemo(() => (config.levels?.list ?? []).filter((level) => level.boss), [config.levels?.list]);
  const levels = config.levels?.list ?? [];
  const ballColors = useMemo(() => playableBallColors(config), [config]);
  const [isOpen, setIsOpen] = useState(false);
  const [moodId, setMoodId] = useState<MoodId>("epicBoss");
  const [recipeId, setRecipeId] = useState("hugeBoss");
  const [intensity, setIntensity] = useState<IntensityIndex>(1);
  const [bossLevelId, setBossLevelId] = useState(bossLevels[0]?.id ?? levels[0]?.id ?? 1);
  const [levelId, setLevelId] = useState(levels[0]?.id ?? 1);
  const [ballColor, setBallColor] = useState<BallColor>(ballColors[0] ?? "white");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const recipes = RECIPES.filter((recipe) => recipe.mood === moodId);
  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId) ?? recipes[0] ?? RECIPES[0];
  const selectedLevelId = selectedRecipe.context === "boss" ? bossLevelId : levelId;
  const selectedValue = recipeValue(selectedRecipe, intensity, ballColor);
  const canApply = selectedRecipe.context !== "boss" || bossLevels.length > 0;

  const chooseMood = (nextMoodId: MoodId) => {
    setMoodId(nextMoodId);
    setRecipeId(RECIPES.find((recipe) => recipe.mood === nextMoodId)?.id ?? RECIPES[0].id);
    setMessage(null);
  };

  const applyRecipe = () => {
    if (!canApply) {
      setMessage({ kind: "error", text: "Pick a boss level before playing this creation." });
      return;
    }

    try {
      const intent = buildIntent(selectedRecipe, intensity, selectedLevelId, ballColor);
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
          <div style={{ fontSize: 11, color: "#8d7a4a", marginTop: 2 }}>Créer une variante jouable en quelques clics</div>
        </div>
      </button>

      {isOpen && (
        <div style={PANEL}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "#b59750" }}>Instant wizard</div>
            <div style={{ fontSize: 17, fontWeight: 950, color: "#ffe18a", marginTop: 3 }}>Choose a gameplay vibe</div>
            <div style={{ fontSize: 11, color: "#9f8b57", marginTop: 3 }}>Simple choices. The engine handles the details.</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center" }}>
            {MOODS.map((mood) => (
              <HoneycombButton
                key={mood.id}
                active={mood.id === moodId}
                label={mood.label}
                symbol={mood.symbol}
                hint={mood.hint}
                onClick={() => chooseMood(mood.id)}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "center" }}>
            {recipes.map((recipe) => (
              <HoneycombButton
                key={recipe.id}
                active={recipe.id === selectedRecipe.id}
                label={recipe.label}
                symbol={recipe.symbol}
                hint={recipe.hint}
                onClick={() => { setRecipeId(recipe.id); setMessage(null); }}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#ffe18a" }}>Intensity</span>
              <span style={{ color: "#fff4bd", fontWeight: 900 }}>{INTENSITIES[intensity]}</span>
            </div>
            <input
              aria-label="Instant intensity"
              min={0}
              max={3}
              step={1}
              type="range"
              value={intensity}
              onChange={(event) => { setIntensity(Number(event.target.value) as IntensityIndex); setMessage(null); }}
              style={{ accentColor: "#ffc64f", width: "100%" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, fontSize: 10, color: "#9f8b57", textAlign: "center" }}>
              {INTENSITIES.map((label) => <span key={label}>{label}</span>)}
            </div>
          </div>

          {selectedRecipe.context === "boss" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#ffe18a", fontSize: 12, fontWeight: 800 }}>
              Boss level
              <select value={bossLevelId} onChange={(event) => { setBossLevelId(Number(event.target.value)); setMessage(null); }} style={SELECT}>
                {bossLevels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
              </select>
            </label>
          )}

          {selectedRecipe.context === "level" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#ffe18a", fontSize: 12, fontWeight: 800 }}>
              Test level
              <select value={levelId} onChange={(event) => { setLevelId(Number(event.target.value)); setMessage(null); }} style={SELECT}>
                {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
              </select>
            </label>
          )}

          {selectedRecipe.context === "ball" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#ffe18a", fontSize: 12, fontWeight: 800 }}>
              Ball
              <select value={ballColor} onChange={(event) => { setBallColor(event.target.value as BallColor); setMessage(null); }} style={SELECT}>
                {ballColors.map((color) => <option key={color} value={color}>{colorLabel(config, color)}</option>)}
              </select>
            </label>
          )}

          <div style={{ border: "1px solid rgba(255,225,120,0.18)", borderRadius: 12, padding: 10, color: "#d8c078", fontSize: 11, background: "rgba(255,255,255,0.04)" }}>
            Ready recipe: <strong style={{ color: "#fff1bf" }}>{selectedRecipe.label}</strong>
            {selectedRecipe.values !== "selectedBallWeight" && <> · Power value: <strong style={{ color: "#fff1bf" }}>{String(selectedValue)}</strong></>}
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
