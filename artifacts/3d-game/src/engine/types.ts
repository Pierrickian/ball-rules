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
  | "absorb"
  | "hp_grow_bouncer"
  | "player_projectile";

// ---- Bounce Condition Enum ----
export enum BounceCondition {
  AGAINST_WALL     = "against_wall",
  AGAINST_BALL     = "against_ball",
  AGAINST_OBSTACLE = "against_obstacle",
  AGAINST_ALL      = "against_all",
}

// ---- Player Shot Types ----
export type ShotKind = "light" | "heavy" | "mega";

export interface ShotTypeConfig {
  _label: string;
  min_hold_seconds: number;
  max_hold_seconds: number;
  damage: number;
  passes_through_balls: boolean;
  wall_bounces: number;
  diameter_multiplier: number;
  speed: number;
  color_tint?: string;
  _description?: string;
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
  hp: number;
  maxHp: number;
  metadata: Record<string, unknown>;
}

export type GameEvent =
  | { type: "ball_spawned"; ball: BallState }
  | { type: "ball_despawned"; ballId: string; reason: string }
  | { type: "rule_transferred"; fromId: string; toId: string; rule: BallRule }
  | { type: "ball_split"; originalId: string; newIds: string[] }
  | { type: "collision"; ballAId: string; ballBId: string }
  | { type: "orange_launched"; launcherId: string; launchedId: string }
  | { type: "ball_damaged"; ballId: string; amount: number; remainingHp: number; position: Vec2 }
  | { type: "ball_healed"; ballId: string; amount: number; remainingHp: number; position: Vec2 }
  | { type: "player_shot"; projectileId: string; shotKind: ShotKind }
  | { type: "session_clear"; launchedCount: number }
  | { type: "session_reboot" };

export interface GameState {
  balls: Map<string, BallState>;
  events: GameEvent[];
  time: number;
  orangeSpawnTimer: number;
  score: number;
  launchedCount: number;
  maxBallsSpawned: number;
  sessionCleared: boolean;
}

// ---- Level Rules ----

export interface AspectRatio {
  id: string;
  w: number;
  h: number;
  _label: string;
  _market?: string;
}

export interface AspectRatioRule {
  _description?: string;
  _rule_type: string;
  default_index: number;
  ratios: AspectRatio[];
}

export interface ArenaResolutionRule {
  _description?: string;
  _rule_type: string;
  default_index: number;
  widths: number[];
}

export interface LevelRules {
  aspect_ratio: AspectRatioRule;
  arena_resolution: ArenaResolutionRule;
}

// ---- Arena Settings ----
export interface ArenaSettings {
  _description?: string;
  base_width: number;
  base_height: number;
  min_width: number;
  max_width: number;
}

// ---- Gameplay Controls ----
export interface GameplayControlsConfig {
  _description?: string;
  queue_size: number;
  queue_ball_colors: BallColor[];
  queue_ball_size: BallSize;
  shot_origin: {
    mode: string;
    inset_factor: number;
  };
  shot_types: Record<ShotKind, ShotTypeConfig>;
}

// ---- Game Session ----
export interface GameSessionConfig {
  _description?: string;
  max_balls_spawned: number;
  auto_reboot_on_clear: boolean;
  reboot_delay_seconds: number;
}

// ---- Bounce Conditions Config ----
export interface BounceConditionsConfig {
  _enum_values: Record<string, string>;
  ball_bounce_conditions: Record<string, BounceCondition>;
}

// ---- Top-Level Config ----
export interface GameConfig {
  graphics: {
    ball_sizes: Record<BallSize, { diameter: number; _label?: string }>;
    ball_material: { roughness: number; metalness: number; emissive_intensity: number };
    camera: { fit_padding: number; height: number };
    arena: { width: number; height: number };
  };
  arena_settings: ArenaSettings;
  level_rules: LevelRules;
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
    hp_grow_bouncer?: {
      default_hp: number;
      max_hp: number;
      hp_gained_per_traversal: number;
      diameter_per_extra_hp: number;
    };
    player_projectile?: {
      max_lifetime_seconds: number;
    };
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
  gameplay_controls: GameplayControlsConfig;
  game_session: GameSessionConfig;
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
