import { Ball } from "./Ball";
import type { BallColor, GameConfig, GameEvent, ShotKind, ShotTypeConfig, Vec2 } from "./types";
import { BallSize, BounceCondition } from "./types";
import { normalize, type Arena2D, type PendingCommand, type RuleContext } from "./engineMath";
import {
  detectWallHit,
  isOutOfBounds,
  isTemporarilyUntouchable,
  triggerMagnetFieldsForProjectile,
} from "./collisionSystem";


export interface PlayerProjectileApiContext {
  balls: Map<string, Ball>;
  config: GameConfig;
  pendingCommands: PendingCommand[];
  activeGrenadeId: string | null;
  getArena: () => Arena2D;
  classifyShot: (holdSeconds: number) => ShotKind;
  damageBall: (ball: Ball, amount: number, reason?: string) => boolean;
  emitEvent: (event: GameEvent, source: "update" | "external") => void;
}

export function playerShoot(
  engine: PlayerProjectileApiContext,
  targetX: number,
  targetY: number,
  holdSeconds: number,
  color: BallColor,
  shotOverride?: Partial<ShotTypeConfig> & { color_tint?: string; effect?: string; visualColor?: BallColor; forceStopsOnHit?: boolean }
): Ball | null {
  const controls = engine.config.gameplay_controls;
  if (!controls) return null;
  const shotKind = engine.classifyShot(holdSeconds);
  const baseShotCfg = controls.shot_types[shotKind];
  if (!baseShotCfg) return null;
  const shotCfg = { ...baseShotCfg, ...(shotOverride ?? {}) };

  const arena = engine.getArena();
  const inset = (controls.shot_origin?.inset_factor ?? 0.04) * arena.halfH * 2;
  const origin: Vec2 = { x: 0, y: -arena.halfH + inset };

  const dx = targetX - origin.x;
  const dy = targetY - origin.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return null;
  const dir: Vec2 = { x: dx / len, y: dy / len };

  const baseSize = controls.queue_ball_size ?? BallSize.SMALL;
  const baseDiameter = engine.config.graphics.ball_sizes[baseSize]?.diameter ?? 1.0;
  const projectileDiameter = baseDiameter * shotCfg.diameter_multiplier;
  const speed = shotCfg.speed;

  const projectile = new Ball(
    shotOverride?.visualColor ?? color,
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
    forceStopsOnHit: shotOverride?.forceStopsOnHit === true,
    remainingWallBounces: shotCfg.wall_bounces,
    lifetime: 0,
    damagedIds: new Map<string, number>(),
    hitCount: 0,
    killCount: 0,
    comboPositionSum: { x: 0, y: 0 },
    comboFinalized: false,
    colorTint: shotCfg.color_tint ?? null,
    effect: shotOverride?.effect ?? (shotKind === 'mega' ? 'nova' : shotKind === 'heavy' ? 'shock' : 'pulse'),
  };
  engine.balls.set(projectile.id, projectile);
  engine.emitEvent({ type: "ball_spawned", ball: projectile.getState() }, "external");
  engine.emitEvent({ type: "player_shot", projectileId: projectile.id, shotKind }, "external");
  return projectile;
}

export function getShotConfig(config: GameConfig, kind: ShotKind): ShotTypeConfig | null {
  return config.gameplay_controls?.shot_types?.[kind] ?? null;
}

export function getPlayerBaseDiameter(config: GameConfig): number {
  const controls = config.gameplay_controls;
  const baseSize = controls?.queue_ball_size ?? BallSize.SMALL;
  return config.graphics.ball_sizes[baseSize]?.diameter ?? 1.0;
}

