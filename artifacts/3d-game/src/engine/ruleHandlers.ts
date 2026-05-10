import { Ball } from "./Ball";
import { BallSize } from "./types";
import { normalize, type RuleContext } from "./engineMath";
import {
  applyMagnetBoostTimer,
  applyMovement,
  getMagnetFieldParams,
  isOutOfBounds,
  isTemporarilyUntouchable,
  resolveMagnetContact,
  resolveWallBounce,
  triggerMagnetBoost,
} from "./collisionSystem";

export function handleBounce(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleAccelerate(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  const accel = ctx.config.rule_parameters.accelerate?.acceleration_per_second ?? 0.4;
  const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
  if (speed > 0.01) {
    ball.velocity.x += (ball.velocity.x / speed) * accel * delta;
    ball.velocity.y += (ball.velocity.y / speed) * accel * delta;
  }
  applyMovement(ball, delta, ctx.arena);
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleLauncher(this: void, _ball: Ball, _delta: number, _ctx: RuleContext): void {
  // intentionally empty
}

export function handleDestroyOnContact(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive || other.color === "orange" || other.isProjectile()) continue;
    if (isTemporarilyUntouchable(other)) continue;
    if (ball.isCollidingWith(other)) {
      ctx.events.push({ type: "collision", ballAId: ball.id, ballBId: other.id });
      ctx.despawnBall(other, "destroyed_by_red");
      ctx.despawnBall(ball, "destroys_self_after_contact");
      return;
    }
  }
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleSlowNearby(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  const p = ctx.config.rule_parameters.slow_nearby ?? { radius: 2.0, slow_factor: 0.5 };
  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive || other.isProjectile()) continue;
    if (ball.distanceTo(other) < p.radius) {
      const drag = 1 - (1 - p.slow_factor) * delta;
      other.velocity.x *= drag;
      other.velocity.y *= drag;
    }
  }
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleAttract(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
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
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleMagnetField(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  const p = getMagnetFieldParams(ctx.config);
  ball.metadata.magnetFieldDiameter = ball.diameter * p.field_diameter_multiplier;

  applyMagnetBoostTimer(ball, delta);
  applyMovement(ball, delta, ctx.arena);

  const fieldRadius = (ball.diameter * p.field_diameter_multiplier) / 2;
  const projectilesInside = ball.metadata.projectilesInsideField instanceof Set
    ? ball.metadata.projectilesInsideField as Set<string>
    : new Set<string>();
  const currentProjectilesInside = new Set<string>();

  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive || other.color === "orange") continue;
    const distance = ball.distanceTo(other);
    const enteredField = distance <= fieldRadius + other.diameter / 2;

    if (other.isProjectile()) {
      if (enteredField) {
        currentProjectilesInside.add(other.id);
        if (!projectilesInside.has(other.id)) triggerMagnetBoost(ball, p);
      }
      continue;
    }

    if (!enteredField || distance <= 0.001) continue;
    const dir = normalize({ x: ball.position.x - other.position.x, y: ball.position.y - other.position.y });
    other.velocity.x += dir.x * p.attraction_strength * delta;
    other.velocity.y += dir.y * p.attraction_strength * delta;
    resolveMagnetContact(ball, other, p);
  }

  ball.metadata.projectilesInsideField = currentProjectilesInside;
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleGentleCurrent(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  const p = ctx.config.rule_parameters.gentle_current ?? {
    field_diameter_multiplier: 4,
    projectile_guidance_strength: 5,
    projectile_target_radius: 35,
    enemy_slow_factor: 0.72,
    enemy_push_strength: 4,
  };
  const fieldRadius = (ball.diameter * Math.max(1, p.field_diameter_multiplier)) / 2;
  ball.metadata.gentleCurrentDiameter = fieldRadius * 2;

  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive || other.color === "orange") continue;
    const distance = ball.distanceTo(other);
    if (distance > fieldRadius + other.diameter / 2) continue;

    if (other.isProjectile()) {
      guideProjectileTowardNearestTarget(other, ball, p.projectile_guidance_strength, p.projectile_target_radius, delta, ctx);
      continue;
    }

    if (other.color === ball.color) continue;
    const drag = 1 - (1 - Math.max(0, Math.min(1, p.enemy_slow_factor))) * delta;
    other.velocity.x *= drag;
    other.velocity.y *= drag;

    const awayFromPlayer = normalize({ x: other.position.x, y: other.position.y + ctx.arena.halfH });
    other.velocity.x += awayFromPlayer.x * p.enemy_push_strength * delta;
    other.velocity.y += awayFromPlayer.y * p.enemy_push_strength * delta;
  }

  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

