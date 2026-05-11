import { Ball } from "./Ball";
import type { BallColor, Vec2 } from "./types";
import { BallSize } from "./types";
import { normalize, randomInRange, weightedPickColor } from "./engineMath";

interface Arena2D {
  halfW: number;
  halfH: number;
}

export function updateOrangeSpawn(this: any, delta: number, arena: Arena2D): void {
  const max = this.config.game_session?.max_balls_spawned ?? 20;
  if (this.launchedCount >= max) return; // hard cap

  const interval = this.config.gameplay.orange.spawn.interval_seconds * (this.runtimeModifiers?.spawnIntervalMultiplier ?? 1);
  this.orangeSpawnTimer += delta;
  if (this.orangeSpawnTimer >= interval) {
    this.orangeSpawnTimer = 0;
    this.spawnOrangeLauncher(arena);
  }
}

export function spawnOrangeLauncher(this: any, arena: Arena2D): void {
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

export function updatePendingLaunches(this: any, delta: number, arena: Arena2D): void {
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

export function performOrangeLaunch(this: any, launcher: Ball, arena: Arena2D): void {
  const launchCfg = this.config.gameplay.orange.launch_config;

  // Color pick — priority order:
  //   1. Active level's launch_color_weights (if `levels.list` is non-empty)
  //   2. launch_config.color === "random" → uniform pick from allow_colors
  //   3. Otherwise → fixed color from launch_config.color
  let color: BallColor;
  const lvl = this.getCurrentLevel();
  const weights = lvl?.launch_color_weights;
  if (weights && Object.keys(weights).length > 0) {
    color = weightedPickColor(this.config, weights) ?? "white";
  } else if (launchCfg.color === "random") {
    const allowed = launchCfg.allow_colors ?? (Object.keys(this.config.ball_colors) as BallColor[]);
    color = allowed[Math.floor(Math.random() * allowed.length)];
  } else {
    color = launchCfg.color as BallColor;
  }

  const levelOverride = lvl?.launch_overrides?.[color];
  const size = (levelOverride?.size as BallSize) ?? (launchCfg.size as BallSize) ?? BallSize.SMALL;
  const speed = (launchCfg.speed ?? 4.5) * (this.runtimeModifiers?.enemySpeedMultiplier ?? 1);
  const toCenter = normalize({ x: -launcher.position.x, y: -launcher.position.y });
  const randomAngle = (Math.random() - 0.5) * Math.PI * 0.8;
  const cos = Math.cos(randomAngle);
  const sin = Math.sin(randomAngle);
  const perpX = -toCenter.y;
  const perpY = toCenter.x;
  const dir: Vec2 = { x: toCenter.x * cos + perpX * sin, y: toCenter.y * cos + perpY * sin };

  void arena;
  const overrideHp =
    typeof levelOverride?.hp === "number" || typeof levelOverride?.maxHp === "number"
      ? { hp: levelOverride?.hp ?? levelOverride?.maxHp ?? 1, maxHp: levelOverride?.maxHp ?? levelOverride?.hp ?? 1 }
      : undefined;

  const launched = this.spawnBall(color, size, { ...launcher.position }, { x: dir.x * speed, y: dir.y * speed }, undefined, overrideHp);
  if (levelOverride?.diameter_multiplier && levelOverride.diameter_multiplier > 0) {
    launched.baseDiameter *= levelOverride.diameter_multiplier;
    launched.diameter *= levelOverride.diameter_multiplier;
  }
  this.launchedCount++;
  this.pendingEvents.push({ type: "orange_launched", launcherId: launcher.id, launchedId: launched.id });

  launcher.isAlive = false;
  this.pendingEvents.push({ type: "ball_despawned", ballId: launcher.id, reason: "after_launch" });
}