export function processPendingCommands(engine: PlayerProjectileApiContext): void {
  if (engine.pendingCommands.length === 0) return;
  const commands = engine.pendingCommands.splice(0);

  for (const command of commands) {
    if (command.type === "launch_grenade") {
      const arena = engine.getArena();
      const origin: Vec2 = { x: 0, y: -arena.halfH + 2 };
      const len = Math.sqrt(command.direction.x*command.direction.x + command.direction.y*command.direction.y);
      const dir = len > 0.001 ? {x: command.direction.x/len, y: command.direction.y/len} : {x: 0, y: 1};
      const baseDiameter = getPlayerBaseDiameter(engine.config);
      const baseSpeed = engine.config.gameplay_controls?.shot_types?.light?.speed ?? 9;
      const grenade = new Ball('gray', BallSize.SMALL, origin, {x: dir.x * baseSpeed * 4, y: dir.y * baseSpeed * 4}, baseDiameter * 2, 'player_projectile', BounceCondition.AGAINST_OBSTACLE, 999, 999);
      grenade.metadata = {isProjectile: true, isGrenade: true, lifetime: 0, damagedIds: new Map<string, number>(), colorTint: '#6b7a8f', effect: command.effect};
      engine.balls.set(grenade.id, grenade);
      engine.emitEvent({ type: 'ball_spawned', ball: grenade.getState() }, "update");
      engine.activeGrenadeId = grenade.id;
      continue;
    }

    if (command.type === "place_mine") {
      const baseDiameter = getPlayerBaseDiameter(engine.config);
      const mine = new Ball('gray', BallSize.SMALL, { ...command.position }, { x: 0, y: 0 }, baseDiameter * 1.75, 'player_projectile', BounceCondition.AGAINST_OBSTACLE, 999, 999);
      mine.metadata = { isProjectile: true, isMine: true, damagedIds: new Map<string, number>(), colorTint: '#ff4d7a', effect: command.effect };
      engine.balls.set(mine.id, mine);
      engine.emitEvent({ type: 'ball_spawned', ball: mine.getState() }, "update");
      engine.emitEvent({ type: 'mine_placed', mineId: mine.id, position: { ...mine.position } }, "update");
      continue;
    }

    if (command.type === "detonate_active_grenade") {
      const grenadeId = engine.activeGrenadeId;
      engine.activeGrenadeId = null;
      if (!grenadeId) continue;
      const grenade = engine.balls.get(grenadeId);
      if (!grenade || !grenade.isAlive) continue;

      if (grenade.metadata.touchedTarget === true) explodeGrenade(engine, grenade);
      else {
        grenade.isAlive = false;
        engine.emitEvent({ type: 'ball_despawned', ballId: grenade.id, reason: 'grenade_fizzled', position: { ...grenade.position }, velocity: { ...grenade.velocity }, effect: String(grenade.metadata?.effect ?? 'ring') }, "update");
      }
    }
  }
}

export function explodeGrenade(engine: PlayerProjectileApiContext, grenade: Ball): void {
  explodeAreaDamage(engine, grenade, 'grenade_exploded', String(grenade.metadata?.effect ?? 'ring'));
}

export function explodeMine(engine: PlayerProjectileApiContext, mine: Ball): void {
  explodeAreaDamage(engine, mine, 'mine_exploded', String(mine.metadata?.effect ?? 'mine'));
}

function explodeAreaDamage(engine: PlayerProjectileApiContext, source: Ball, reason: 'grenade_exploded' | 'mine_exploded', effect: string): void {
  const radius = getPlayerBaseDiameter(engine.config) * 3;
  for (const other of engine.balls.values()) {
    if (!other.isAlive || other.id===source.id || other.isProjectile() || other.color==='orange') continue;
    const dx = other.position.x - source.position.x; const dy = other.position.y - source.position.y;
    const reach = radius + other.diameter / 2;
    if (Math.sqrt(dx*dx+dy*dy) <= reach) engine.damageBall(other, 10, 'killed_by_grenade');
  }
  source.isAlive = false;
  engine.emitEvent({ type: 'ball_despawned', ballId: source.id, reason, position: { ...source.position }, velocity: { ...source.velocity }, effect }, "update");
}

