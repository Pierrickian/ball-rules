// ============================================================
// InstantCreationMenu
// ------------------------------------------------------------
// UI test panel for instant feature creation. It intentionally
// leaves the existing Evolution/Add flow untouched: this component
// is a separate lightning-button menu that explores declared engine
// capabilities and builds a normalized feature intent.
// ============================================================

import { useMemo, useState } from "react";
import { buildInstantConfigPatch, SUPPORTED_INSTANT_CONFIG_CAPABILITIES } from "./instantConfigPatches";
import type { BallColor, GameConfig } from "../engine/types";
import {
  evaluateFeatureIntent,
  FEATURE_CAPABILITY_REGISTRY,
  type CapabilityDefinition,
  type FeatureCategory,
  type FeatureIntent,
} from "./featureCapabilities";

const ENTITY_ICONS: Record<FeatureCategory, string> = {
  ball: "🔮",
  level: "🏁",
  boss: "👑",
  weapon: "🎯",
  ability: "✨",
  object: "🏥",
  game: "🌌",
  other: "🌀",
};

const PANEL: React.CSSProperties = {
  border: "1px solid rgba(255,225,120,0.34)",
  background: "linear-gradient(180deg, rgba(40,28,8,0.96), rgba(6,12,30,0.98))",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  boxShadow: "0 0 22px rgba(255,200,80,0.13)",
};

const MINI_TITLE: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 2,
  color: "#806c38",
};

const FIELD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const INPUT: React.CSSProperties = {
  border: "1px solid rgba(255,225,120,0.28)",
  background: "rgba(0,5,20,0.74)",
  color: "#fff1bf",
  borderRadius: 8,
  padding: "9px 10px",
  fontFamily: "inherit",
  fontSize: 12,
};

const CHIP: React.CSSProperties = {
  border: "1px solid rgba(255,225,120,0.24)",
  background: "rgba(255,204,80,0.08)",
  color: "#ffe18a",
  borderRadius: 999,
  padding: "7px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
};

function realColorKeys(config: GameConfig): BallColor[] {
  return Object.keys(config.ball_colors).filter(
    (color) => color !== "_description" && color !== "_color_format"
  ) as BallColor[];
}

function instantCapabilities(category: FeatureCategory): CapabilityDefinition[] {
  return FEATURE_CAPABILITY_REGISTRY.categories
    .find((entry) => entry.key === category)
    ?.capabilities.filter((capability) => capability.status === "instant" && SUPPORTED_INSTANT_CONFIG_CAPABILITIES.has(capability.key)) ?? [];
}

function defaultValueForCapability(capability: CapabilityDefinition, config: GameConfig): unknown {
  if (capability.valueType === "number") return capability.min ?? 1;
  if (capability.valueType === "boolean") return true;
  if (capability.valueType === "enum") return capability.enumValues?.[0] ?? "";
  if (capability.valueType === "weights") return { [realColorKeys(config)[0] ?? "white"]: 1 };
  if (capability.valueType === "object") return {};
  return "";
}

function capabilityTargetFields(capability: CapabilityDefinition): Array<"level" | "ball" | "boss"> {
  const fields: Array<"level" | "ball" | "boss"> = [];
  if (capability.key.startsWith("boss.")) fields.push("level", "boss");
  if (capability.key.includes("launch_color_weights") || capability.key.includes("timer") || capability.key.includes("ammo") || capability.key.includes("spawnWeight")) fields.push("level");
  if (capability.key.includes("ball") || capability.key.includes("color") || capability.key.includes("spawnWeight") || capability.key.includes("bounce") || capability.key === "size" || capability.key.startsWith("behavior.")) fields.push("ball");
  return Array.from(new Set(fields));
}

