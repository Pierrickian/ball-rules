import { GameEngine } from "./game_engine";
import type { BallColor, GameConfig, GameEvent, Vec2 } from "./types";

type LingeringGrenadeZone = {
  id: string;
  position: Vec2;
  radius: number;
  remaining: number;
  affectedIds: Set<string>;
};

type RuntimeBall = {
  id: string;
  color: BallColor;
  isAlive: boolean;
  position: Vec2;
  isProjectile?: () => boolean;
};

type RuntimeAccess = {
  balls?: Map<string, RuntimeBall>;
  damageBall?: (ball: RuntimeBall, amount: number, reason?: string) => boolean;
};

export function createGrenadeZoneStore(): LingeringGrenadeZone[] {
  return [];
}

function getRadius(config: GameConfig): number {
  const baseSize = config.gameplay_controls.queue_ball_size ?? "small";
  const baseDiameter = config.graphics.ball_sizes[baseSize]?.diameter ?? 1;
  return baseDiameter * 12;
}

function isTarget(ball: RuntimeBall): boolean {
  if (!ball.isAlive) return false;
  if (ball.color === "orange") return false;
  if (typeof ball.isProjectile === "function" && ball.isProjectile()) return false;
  return true;
}

export function addGrenadeZones(events: GameEvent[], zones: LingeringGrenadeZone[], config: GameConfig): void {
  const alreadyAffected = new Set<string>();
  for (const event of events) {
    if (event.type === "ball_damaged") alreadyAffected.add(event.ballId);
  }

  for (const event of events) {
    if (event.type !== "ball_despawned") continue;
    if (event.reason !== "grenade_exploded") continue;
    if (!event.position) continue;
    if (zones.some((zone) => zone.id === event.ballId)) continue;
    zones.push({
      id: event.ballId,
      position: { ...event.position },
      radius: getRadius(config),
      remaining: 0.8,
      affectedIds: new Set(alreadyAffected),
    });
  }
}

export function updateGrenadeZones(engine: GameEngine, zones: LingeringGrenadeZone[], delta: number): void {
  const runtime = engine as unknown as RuntimeAccess;
  if (!runtime.balls || !runtime.damageBall) return;

  for (const zone of zones) {
    zone.remaining -= delta;
    for (const ball of runtime.balls.values()) {
      if (!isTarget(ball)) continue;
      if (zone.affectedIds.has(ball.id)) continue;

      const dx = ball.position.x - zone.position.x;
      const dy = ball.position.y - zone.position.y;
      if (Math.sqrt(dx * dx + dy * dy) > zone.radius) continue;

      runtime.damageBall.call(engine, ball, 2, "killed_by_grenade");
      zone.affectedIds.add(ball.id);
    }
  }

  for (let i = zones.length - 1; i >= 0; i -= 1) {
    if (zones[i].remaining <= 0) zones.splice(i, 1);
  }
}
