// ============================================================
// BALL — Game Object
//
// ARCHITECTURE NOTE:
// - Ball is a pure data + logic class. It has NO knowledge of
//   Three.js, React, or rendering.
// - Every new ball must be instantiated via new Ball(...) and
//   registered with the GameEngine.
// - Behaviors are applied by the GameEngine handlers based on
//   the ball's `rule` field, which comes from game_config.json.
// - To add a new behavior: add the rule to game_config.json
//   FIRST, then add a handler in game_engine.ts.
// - A ball's rule can change at runtime via changeRule() or
//   passRuleTo(). Both methods are the ONLY sanctioned way to
//   change rules.
// - A ball's bounceCondition comes from bounce_conditions.ball_bounce_conditions
//   in game_config.json. Do NOT set it directly — use the config.
// - HP system: every ball has hp/maxHp. Damage is applied by the
//   engine's damageBall() helper. Despawned at 0 HP.
// ============================================================

import { v4 as uuidv4 } from "uuid";
import type { BallColor, BallRule, BallState, Vec2 } from "./types";
import { BallSize, BounceCondition } from "./types";

export class Ball {
  readonly id: string;
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
  baseDiameter: number;
  hp: number;
  maxHp: number;
  metadata: Record<string, unknown>;
  isBoss: boolean;

  constructor(
    color: BallColor,
    size: BallSize,
    position: Vec2,
    velocity: Vec2,
    diameter: number,
    rule: BallRule,
    bounceCondition: BounceCondition = BounceCondition.AGAINST_WALL,
    hp = 1,
    maxHp = 1,
    isBoss = false
  ) {
    this.id = uuidv4();
    this.color = color;
    this.size = size;
    this.position = { ...position };
    this.velocity = { ...velocity };
    this.diameter = diameter;
    this.baseDiameter = diameter;
    this.rule = rule;
    this.bounceCondition = bounceCondition;
    this.isAlive = true;
    this.isFrozen = false;
    this.frozenTimer = 0;
    this.ruleTransferred = false;
    this.hp = hp;
    this.maxHp = maxHp;
    this.metadata = {};
    this.isBoss = isBoss;
  }

  /** Transfer this ball's rule to another. The other adopts the rule; this becomes "neutral". */
  passRuleTo(other: Ball, logEnabled = false): void {
    if (logEnabled) {
      console.log(`[RULE TRANSFER] Ball ${this.id} (${this.color}) passes '${this.rule}' → Ball ${other.id} (${other.color})`);
    }
    const myRule = this.rule;
    other.changeRule(myRule, logEnabled);
    this.changeRule("neutral", logEnabled);
  }

  /** ONLY sanctioned way to change a ball's rule. */
  changeRule(newRule: BallRule, logEnabled = false): void {
    if (logEnabled) {
      console.log(`[RULE CHANGE] Ball ${this.id} (${this.color}): '${this.rule}' → '${newRule}'`);
    }
    this.rule = newRule;
  }

  freeze(durationSeconds: number): void {
    this.isFrozen = true;
    this.frozenTimer = durationSeconds;
  }

  /** Apply damage. Returns true if the ball died (hp ≤ 0). */
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }

  /** Heal up to maxHp. Returns the amount actually healed. */
  heal(amount: number): number {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  /** Snapshot for the React layer. */
  getState(): BallState {
    return {
      id: this.id,
      color: this.color,
      size: this.size,
      position: { ...this.position },
      velocity: { ...this.velocity },
      rule: this.rule,
      bounceCondition: this.bounceCondition,
      isAlive: this.isAlive,
      isFrozen: this.isFrozen,
      frozenTimer: this.frozenTimer,
      ruleTransferred: this.ruleTransferred,
      diameter: this.diameter,
      hp: this.hp,
      maxHp: this.maxHp,
      metadata: { ...this.metadata },
      isBoss: this.isBoss,
    };
  }

  distanceTo(other: Ball): number {
    const dx = this.position.x - other.position.x;
    const dy = this.position.y - other.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  isCollidingWith(other: Ball): boolean {
    const minDist = (this.diameter + other.diameter) / 2;
    return this.distanceTo(other) < minDist;
  }

  isProjectile(): boolean {
    return this.rule === "player_projectile" || this.metadata.isProjectile === true;
  }
}
