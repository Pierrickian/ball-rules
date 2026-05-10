// ============================================================
// Feature capabilities
// ------------------------------------------------------------
// Data-driven helper used by the Add/Evolution flow to decide
// whether a player request can be created instantly from config,
// partially created, or must become a Codex issue.
//
// Keep this file free of React and engine runtime side effects.
// It is a negotiation layer between player intent and declared
// game capabilities.
// ============================================================

export type FeatureCategory =
  | "boss"
  | "ball"
  | "level"
  | "weapon"
  | "ability"
  | "object"
  | "other"
  | "game";

export type CapabilityStatus = "instant" | "codex";
export type FeatureEvaluationStatus = "instant" | "partial" | "codex";
export type CapabilityValueType = "string" | "number" | "boolean" | "enum" | "weights" | "object";

export interface CapabilityDefinition {
  key: string;
  label: string;
  status: CapabilityStatus;
  valueType?: CapabilityValueType;
  min?: number;
  max?: number;
  enumValues?: string[];
  issueTitle?: string;
  issueHint?: string;
}

export interface FeatureCategoryDefinition {
  key: FeatureCategory;
  label: string;
  description: string;
  capabilities: CapabilityDefinition[];
}

export interface FeatureCapabilityRegistry {
  categories: FeatureCategoryDefinition[];
}

export interface FeatureIntent {
  category: FeatureCategory;
  title?: string;
  description?: string;
  /** Form-level targeting data (level, ball, scope, etc.) that should not be evaluated as capabilities. */
  context?: Record<string, unknown>;
  requestedProperties?: Record<string, unknown>;
  requestedBehaviors?: string[];
}

export interface CapabilityMatch {
  key: string;
  label: string;
  value?: unknown;
  reason?: string;
}

export interface FeatureEvaluation {
  status: FeatureEvaluationStatus;
  category: FeatureCategory;
  supported: CapabilityMatch[];
  unsupported: CapabilityMatch[];
  issuePayload?: {
    title: string;
    body: string;
  };
}