function guideProjectileTowardNearestTarget(
  projectile: Ball,
  current: Ball,
  guidanceStrength: number,
  targetRadius: number,
  delta: number,
  ctx: RuleContext
): void {
  const currentSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
  if (currentSpeed <= 0.001) return;

  let nearest: Ball | null = null;
  let nearestDistance = Infinity;
  for (const candidate of ctx.allBalls) {
    if (!candidate.isAlive || candidate.id === projectile.id || candidate.id === current.id) continue;
    if (candidate.isProjectile() || candidate.color === "orange" || candidate.color === current.color) continue;
    const distance = projectile.distanceTo(candidate);
    if (distance > targetRadius || distance >= nearestDistance) continue;
    nearest = candidate;
    nearestDistance = distance;
  }

  if (!nearest) return;
  const desired = normalize({ x: nearest.position.x - projectile.position.x, y: nearest.position.y - projectile.position.y });
  const turn = Math.max(0, guidanceStrength) * delta;
  projectile.velocity.x += desired.x * turn;
  projectile.velocity.y += desired.y * turn;
  const nextSpeed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
  if (nextSpeed <= 0.001) return;
  projectile.velocity.x = (projectile.velocity.x / nextSpeed) * currentSpeed;
  projectile.velocity.y = (projectile.velocity.y / nextSpeed) * currentSpeed;
}

export function handleSplit(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  ball.position.x += ball.velocity.x * delta;
  ball.position.y += ball.velocity.y * delta;
  const hitWall = resolveWallBounce(ball, ctx.arena);

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
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleFreezeNearby(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  const p = ctx.config.rule_parameters.freeze_nearby ?? { radius: 2.5, freeze_duration_seconds: 1.5 };
  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive || other.isProjectile()) continue;
    if (ball.distanceTo(other) < p.radius && !other.isFrozen) {
      other.freeze(p.freeze_duration_seconds);
    }
  }
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleTransferRule(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  if (ball.ruleTransferred) {
    if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
    return;
  }
  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive || other.color === "orange" || other.isProjectile()) continue;
    if (isTemporarilyUntouchable(other)) continue;
    if (ball.isCollidingWith(other)) {
      const transferred = other.rule;
      ball.passRuleTo(other, ctx.logEnabled);
      ctx.events.push({ type: "rule_transferred", fromId: ball.id, toId: other.id, rule: transferred });
      ball.ruleTransferred = true;
      ctx.despawnBall(ball, "rule_transferred");
      return;
    }
  }
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleGravitySink(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  const p = ctx.config.rule_parameters.gravity_sink ?? { strength: 0.6 };
  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive || other.isProjectile()) continue;
    const toCenter = normalize({ x: -other.position.x, y: -other.position.y });
    other.velocity.x += toCenter.x * p.strength * delta;
    other.velocity.y += toCenter.y * p.strength * delta;
  }
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleNeutral(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleAbsorb(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  const p = ctx.config.rule_parameters.absorb ?? { max_diameter_multiplier: 3.0 };
  const maxDiam = ball.baseDiameter * p.max_diameter_multiplier;
  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive || other.color === "black" || other.isProjectile()) continue;
    if (isTemporarilyUntouchable(other)) continue;
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
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleHpGrowBouncer(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  const p = ctx.config.rule_parameters.hp_grow_bouncer;
  if (!p) return;

  if (!(ball.metadata.touched instanceof Set)) ball.metadata.touched = new Set<string>();
  const touched = ball.metadata.touched as Set<string>;

  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive) continue;
    if (other.color === "orange" || other.isProjectile()) continue;
    if (isTemporarilyUntouchable(other)) continue;
    const overlapping = ball.isCollidingWith(other);
    if (overlapping && !touched.has(other.id)) {
      touched.add(other.id);
      if (ball.hp < ball.maxHp) {
        const baseHealAmount = ball.color === "blue"
          ? (p.blue_hp_gained_per_contact ?? 2)
          : (p.hp_gained_per_traversal ?? 1);
        const healMultiplier = typeof ball.metadata.hpGrowHealMultiplier === "number"
          ? Number(ball.metadata.hpGrowHealMultiplier)
          : 1;
        const healAmount = baseHealAmount * Math.max(0, healMultiplier);
        const healed = ball.heal(healAmount);
        if (healed > 0) {
          ball.diameter = ctx.computeHpGrowDiameter(ball);
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
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleBlinkHpBouncer(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  const p = ctx.config.rule_parameters.yellow_blinker ?? { default_hp: 4, max_hp: 4, invisible_duration_seconds: 0.5, cycle_seconds: 1.0 };
  const age = Number(ball.metadata.ageSeconds ?? 0) + delta;
  ball.metadata.ageSeconds = age;

  const baseCycle = Math.max(0.01, p.cycle_seconds ?? 1.0);
  const invis = Math.max(0, Math.min(baseCycle, p.invisible_duration_seconds ?? 0.5));
  const visible = Math.max(0.01, baseCycle - invis);
  const cycle = invis + visible * 1.15;
  const phase = age % cycle;
  const isInvisible = phase < invis;
  ball.metadata.visibilityAlpha = isInvisible ? 0.0 : 1.0;
  applyMovement(ball, delta, ctx.arena);

  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}

export function handleRedSplitBouncer(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  applyMovement(ball, delta, ctx.arena);
  if (isOutOfBounds(ball, ctx.arena)) ctx.despawnBall(ball, "out_of_bounds");
}
