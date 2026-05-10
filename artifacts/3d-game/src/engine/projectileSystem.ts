import { Ball } from "./Ball";
import type { BallColor, GameConfig, GameEvent, Vec2 } from "./types";
import { normalize } from "./engineMath";

interface Arena2D {
  halfW: number;
  halfH: number;
}

interface RuleContext {
  allBalls: Ball[];
  config: GameConfig;
  events: GameEvent[];
  arena: Arena2D;
  spawnBall: (
    color: BallColor,
    size: Ball["size"],
    position: Vec2,
    velocity: Vec2,
    overrideRule?: Ball["rule"],
    overrideHp?: { hp: number; maxHp: number }
  ) => Ball;
  despawnBall: (ball: Ball, reason: string) => void;
  damageBall: (ball: Ball, amount: number, reason?: string) => boolean;
}

export function handlePlayerProjectile(this: any, ball: Ball, delta: number, ctx: RuleContext): void {
  const metaAny = ball.metadata as Record<string, unknown>;
  if (metaAny.isGrenade === true) {
    const stuckToId = typeof metaAny.stuckToId === "string" ? metaAny.stuckToId : null;
    if (stuckToId) {
      const carrier = ctx.allBalls.find((b) => b.id === stuckToId && b.isAlive);
      if (carrier) {
        const offset = (metaAny.stuckOffset as Vec2 | undefined) ?? { x: 0, y: 0 };
        ball.position.x = carrier.position.x + offset.x;
        ball.position.y = carrier.position.y + offset.y;
        ball.velocity.x = carrier.velocity.x;
        ball.velocity.y = carrier.velocity.y;
      } else {
        delete metaAny.stuckToId;
        delete metaAny.stuckOffset;
      }
    } else {
      ball.position.x += ball.velocity.x * delta;
      ball.position.y += ball.velocity.y * delta;
      for (const other of ctx.allBalls) {
        if (other.id === ball.id || !other.isAlive || other.isProjectile() || other.color === "orange") continue;
        if (ball.isCollidingWith(other)) {
          ball.metadata.stuckToId = other.id;
          ball.metadata.stuckOffset = { x: ball.position.x - other.position.x, y: ball.position.y - other.position.y };
          ball.velocity.x = other.velocity.x;
          ball.velocity.y = other.velocity.y;
          break;
        }
      }
    }
    if (this.isOutOfBounds(ball, ctx.arena)) {
      ctx.despawnBall(ball, "grenade_out_of_bounds");
      this.activeGrenadeId = null;
      return;
    }
    // Grenade is sticky to all non-projectile balls on its path.
    for (const other of ctx.allBalls) {
      if (other.id === ball.id || !other.isAlive || other.isProjectile() || other.color === "orange") continue;
      if (ball.isCollidingWith(other)) {
        metaAny.touchedTarget = true;
        const sticky = other.metadata.stuckGrenades instanceof Set ? other.metadata.stuckGrenades : new Set<string>();
        sticky.add(ball.id);
        other.metadata.stuckGrenades = sticky;
      }
    }
    return;
  }

  const meta = ball.metadata as {
    damage: number;
    passesThroughBalls: boolean;
    remainingWallBounces: number;
    lifetime: number;
    damagedIds: Map<string, number>;
    hitCount?: number;
    killCount?: number;
    comboPositionSum?: Vec2;
    comboFinalized?: boolean;
  };

  // Lifetime safety
  meta.lifetime += delta;
  const maxLife = ctx.config.rule_parameters.player_projectile?.max_lifetime_seconds ?? 4.0;
  if (meta.lifetime > maxLife) {
    this.finalizePlayerProjectileCombo(ball, ctx);
    ctx.despawnBall(ball, "projectile_expired");
    return;
  }

  // Move
  ball.position.x += ball.velocity.x * delta;
  ball.position.y += ball.velocity.y * delta;

  this.triggerMagnetFieldsForProjectile(ball, ctx);

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
      this.finalizePlayerProjectileCombo(ball, ctx);
      ctx.despawnBall(ball, "projectile_hit_wall");
      return;
    }
  }

  // --- Ball collisions ---
  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive) continue;
    if (other.color === "orange" || other.isProjectile()) continue;
    if (this.isTemporarilyUntouchable(other)) continue;
    const immunityUntil = meta.damagedIds.get(other.id) ?? 0;
    if (immunityUntil > this.elapsedTime) continue;

    const ignoreProjectileId = typeof other.metadata?.ignoreProjectileId === "string" ? other.metadata.ignoreProjectileId : null;
    const ignoreUntil = typeof other.metadata?.ignoreProjectileUntil === "number" ? other.metadata.ignoreProjectileUntil : 0;
    if (ignoreProjectileId === ball.id && ignoreUntil > this.elapsedTime) continue;

    if (ball.isCollidingWith(other)) {
      const hpBeforeHit = other.hp;
      const hitImmunitySeconds = this.getProjectileHitImmunitySeconds(ctx.config);
      meta.damagedIds.set(other.id, this.elapsedTime + hitImmunitySeconds);
      ctx.events.push({ type: "collision", ballAId: ball.id, ballBId: other.id });
      const killed = ctx.damageBall(other, meta.damage, "killed_by_player");
      meta.hitCount = (meta.hitCount ?? 0) + 1;
      meta.killCount = (meta.killCount ?? 0) + (killed ? 1 : 0);
      const comboPositionSum = meta.comboPositionSum ?? { x: 0, y: 0 };
      comboPositionSum.x += other.position.x;
      comboPositionSum.y += other.position.y;
      meta.comboPositionSum = comboPositionSum;
      this.trySplitRedAfterNonLethalHit(other, hpBeforeHit, ball.id, ctx);

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
        this.finalizePlayerProjectileCombo(ball, ctx);
        ctx.despawnBall(ball, "projectile_hit_ball");
        return;
      }
    }
  }

  if (this.isOutOfBounds(ball, ctx.arena)) {
    this.finalizePlayerProjectileCombo(ball, ctx);
    ctx.despawnBall(ball, "projectile_out_of_bounds");
  }
}

