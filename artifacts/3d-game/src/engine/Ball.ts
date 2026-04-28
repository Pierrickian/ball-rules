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
// ============================================================

import { v4 as uuidv4 } from "uuid";
import type { BallColor, BallRule, BallState, Vec2 } from "./types";
import { BallSize } from "./types";

export class Ball {
  readonly id: string;
  color: BallColor;
  size: BallSize;
  position: Vec2;
  velocity: Vec2;
  rule: BallRule;
  isAlive: boolean;
  isFrozen: boolean;
  frozenTimer: number;
  ruleTransferred: boolean;
  diameter: number;
  baseDiameter: number;
  metadata: Record<string, unknown>;

  constructor(
    color: BallColor,
    size: BallSize,
    position: Vec2,
    velocity: Vec2,
    diameter: number,
    rule: BallRule
  ) {
    this.id = uuidv4();
    this.color = color;
    this.size = size;
    this.position = { ...position };
    this.velocity = { ...velocity };
    this.diameter = diameter;
    this.baseDiameter = diameter;
    this.rule = rule;
    this.isAlive = true;
    this.isFrozen = false;
    this.frozenTimer = 0;
    this.ruleTransferred = false;
    this.metadata = {};
  }

  /**
   * Transfer this ball's rule to another ball.
   * The other ball adopts the rule; this ball's rule becomes "neutral".
   * This is the ONLY sanctioned way to pass a rule between balls.
   * All rule changes must go through changeRule() or passRuleTo().
   */
  passRuleTo(other: Ball, logEnabled = false): void {
    if (logEnabled) {
      console.log(
        `[RULE TRANSFER] Ball ${this.id} (${this.color}) passes rule '${this.rule}' to Ball ${other.id} (${other.color})`
      );
    }
    const myRule = this.rule;
    other.changeRule(myRule, logEnabled);
    this.changeRule("neutral", logEnabled);
  }

  /**
   * Change this ball's rule.
   * This is the ONLY sanctioned way to change a ball's rule.
   * All rule modifications must pass through this method.
   */
  changeRule(newRule: BallRule, logEnabled = false): void {
    if (logEnabled) {
      console.log(
        `[RULE CHANGE] Ball ${this.id} (${this.color}): '${this.rule}' -> '${newRule}'`
      );
    }
    this.rule = newRule;
  }

  /**
   * Freeze this ball for a given duration in seconds.
   */
  freeze(durationSeconds: number): void {
    this.isFrozen = true;
    this.frozenTimer = durationSeconds;
  }

  /**
   * Snapshot of the ball's state for the React layer.
   */
  getState(): BallState {
    return {
      id: this.id,
      color: this.color,
      size: this.size,
      position: { ...this.position },
      velocity: { ...this.velocity },
      rule: this.rule,
      isAlive: this.isAlive,
      isFrozen: this.isFrozen,
      frozenTimer: this.frozenTimer,
      ruleTransferred: this.ruleTransferred,
      diameter: this.diameter,
      metadata: { ...this.metadata },
    };
  }

  /** Distance (center-to-center) to another ball */
  distanceTo(other: Ball): number {
    const dx = this.position.x - other.position.x;
    const dy = this.position.y - other.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** True if this ball overlaps with another */
  isCollidingWith(other: Ball): boolean {
    const minDist = (this.diameter + other.diameter) / 2;
    return this.distanceTo(other) < minDist;
  }
}