export function handlePlayerProjectile(this: void, ball: Ball, delta: number, ctx: RuleContext): void {
  const metaAny = ball.metadata as Record<string, unknown>;
  if (metaAny.isMine === true) {
    const triggered = ctx.allBalls.some((other) => (
      other.id !== ball.id &&
      other.isAlive &&
      !other.isProjectile() &&
      other.color !== "orange" &&
      ball.isCollidingWith(other)
    ));
    if (triggered) {
      explodeMine({
        balls: new Map(ctx.allBalls.map((b) => [b.id, b])),
        config: ctx.config,
        pendingCommands: [],
        activeGrenadeId: null,
        getArena: () => ctx.arena,
        classifyShot: () => "light",
        damageBall: ctx.damageBall,
        emitEvent: (event) => ctx.events.push(event),
      }, ball);
    }
    return;
  }

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
    if (isOutOfBounds(ball, ctx.arena)) {
      ctx.despawnBall(ball, "grenade_out_of_bounds");
      ctx.clearActiveGrenade(ball.id);
      return;
    }
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
    forceStopsOnHit?: boolean;
    remainingWallBounces: number;
    lifetime: number;
    damagedIds: Map<string, number>;
    hitCount?: number;
    killCount?: number;
    comboPositionSum?: Vec2;
    comboFinalized?: boolean;
  };

  meta.lifetime += delta;
  const maxLife = ctx.config.rule_parameters.player_projectile?.max_lifetime_seconds ?? 4.0;
  if (meta.lifetime > maxLife) {
    finalizePlayerProjectileCombo(ball, ctx);
    ctx.despawnBall(ball, "projectile_expired");
    return;
  }

  ball.position.x += ball.velocity.x * delta;
  ball.position.y += ball.velocity.y * delta;

  triggerMagnetFieldsForProjectile(ball, ctx);

  const wallAxis = detectWallHit(ball, ctx.arena);
  if (wallAxis) {
    if (meta.remainingWallBounces > 0) {
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
      finalizePlayerProjectileCombo(ball, ctx);
      ctx.despawnBall(ball, "projectile_hit_wall");
      return;
    }
  }

  for (const other of ctx.allBalls) {
    if (other.id === ball.id || !other.isAlive) continue;
    if (other.color === "orange" || other.isProjectile()) continue;
    if (isTemporarilyUntouchable(other)) continue;
    const immunityUntil = meta.damagedIds.get(other.id) ?? 0;
    if (immunityUntil > ctx.elapsedTime) continue;

    const ignoreProjectileId = typeof other.metadata?.ignoreProjectileId === "string" ? other.metadata.ignoreProjectileId : null;
    const ignoreUntil = typeof other.metadata?.ignoreProjectileUntil === "number" ? other.metadata.ignoreProjectileUntil : 0;
    if (ignoreProjectileId === ball.id && ignoreUntil > ctx.elapsedTime) continue;

    if (ball.isCollidingWith(other)) {
      const hpBeforeHit = other.hp;
      const hitImmunitySeconds = getProjectileHitImmunitySeconds(ctx.config);
      meta.damagedIds.set(other.id, ctx.elapsedTime + hitImmunitySeconds);
      ctx.events.push({ type: "collision", ballAId: ball.id, ballBId: other.id });
      const killed = ctx.damageBall(other, meta.damage, "killed_by_player");
      meta.hitCount = (meta.hitCount ?? 0) + 1;
      meta.killCount = (meta.killCount ?? 0) + (killed ? 1 : 0);
      const comboPositionSum = meta.comboPositionSum ?? { x: 0, y: 0 };
      comboPositionSum.x += other.position.x;
      comboPositionSum.y += other.position.y;
      meta.comboPositionSum = comboPositionSum;
      trySplitRedAfterNonLethalHit(other, hpBeforeHit, ball.id, ctx);

      const isBouncy = !!ctx.config.ball_colors[other.color]?.bouncy_surface;
      if (isBouncy && other.isAlive) {
        reflectProjectileOff(ball, other);
        continue;
      }

      if (meta.forceStopsOnHit || !meta.passesThroughBalls) {
        finalizePlayerProjectileCombo(ball, ctx);
        ctx.despawnBall(ball, "projectile_hit_ball");
        return;
      }
    }
  }

  if (isOutOfBounds(ball, ctx.arena)) {
    finalizePlayerProjectileCombo(ball, ctx);
    ctx.despawnBall(ball, "projectile_out_of_bounds");
  }
}

export function finalizePlayerProjectileCombo(ball: Ball, ctx: RuleContext): void {
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
    ctx.setComboStreak(0);
    return;
  }

  const nextStreak = ctx.getComboStreak() + 1;
  ctx.setComboStreak(nextStreak);

  ctx.events.push({
    type: "combo_popup",
    projectileId: ball.id,
    label,
    streak: nextStreak,
    tier,
    position: { x: 0, y: 0 },
  });
}

export function trySplitRedAfterNonLethalHit(target: Ball, hpBeforeHit: number, sourceProjectileId: string, ctx: RuleContext): void {
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
  const ignoreUntil = ctx.elapsedTime + getProjectileHitImmunitySeconds(ctx.config);
  b1.metadata.ignoreProjectileId = sourceProjectileId;
  b1.metadata.ignoreProjectileUntil = ignoreUntil;
  b2.metadata.ignoreProjectileId = sourceProjectileId;
  b2.metadata.ignoreProjectileUntil = ignoreUntil;
  ctx.events.push({ type: "ball_split", originalId: target.id, newIds: [b1.id, b2.id] });
  ctx.despawnBall(target, "red_split_after_hit");
}

export function getProjectileHitImmunitySeconds(config: GameConfig): number {
  const ms = config.rule_parameters.player_projectile?.hit_immunity_ms ?? 200;
  return Math.max(0, ms) / 1000;
}

export function reflectProjectileOff(projectile: Ball, target: Ball): void {
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