export const FEATURE_CAPABILITY_REGISTRY: FeatureCapabilityRegistry = {
  categories: [
    {
      key: "ball",
      label: "New Ball",
      description: "Create or tune balls using existing config fields and handlers.",
      capabilities: [
        { key: "color", label: "Ball color", status: "instant", valueType: "string" },
        { key: "label", label: "Display label", status: "instant", valueType: "string" },
        { key: "selectable_by_player", label: "Player selectable flag", status: "instant", valueType: "boolean" },
        { key: "for_terrain", label: "Terrain flag", status: "instant", valueType: "boolean" },
        { key: "size", label: "Ball size", status: "instant", valueType: "enum", enumValues: ["small", "medium", "large"] },
        { key: "speed", label: "Launch speed", status: "instant", valueType: "number", min: 1, max: 250 },
        { key: "spawnWeight", label: "Level spawn weight", status: "instant", valueType: "number", min: 0, max: 1 },
        { key: "bounceCondition", label: "Bounce condition", status: "instant", valueType: "enum", enumValues: ["against_wall", "against_ball", "against_obstacle", "against_all"] },
        { key: "behavior.bounce", label: "Bounce behavior", status: "instant" },
        { key: "behavior.neutral", label: "Neutral behavior", status: "instant" },
        { key: "behavior.hp_grow_bouncer", label: "HP grow bouncer behavior", status: "instant" },
        { key: "behavior.blink_hp_bouncer", label: "Blinking HP behavior", status: "instant" },
        { key: "behavior.red_split_bouncer", label: "Red split bouncer behavior", status: "instant" },
        { key: "behavior.magnet_field", label: "Magnet field behavior", status: "instant" },
        {
          key: "behavior.custom",
          label: "New custom ball behavior",
          status: "codex",
          issueTitle: "Add a new ball behavior",
          issueHint: "The requested ball behavior is not declared in the current capability registry."
        }
      ]
    },
    {
      key: "level",
      label: "New Level",
      description: "Create levels by assembling existing ball weights, timers, ammo and optional boss config.",
      capabilities: [
        { key: "name", label: "Level name", status: "instant", valueType: "string" },
        { key: "description", label: "Level description", status: "instant", valueType: "string" },
        { key: "launch_color_weights", label: "Ball color weights", status: "instant", valueType: "weights" },
        { key: "timer_seconds", label: "Timer duration", status: "instant", valueType: "number", min: 5, max: 600 },
        { key: "ammo_count", label: "Ammo count", status: "instant", valueType: "number", min: 1, max: 999 },
        { key: "hospital", label: "Hospital object", status: "instant", valueType: "object" },
        { key: "boss", label: "Existing boss phase config", status: "instant", valueType: "object" },
        {
          key: "layout.customArenaShape",
          label: "New arena shape",
          status: "codex",
          issueTitle: "Add custom arena shape support",
          issueHint: "The current level config supports dimensions and weights, not arbitrary arena geometry."
        }
      ]
    },
    {
      key: "weapon",
      label: "New Weapon",
      description: "Tune existing shot kinds before creating new weapon code.",
      capabilities: [
        { key: "shot.light", label: "Light shot tuning", status: "instant", valueType: "object" },
        { key: "shot.heavy", label: "Heavy shot tuning", status: "instant", valueType: "object" },
        { key: "shot.mega", label: "Mega shot tuning", status: "instant", valueType: "object" },
        { key: "projectile_distribution", label: "Projectile distribution", status: "instant", valueType: "weights" },
        { key: "queue_size", label: "Projectile queue size", status: "instant", valueType: "number", min: 1, max: 30 },
        {
          key: "weapon.custom",
          label: "New weapon family",
          status: "codex",
          issueTitle: "Add a new weapon type",
          issueHint: "The current engine can tune existing shots but does not declare this weapon family."
        }
      ]
    },
    {
      key: "boss",
      label: "New Boss",
      description: "Reuse existing boss fields, or ask Codex for new boss AI and phases.",
      capabilities: [
        { key: "boss.color", label: "Boss color", status: "instant", valueType: "string" },
        { key: "boss.hp", label: "Boss HP", status: "instant", valueType: "number", min: 1, max: 9999 },
        { key: "boss.maxHp", label: "Boss max HP", status: "instant", valueType: "number", min: 1, max: 9999 },
        { key: "boss.horizontal_speed", label: "Boss horizontal speed", status: "instant", valueType: "number", min: 0, max: 250 },
        { key: "boss.spawn_count", label: "Boss spawn count", status: "instant", valueType: "number", min: 1, max: 20 },
        { key: "boss.defeat_rule", label: "Boss defeat rule", status: "instant", valueType: "enum", enumValues: ["grenade_last_hit"] },
        {
          key: "boss.ai.custom",
          label: "New boss AI",
          status: "codex",
          issueTitle: "Add custom boss AI",
          issueHint: "A new boss personality needs engine behavior beyond declared boss config fields."
        }
      ]
    },
    {
      key: "ability",
      label: "New Ability",
      description: "Abilities are not yet exposed as config-first capabilities.",
      capabilities: [
        {
          key: "ability.custom",
          label: "New player ability",
          status: "codex",
          issueTitle: "Add a new player ability",
          issueHint: "Player abilities need a dedicated data-driven system before they can be instant."
        }
      ]
    },
    {
      key: "object",
      label: "New Object",
      description: "Reuse declared objects when possible; create issues for new interaction rules.",
      capabilities: [
        { key: "object.hospital", label: "Hospital object", status: "instant", valueType: "object" },
        {
          key: "object.custom",
          label: "New interactive object",
          status: "codex",
          issueTitle: "Add a new interactive object",
          issueHint: "This object is not declared as a reusable config capability yet."
        }
      ]
    },
    {
      key: "game",
      label: "New Game",
      description: "A complete new game is always routed to Codex for now.",
      capabilities: [
        {
          key: "game.custom",
          label: "New game concept",
          status: "codex",
          issueTitle: "Create a new game prototype",
          issueHint: "A new game needs files, routing, UI and gameplay architecture."
        }
      ]
    },
    {
      key: "other",
      label: "Other",
      description: "Anything outside known categories becomes an issue by default.",
      capabilities: [
        {
          key: "other.custom",
          label: "Unclassified idea",
          status: "codex",
          issueTitle: "Handle an unclassified gameplay idea",
          issueHint: "This request does not map to a declared instant capability."
        }
      ]
    }
  ]
};