export function InstantCreationMenu({
  config,
  onApplyInstantConfig,
}: {
  config: GameConfig;
  onApplyInstantConfig: (
    nextConfig: GameConfig,
    options?: { reset?: boolean; playtestTarget?: unknown }
  ) => void;
}) {
  const categories = FEATURE_CAPABILITY_REGISTRY.categories.filter((category) =>
    instantCapabilities(category.key).length > 0
  );
  const defaultCategory = categories[0]?.key ?? "level";
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<FeatureCategory>(defaultCategory);
  const capabilities = instantCapabilities(category);
  const [capabilityKey, setCapabilityKey] = useState(capabilities[0]?.key ?? "");
  const selectedCapability = capabilities.find((capability) => capability.key === capabilityKey) ?? capabilities[0];
  const [levelId, setLevelId] = useState(config.levels?.list[0]?.id ?? 1);
  const [ballColor, setBallColor] = useState<BallColor>(realColorKeys(config)[0] ?? "white");
  const [value, setValue] = useState<unknown>(() => selectedCapability ? defaultValueForCapability(selectedCapability, config) : "");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const targetFields = selectedCapability ? capabilityTargetFields(selectedCapability) : [];

  const intent = useMemo<FeatureIntent>(() => {
    if (!selectedCapability) {
      return { category, context: {}, requestedProperties: {} };
    }

    const isBehaviorCapability = selectedCapability.key.startsWith("behavior.");

    return {
      category,
      title: selectedCapability.label,
      description: `Instant request for ${selectedCapability.label}`,
      context: {
        ...(targetFields.includes("level") ? { levelId } : {}),
        ...(targetFields.includes("ball") ? { color: ballColor } : {}),
        ...(targetFields.includes("boss") ? { scope: "boss" } : {}),
      },
      requestedProperties: isBehaviorCapability ? {} : { [selectedCapability.key]: value },
      requestedBehaviors: isBehaviorCapability ? [selectedCapability.key] : [],
    };
  }, [ballColor, category, levelId, selectedCapability, targetFields, value]);

  const evaluation = useMemo(() => evaluateFeatureIntent(intent), [intent]);

  const handleApplyInstantly = () => {
    try {
      const patch = buildInstantConfigPatch(config, intent);
      onApplyInstantConfig(patch.nextConfig, { reset: patch.requiresReset, playtestTarget: patch.playtestTarget });
      setMessage({ kind: "success", text: patch.summary || "Applied for this session" });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not apply this instant change." });
    }
  };

  const changeCategory = (next: FeatureCategory) => {
    const nextCapabilities = instantCapabilities(next);
    const nextCapability = nextCapabilities[0];
    setCategory(next);
    setCapabilityKey(nextCapability?.key ?? "");
    setValue(nextCapability ? defaultValueForCapability(nextCapability, config) : "");
    setMessage(null);
  };

  const changeCapability = (key: string) => {
    const nextCapability = capabilities.find((capability) => capability.key === key);
    setCapabilityKey(key);
    setValue(nextCapability ? defaultValueForCapability(nextCapability, config) : "");
    setMessage(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        onClick={() => setIsOpen((value) => !value)}
        style={{
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
        }}
      >
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>
          <div style={{ fontWeight: 900 }}>Instant</div>
          <div style={{ fontSize: 11, color: "#8d7a4a", marginTop: 2 }}>Créer avec ce que le moteur sait déjà faire</div>
        </div>
      </button>

      {isOpen && (
        <div style={PANEL}>
          <div>
            <div style={MINI_TITLE}>Instant creation</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#ffe18a" }}>What do you want to modify?</div>
          </div>

          <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
            {categories.map((entry) => {
              const active = entry.key === category;
              return (
                <button
                  key={entry.key}
                  onClick={() => changeCategory(entry.key)}
                  style={{
                    ...CHIP,
                    background: active ? "rgba(255,210,80,0.26)" : CHIP.background,
                    borderColor: active ? "rgba(255,225,120,0.72)" : "rgba(255,225,120,0.24)",
                    color: active ? "#fff7cf" : CHIP.color,
                    flexShrink: 0,
                  }}
                >
                  {ENTITY_ICONS[entry.key]} {entry.label}
                </button>
              );
            })}
          </div>

          <label style={FIELD}>
            <span style={MINI_TITLE}>Capability</span>
            <select value={selectedCapability?.key ?? ""} onChange={(event) => changeCapability(event.currentTarget.value)} style={INPUT}>
              {capabilities.map((capability) => (
                <option key={capability.key} value={capability.key}>{capability.label}</option>
              ))}
            </select>
          </label>

          {targetFields.includes("ball") && (
            <label style={FIELD}>
              <span style={MINI_TITLE}>Which ball?</span>
              <select value={ballColor} onChange={(event) => setBallColor(event.currentTarget.value as BallColor)} style={INPUT}>
                {realColorKeys(config).map((color) => (
                  <option key={color} value={color}>{config.ball_colors[color]?._label ?? color}</option>
                ))}
              </select>
            </label>
          )}

          {targetFields.includes("level") && (
            <label style={FIELD}>
              <span style={MINI_TITLE}>Which level?</span>
              <select value={levelId} onChange={(event) => setLevelId(Number(event.currentTarget.value))} style={INPUT}>
                {(config.levels?.list ?? []).map((level) => (
                  <option key={level.id} value={level.id}>{level.name}</option>
                ))}
              </select>
            </label>
          )}

          {selectedCapability && (
            <label style={FIELD}>
              <span style={MINI_TITLE}>New value</span>
              {selectedCapability.valueType === "enum" ? (
                <select value={String(value)} onChange={(event) => setValue(event.currentTarget.value)} style={INPUT}>
                  {(selectedCapability.enumValues ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : selectedCapability.valueType === "boolean" ? (
                <select value={String(value)} onChange={(event) => setValue(event.currentTarget.value === "true")} style={INPUT}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : selectedCapability.valueType === "number" ? (
                <input
                  type="number"
                  value={Number(value)}
                  min={selectedCapability.min}
                  max={selectedCapability.max}
                  onChange={(event) => setValue(Number(event.currentTarget.value))}
                  style={INPUT}
                />
              ) : (
                <input
                  value={typeof value === "string" ? value : JSON.stringify(value)}
                  onChange={(event) => setValue(event.currentTarget.value)}
                  style={INPUT}
                />
              )}
            </label>
          )}

          <div style={{ border: "1px solid rgba(255,225,120,0.18)", borderRadius: 12, padding: 10, background: "rgba(0,5,20,0.45)", fontSize: 11, color: "#bda96a", lineHeight: 1.45 }}>
            <div style={{ color: evaluation.status === "instant" ? "#66ffbb" : evaluation.status === "partial" ? "#ffe18a" : "#ff9c9c", fontWeight: 900, marginBottom: 4 }}>
              {evaluation.status === "instant" ? "⚡ Ready instantly" : evaluation.status === "partial" ? "⚡ Partial instant creation" : "🛠️ Needs evolution"}
            </div>
            <div>{evaluation.supported.length} supported · {evaluation.unsupported.length} missing</div>
          </div>

          <button
            onClick={handleApplyInstantly}
            disabled={evaluation.status !== "instant"}
            title={evaluation.status === "instant" ? "Apply a runtime config patch and start a playtest" : "This request is not fully instant yet"}
            style={{
              border: "1px solid rgba(102,255,187,0.55)",
              background: evaluation.status === "instant" ? "rgba(0,80,54,0.92)" : "rgba(30,30,30,0.55)",
              color: evaluation.status === "instant" ? "#c8ffe7" : "#777",
              borderRadius: 999,
              padding: "10px 14px",
              cursor: evaluation.status === "instant" ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              fontWeight: 900,
            }}
          >
            ⚡ Apply Instantly
          </button>

          {message && (
            <div style={{
              border: `1px solid ${message.kind === "success" ? "rgba(102,255,187,0.45)" : "rgba(255,120,120,0.45)"}`,
              background: message.kind === "success" ? "rgba(0,80,54,0.35)" : "rgba(90,20,20,0.35)",
              color: message.kind === "success" ? "#c8ffe7" : "#ffd0d0",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 800,
            }}>
              {message.kind === "success" ? "✅ Applied for this session" : "⚠️ Instant apply failed"}
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 3 }}>{message.text}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