export function finalizePlayerProjectileCombo(this: any, ball: Ball, ctx: RuleContext): void {
  const meta = ball.metadata as {
    hitCount?: number;
    killCount?: number;
    comboPositionSum?: Vec2;
    comboFinalized?: boolean;
  };
  if (meta.comboFinalized) return;
  meta.comboFinalized = true;

  const hitCount = meta.hitCount ?? 0;
  const killCount = meta.killCount ?? 0;
  let comboType: string | null = null;
  let label: string | null = null;
  let tier = 0;

  if (killCount >= 5) {
    comboType = "kill_5_plus";
    label = "god is playing!";
    tier = 5;
  } else if (killCount === 4) {
    comboType = "kill_4";
    label = "awesome";
    tier = 4;
  } else if (killCount === 3) {
    comboType = "kill_3";
    label = "impressive";
    tier = 3;
  } else if (killCount === 2) {
    comboType = "kill_2";
    label = "amazing";
    tier = 2;
  } else if (hitCount >= 4) {
    comboType = "hit_4_plus";
    label = "great";
    tier = 1;
  }

  if (!comboType || !label) {
    this.comboStreak = 0;
    return;
  }

  this.comboStreak += 1;

  ctx.events.push({
    type: "combo_popup",
    projectileId: ball.id,
    label,
    streak: this.comboStreak,
    tier,
    position: { x: 0, y: 0 },
  });
}

export function trySplitRedAfterNonLethalHit(this: any, target: Ball, hpBeforeHit: number, sourceProjectileId: string, ctx: RuleContext): void {
  if (target.color !== "red" || !target.isAlive) return;
  const redCap = target.isBoss ? 25 : 8;
  target.maxHp = Math.min(redCap, target.maxHp);
  target.hp = Math.min(target.hp, target.maxHp);
  if (target.hp >= hpBeforeHit) return;
  const childHp = Math.max(1, Math.min(redCap, target.hp - 1));
  const speed = Math.sqrt(target.velocity.x ** 2 + target.velocity.y ** 2);
  const dir = speed > 0.01 ? normalize(target.velocity) : { x: 1, y: 0 };
  const perp = normalize({ x: -dir.y, y: dir.x });
  const childSpeed = Math.max(speed, 12);
  const b1 = ctx.spawnBall("red", target.size, { ...target.position }, {
    x: dir.x * childSpeed * 0.75 + perp.x * childSpeed * 0.55,
    y: dir.y * childSpeed * 0.75 + perp.y * childSpeed * 0.55,
  }, "red_split_bouncer", { hp: childHp, maxHp: childHp });
  const b2 = ctx.spawnBall("red", target.size, { ...target.position }, {
    x: dir.x * childSpeed * 0.75 - perp.x * childSpeed * 0.55,
    y: dir.y * childSpeed * 0.75 - perp.y * childSpeed * 0.55,
  }, "red_split_bouncer", { hp: childHp, maxHp: childHp });
  b1.maxHp = childHp; b1.hp = childHp; b1.isBoss = target.isBoss;
  b2.maxHp = childHp; b2.hp = childHp; b2.isBoss = target.isBoss;
  const ignoreUntil = this.elapsedTime + this.getProjectileHitImmunitySeconds(ctx.config);
  b1.metadata.ignoreProjectileId = sourceProjectileId;
  b1.metadata.ignoreProjectileUntil = ignoreUntil;
  b2.metadata.ignoreProjectileId = sourceProjectileId;
  b2.metadata.ignoreProjectileUntil = ignoreUntil;
  ctx.events.push({ type: "ball_split", originalId: target.id, newIds: [b1.id, b2.id] });
  ctx.despawnBall(target, "red_split_after_hit");
}

export function getProjectileHitImmunitySeconds(this: any, config: GameConfig): number {
  const ms = config.rule_parameters.player_projectile?.hit_immunity_ms ?? 200;
  return Math.max(0, ms) / 1000;
}

export function reflectProjectileOff(this: any, projectile: Ball, target: Ball): void {
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
