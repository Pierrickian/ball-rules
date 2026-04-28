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
// - BounceCondition enum drives ALL wall/ball collision logic:
//     against_wall     → bounce walls only, exit through balls
//     against_ball     → bounce balls only, exit through walls
//     against_obstacle → bounce obstacles only (future)
//     against_all      → bounce everything
//   This is read from bounce_conditions.ball_bounce_conditions in config.
// - 3D graphics are completely decoupled: this file has zero
//   imports from Three.js or React.
// - Physics is resolved in 2D (X/Y plane only).
// ============================================================

import { Ball } from "./Ball";
import type { BallColor, BallRule, GameConfig, GameEvent, GameState, Vec2 } from "./types";
import { BallSize, BounceCondition } from "./types";

type RuleHandler = (ball: Ball, delta: number, context: RuleContext) => void;

interface RuleContext {
  allBalls: Ball[];
  config: GameConfig;
  events: GameEvent[];
  arena: Arena2D;
  spawnBall: (color: BallColor, size: BallSize, position: Vec2, velocity: Vec2) => Ball;
  despawnBall: (ball: Ball, reason: string) => void;
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
  private pendingEvents: GameEvent[] = [];
  private logEnabled: boolean;

  constructor(config: GameConfig) {
    this.config = config;
    this.logEnabled = config.debug?.log_rule_changes ?? false;
    this.registerAllHandlers();
  }

