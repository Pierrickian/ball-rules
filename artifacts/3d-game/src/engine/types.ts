// ============================================================
// TYPES — Ball Game Engine
// All types are derived from game_config.json.
// Do NOT add new rules, colors, or bounce conditions here
// without adding them to game_config.json first.
// The config is the single source of truth.
// ============================================================

export type BallColor =
  | "white"
  | "yellow"
  | "orange"
  | "red"
  | "light_green"
  | "dark_green"
  | "turquoise"
  | "cyan"
  | "blue"
  | "dark_blue"
  | "gray"
  | "black";

export enum BallSize {
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

export type BallRule =
  | "bounce"
  | "accelerate"
  | "launcher"
  | "destroy_on_contact"
  | "slow_nearby"
  | "attract"
  | "split"
  | "freeze_nearby"
  | "transfer_rule"
  | "gravity_sink"
  | "neutral"
  | "absorb";

// ---- Bounce Condition Enum ----
// Defined globally in game_config.json > bounce_conditions._enum_values
// Assigned per-color in bounce_conditions.ball_bounce_conditions
// Handler: game_engine.ts > resolveWallBounce / resolveBallCollision
export enum BounceCondition {
  AGAINST_WALL     = "against_wall",     // Bounces only off arena walls
  AGAINST_BALL     = "against_ball",     // Bounces only off other balls (exits through walls)
  AGAINST_OBSTACLE = "against_obstacle", // Bounces only off obstacles (future feature)
  AGAINST_ALL      = "against_all",      // Bounces off walls, balls, and obstacles
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface BallState {
  id: string;
  color: BallColor;
  size: BallSize;
  position: Vec2;
  velocity: Vec2;
  rule: BallRule;
  bounceCondition: BounceCondition;
  isAlive: boolean;
  isFrozen: boolean;
  frozenTimer: number;
  ruleTransferred: boolean;
  diameter: number;
  metadata: Record<string, unknown>;
}

export type GameEvent =
  | { type: "ball_spawned"; ball: BallState }
  | { type: "ball_despawned"; ballId: string; reason: string }
  | { type: "rule_transferred"; fromId: string; toId: string; rule: BallRule }
  | { type: "ball_split"; originalId: string; newIds: string[] }
  | { type: "collision"; ballAId: string; ballBId: string }
  | { type: "orange_launched"; launcherId: string; launchedId: string };

export interface GameState {
  balls: Map<string, BallState>;
  events: GameEvent[];
  time: number;
  orangeSpawnTimer: number;
  score: number;
}

// ---- Config shapes (mirror of game_config.json) ----

export interface BounceConditionsConfig {
  _enum_values: Record<string, string>;
  ball_bounce_conditions: Record<string, BounceCondition>;
}

export interface GameConfig {
  graphics: {
    ball_sizes: Record<BallSize, { diameter: number; _label?: string }>;
    ball_material: { roughness: number; metalness: number; emissive_intensity: number };
    camera: { height: number; field_of_view_deg: number };
    arena: { width: number; height: number };
  };
  ball_colors: Record<BallColor, { hex: string; rgb: [number, number, number]; _label?: string }>;
  ball_rules: Record<BallColor, { rule: BallRule; _description?: string }>;
  bounce_conditions: BounceConditionsConfig;
  rule_parameters: {
    bounce?: { restitution: number };
    ball_collision?: { restitution: number };
    accelerate?: { acceleration_per_second: number };
    slow_nearby?: { radius: number; slow_factor: number };
    attract?: { radius: number; strength: number };
    freeze_nearby?: { radius: number; freeze_duration_seconds: number };
    gravity_sink?: { strength: number };
    absorb?: { max_diameter_multiplier: number };
  };
  gameplay: {
    orange: {
      spawn: { condition: string; interval_seconds: number; spawn_on_edge: boolean };
      despawn: { condition: string };
      launch_config: {
        color: BallColor | "random";
        size: BallSize;
        speed: number;
        direction: string;
        allow_colors: BallColor[];
      };
    };
    [color: string]: {
      spawn: { condition: string; interval_seconds?: number; spawn_on_edge?: boolean };
      despawn: { condition: string };
      launch_config?: unknown;
    };
  };
  game_rules_concept: {
    title: string;
    concept: string;
    sections: Array<{ heading: string; text: string }>;
  };
  debug: {
    show_velocities: boolean;
    show_ball_ids: boolean;
    log_rule_changes: boolean;
  };
}
