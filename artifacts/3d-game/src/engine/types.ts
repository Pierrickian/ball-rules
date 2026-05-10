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
  | "pink"
  | "purple"
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
  | "blink_hp_bouncer"
  | "red_split_bouncer"
  | "player_projectile"
  | "magnet_field";

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
  isBoss?: boolean;
}

export type GameEvent =
  | { type: "ball_spawned"; ball: BallState }
  | { type: "ball_despawned"; ballId: string; reason: string; position?: Vec2; velocity?: Vec2; effect?: string }
  | { type: "rule_transferred"; fromId: string; toId: string; rule: BallRule }
  | { type: "ball_split"; originalId: string; newIds: string[] }
  | { type: "collision"; ballAId: string; ballBId: string }
  | { type: "orange_launched"; launcherId: string; launchedId: string }
  | { type: "ball_damaged"; ballId: string; amount: number; remainingHp: number; position: Vec2 }
  | { type: "ball_healed"; ballId: string; amount: number; remainingHp: number; position: Vec2 }
  | { type: "grenade_awarded"; amount: number; reason: string }
  | { type: "grenade_helper_flash"; reason: string }
  | { type: "player_shot"; projectileId: string; shotKind: ShotKind }
  | { type: "combo_popup"; projectileId: string; label: string; streak: number; tier: number; position: Vec2 }
  | { type: "session_clear"; launchedCount: number }
  | { type: "session_reboot" }
  | { type: "level_changed"; levelIndex: number; levelId: number; levelName: string };

export interface GameState {
  balls: Map<string, BallState>;
  events: GameEvent[];
  time: number;
  orangeSpawnTimer: number;
  score: number;
  launchedCount: number;
  maxBallsSpawned: number;
  sessionCleared: boolean;
  currentLevelIndex: number;
  currentLevelId: number;
  currentLevelName: string;
  bossIntroActive?: boolean;
  bossHintActive?: boolean;
  bossHintMessage?: string;
  bossMasteredActive?: boolean;
  isBossPhase?: boolean;
  timerSecondsRemaining?: number;
  ammoRemaining?: number;
  retryReason?: "timeout" | "ammo" | "manual" | null;
  hospital?: {
    isActive: boolean;
    x: number;
    y: number;
    diameter: number;
    hp: number;
    maxHp: number;
  };
}

// ---- Levels ----

export interface BossSpawnPosition {
  x: number;
  y: number;
}

export interface LevelBossConfig {
  color: BallColor;
  size?: BallSize;
  hp: number;
  maxHp?: number;
  diameter_multiplier?: number;
  launcher_size?: BallSize;
  launcher_diameter_multiplier?: number;
  intro_overlay_seconds?: number;
  horizontal_speed?: number;
  spawn_count?: number;
  spawn_spacing_x?: number;
  spawn_position?: BossSpawnPosition;
  dark_green_heal_bonus_percent?: number;
  defeat_hint_message?: string;
  defeat_hint_seconds?: number;
  defeat_rule?: "grenade_last_hit";
  non_matching_kill_recharge_hp?: number;
  reward_grenades_on_spawn?: number;
}


export interface LevelEntry {
  id: number;
  name: string;
  description: string;
  /** Relative weights per ball color for the orange launcher's pick.
   *  Total is normalised to 1; values can be on any scale. */
  launch_color_weights: Partial<Record<BallColor, number>>;
  /** Optional per-color overrides applied to balls launched by orange on this level. */
  launch_overrides?: Partial<Record<BallColor, {
    size?: BallSize;
    hp?: number;
    maxHp?: number;
    diameter_multiplier?: number;
  }>>;
  /** Optional boss spawned once all regular enemies are cleared for the level. */
  boss?: LevelBossConfig;
  hospital?: {
    x: number;
    y: number;
    hp: number;
    maxHp?: number;
    heal_per_contact?: number;
    diameter_from_boss_hp?: number;
  };
  dark_green_heal_bonus_percent?: number;
  timer_seconds?: number;
  ammo_count?: number;
  /** Optional runtime/story override for how many enemies the orange launcher can spawn on this level. */
  max_balls_spawned?: number;
  /** Optional runtime/story override for the orange launcher spawn interval on this level. Lower values mean a faster cadence. */
  spawn_interval_seconds?: number;
}

export interface LevelsConfig {
  _description?: string;
  boss_intro_overlay_seconds?: number;
  boss_mastered_overlay_seconds?: number;
  list: LevelEntry[];
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
  player_projectile_distribution?: Record<ShotKind, number>;
  difficulty_hp?: {
    _description?: string;
    min: number;
    max: number;
    presets: Record<"easy" | "medium" | "hard", number>;
    default: "easy" | "medium" | "hard";
  };
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
  /** When true (default), auto-reboot advances to the next level in
   *  `levels.list` (with wrap-around). When false, the same level replays. */
  advance_level_on_clear?: boolean;
}