  // --------------------------------------------------------
  // Handler Registration
  // To add a new rule: implement handler, call registerRuleHandler().
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
    return {
      balls,
      events: [...this.pendingEvents],
      time: 0,
      orangeSpawnTimer: this.orangeSpawnTimer,
      score: 0,
    };
  }

  updateConfig(config: GameConfig): void {
    this.config = config;
    this.logEnabled = config.debug?.log_rule_changes ?? false;
  }

  // --------------------------------------------------------
  // Main Update Loop — call every frame with delta in seconds
  // --------------------------------------------------------
  update(delta: number): GameState {
    this.pendingEvents = [];
    const arena = this.getArena();

    // Spawn orange launchers
    this.updateOrangeSpawn(delta, arena);

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
      spawnBall: this.spawnBall.bind(this),
      despawnBall: (ball, reason) => {
        ball.isAlive = false;
        this.pendingEvents.push({ type: "ball_despawned", ballId: ball.id, reason });
      },
    };

    // Step 1: Apply rule handlers (movement + rule-specific behavior)
    for (const ball of allBalls) {
      if (!ball.isAlive || ball.isFrozen) continue;
      const handler = this.ruleHandlers.get(ball.rule);
      if (handler) handler(ball, delta, context);
      else this.applyMovement(ball, delta, arena);
    }

    // Step 2: Resolve ball-to-ball collisions based on BounceCondition
    this.resolveBallCollisions(allBalls, arena);

    // Step 3: Remove dead balls
    this.balls.forEach((ball, id) => {
      if (!ball.isAlive) this.balls.delete(id);
    });

    return this.getState();
  }

  // --------------------------------------------------------
  // Ball Spawning
  // --------------------------------------------------------
  spawnBall(color: BallColor, size: BallSize, position: Vec2, velocity: Vec2): Ball {
    const diameter = this.config.graphics.ball_sizes[size]?.diameter ?? 0.5;
    const rule = this.config.ball_rules[color]?.rule ?? "neutral";
    const bounceCondition = this.getBounceCondition(color);
    const ball = new Ball(color, size, position, velocity, diameter, rule, bounceCondition);
    this.balls.set(ball.id, ball);
    this.pendingEvents.push({ type: "ball_spawned", ball: ball.getState() });
    return ball;
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
  // Physics Helpers — BounceCondition-aware
  // --------------------------------------------------------

  /**
   * Move ball and resolve wall bounce based on its BounceCondition.
   * Returns whether a wall was hit.
   */
  private applyMovement(ball: Ball, delta: number, arena: Arena2D): boolean {
    ball.position.x += ball.velocity.x * delta;
    ball.position.y += ball.velocity.y * delta;
    return this.resolveWallBounce(ball, arena);
  }

  /**
   * Resolve wall collisions according to BounceCondition.
   * - against_wall / against_all  → reflect velocity, clamp position
   * - against_ball / against_obstacle → do nothing (ball exits through walls)
   * Returns true if a wall was hit and the ball bounced.
   */
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

  private isOutOfBounds(ball: Ball, arena: Arena2D): boolean {
    const r = ball.diameter / 2;
    return (
      ball.position.x + r < -arena.halfW ||
      ball.position.x - r > arena.halfW ||
      ball.position.y + r < -arena.halfH ||
      ball.position.y - r > arena.halfH
    );
  }

  /**
   * Global ball-to-ball elastic collision pass.
   * Only applied when BOTH balls have bounceCondition that includes balls
   * (against_ball or against_all).
   */
  private resolveBallCollisions(balls: Ball[], _arena: Arena2D): void {
    const restitution = this.config.rule_parameters.ball_collision?.restitution ?? 0.95;

    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        if (!a.isAlive || !b.isAlive) continue;
        if (a.isFrozen && b.isFrozen) continue;

        const aBouncesBalls =
          a.bounceCondition === BounceCondition.AGAINST_BALL ||
          a.bounceCondition === BounceCondition.AGAINST_ALL;
        const bBouncesBalls =
          b.bounceCondition === BounceCondition.AGAINST_BALL ||
          b.bounceCondition === BounceCondition.AGAINST_ALL;

        if (!aBouncesBalls && !bBouncesBalls) continue;

        const dist = a.distanceTo(b);
        const minDist = (a.diameter + b.diameter) / 2;
        if (dist >= minDist || dist < 0.001) continue;

        // Separate overlapping balls
        const nx = (b.position.x - a.position.x) / dist;
        const ny = (b.position.y - a.position.y) / dist;
        const overlap = minDist - dist;
        const correction = overlap / 2;

        if (aBouncesBalls && !a.isFrozen) { a.position.x -= nx * correction; a.position.y -= ny * correction; }
        if (bBouncesBalls && !b.isFrozen) { b.position.x += nx * correction; b.position.y += ny * correction; }

        // Elastic collision impulse (1D along normal)
        const dvx = a.velocity.x - b.velocity.x;
        const dvy = a.velocity.y - b.velocity.y;
        const dot = dvx * nx + dvy * ny;
        if (dot <= 0) continue; // Moving apart

        const impulse = dot * restitution;
        if (aBouncesBalls && !a.isFrozen) { a.velocity.x -= impulse * nx; a.velocity.y -= impulse * ny; }
        if (bBouncesBalls && !b.isFrozen) { b.velocity.x += impulse * nx; b.velocity.y += impulse * ny; }

        this.pendingEvents.push({ type: "collision", ballAId: a.id, ballBId: b.id });
      }
    }
  }

  // --------------------------------------------------------
  // Orange Launcher Spawn Logic
  // --------------------------------------------------------
  private updateOrangeSpawn(delta: number, arena: Arena2D): void {
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
    this.performOrangeLaunch(launcher, arena);
  }

  private performOrangeLaunch(launcher: Ball, arena: Arena2D): void {
    const launchCfg = this.config.gameplay.orange.launch_config;

    let color: BallColor;
    if (launchCfg.color === "random") {
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
    this.pendingEvents.push({ type: "orange_launched", launcherId: launcher.id, launchedId: launched.id });

    launcher.isAlive = false;
    this.pendingEvents.push({ type: "ball_despawned", ballId: launcher.id, reason: "after_launch" });
  }

  // --------------------------------------------------------
  // Rule Handlers
  // --------------------------------------------------------

  /** WHITE — bounce: wall-bouncing, no special effect */
  private handleBounce(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** YELLOW — accelerate: speeds up over time */
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

  /** ORANGE — launcher: handled by spawn system, not per-frame */
  private handleLauncher(ball: Ball, _delta: number, ctx: RuleContext): void {
    ctx.despawnBall(ball, "after_launch");
  }

  /** RED — destroy_on_contact */
  private handleDestroyOnContact(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.color === "orange") continue;
      if (ball.isCollidingWith(other)) {
        ctx.events.push({ type: "collision", ballAId: ball.id, ballBId: other.id });
        ctx.despawnBall(other, "destroyed_by_red");
        ctx.despawnBall(ball, "destroys_self_after_contact");
        return;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** LIGHT_GREEN — slow_nearby: slows nearby balls */
  private handleSlowNearby(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.slow_nearby ?? { radius: 2.0, slow_factor: 0.5 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      if (ball.distanceTo(other) < p.radius) {
        const drag = 1 - (1 - p.slow_factor) * delta;
        other.velocity.x *= drag;
        other.velocity.y *= drag;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** DARK_GREEN — attract: pulls nearby balls */
  private handleAttract(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.attract ?? { radius: 3.0, strength: 0.8 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      const d = ball.distanceTo(other);
      if (d < p.radius && d > 0.01) {
        const dir = normalize({ x: ball.position.x - other.position.x, y: ball.position.y - other.position.y });
        other.velocity.x += dir.x * p.strength * delta;
        other.velocity.y += dir.y * p.strength * delta;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** TURQUOISE — split: splits into 2 on wall contact */
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

  /** CYAN — freeze_nearby: freezes nearby balls */
  private handleFreezeNearby(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.freeze_nearby ?? { radius: 2.5, freeze_duration_seconds: 1.5 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      if (ball.distanceTo(other) < p.radius && !other.isFrozen) {
        other.freeze(p.freeze_duration_seconds);
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** BLUE — transfer_rule: passes its rule to first contacted ball */
  private handleTransferRule(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    if (ball.ruleTransferred) {
      if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
      return;
    }
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.color === "orange") continue;
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

  /** DARK_BLUE — gravity_sink: pulls all balls toward center */
  private handleGravitySink(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.gravity_sink ?? { strength: 0.6 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      const toCenter = normalize({ x: -other.position.x, y: -other.position.y });
      other.velocity.x += toCenter.x * p.strength * delta;
      other.velocity.y += toCenter.y * p.strength * delta;
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** GRAY — neutral: move and bounce, no effect */
  private handleNeutral(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** BLACK — absorb: eats other balls and grows */
  private handleAbsorb(ball: Ball, delta: number, ctx: RuleContext): void {
    this.applyMovement(ball, delta, ctx.arena);
    const p = ctx.config.rule_parameters.absorb ?? { max_diameter_multiplier: 3.0 };
    const maxDiam = ball.baseDiameter * p.max_diameter_multiplier;
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.color === "black") continue;
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
}
