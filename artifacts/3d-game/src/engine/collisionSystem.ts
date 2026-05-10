import { Ball } from "./Ball";
import type { BallColor, GameConfig, GameEvent, Vec2 } from "./types";
import { BounceCondition } from "./types";

interface Arena2D {
  halfW: number;
  halfH: number;
}

interface MagnetFieldParams {
  field_diameter_multiplier: number;
  attraction_strength: number;
  boost_speed_multiplier: number;
  boost_duration_seconds: number;
  contact_velocity_damping?: number;
}

interface RuleContext {
  allBalls: Ball[];
  config: GameConfig;
  events: GameEvent[];
  arena: Arena2D;
  spawnBall: (...args: any[]) => Ball;
  despawnBall: (ball: Ball, reason: string) => void;
  damageBall: (ball: Ball, amount: number, reason?: string) => boolean;
}

export function getBounceCondition(this: any, color: BallColor): BounceCondition {
  const raw = this.config.bounce_conditions?.ball_bounce_conditions?.[color];
  if (raw && Object.values(BounceCondition).includes(raw as BounceCondition)) {
    return raw as BounceCondition;
  }
  return BounceCondition.AGAINST_WALL;
}

export function getArena(this: any): Arena2D {
  return {
    halfW: this.config.graphics.arena.width / 2,
    halfH: this.config.graphics.arena.height / 2,
  };
}

export function applyMovement(this: any, ball: Ball, delta: number, arena: Arena2D): boolean {
  ball.position.x += ball.velocity.x * delta;
  ball.position.y += ball.velocity.y * delta;
  return this.resolveWallBounce(ball, arena);
}

export function resolveWallBounce(this: any, ball: Ball, arena: Arena2D): boolean {
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

export function detectWallHit(this: any, ball: Ball, arena: Arena2D): "x" | "y" | null {
  const r = ball.diameter / 2;
  if (ball.position.x - r < -arena.halfW || ball.position.x + r > arena.halfW) return "x";
  if (ball.position.y - r < -arena.halfH || ball.position.y + r > arena.halfH) return "y";
  return null;
}

export function isOutOfBounds(this: any, ball: Ball, arena: Arena2D): boolean {
  const r = ball.diameter / 2;
  return (
    ball.position.x + r < -arena.halfW ||
    ball.position.x - r > arena.halfW ||
    ball.position.y + r < -arena.halfH ||
    ball.position.y - r > arena.halfH
  );
}

export function isTemporarilyUntouchable(this: any, ball: Ball): boolean {
  return ball.color === "yellow" && Number(ball.metadata.visibilityAlpha ?? 1) <= 0;
}

export function getSpeed(this: any, v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function rescaleVelocity(this: any, ball: Ball, targetSpeed: number): void {
  const speed = this.getSpeed(ball.velocity);
  if (speed <= 0.001 || targetSpeed <= 0) return;
  const scale = targetSpeed / speed;
  ball.velocity.x *= scale;
  ball.velocity.y *= scale;
}

export function getMagnetFieldParams(this: any, config: GameConfig): MagnetFieldParams {
  return config.rule_parameters.magnet_field ?? {
    field_diameter_multiplier: 3,
    attraction_strength: 18,
    boost_speed_multiplier: 2,
    boost_duration_seconds: 0.5,
    contact_velocity_damping: 0,
  };
}

export function triggerMagnetBoost(this: any, ball: Ball, p: MagnetFieldParams): void {
  const currentSpeed = this.getSpeed(ball.velocity);
  if (currentSpeed <= 0.001) return;
  if (typeof ball.metadata.magnetBaseSpeed !== "number" || Number(ball.metadata.magnetBoostTimer ?? 0) <= 0) {
    ball.metadata.magnetBaseSpeed = currentSpeed;
  }
  this.rescaleVelocity(ball, currentSpeed * Math.max(1, p.boost_speed_multiplier));
  ball.metadata.magnetBoostTimer = Math.max(0, p.boost_duration_seconds);
}

export function applyMagnetBoostTimer(this: any, ball: Ball, delta: number): void {
  const timer = Number(ball.metadata.magnetBoostTimer ?? 0);
  if (timer <= 0) return;
  const nextTimer = timer - delta;
  if (nextTimer > 0) {
    ball.metadata.magnetBoostTimer = nextTimer;
    return;
  }

  const baseSpeed = typeof ball.metadata.magnetBaseSpeed === "number"
    ? Math.max(0, ball.metadata.magnetBaseSpeed)
    : null;
  if (baseSpeed !== null) this.rescaleVelocity(ball, baseSpeed);
  ball.metadata.magnetBoostTimer = 0;
  delete ball.metadata.magnetBaseSpeed;
}

export function triggerMagnetFieldsForProjectile(this: any, projectile: Ball, ctx: RuleContext): void {
  for (const magnet of ctx.allBalls) {
    if (!magnet.isAlive || magnet.id === projectile.id || magnet.rule !== "magnet_field") continue;
    const p = this.getMagnetFieldParams(ctx.config);
    const fieldRadius = (magnet.diameter * p.field_diameter_multiplier) / 2;
    if (magnet.distanceTo(projectile) > fieldRadius + projectile.diameter / 2) continue;

    const projectilesInside = magnet.metadata.projectilesInsideField instanceof Set
      ? magnet.metadata.projectilesInsideField as Set<string>
      : new Set<string>();
    if (!projectilesInside.has(projectile.id)) this.triggerMagnetBoost(magnet, p);
    projectilesInside.add(projectile.id);
    magnet.metadata.projectilesInsideField = projectilesInside;
  }
}

export function resolveMagnetContact(this: any, magnet: Ball, other: Ball, p: MagnetFieldParams): void {
  const dx = other.position.x - magnet.position.x;
  const dy = other.position.y - magnet.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = (magnet.diameter + other.diameter) / 2;
  if (dist >= minDist || dist <= 0.001) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;
  other.position.x += nx * (overlap + 0.01);
  other.position.y += ny * (overlap + 0.01);

  const inwardVelocity = other.velocity.x * nx + other.velocity.y * ny;
  if (inwardVelocity < 0) {
    const damping = Math.max(0, Math.min(1, p.contact_velocity_damping ?? 0));
    other.velocity.x -= inwardVelocity * (1 - damping) * nx;
    other.velocity.y -= inwardVelocity * (1 - damping) * ny;
  }
}

export function resolveBallCollisions(this: any, balls: Ball[], _arena: Arena2D): void {
  const restitution = this.config.rule_parameters.ball_collision?.restitution ?? 0.95;

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      if (!a.isAlive || !b.isAlive) continue;
      if (this.isTemporarilyUntouchable(a) || this.isTemporarilyUntouchable(b)) continue;
      if (a.isProjectile() || b.isProjectile()) continue; // projectiles handle their own
      if (a.isFrozen && b.isFrozen) continue;

      if (a.rule === "magnet_field" || b.rule === "magnet_field") {
        const magnet = a.rule === "magnet_field" ? a : b;
        const other = magnet === a ? b : a;
        if (!magnet.isFrozen) this.resolveMagnetContact(magnet, other, this.getMagnetFieldParams(this.config));
        continue;
      }

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