// ---- Bounce Conditions Config ----
export interface BounceConditionsConfig {
  _enum_values: Record<string, string>;
  ball_bounce_conditions: Record<string, BounceCondition>;
}

// ---- Top-Level Config ----
export interface EvolutionRequestConfig {
  _description?: string;
  /** GitHub owner/repo receiving in-game evolution requests. */
  repo: string;
  /** Default request kind. PR can only be confirmed when an endpoint creates one. */
  mode: "issue" | "pr";
  /** Optional server endpoint that creates the issue/PR and returns its number. */
  endpoint?: string;
  default_title: string;
}

export interface GameConfig {
  graphics: {
    ball_sizes: Record<BallSize, { diameter: number; _label?: string }>;
    ball_material: { roughness: number; metalness: number; emissive_intensity: number };
    camera: { fit_padding: number; height: number };
    arena: { width: number; height: number };
  };
  arena_settings: ArenaSettings;
  level_rules: LevelRules;
  ball_colors: Record<
    BallColor,
    {
      hex: string;
      rgb: [number, number, number];
      _label?: string;
      /** True if the player can pick this color into their shot queue. */
      selectable_by_player?: boolean;
      /** True if this color belongs to the terrain (carousel + arena). */
      for_terrain?: boolean;
      /** Optional system role (e.g. "launcher"). When set, the color is a
       *  terrain mechanic and is rendered with a "Rôle système" badge in
       *  the carousel instead of the "En attente de règle" badge. */
      system_role?: string;
      /** Human-readable explanation of the system role, shown next to the
       *  badge in the carousel. */
      _system_role_description?: string;
      /** When true, this color acts as a bouncy bumper: anything that
       *  collides with it (player projectiles included) ricochets off
       *  instead of passing through. Damage and HP rules still apply. */
      bouncy_surface?: boolean;
      /** Human-readable explanation of the bouncy_surface flag (for the carousel). */
      _bouncy_surface_description?: string;
    }
  >;
  ball_rules: Record<BallColor, { rule: BallRule; _description?: string }>;
  bounce_conditions: BounceConditionsConfig;
  rule_parameters: {
    bounce?: { restitution: number };
    ball_collision?: { restitution: number };
    accelerate?: { acceleration_per_second: number };
    slow_nearby?: { radius: number; slow_factor: number };
    attract?: { radius: number; strength: number };
    magnet_field?: {
      field_diameter_multiplier: number;
      attraction_strength: number;
      boost_speed_multiplier: number;
      boost_duration_seconds: number;
      contact_velocity_damping?: number;
    };
    freeze_nearby?: { radius: number; freeze_duration_seconds: number };
    gravity_sink?: { strength: number };
    absorb?: { max_diameter_multiplier: number };
    hp_grow_bouncer?: {
      default_hp: number;
      max_hp: number;
      hp_gained_per_traversal: number;
      blue_hp_gained_per_contact?: number;
      diameter_per_extra_hp: number;
    };
    yellow_blinker?: {
      default_hp: number;
      max_hp: number;
      invisible_duration_seconds: number;
      cycle_seconds: number;
    };
    red_split_bouncer?: {
      default_hp: number;
      max_hp: number;
    };
    player_projectile?: {
      max_lifetime_seconds: number;
      hit_immunity_ms?: number;
    };
  };
  gameplay: {
    orange: {
      spawn: { condition: string; interval_seconds: number; spawn_on_edge: boolean };
      despawn: { condition: string };
      /** Seconds the orange launcher remains visible at its spawn point
       *  before firing its projectile. 0 (or omitted) = launch immediately. */
      launch_delay_seconds?: number;
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
  /** Optional level progression. When `levels.list` is non-empty,
   *  level weights override `gameplay.orange.launch_config.color`
   *  for the orange launcher's color pick. */
  levels?: LevelsConfig;
  game_rules_concept: {
    title: string;
    concept: string;
    sections: Array<{ heading: string; text: string }>;
  };
  /**
   * Short titles of the latest game evolutions, newest-first.
   * Capped at 20 entries — older ones are dropped when a new one is added.
   * The agent must update this list before each commit (see replit.md).
   */
  release_notes: string[];
  /** In-game Evolution request target and optional creation endpoint. */
  evolution_request?: EvolutionRequestConfig;
  debug: {
    show_velocities: boolean;
    show_ball_ids: boolean;
    log_rule_changes: boolean;
  };
}
