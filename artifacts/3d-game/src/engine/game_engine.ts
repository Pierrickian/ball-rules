// ============================================================
// GAME ENGINE — Rule Handlers & Physics
//
// ARCHITECTURE NOTE:
// - The GameEngine interprets game_config.json at runtime.
// - All gameplay rules are read from the config. Do NOT hard-
//   code game values here — put them in game_config.json.
// - Each rule has exactly one handler registered via
//   registerRuleHandler(). To add a new rule:
//     1. Add it to game_config.json (ball_rules section)
//     2. Add a handler function below
//     3. Register it in registerAllHandlers()
// - BounceCondition enum drives ALL wall/ball collision logic.
// - 3D graphics are completely decoupled: this file has zero
//   imports from Three.js or React.
// - Physics is resolved in 2D (X/Y plane only).
// ============================================================

import { Ball } from "./Ball";
import type {
  BallColor,
  BallRule,
  GameConfig,
  GameEvent,
  GameState,
  ShotKind,
  ShotTypeConfig,
  Vec2,
} from "./types";
import { BallSize, BounceCondition } from "./types";

type RuleHandler = (ball: Ball, delta: number, context: RuleContext) => void;

interface RuleContext {
  allBalls: Ball[];
  config: GameConfig;
  events: GameEvent[];
  arena: Arena2D;
  spawnBall: (
    color: BallColor,
    size: BallSize,
    position: Vec2,
    velocity: Vec2,
    overrideRule?: BallRule,
    overrideHp?: { hp: number; maxHp: number }
  ) => Ball;
  despawnBall: (ball: Ball, reason: string) => void;
  damageBall: (ball: Ball, amount: number, reason?: string) => boolean;
}

interface Arena2D {
  halfW: number;
  halfH: number;
}

