// ============================================================
// GAME ENGINE — Rule Handlers
//
// ARCHITECTURE NOTE:
// - The GameEngine interprets game_config.json at runtime.
// - All gameplay rules are read from the config. Do NOT hard-
//   code game values here — put them in game_config.json.
// - Each rule has exactly one handler registered via
//   registerRuleHandler(). To add a new rule:
//     1. Add it to game_config.json (ball_rules section)
//     2. Add a handler function below
//     3. Register it in the constructor
// - 3D graphics are completely decoupled: this file has zero
//   imports from Three.js or React. It only knows Vec2 math.
// - The engine emits GameEvents that the React/Three layer
//   consumes to drive visual changes.
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { Ball } from "./Ball";
import type { BallColor, BallRule, GameConfig, GameEvent, GameState, Vec2 } from "./types";
import { BallSize } from "./types";

type RuleHandler = (ball: Ball, delta: number, context: RuleContext) => void;

interface RuleContext {
  allBalls: Ball[];
  config: GameConfig;
  events: GameEvent[];
  arena: { halfW: number; halfH: number };
  spawnBall: (
    color: BallColor,
    size: BallSize,
    position: Vec2,
    velocity: Vec2
  ) => Ball;
  despawnBall: (ball: Ball, reason: string) => void;
}

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
  // To add a new rule: implement a function, then call
  // registerRuleHandler("<ruleName>", handlerFn) here.
  // --------------------------------------------------------
  private registerAllHandlers(): void {
    this.registerRuleHandler("bounce", this.handleBounce.bind(this));
    this.registerRuleHandler("accelerate", this.handleAccelerate.bind(this));
    this.registerRuleHandler("launcher", this.handleLauncher.bind(this));
    this.registerRuleHandler("destroy_on_contact", this.handleDestroyOnContact.bind(this));
    this.registerRuleHandler("slow_nearby", this.handleSlowNearby.bind(this));
    this.registerRuleHandler("attract", this.handleAttract.bind(this));
    this.registerRuleHandler("split", this.handleSplit.bind(this));
    this.registerRuleHandler("freeze_nearby", this.handleFreezeNearby.bind(this));
    this.registerRuleHandler("transfer_rule", this.handleTransferRule.bind(this));
    this.registerRuleHandler("gravity_sink", this.handleGravitySink.bind(this));
    this.registerRuleHandler("neutral", this.handleNeutral.bind(this));
    this.registerRuleHandler("absorb", this.handleAbsorb.bind(this));
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

    // Spawn orange balls via timer
    this.updateOrangeSpawn(delta, arena);

    // Update freeze timers
    this.balls.forEach((ball) => {
      if (ball.isFrozen) {
        ball.frozenTimer -= delta;
        if (ball.frozenTimer <= 0) {
          ball.isFrozen = false;
          ball.frozenTimer = 0;
        }
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

    // Apply rule handlers
    for (const ball of allBalls) {
      if (!ball.isAlive || ball.isFrozen) continue;
      const handler = this.ruleHandlers.get(ball.rule);
      if (handler) {
        handler(ball, delta, context);
      } else {
        // Fallback: move + wall bounce
        this.moveAndBounce(ball, delta, arena);
      }
    }

    // Remove dead balls
    this.balls.forEach((ball, id) => {
      if (!ball.isAlive) this.balls.delete(id);
    });

    return this.getState();
  }

  // --------------------------------------------------------
  // Ball Spawning
  // --------------------------------------------------------
  spawnBall(
    color: BallColor,
    size: BallSize,
    position: Vec2,
    velocity: Vec2
  ): Ball {
    const diameter = this.config.graphics.ball_sizes[size]?.diameter ?? 0.3;
    const rule = this.config.ball_rules[color]?.rule ?? "neutral";
    const ball = new Ball(color, size, position, velocity, diameter, rule);
    this.balls.set(ball.id, ball);
    this.pendingEvents.push({ type: "ball_spawned", ball: ball.getState() });
    return ball;
  }

  private getArena() {
    const w = this.config.graphics.arena.width;
    const h = this.config.graphics.arena.height;
    return { halfW: w / 2, halfH: h / 2 };
  }

  // --------------------------------------------------------
  // Orange Launcher Spawn Logic (from gameplay.orange in config)
  // --------------------------------------------------------
  private updateOrangeSpawn(delta: number, arena: { halfW: number; halfH: number }): void {
    const orangeConfig = this.config.gameplay.orange;
    const interval = orangeConfig.spawn.interval_seconds;

    this.orangeSpawnTimer += delta;
    if (this.orangeSpawnTimer >= interval) {
      this.orangeSpawnTimer = 0;
      this.spawnOrangeLauncher(arena);
    }
  }

  private spawnOrangeLauncher(arena: { halfW: number; halfH: number }): void {
    // Place orange on a random edge
    const edge = Math.floor(Math.random() * 4); // 0=top,1=bottom,2=left,3=right
    let pos: Vec2;
    const pad = 0.1;
    switch (edge) {
      case 0: pos = { x: randomInRange(-arena.halfW + pad, arena.halfW - pad), y: arena.halfH - pad }; break;
      case 1: pos = { x: randomInRange(-arena.halfW + pad, arena.halfW - pad), y: -arena.halfH + pad }; break;
      case 2: pos = { x: -arena.halfW + pad, y: randomInRange(-arena.halfH + pad, arena.halfH - pad) }; break;
      default: pos = { x: arena.halfW - pad, y: randomInRange(-arena.halfH + pad, arena.halfH - pad) }; break;
    }
    const ball = this.spawnBall("orange", BallSize.MEDIUM, pos, { x: 0, y: 0 });
    // Immediately launch from it
    this.performOrangeLaunch(ball, arena);
  }

  private performOrangeLaunch(launcher: Ball, arena: { halfW: number; halfH: number }): void {
    const launchCfg = this.config.gameplay.orange.launch_config;

    // Determine color
    let color: BallColor;
    if (launchCfg.color === "random") {
      const allowed = launchCfg.allow_colors ?? (Object.keys(this.config.ball_colors) as BallColor[]);
      color = allowed[Math.floor(Math.random() * allowed.length)];
    } else {
      color = launchCfg.color as BallColor;
    }

    // Determine size
    const size = launchCfg.size ?? BallSize.SMALL;

    // Direction: random toward interior
    const angle = Math.random() * Math.PI * 2;
    const speed = launchCfg.speed ?? 4.0;
    // Bias toward center
    const toCenter = normalize({
      x: -launcher.position.x,
      y: -launcher.position.y,
    });
    const randomAngle = Math.random() * Math.PI - Math.PI / 2;
    const cos = Math.cos(randomAngle);
    const sin = Math.sin(randomAngle);
    const perpX = -toCenter.y;
    const perpY = toCenter.x;
    const dir: Vec2 = {
      x: toCenter.x * cos + perpX * sin,
      y: toCenter.y * cos + perpY * sin,
    };
    void angle; // used via spread below

    const launched = this.spawnBall(color, size as BallSize, { ...launcher.position }, {
      x: dir.x * speed,
      y: dir.y * speed,
    });

    this.pendingEvents.push({
      type: "orange_launched",
      launcherId: launcher.id,
      launchedId: launched.id,
    });

    // Despawn orange after launch
    launcher.isAlive = false;
    this.pendingEvents.push({ type: "ball_despawned", ballId: launcher.id, reason: "after_launch" });
  }

  // --------------------------------------------------------
  // Movement Helpers
  // --------------------------------------------------------
  private moveAndBounce(ball: Ball, delta: number, arena: { halfW: number; halfH: number }): void {
    ball.position.x += ball.velocity.x * delta;
    ball.position.y += ball.velocity.y * delta;

    const r = ball.diameter / 2;
    if (ball.position.x - r < -arena.halfW) { ball.position.x = -arena.halfW + r; ball.velocity.x *= -1; }
    if (ball.position.x + r > arena.halfW)  { ball.position.x = arena.halfW - r;  ball.velocity.x *= -1; }
    if (ball.position.y - r < -arena.halfH) { ball.position.y = -arena.halfH + r; ball.velocity.y *= -1; }
    if (ball.position.y + r > arena.halfH)  { ball.position.y = arena.halfH - r;  ball.velocity.y *= -1; }
  }

  private isOutOfBounds(ball: Ball, arena: { halfW: number; halfH: number }): boolean {
    const r = ball.diameter / 2;
    return (
      ball.position.x + r < -arena.halfW ||
      ball.position.x - r > arena.halfW ||
      ball.position.y + r < -arena.halfH ||
      ball.position.y - r > arena.halfH
    );
  }

  // --------------------------------------------------------
  // Rule Handlers
  // Each handler is responsible for one BallRule value.
  // They receive the ball, delta time, and a shared context.
  // --------------------------------------------------------

  /** WHITE — bounce: standard wall-bouncing ball */
  private handleBounce(ball: Ball, delta: number, ctx: RuleContext): void {
    this.moveAndBounce(ball, delta, ctx.arena);
    if (this.isOutOfBounds(ball, ctx.arena)) {
      ctx.despawnBall(ball, "out_of_bounds");
    }
  }

  /** YELLOW — accelerate: gradually speeds up */
  private handleAccelerate(ball: Ball, delta: number, ctx: RuleContext): void {
    const accel = ctx.config.rule_parameters.accelerate?.acceleration_per_second ?? 0.3;
    const dir = normalize(ball.velocity);
    ball.velocity.x += dir.x * accel * delta;
    ball.velocity.y += dir.y * accel * delta;
    this.moveAndBounce(ball, delta, ctx.arena);
    if (this.isOutOfBounds(ball, ctx.arena)) {
      ctx.despawnBall(ball, "out_of_bounds");
    }
  }

  /** ORANGE — launcher: handled by the spawn system, not per-frame */
  private handleLauncher(ball: Ball, _delta: number, ctx: RuleContext): void {
    // Orange balls are spawned and immediately launched; they should not persist
    ctx.despawnBall(ball, "after_launch");
  }

  /** RED — destroy_on_contact: destroys balls it touches */
  private handleDestroyOnContact(ball: Ball, delta: number, ctx: RuleContext): void {
    this.moveAndBounce(ball, delta, ctx.arena);
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

  /** LIGHT_GREEN — slow_nearby: slows other balls in radius */
  private handleSlowNearby(ball: Ball, delta: number, ctx: RuleContext): void {
    this.moveAndBounce(ball, delta, ctx.arena);
    const params = ctx.config.rule_parameters.slow_nearby ?? { radius: 2.0, slow_factor: 0.5 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      if (ball.distanceTo(other) < params.radius) {
        other.velocity.x *= 1 - (1 - params.slow_factor) * delta;
        other.velocity.y *= 1 - (1 - params.slow_factor) * delta;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** DARK_GREEN — attract: pulls other balls toward itself */
  private handleAttract(ball: Ball, delta: number, ctx: RuleContext): void {
    this.moveAndBounce(ball, delta, ctx.arena);
    const params = ctx.config.rule_parameters.attract ?? { radius: 3.0, strength: 0.8 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      const d = ball.distanceTo(other);
      if (d < params.radius && d > 0.01) {
        const dir = normalize({ x: ball.position.x - other.position.x, y: ball.position.y - other.position.y });
        other.velocity.x += dir.x * params.strength * delta;
        other.velocity.y += dir.y * params.strength * delta;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** TURQUOISE — split: splits into 2 on wall contact */
  private handleSplit(ball: Ball, delta: number, ctx: RuleContext): void {
    ball.position.x += ball.velocity.x * delta;
    ball.position.y += ball.velocity.y * delta;

    const r = ball.diameter / 2;
    let hitWall = false;
    if (ball.position.x - r < -ctx.arena.halfW) { ball.position.x = -ctx.arena.halfW + r; ball.velocity.x *= -1; hitWall = true; }
    if (ball.position.x + r > ctx.arena.halfW)  { ball.position.x = ctx.arena.halfW - r;  ball.velocity.x *= -1; hitWall = true; }
    if (ball.position.y - r < -ctx.arena.halfH) { ball.position.y = -ctx.arena.halfH + r; ball.velocity.y *= -1; hitWall = true; }
    if (ball.position.y + r > ctx.arena.halfH)  { ball.position.y = ctx.arena.halfH - r;  ball.velocity.y *= -1; hitWall = true; }

    if (hitWall && ball.size !== BallSize.SMALL) {
      // Spawn 2 smaller balls
      const smallerSize = ball.size === BallSize.LARGE ? BallSize.MEDIUM : BallSize.SMALL;
      const perp = { x: -ball.velocity.y, y: ball.velocity.x };
      const normPerp = normalize(perp);
      const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
      const b1 = ctx.spawnBall("turquoise", smallerSize, { ...ball.position }, {
        x: ball.velocity.x * 0.8 + normPerp.x * speed * 0.5,
        y: ball.velocity.y * 0.8 + normPerp.y * speed * 0.5,
      });
      const b2 = ctx.spawnBall("turquoise", smallerSize, { ...ball.position }, {
        x: ball.velocity.x * 0.8 - normPerp.x * speed * 0.5,
        y: ball.velocity.y * 0.8 - normPerp.y * speed * 0.5,
      });
      ctx.events.push({ type: "ball_split", originalId: ball.id, newIds: [b1.id, b2.id] });
      ctx.despawnBall(ball, "split_completed");
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** CYAN — freeze_nearby: freezes nearby balls momentarily */
  private handleFreezeNearby(ball: Ball, delta: number, ctx: RuleContext): void {
    this.moveAndBounce(ball, delta, ctx.arena);
    const params = ctx.config.rule_parameters.freeze_nearby ?? { radius: 2.5, freeze_duration_seconds: 1.5 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      if (ball.distanceTo(other) < params.radius && !other.isFrozen) {
        other.freeze(params.freeze_duration_seconds);
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** BLUE — transfer_rule: passes its rule to the first ball it contacts */
  private handleTransferRule(ball: Ball, delta: number, ctx: RuleContext): void {
    this.moveAndBounce(ball, delta, ctx.arena);
    if (ball.ruleTransferred) {
      if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
      return;
    }
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.color === "orange") continue;
      if (ball.isCollidingWith(other)) {
        const transferredRule = other.rule;
        ball.passRuleTo(other, this.logEnabled);
        ctx.events.push({ type: "rule_transferred", fromId: ball.id, toId: other.id, rule: transferredRule });
        ball.ruleTransferred = true;
        ctx.despawnBall(ball, "rule_transferred");
        return;
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** DARK_BLUE — gravity_sink: pulls all balls toward center */
  private handleGravitySink(ball: Ball, delta: number, ctx: RuleContext): void {
    this.moveAndBounce(ball, delta, ctx.arena);
    const params = ctx.config.rule_parameters.gravity_sink ?? { strength: 0.5 };
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive) continue;
      const toCenter = normalize({ x: -other.position.x, y: -other.position.y });
      other.velocity.x += toCenter.x * params.strength * delta;
      other.velocity.y += toCenter.y * params.strength * delta;
    }
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** GRAY — neutral: just moves and bounces */
  private handleNeutral(ball: Ball, delta: number, ctx: RuleContext): void {
    this.moveAndBounce(ball, delta, ctx.arena);
    if (this.isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
  }

  /** BLACK — absorb: eats other balls and grows */
  private handleAbsorb(ball: Ball, delta: number, ctx: RuleContext): void {
    this.moveAndBounce(ball, delta, ctx.arena);
    const params = ctx.config.rule_parameters.absorb ?? { max_diameter_multiplier: 3.0 };
    const maxDiam = ball.baseDiameter * params.max_diameter_multiplier;

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