export function evaluateFeatureIntent(
  intent: FeatureIntent,
  registry: FeatureCapabilityRegistry = FEATURE_CAPABILITY_REGISTRY
): FeatureEvaluation {
  const category = registry.categories.find((entry) => entry.key === intent.category);

  if (!category) {
    return buildCodexOnlyEvaluation(intent, "Unknown feature category", "This category is not declared in the capability registry.");
  }

  const capabilitiesByKey = new Map(category.capabilities.map((capability) => [capability.key, capability]));
  const supported: CapabilityMatch[] = [];
  const unsupported: CapabilityMatch[] = [];

  for (const [key, value] of Object.entries(intent.requestedProperties ?? {})) {
    addCapabilityMatch(key, value, capabilitiesByKey, supported, unsupported);
  }

  for (const behavior of intent.requestedBehaviors ?? []) {
    const key = behavior.startsWith("behavior.") ? behavior : `behavior.${behavior}`;
    addCapabilityMatch(key, behavior, capabilitiesByKey, supported, unsupported);
  }

  if (supported.length === 0 && unsupported.length === 0) {
    const fallback = category.capabilities.find((capability) => capability.status === "codex");
    if (fallback) {
      unsupported.push({
        key: fallback.key,
        label: fallback.label,
        reason: fallback.issueHint ?? "No requested field maps to an instant capability yet."
      });
    }
  }

  const status: FeatureEvaluationStatus =
    unsupported.length === 0 ? "instant" : supported.length === 0 ? "codex" : "partial";

  return {
    status,
    category: intent.category,
    supported,
    unsupported,
    issuePayload: unsupported.length > 0 ? buildIssuePayload(intent, category, unsupported) : undefined
  };
}

function addCapabilityMatch(
  key: string,
  value: unknown,
  capabilitiesByKey: Map<string, CapabilityDefinition>,
  supported: CapabilityMatch[],
  unsupported: CapabilityMatch[]
) {
  const capability = capabilitiesByKey.get(key) ?? capabilitiesByKey.get(`${key}.custom`) ?? capabilitiesByKey.get("behavior.custom");

  if (!capability || capability.status === "codex") {
    unsupported.push({
      key,
      label: capability?.label ?? key,
      value,
      reason: capability?.issueHint ?? "This capability is not declared as instant."
    });
    return;
  }

  const rangeError = validateCapabilityValue(capability, value);
  if (rangeError) {
    unsupported.push({ key, label: capability.label, value, reason: rangeError });
    return;
  }

  supported.push({ key, label: capability.label, value });
}

function validateCapabilityValue(capability: CapabilityDefinition, value: unknown): string | undefined {
  if (capability.valueType === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "Expected a finite number.";
    if (capability.min !== undefined && value < capability.min) return `Value must be >= ${capability.min}.`;
    if (capability.max !== undefined && value > capability.max) return `Value must be <= ${capability.max}.`;
  }

  if (capability.valueType === "enum") {
    if (typeof value !== "string") return "Expected a string enum value.";
    if (capability.enumValues && !capability.enumValues.includes(value)) {
      return `Allowed values: ${capability.enumValues.join(", ")}.`;
    }
  }

  if (capability.valueType === "boolean" && typeof value !== "boolean") {
    return "Expected a boolean value.";
  }

  return undefined;
}

function buildCodexOnlyEvaluation(intent: FeatureIntent, title: string, reason: string): FeatureEvaluation {
  const unsupported = [{ key: intent.category, label: title, reason }];
  return {
    status: "codex",
    category: intent.category,
    supported: [],
    unsupported,
    issuePayload: {
      title,
      body: buildIssueBody(intent, unsupported)
    }
  };
}

function buildIssuePayload(
  intent: FeatureIntent,
  category: FeatureCategoryDefinition,
  unsupported: CapabilityMatch[]
) {
  const firstUnsupported = unsupported[0];
  const codexCapability = category.capabilities.find((capability) => capability.status === "codex");
  const title = intent.title || codexCapability?.issueTitle || `Add support for ${firstUnsupported.label}`;

  return {
    title,
    body: buildIssueBody(intent, unsupported)
  };
}

function buildIssueBody(intent: FeatureIntent, unsupported: CapabilityMatch[]): string {
  const requested = JSON.stringify(
    {
      category: intent.category,
      title: intent.title,
      description: intent.description,
      context: intent.context ?? {},
      requestedProperties: intent.requestedProperties ?? {},
      requestedBehaviors: intent.requestedBehaviors ?? []
    },
    null,
    2
  );

  const missing = unsupported
    .map((item) => `- ${item.key}: ${item.reason ?? "Not supported by config yet."}`)
    .join("\n");

  return [
    "## Player request",
    intent.description || "No free-text description provided.",
    "",
    "## Unsupported capabilities",
    missing || "No unsupported capability listed.",
    "",
    "## Structured intent",
    "```json",
    requested,
    "```"
  ].join("\n");
}