// ---- Math helpers ----
function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class GameEngine {
  private balls = new Map<string, Ball>();
  private ruleHandlers = new Map<BallRule, RuleHandler>();
  private config: GameConfig;
  private orangeSpawnTimer = 0;
  /** Orange launchers waiting their delay before firing.
   *  Each entry tracks the launcher ball's id and remaining seconds. */
  private pendingLaunches: Array<{ launcherId: string; remaining: number }> = [];
  private launchedCount = 0;
  private pendingEvents: GameEvent[] = [];
  private logEnabled: boolean;
  private elapsedTime = 0;
  private sessionCleared = false;
  private currentLevelIndex = 0;
  // When true, the game ignores the levels system: the orange launcher
  // uses launch_config.color directly (no level weights), and getCurrentLevel
  // returns null so HUD/snapshot don't display stale level info. Used by
  // the "Couleur lancée" menu to play a single-color, single-level loop
  // without entering story mode.
  private singleColorMode = false;

  constructor(config: GameConfig, initialLevelIndex = 0) {
    this.config = config;
    this.logEnabled = config.debug?.log_rule_changes ?? false;
    const levelCount = config.levels?.list?.length ?? 0;
    this.currentLevelIndex = levelCount > 0
      ? ((initialLevelIndex % levelCount) + levelCount) % levelCount
      : 0;
    this.registerAllHandlers();
  }

  // --------------------------------------------------------
  // Handler Registration
  // --------------------------------------------------------
  private registerAllHandlers(): void {
    this.registerRuleHandler("bounce",            this.handleBounce.bind(this));
    this.registerRuleHandler("accelerate",        this.handleAccelerate.bind(this));
    this.registerRuleHandler("launcher",          this.handleLauncher.bind(this));
    this.registerRuleHandler("destroy_on_contact",this.handleDestroyOnContact.bind(this));
    this.registerRuleHandler("slow_nearby",       this.handleSlowNearby.bind(this));
    this.registerRuleHandler("attract",           this.handleAttract.bind(this));
    this.registerRuleHandler("split",             this.handleSplit.bind(this));
    this.registerRuleHandler("freeze_nearby",     this.handleFreezeNearby.bind(this));
    this.registerRuleHandler("transfer_rule",     this.handleTransferRule.bind(this));
    this.registerRuleHandler("gravity_sink",      this.handleGravitySink.bind(this));
    this.registerRuleHandler("neutral",           this.handleNeutral.bind(this));
    this.registerRuleHandler("absorb",            this.handleAbsorb.bind(this));
    this.registerRuleHandler("hp_grow_bouncer",   this.handleHpGrowBouncer.bind(this));
    this.registerRuleHandler("blink_hp_bouncer",  this.handleBlinkHpBouncer.bind(this));
    this.registerRuleHandler("player_projectile", this.handlePlayerProjectile.bind(this));
  }

  registerRuleHandler(rule: BallRule, handler: RuleHandler): void {
    this.ruleHandlers.set(rule, handler);
  }

  // --------------------------------------------------------
  // Public API
  // --------------------------------------------------------

  getState(): GameState {
    const balls = new Map<string, import("./types").BallState>();
    this.balls.forEach((b, id) => balls.set(id, b.getState()));
    const lvl = this.getCurrentLevel();
    return {
      balls,
      events: [...this.pendingEvents],
      time: this.elapsedTime,
      orangeSpawnTimer: this.orangeSpawnTimer,
      score: 0,
      launchedCount: this.launchedCount,
      maxBallsSpawned: this.config.game_session?.max_balls_spawned ?? 20,
      sessionCleared: this.sessionCleared,
      currentLevelIndex: this.currentLevelIndex,
      currentLevelId: lvl?.id ?? 0,
      currentLevelName: lvl?.name ?? "",
    };
  }

  /** Active level entry, or null when no `levels.list` is configured
   *  or when the engine is in single-color (non-story) mode. */
  getCurrentLevel(): import("./types").LevelEntry | null {
    if (this.singleColorMode) return null;
    const list = this.config.levels?.list;
    if (!list || list.length === 0) return null;
    const i = ((this.currentLevelIndex % list.length) + list.length) % list.length;
    return list[i];
  }

  getCurrentLevelIndex(): number {
    return this.currentLevelIndex;
  }

  /** Toggle single-color mode (orange launcher uses launch_config.color
   *  directly, level weights and level metadata are ignored). */
  setSingleColorMode(on: boolean): void {
    this.singleColorMode = on;
  }

  isSingleColorMode(): boolean {
    return this.singleColorMode;
  }

  updateConfig(config: GameConfig): void {
    this.config = config;
    this.logEnabled = config.debug?.log_rule_changes ?? false;
  }

  getLaunchedCount(): number {
    return this.launchedCount;
  }

  /** Number of "enemy" balls currently alive (excludes orange launchers and player projectiles). */
  getEnemyBallCount(): number {
    let n = 0;
    this.balls.forEach((b) => {
      if (!b.isAlive) return;
      if (b.color === "orange") return;
      if (b.isProjectile()) return;
      n++;
    });
    return n;
  }

  /** Has the session reached its spawn cap AND is now cleared? */
  isSessionFinished(): boolean {
    const max = this.config.game_session?.max_balls_spawned ?? 20;
    return this.launchedCount >= max && this.getEnemyBallCount() === 0;
  }

  // --------------------------------------------------------
  // Player Shooting API
  // --------------------------------------------------------

  /**
   * Fire a player projectile from the bottom-center of the arena toward
   * the given target point (in game coordinates: x = horizontal, y = vertical).
   * holdSeconds determines the shot kind via gameplay_controls.shot_types.
   * color is the next ball from the player's queue.
   */
  playerShoot(targetX: number, targetY: number, holdSeconds: number, color: BallColor): Ball | null {
    const controls = this.config.gameplay_controls;
    if (!controls) return null;
    const shotKind = this.classifyShot(holdSeconds);
    const shotCfg = controls.shot_types[shotKind];
    if (!shotCfg) return null;

    const arena = this.getArena();
    const inset = (controls.shot_origin?.inset_factor ?? 0.04) * arena.halfH * 2;
    const origin: Vec2 = { x: 0, y: -arena.halfH + inset };

    const dx = targetX - origin.x;
    const dy = targetY - origin.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return null;
    const dir: Vec2 = { x: dx / len, y: dy / len };

    const baseSize = controls.queue_ball_size ?? BallSize.SMALL;
    const baseDiameter = this.config.graphics.ball_sizes[baseSize]?.diameter ?? 1.0;
    const projectileDiameter = baseDiameter * shotCfg.diameter_multiplier;
    const speed = shotCfg.speed;

    const projectile = new Ball(
      color,
      baseSize,
      origin,
      { x: dir.x * speed, y: dir.y * speed },
      projectileDiameter,
      "player_projectile",
      BounceCondition.AGAINST_OBSTACLE,
      999, 999
    );
    projectile.metadata = {
      isProjectile: true,
      shotKind,
      damage: shotCfg.damage,
      passesThroughBalls: shotCfg.passes_through_balls,
      remainingWallBounces: shotCfg.wall_bounces,
      lifetime: 0,
      damagedIds: new Set<string>(),
      colorTint: shotCfg.color_tint ?? null,
    };
    this.balls.set(projectile.id, projectile);
    this.pendingEvents.push({ type: "ball_spawned", ball: projectile.getState() });
    this.pendingEvents.push({ type: "player_shot", projectileId: projectile.id, shotKind });
    return projectile;
  }

  classifyShot(holdSeconds: number): ShotKind {
    const types = this.config.gameplay_controls?.shot_types;
    if (!types) return "light";
    // Return the highest tier whose min_hold_seconds is satisfied
    if (holdSeconds >= types.mega.min_hold_seconds) return "mega";
    if (holdSeconds >= types.heavy.min_hold_seconds) return "heavy";
    return "light";
  }

  getShotConfig(kind: ShotKind): ShotTypeConfig | null {
    return this.config.gameplay_controls?.shot_types?.[kind] ?? null;
  }

  // --------------------------------------------------------
  // Main Update Loop
  // --------------------------------------------------------
  update(delta: number): GameState {
    this.pendingEvents = [];
    this.elapsedTime += delta;
    const arena = this.getArena();

    // Spawn orange launchers (capped by max_balls_spawned)
    this.updateOrangeSpawn(delta, arena);
    // Fire orange launchers whose visibility delay has elapsed.
    this.updatePendingLaunches(delta, arena);

    // Update freeze timers
    this.balls.forEach((ball) => {
      if (ball.isFrozen) {
        ball.frozenTimer -= delta;
        if (ball.frozenTimer <= 0) { ball.isFrozen = false; ball.frozenTimer = 0; }
      }
    });

    const allBalls = Array.from(this.balls.values());
    const context: RuleContext = {
      allBalls,
      config: this.config,
      events: this.pendingEvents,
      arena,
      spawnBall: (c, s, p, v, overrideRule, overrideHp) =>
        this.spawnBall(c, s, p, v, overrideRule, overrideHp),
      despawnBall: (ball, reason) => {
        ball.isAlive = false;
        this.pendingEvents.push({ type: "ball_despawned", ballId: ball.id, reason });
      },
      damageBall: (ball, amount, reason = "damaged") => this.damageBall(ball, amount, reason),
    };

    // Step 1: Apply rule handlers
    for (const ball of allBalls) {
      if (!ball.isAlive || ball.isFrozen) continue;
      const handler = this.ruleHandlers.get(ball.rule);
      if (handler) handler(ball, delta, context);
      else this.applyMovement(ball, delta, arena);
    }

    // Step 2: Resolve ball-to-ball collisions (skip projectiles — they handle their own)
    this.resolveBallCollisions(allBalls, arena);

    // Step 3: Remove dead balls
    this.balls.forEach((ball, id) => {
      if (!ball.isAlive) this.balls.delete(id);
    });

    // Step 4: Session-clear flag
    this.sessionCleared = this.isSessionFinished();

    return this.getState();
  }

  /** Apply damage and despawn at 0 HP. Returns true if killed. */
  private damageBall(ball: Ball, amount: number, reason = "damaged"): boolean {
    if (!ball.isAlive) return false;
    const died = ball.takeDamage(amount);
    this.pendingEvents.push({
      type: "ball_damaged",
      ballId: ball.id,
      amount,
      remainingHp: ball.hp,
      position: { ...ball.position },
    });
    if (died) {
      ball.isAlive = false;
      this.pendingEvents.push({ type: "ball_despawned", ballId: ball.id, reason });
    } else if (ball.rule === "hp_grow_bouncer") {
      // Keep visual diameter in sync with current HP so damage is visible.
      ball.diameter = this.computeHpGrowDiameter(ball);
    }
    return died;
  }

  // --------------------------------------------------------
  // Ball Spawning
  // --------------------------------------------------------
  spawnBall(
    color: BallColor,
    size: BallSize,
    position: Vec2,
    velocity: Vec2,
    overrideRule?: BallRule,
    overrideHp?: { hp: number; maxHp: number }
  ): Ball {
    const diameter = this.config.graphics.ball_sizes[size]?.diameter ?? 0.5;
    const rule = overrideRule ?? this.config.ball_rules[color]?.rule ?? "neutral";
    const bounceCondition = this.getBounceCondition(color);

    // HP defaults: 1 / 1, but dark_green (hp_grow_bouncer) reads from rule_parameters
    let hp = 1;
    let maxHp = 1;
    if (overrideHp) {
      hp = overrideHp.hp;
      maxHp = overrideHp.maxHp;
    } else if (rule === "hp_grow_bouncer") {
      const p = this.config.rule_parameters.hp_grow_bouncer;
      hp = p?.default_hp ?? 2;
      maxHp = p?.max_hp ?? 5;
    } else if (rule === "blink_hp_bouncer") {
      const p = this.config.rule_parameters.yellow_blinker;
      hp = p?.default_hp ?? 4;
      maxHp = p?.max_hp ?? 4;
    }

    const ball = new Ball(color, size, position, velocity, diameter, rule, bounceCondition, hp, maxHp);

    // Initial diameter scaling for hp_grow_bouncer
    if (rule === "hp_grow_bouncer") {
      ball.diameter = this.computeHpGrowDiameter(ball);
    }

    this.balls.set(ball.id, ball);
    this.pendingEvents.push({ type: "ball_spawned", ball: ball.getState() });
    return ball;
  }

  private computeHpGrowDiameter(ball: Ball): number {
    const p = this.config.rule_parameters.hp_grow_bouncer;
    if (!p) return ball.baseDiameter;
    const factor = 1 + (ball.hp - p.default_hp) * p.diameter_per_extra_hp;
    return ball.baseDiameter * Math.max(0.4, factor);
  }

  private getBounceCondition(color: BallColor): BounceCondition {
    const raw = this.config.bounce_conditions?.ball_bounce_conditions?.[color];
    if (raw && Object.values(BounceCondition).includes(raw as BounceCondition)) {
      return raw as BounceCondition;
    }
    return BounceCondition.AGAINST_WALL;
  }

  private getArena(): Arena2D {
    return {
      halfW: this.config.graphics.arena.width / 2,
      halfH: this.config.graphics.arena.height / 2,
    };
  }

  // --------------------------------------------------------
  // Physics Helpers
  // --------------------------------------------------------

  private applyMovement(ball: Ball, delta: number, arena: Arena2D): boolean {
    ball.position.x += ball.velocity.x * delta;
    ball.position.y += ball.velocity.y * delta;
    return this.resolveWallBounce(ball, arena);
  }

  private resolveWallBounce(ball: Ball, arena: Arena2D): boolean {
    const canBounceWall =
      ball.bounceCondition === BounceCondition.AGAINST_WALL ||
      ball.bounceCondition === BounceCondition.AGAINST_ALL;
    if (!canBounceWall) return false;

    const r = ball.diameter / 2;
    let hit = false;
    if (ball.position.x - r < -arena.halfW) { ball.position.x = -arena.halfW + r; ball.velocity.x = Math.abs(ball.velocity.x); hit = true; }
    if (ball.position.x + r > arena.halfW)  { ball.position.x = arena.halfW - r;  ball.velocity.x = -Math.abs(ball.velocity.x); hit = true; }
    if (ball.position.y - r < -arena.halfH) { ball.position.y = -arena.halfH + r; ball.velocity.y = Math.abs(ball.velocity.y); hit = true; }
    if (ball.position.y + r > arena.halfH)  { ball.position.y = arena.halfH - r;  ball.velocity.y = -Math.abs(ball.velocity.y); hit = true; }
    return hit;
  }

  /** Check which wall (if any) the ball is currently outside; returns axis of impact for projectiles. */
  private detectWallHit(ball: Ball, arena: Arena2D): "x" | "y" | null {
    const r = ball.diameter / 2;
    if (ball.position.x - r < -arena.halfW || ball.position.x + r > arena.halfW) return "x";
    if (ball.position.y - r < -arena.halfH || ball.position.y + r > arena.halfH) return "y";
    return null;
  }

  private isOutOfBounds(ball: Ball, arena: Arena2D): boolean {
    const r = ball.diameter / 2;
    return (
      ball.position.x + r < -arena.halfW ||
      ball.position.x - r > arena.halfW ||
      ball.position.y + r < -arena.halfH ||
      ball.position.y - r > arena.halfH
    );
  }

  private isTemporarilyUntouchable(ball: Ball): boolean {
    return ball.color === "yellow" && Number(ball.metadata.visibilityAlpha ?? 1) <= 0;
  }

  /** Global ball-to-ball elastic collision pass — projectiles excluded. */
  private resolveBallCollisions(balls: Ball[], _arena: Arena2D): void {
    const restitution = this.config.rule_parameters.ball_collision?.restitution ?? 0.95;

    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        if (!a.isAlive || !b.isAlive) continue;
        if (this.isTemporarilyUntouchable(a) || this.isTemporarilyUntouchable(b)) continue;
        if (a.isProjectile() || b.isProjectile()) continue; // projectiles handle their own
        if (a.isFrozen && b.isFrozen) continue;

        // A bouncy_surface color (e.g. blue) acts as a bumper: any ball
        // that touches it ricochets off, regardless of its own bounce
        // condition. So we force both sides to bounce when at least one
        // of them is a bouncy surface.
        const aBouncy = !!this.config.ball_colors[a.color]?.bouncy_surface;
        const bBouncy = !!this.config.ball_colors[b.color]?.bouncy_surface;
        let aBouncesBalls =
          aBouncy ||
          a.bounceCondition === BounceCondition.AGAINST_BALL ||
          a.bounceCondition === BounceCondition.AGAINST_ALL;
        let bBouncesBalls =
          bBouncy ||
          b.bounceCondition === BounceCondition.AGAINST_BALL ||
          b.bounceCondition === BounceCondition.AGAINST_ALL;
        if (aBouncy || bBouncy) {
          aBouncesBalls = true;
          bBouncesBalls = true;
        }

        if (!aBouncesBalls && !bBouncesBalls) continue;

        const dist = a.distanceTo(b);
        const minDist = (a.diameter + b.diameter) / 2;
        if (dist >= minDist || dist < 0.001) continue;

        const nx = (b.position.x - a.position.x) / dist;
        const ny = (b.position.y - a.position.y) / dist;
        const overlap = minDist - dist;
        const correction = overlap / 2;

        if (aBouncesBalls && !a.isFrozen) { a.position.x -= nx * correction; a.position.y -= ny * correction; }
        if (bBouncesBalls && !b.isFrozen) { b.position.x += nx * correction; b.position.y += ny * correction; }

        const dvx = a.velocity.x - b.velocity.x;
        const dvy = a.velocity.y - b.velocity.y;
        const dot = dvx * nx + dvy * ny;
        if (dot <= 0) continue;

        const impulse = dot * restitution;
        if (aBouncesBalls && !a.isFrozen) { a.velocity.x -= impulse * nx; a.velocity.y -= impulse * ny; }
        if (bBouncesBalls && !b.isFrozen) { b.velocity.x += impulse * nx; b.velocity.y += impulse * ny; }

        this.pendingEvents.push({ type: "collision", ballAId: a.id, ballBId: b.id });
      }
    }
  }

  /** Pick a color from a weights map. Ignores zero/negative weights and
   *  unknown colors. Returns null if no valid entry remains. */
  private weightedPickColor(
    weights: Partial<Record<BallColor, number>>
  ): BallColor | null {
    const entries: Array<[BallColor, number]> = [];
    let total = 0;
    for (const [k, v] of Object.entries(weights)) {
      const color = k as BallColor;
      const weight = typeof v === "number" ? v : 0;
      if (weight > 0 && this.config.ball_colors[color]) {
        entries.push([color, weight]);
        total += weight;
      }
    }
    if (entries.length === 0 || total <= 0) return null;
    let r = Math.random() * total;
    for (const [color, weight] of entries) {
      r -= weight;
      if (r <= 0) return color;
    }
    return entries[entries.length - 1][0];
  }

  // --------------------------------------------------------
  // Orange Launcher Spawn Logic
  // --------------------------------------------------------
  private updateOrangeSpawn(delta: number, arena: Arena2D): void {
    const max = this.config.game_session?.max_balls_spawned ?? 20;
    if (this.launchedCount >= max) return; // hard cap

    const interval = this.config.gameplay.orange.spawn.interval_seconds;
    this.orangeSpawnTimer += delta;
    if (this.orangeSpawnTimer >= interval) {
      this.orangeSpawnTimer = 0;
      this.spawnOrangeLauncher(arena);
    }
  }

  private spawnOrangeLauncher(arena: Arena2D): void {
    const edge = Math.floor(Math.random() * 4);
    const pad = 0.05;
    let pos: Vec2;
    switch (edge) {
      case 0: pos = { x: randomInRange(-arena.halfW + pad, arena.halfW - pad), y: arena.halfH - pad }; break;
      case 1: pos = { x: randomInRange(-arena.halfW + pad, arena.halfW - pad), y: -arena.halfH + pad }; break;
      case 2: pos = { x: -arena.halfW + pad, y: randomInRange(-arena.halfH + pad, arena.halfH - pad) }; break;
      default: pos = { x: arena.halfW - pad, y: randomInRange(-arena.halfH + pad, arena.halfH - pad) }; break;
    }
    const launcher = this.spawnBall("orange", BallSize.MEDIUM, pos, { x: 0, y: 0 });
    const delay = this.config.gameplay.orange.launch_delay_seconds ?? 0;
    if (delay <= 0) {
      // Legacy behaviour : launch right away.
      this.performOrangeLaunch(launcher, arena);
    } else {
      // Keep the orange visible at its spawn position for `delay` seconds
      // (charging phase) then trigger the launch in the update loop.
      this.pendingLaunches.push({ launcherId: launcher.id, remaining: delay });
    }
  }

  /** Tick down delayed orange launches and fire those whose timer has reached 0. */
  private updatePendingLaunches(delta: number, arena: Arena2D): void {
    if (this.pendingLaunches.length === 0) return;
    const stillPending: Array<{ launcherId: string; remaining: number }> = [];
    for (const entry of this.pendingLaunches) {
      const launcher = this.balls.get(entry.launcherId);
      // Drop orphaned entries (e.g. launcher killed by a player projectile mid-charge).
      if (!launcher || !launcher.isAlive) continue;
      entry.remaining -= delta;
      if (entry.remaining <= 0) {
        this.performOrangeLaunch(launcher, arena);
      } else {
        stillPending.push(entry);
      }
    }
    this.pendingLaunches = stillPending;
  }

  private performOrangeLaunch(launcher: Ball, arena: Arena2D): void {
    const launchCfg = this.config.gameplay.orange.launch_config;

    // Color pick — priority order:
    //   1. Active level's launch_color_weights (if `levels.list` is non-empty)
    //   2. launch_config.color === "random" → uniform pick from allow_colors
    //   3. Otherwise → fixed color from launch_config.color
    let color: BallColor;
    const lvl = this.getCurrentLevel();
    const weights = lvl?.launch_color_weights;
    if (weights && Object.keys(weights).length > 0) {
      color = this.weightedPickColor(weights) ?? "white";
    } else if (launchCfg.color === "random") {
      const allowed = launchCfg.allow_colors ?? (Object.keys(this.config.ball_colors) as BallColor[]);
      color = allowed[Math.floor(Math.random() * allowed.length)];
    } else {
      color = launchCfg.color as BallColor;
    }

    const size = (launchCfg.size as BallSize) ?? BallSize.SMALL;
    const speed = launchCfg.speed ?? 4.5;
    const toCenter = normalize({ x: -launcher.position.x, y: -launcher.position.y });
    const randomAngle = (Math.random() - 0.5) * Math.PI * 0.8;
    const cos = Math.cos(randomAngle);
    const sin = Math.sin(randomAngle);
    const perpX = -toCenter.y;
    const perpY = toCenter.x;
    const dir: Vec2 = { x: toCenter.x * cos + perpX * sin, y: toCenter.y * cos + perpY * sin };

    void arena;
    const launched = this.spawnBall(color, size, { ...launcher.position }, { x: dir.x * speed, y: dir.y * speed });
    this.launchedCount++;
    this.pendingEvents.push({ type: "orange_launched", launcherId: launcher.id, launchedId: launched.id });

    launcher.isAlive = false;
    this.pendingEvents.push({ type: "ball_despawned", ballId: launcher.id, reason: "after_launch" });
  }

  // --------------------------------------------------------
  // Rule Handlers
  // --------------------------------------------------------

  /** WHITE — bounce */
  private handleBounce(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** YELLOW — accelerate */
  private handleAccelerate(ball: Ball, delta: number, ctx: RuleContext): void {
    const accel = ctx.config.rule_parameters.accelerate?.acceleration_per_second ?? 0.4;
    const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
    if (speed > 0.01) {
      ball.velocity.x += (ball.velocity.x / speed) * accel * delta;
      ball.velocity.y += (ball.velocity.y / speed) * accel * delta;
    }
    this.applyMovement(ball, delta, ctx.arena);
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** ORANGE — launcher (no-op rule).
   *  The orange's lifecycle is fully driven by `spawnOrangeLauncher` →
   *  `updatePendingLaunches` → `performOrangeLaunch`, which sets
   *  `isAlive = false` itself. The rule handler must NOT despawn the ball
   *  here, otherwise the visibility delay (`launch_delay_seconds`) would
   *  be cut short on the very next tick. The ball stands still at its
   *  spawn position while charging. */
  private handleLauncher(_ball: Ball, _delta: number, _ctx: RuleContext): void {
    // intentionally empty
  }

  /** RED — destroy_on_contact */
  private handleDestroyOnContact(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.color === "orange" || other.isProjectile()) continue;
      if (this.isTemporarilyUntouchable(other)) continue;
      if (ball.isCollidingWith(other)) {
        ctx.events.push({ type: "collision", ballAId: ball.id, ballBId: other.id });
        ctx.despawnBall(other, "destroyed_by_red");
        ctx.despawnBall(ball, "destroys_self_after_contact");
        return;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** LIGHT_GREEN — slow_nearby */
  private handleSlowNearby(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.slow_nearby ?? { radius: 2.0, slow_factor: 0.5 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.isProjectile()) continue;
      if (ball.distanceTo(other) < p.radius) {
        const drag = 1 - (1 - p.slow_factor) * delta;
        other.velocity.x *= drag;
        other.velocity.y *= drag;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** Old DARK_GREEN attract handler (kept for backward compatibility / runtime swaps). */
  private handleAttract(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.attract ?? { radius: 3.0, strength: 0.8 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.isProjectile()) continue;
      const d = ball.distanceTo(other);
      if (d < p.radius && d > 0.01) {
        const dir = normalize({ x: ball.position.x - other.position.x, y: ball.position.y - other.position.y });
        other.velocity.x += dir.x * p.strength * delta;
        other.velocity.y += dir.y * p.strength * delta;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** TURQUOISE — split */
  private handleSplit(ball: Ball, delta: number, ctx: RuleContext): void {
    ball.position.x += ball.velocity.x * delta;
    ball.position.y += ball.velocity.y * delta;
    const hitWall = this.resolveWallBounce(ball, ctx.arena);

    if (hitWall && ball.size !== BallSize.SMALL) {
      const smallerSize = ball.size === BallSize.LARGE ? BallSize.MEDIUM : BallSize.SMALL;
      const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
      const perp = normalize({ x: -ball.velocity.y, y: ball.velocity.x });
      const b1 = ctx.spawnBall("turquoise", smallerSize, { ...ball.position }, {
        x: ball.velocity.x * 0.8 + perp.x * speed * 0.5,
        y: ball.velocity.y * 0.8 + perp.y * speed * 0.5,
      });
      const b2 = ctx.spawnBall("turquoise", smallerSize, { ...ball.position }, {
        x: ball.velocity.x * 0.8 - perp.x * speed * 0.5,
        y: ball.velocity.y * 0.8 - perp.y * speed * 0.5,
      });
      ctx.events.push({ type: "ball_split", originalId: ball.id, newIds: [b1.id, b2.id] });
      ctx.despawnBall(ball, "split_completed");
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** CYAN — freeze_nearby */
  private handleFreezeNearby(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.freeze_nearby ?? { radius: 2.5, freeze_duration_seconds: 1.5 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.isProjectile()) continue;
      if (ball.distanceTo(other) < p.radius && !other.isFrozen) {
        other.freeze(p.freeze_duration_seconds);
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** BLUE — transfer_rule */
  private handleTransferRule(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    if (ball.ruleTransferred) {
      if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
      return;
    }
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.color === "orange" || other.isProjectile()) continue;
      if (this.isTemporarilyUntouchable(other)) continue;
      if (ball.isCollidingWith(other)) {
        const transferred = other.rule;
        ball.passRuleTo(other, this.logEnabled);
        ctx.events.push({ type: "rule_transferred", fromId: ball.id, toId: other.id, rule: transferred });
        ball.ruleTransferred = true;
        ctx.despawnBall(ball, "rule_transferred");
        return;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** DARK_BLUE — gravity_sink */
  private handleGravitySink(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.gravity_sink ?? { strength: 0.6 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.isProjectile()) continue;
      const toCenter = normalize({ x: -other.position.x, y: -other.position.y });
      other.velocity.x += toCenter.x * p.strength * delta;
      other.velocity.y += toCenter.y * p.strength * delta;
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** GRAY — neutral */
  private handleNeutral(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** BLACK — absorb */
  private handleAbsorb(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.absorb ?? { max_diameter_multiplier: 3.0 };
    const maxDiam = ball.baseDiameter * p.max_diameter_multiplier;
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.color === "black" || other.isProjectile()) continue;
      if (this.isTemporarilyUntouchable(other)) continue;
      if (ball.isCollidingWith(other)) {
        ctx.events.push({ type: "collision", ballAId: ball.id, ballBId: other.id });
        ctx.despawnBall(other, "absorbed_by_black");
        if (ball.diameter < maxDiam) {
          ball.diameter = Math.min(ball.diameter + other.diameter * 0.3, maxDiam);
        } else {
          ctx.despawnBall(ball, "max_size_reached");
          return;
        }
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /**
   * DARK_GREEN / BLUE — hp_grow_bouncer.
   * Bounces on walls. On entering overlap with another (non-projectile, non-orange) ball:
   *   - +HP (capped at max_hp): dark_green uses hp_gained_per_traversal,
   *     blue uses blue_hp_gained_per_contact.
   *   - diameter recomputed from current HP
   * Tracks "touched" set in metadata to avoid double-counting per overlap event.
   */
  private handleHpGrowBouncer(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.hp_grow_bouncer;
    if (!p) return;

    if (!(ball.metadata.touched instanceof Set)) ball.metadata.touched = new Set<string>();
    const touched = ball.metadata.touched as Set<string>;

    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      if (other.color === "orange" || other.isProjectile()) continue;
      if (this.isTemporarilyUntouchable(other)) continue;
      const overlapping = ball.isCollidingWith(other);
      if (overlapping && !touched.has(other.id)) {
        touched.add(other.id);
        if (ball.hp < ball.maxHp) {
          const healAmount = ball.color === "blue"
            ? (p.blue_hp_gained_per_contact ?? 2)
            : (p.hp_gained_per_traversal ?? 1);
          const healed = ball.heal(healAmount);
          if (healed > 0) {
            ball.diameter = this.computeHpGrowDiameter(ball);
            ctx.events.push({
              type: "ball_healed",
              ballId: ball.id,
              amount: healed,
              remainingHp: ball.hp,
              position: { ...ball.position },
            });
          }
        }
      } else if (!overlapping && touched.has(other.id)) {
        touched.delete(other.id);
      }
    }

    // Clean up touched IDs that no longer exist
    for (const id of Array.from(touched)) {
      const exists = ctx.allBalls.find((b) => b.id === id && b.isAlive);
      if (!exists) touched.delete(id);
    }

    // Out of bounds shouldn't really happen (against_wall), but safety
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }


  /**
   * YELLOW — blink_hp_bouncer.
   * - Fixed HP pool (configured), despawns at 0 HP
   * - Periodically toggles visibility: invisible for X seconds every cycle.
   */
  private handleBlinkHpBouncer(ball: Ball, delta: number, ctx: RuleContext): void {
    const p = ctx.config.rule_parameters.yellow_blinker ?? { default_hp: 4, max_hp: 4, invisible_duration_seconds: 0.5, cycle_seconds: 1.0 };
    const age = Number(ball.metadata.ageSeconds ?? 0) + delta;
    ball.metadata.ageSeconds = age;

    const cycle = Math.max(0.01, p.cycle_seconds ?? 1.0);
    const invis = Math.max(0, Math.min(cycle, p.invisible_duration_seconds ?? 0.5));
    const phase = age % cycle;
    const isInvisible = phase < invis;
    ball.metadata.visibilityAlpha = isInvisible ? 0.0 : 1.0;
    this.applyMovement(ball, delta, ctx.arena);

    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /**
   * PLAYER PROJECTILE — straight-line shot fired by player click.
   * Behavior driven by metadata (set in playerShoot):
   *   shotKind, damage, passesThroughBalls, remainingWallBounces, lifetime, damagedIds
   * - light: stops on first ball OR first wall
   * - heavy: passes balls, stops on wall
   * - mega:  passes balls, bounces N times on walls then despawns
   */
  private handlePlayerProjectile(ball: Ball, delta: number, ctx: RuleContext): void {
    const meta = ball.metadata as {
      damage: number;
      passesThroughBalls: boolean;
      remainingWallBounces: number;
      lifetime: number;
      damagedIds: Set<string>;
    };

    // Lifetime safety
    meta.lifetime += delta;
    const maxLife = ctx.config.rule_parameters.player_projectile?.max_lifetime_seconds ?? 4.0;
    if (meta.lifetime > maxLife) {
      ctx.despawnBall(ball, "projectile_expired");
      return;
    }

    // Move
    ball.position.x += ball.velocity.x * delta;
    ball.position.y += ball.velocity.y * delta;

    // --- Wall handling ---
    const wallAxis = this.detectWallHit(ball, ctx.arena);
    if (wallAxis) {
      if (meta.remainingWallBounces > 0) {
        // Bounce: clamp position back inside, flip velocity
        const r = ball.diameter / 2;
        if (wallAxis === "x") {
          if (ball.position.x - r < -ctx.arena.halfW) ball.position.x = -ctx.arena.halfW + r;
          if (ball.position.x + r >  ctx.arena.halfW) ball.position.x =  ctx.arena.halfW - r;
          ball.velocity.x = -ball.velocity.x;
        } else {
          if (ball.position.y - r < -ctx.arena.halfH) ball.position.y = -ctx.arena.halfH + r;
          if (ball.position.y + r >  ctx.arena.halfH) ball.position.y =  ctx.arena.halfH - r;
          ball.velocity.y = -ball.velocity.y;
        }
        meta.remainingWallBounces--;
      } else {
        // No bounces left → stop / despawn
        ctx.despawnBall(ball, "projectile_hit_wall");
        return;
      }
    }

    // --- Ball collisions ---
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      if (other.color === "orange" || other.isProjectile()) continue;
      if (this.isTemporarilyUntouchable(other)) continue;
      if (meta.damagedIds.has(other.id)) continue;

      if (ball.isCollidingWith(other)) {
        meta.damagedIds.add(other.id);
        ctx.events.push({ type: "collision", ballAId: ball.id, ballBId: other.id });
        ctx.damageBall(other, meta.damage, "killed_by_player");

        // Bouncy_surface targets (e.g. blue) act as bumpers for ALL three
        // shot kinds: the projectile ricochets off them and keeps flying
        // (the damage is still applied above). If the hit kills the target,
        // we fall through to the normal pass-through / despawn behaviour
        // since the bumper no longer exists.
        const isBouncy = !!ctx.config.ball_colors[other.color]?.bouncy_surface;
        if (isBouncy && other.isAlive) {
          this.reflectProjectileOff(ball, other);
          continue;
        }

        if (!meta.passesThroughBalls) {
          // Light shot: stop after first ball contact (non-bouncy target).
          ctx.despawnBall(ball, "projectile_hit_ball");
          return;
        }
      }
    }

    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "projectile_out_of_bounds");
  }

  /** Reflect a projectile's velocity off a target ball treated as a bumper.
   *  Also pushes the projectile out of overlap so it doesn't immediately
   *  re-collide on the next frame. */
  private reflectProjectileOff(projectile: Ball, target: Ball): void {
    const dx = projectile.position.x - target.position.x;
    const dy = projectile.position.y - target.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const vDotN = projectile.velocity.x * nx + projectile.velocity.y * ny;
    if (vDotN < 0) {
      projectile.velocity.x -= 2 * vDotN * nx;
      projectile.velocity.y -= 2 * vDotN * ny;
    }
    const minDist = (projectile.diameter + target.diameter) / 2;
    const push = minDist - dist + 0.01;
    if (push > 0) {
      projectile.position.x += nx * push;
      projectile.position.y += ny * push;
    }
  }
}
