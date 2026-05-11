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
// - BounceCondition enum drives ALL wall/ball collision logic.
// - 3D graphics are completely decoupled: this file has zero
//   imports from Three.js or React.
// - Physics is resolved in 2D (X/Y plane only).
// ============================================================

import { Ball } from "./Ball";
import type {
  BallColor,
  BallRule,
  GameConfig,
  GameEvent,
  GameState,
  ShotKind,
  ShotTypeConfig,
  Vec2,
} from "./types";
import type { RuntimeEngineModifiers } from "./runtimeModifiers";
import { BallSize, BounceCondition } from "./types";
import type { Arena2D, PendingCommand, RuleContext } from "./engineMath";
import {
  applyMovement,
  getArena,
  getBounceCondition,
  resolveBallCollisions,
} from "./collisionSystem";
import { maybeSpawnLevelBoss } from "./bossSystem";
import {
  performOrangeLaunch,
  spawnOrangeLauncher,
  updateOrangeSpawn,
  updatePendingLaunches,
} from "./launchSystem";
import {
  getPlayerBaseDiameter,
  getShotConfig,
  handlePlayerProjectile,
  playerShoot as shootPlayerProjectile,
  processPendingCommands as processProjectileCommands,
} from "./projectileSystem";
import {
  handleAbsorb,
  handleAccelerate,
  handleAttract,
  handleBlinkHpBouncer,
  handleBounce,
  handleDestroyOnContact,
  handleFreezeNearby,
  handleGravitySink,
  handleHpGrowBouncer,
  handleLauncher,
  handleMagnetField,
  handleNeutral,
  handleRedSplitBouncer,
  handleSlowNearby,
  handleSplit,
  handleTransferRule,
} from "./ruleHandlers";

type RuleHandler = (ball: Ball, delta: number, context: RuleContext) => void;


export class GameEngine {
  private balls = new Map<string, Ball>();
  private ruleHandlers = new Map<BallRule, RuleHandler>();
  private config: GameConfig;
  private orangeSpawnTimer = 0;
  /** Orange launchers waiting their delay before firing.
   *  Each entry tracks the launcher ball's id and remaining seconds. */
  private pendingLaunches: Array<{ launcherId: string; remaining: number }> = [];
  private activeGrenadeId: string | null = null;
  private grenadesLeft = 5;

  private launchedCount = 0;
  private pendingEvents: GameEvent[] = [];
  private pendingCommands: PendingCommand[] = [];
  private queuedExternalEvents: GameEvent[] = [];
  private isInsideUpdate = false;
  private logEnabled: boolean;
  private elapsedTime = 0;
  private sessionCleared = false;
  private currentLevelIndex = 0;
  // When true, the game ignores the levels system: the orange launcher
  // uses launch_config.color directly (no level weights), and getCurrentLevel
  // returns null so HUD/snapshot don't display stale level info. Used by
  // the "Couleur lancée" menu to play a single-color, single-level loop
  // without entering story mode.
  private singleColorMode = false;
  private bossSpawned = false;
  private bossDefeated = false;
  private bossIntroRemaining = 0;
  private bossHintRemaining = 0;
  private bossHintMessage = "";
  private bossMasteredRemaining = 0;
  private grenadeHelperShownForBossIds = new Set<string>();
  private hospital: { x: number; y: number; vx: number; vy: number; diameter: number; hp: number; maxHp: number; healPerContact: number; contactIds: Set<string> } | null = null;
  private difficultyBonusHp = 0;
  private hpAdjustment = 0;
  private comboStreak = 0;
  private runtimeModifiers: RuntimeEngineModifiers = {
    spawnIntervalMultiplier: 1,
    enemySpeedMultiplier: 1,
    enemyHpMultiplier: 1,
    gameplaySpeedMultiplier: 1,
    enemyDensityMultiplier: 1,
  };

  constructor(config: GameConfig, initialLevelIndex = 0) {
    this.config = config;
    this.logEnabled = config.debug?.log_rule_changes ?? false;
    const levelCount = config.levels?.list?.length ?? 0;
    this.currentLevelIndex = levelCount > 0
      ? ((initialLevelIndex % levelCount) + levelCount) % levelCount
      : 0;
    this.configureHospitalForCurrentLevel();
    this.registerAllHandlers();
  }

  private getBounceCondition(color: BallColor): BounceCondition {
    return getBounceCondition.call({ config: this.config, pendingEvents: this.pendingEvents }, color);
  }
  private getArena(): Arena2D {
    return getArena.call({ config: this.config, pendingEvents: this.pendingEvents });
  }
  private applyMovement = applyMovement;
  private resolveBallCollisions(balls: Ball[], arena: Arena2D): void {
    resolveBallCollisions.call({ config: this.config, pendingEvents: this.pendingEvents }, balls, arena);
  }
  private maybeSpawnLevelBoss = maybeSpawnLevelBoss;
  private updateOrangeSpawn = updateOrangeSpawn;
  private spawnOrangeLauncher = spawnOrangeLauncher;
  private updatePendingLaunches = updatePendingLaunches;
  private performOrangeLaunch = performOrangeLaunch;
  private handlePlayerProjectile = handlePlayerProjectile;
  private handleBounce = handleBounce;
  private handleAccelerate = handleAccelerate;
  private handleLauncher = handleLauncher;
  private handleDestroyOnContact = handleDestroyOnContact;
  private handleSlowNearby = handleSlowNearby;
  private handleAttract = handleAttract;
  private handleMagnetField = handleMagnetField;
  private handleSplit = handleSplit;
  private handleFreezeNearby = handleFreezeNearby;
  private handleTransferRule = handleTransferRule;
  private handleGravitySink = handleGravitySink;
  private handleNeutral = handleNeutral;
  private handleAbsorb = handleAbsorb;
  private handleHpGrowBouncer = handleHpGrowBouncer;
  private handleBlinkHpBouncer = handleBlinkHpBouncer;
  private handleRedSplitBouncer = handleRedSplitBouncer;

  // Hospital, damage, and spawn helpers remain in GameEngine because they
  // directly mutate session state, emit events, and are shared by several
  // systems. Narrowing those contracts is the next safe extraction step.

  // --------------------------------------------------------
  // Handler Registration
  // --------------------------------------------------------
  private registerAllHandlers(): void {
    this.registerRuleHandler("bounce",            this.handleBounce);
    this.registerRuleHandler("accelerate",        this.handleAccelerate);
    this.registerRuleHandler("launcher",          this.handleLauncher);
    this.registerRuleHandler("destroy_on_contact",this.handleDestroyOnContact);
    this.registerRuleHandler("slow_nearby",       this.handleSlowNearby);
    this.registerRuleHandler("attract",           this.handleAttract);
    this.registerRuleHandler("split",             this.handleSplit);
    this.registerRuleHandler("freeze_nearby",     this.handleFreezeNearby);
    this.registerRuleHandler("transfer_rule",     this.handleTransferRule);
    this.registerRuleHandler("gravity_sink",      this.handleGravitySink);
    this.registerRuleHandler("neutral",           this.handleNeutral);
    this.registerRuleHandler("absorb",            this.handleAbsorb);
    this.registerRuleHandler("hp_grow_bouncer",   this.handleHpGrowBouncer);
    this.registerRuleHandler("blink_hp_bouncer",  this.handleBlinkHpBouncer);
    this.registerRuleHandler("red_split_bouncer", this.handleRedSplitBouncer);
    this.registerRuleHandler("player_projectile", this.handlePlayerProjectile);
    this.registerRuleHandler("magnet_field",      this.handleMagnetField);
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
    const lvl = this.getCurrentLevel();
    return {
      balls,
      events: [...this.pendingEvents],
      time: this.elapsedTime,
      orangeSpawnTimer: this.orangeSpawnTimer,
      score: 0,
      launchedCount: this.launchedCount,
      maxBallsSpawned: this.config.game_session?.max_balls_spawned ?? 20,
      sessionCleared: this.sessionCleared,
      currentLevelIndex: this.currentLevelIndex,
      currentLevelId: lvl?.id ?? 0,
      currentLevelName: lvl?.name ?? "",
      bossIntroActive: this.bossIntroRemaining > 0,
      bossHintActive: this.bossHintRemaining > 0 && this.bossHintMessage.length > 0,
      bossHintMessage: this.bossHintRemaining > 0 ? this.bossHintMessage : "",
      bossMasteredActive: this.bossMasteredRemaining > 0,
      isBossPhase: this.isBossPhase(),
      hospital: this.hospital ? {
        isActive: this.hospital.hp > 0,
        x: this.hospital.x,
        y: this.hospital.y,
        diameter: this.hospital.diameter,
        hp: this.hospital.hp,
        maxHp: this.hospital.maxHp,
      } : undefined,
    };
  }

  /** Active level entry, or null when no `levels.list` is configured
   *  or when the engine is in single-color (non-story) mode. */
  getCurrentLevel(): import("./types").LevelEntry | null {
    if (this.singleColorMode) return null;
    const list = this.config.levels?.list;
    if (!list || list.length === 0) return null;
    const i = ((this.currentLevelIndex % list.length) + list.length) % list.length;
    return list[i];
  }

  getCurrentLevelIndex(): number {
    return this.currentLevelIndex;
  }

  /** Toggle single-color mode (orange launcher uses launch_config.color
   *  directly, level weights and level metadata are ignored). */
  setSingleColorMode(on: boolean): void {
    this.singleColorMode = on;
  }

  isSingleColorMode(): boolean {
    return this.singleColorMode;
  }

  updateConfig(config: GameConfig): void {
    this.config = config;
    this.logEnabled = config.debug?.log_rule_changes ?? false;
    this.configureHospitalForCurrentLevel();
  }
  setDifficultyBonusHp(bonus: number): void { this.difficultyBonusHp = Math.max(0, Math.floor(bonus)); }

  setRuntimeModifiers(modifiers: RuntimeEngineModifiers): void {
    this.runtimeModifiers = modifiers;
  }

  addGrenades(amount: number): void {
    const safe = Math.max(0, Math.floor(amount));
    if (safe <= 0) return;
    this.grenadesLeft += safe;
    this.pendingEvents.push({ type: "grenade_awarded", amount: safe, reason: "runtime_alveole" });
  }

  /** Relative HP tuning selected by the player for the current retry/level. */
  setHpAdjustment(adjustment: number): void {
    this.hpAdjustment = Math.max(-10, Math.min(10, Math.round(adjustment)));
  }

  getLaunchedCount(): number {
    return this.launchedCount;
  }

  /** Number of "enemy" balls currently alive (excludes orange launchers and player projectiles). */
  isBossPhase(): boolean {
    if (this.bossIntroRemaining > 0 || this.bossMasteredRemaining > 0) return true;
    for (const b of this.balls.values()) {
      if (b.isAlive && b.isBoss) return true;
    }
    return false;
  }

  getEnemyBallCount(): number {
    let n = 0;
    this.balls.forEach((b) => {
      if (!b.isAlive) return;
      if (b.color === "orange") return;
      if (b.isProjectile()) return;
      n++;
    });
    return n;
  }

  /** Has the session reached its spawn cap AND is now cleared? */
  isSessionFinished(): boolean {
    const max = this.config.game_session?.max_balls_spawned ?? 20;
    if (this.launchedCount < max) return false;
    const bossConfigured = !!this.getCurrentLevel()?.boss;
    if (!bossConfigured) return this.getEnemyBallCount() === 0;
    if (!this.bossSpawned) return false;
    if (!this.bossDefeated) return false;
    if (this.bossMasteredRemaining > 0) return false;
    return this.getEnemyBallCount() === 0;
  }

  // --------------------------------------------------------
  // Player Shooting API
  // --------------------------------------------------------

  /**
   * Fire a player projectile from the bottom-center of the arena toward
   * the given target point (in game coordinates: x = horizontal, y = vertical).
   * holdSeconds determines the shot kind via gameplay_controls.shot_types.
   * color is the next ball from the player's queue.
   */
  playerShoot(targetX: number, targetY: number, holdSeconds: number, color: BallColor): Ball | null {
    return shootPlayerProjectile(this.projectileApiContext(), targetX, targetY, holdSeconds, color);
  }

  classifyShot(holdSeconds: number): ShotKind {
    const types = this.config.gameplay_controls?.shot_types;
    if (!types) return "light";
    // Return the highest tier whose min_hold_seconds is satisfied
    if (holdSeconds >= types.mega.min_hold_seconds) return "mega";
    if (holdSeconds >= types.heavy.min_hold_seconds) return "heavy";
    return "light";
  }

  getShotConfig(kind: ShotKind): ShotTypeConfig | null {
    return getShotConfig(this.config, kind);
  }

  getGrenadesLeft(): number { return this.grenadesLeft; }

  private emitEvent(event: GameEvent, source: "update" | "external"): void {
    if (source === "update") {
      this.pendingEvents.push(event);
      return;
    }
    this.queuedExternalEvents.push(event);
  }

  private getPlayerBaseDiameter(): number {
    return getPlayerBaseDiameter(this.config);
  }

  private projectileApiContext() {
    return {
      balls: this.balls,
      config: this.config,
      pendingCommands: this.pendingCommands,
      activeGrenadeId: this.activeGrenadeId,
      getArena: () => this.getArena(),
      classifyShot: (holdSeconds: number) => this.classifyShot(holdSeconds),
      damageBall: (ball: Ball, amount: number, reason?: string) => this.damageBall(ball, amount, reason),
      emitEvent: (event: GameEvent, source: "update" | "external") => this.emitEvent(event, source),
    };
  }

  // ARCHITECTURE NOTE: any gameplay mutation that must produce visual effects
  // must be funneled through update() to guarantee event delivery to rendering.
  toggleGrenade(direction: Vec2, effect: string = 'ring'): boolean {
    if (this.activeGrenadeId) {
      this.pendingCommands.push({ type: "detonate_active_grenade" });
      return true;
    }
    if (this.grenadesLeft <= 0) return false;
    this.pendingCommands.push({ type: "launch_grenade", direction: { ...direction }, effect });
    this.grenadesLeft--;
    return true;
  }

  private processPendingCommands(): void {
    const ctx = this.projectileApiContext();
    processProjectileCommands(ctx);
    this.activeGrenadeId = ctx.activeGrenadeId;
  }

  // --------------------------------------------------------
  // Main Update Loop
  // --------------------------------------------------------
  update(delta: number): GameState {
    delta *= this.runtimeModifiers.gameplaySpeedMultiplier;
    this.pendingEvents = [...this.queuedExternalEvents];
    this.queuedExternalEvents = [];
    this.isInsideUpdate = true;
    this.elapsedTime += delta;
    const arena = this.getArena();

    // Process cross-frame gameplay intentions before rule handlers.
    this.processPendingCommands();

    // Spawn orange launchers (capped by max_balls_spawned)
    this.updateOrangeSpawn(delta, arena);
    // Fire orange launchers whose visibility delay has elapsed.
    this.updatePendingLaunches(delta, arena);
    // Spawn level boss when regular wave is fully cleared.
    this.maybeSpawnLevelBoss(arena, delta);
    this.updateHospitalMotion(delta, arena);
    if (this.bossHintRemaining > 0) this.bossHintRemaining = Math.max(0, this.bossHintRemaining - delta);
    if (this.bossMasteredRemaining > 0) this.bossMasteredRemaining = Math.max(0, this.bossMasteredRemaining - delta);

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
      spawnBall: (c, s2, p, v, overrideRule, overrideHp) =>
        this.spawnBall(c, s2, p, v, overrideRule, overrideHp),
      despawnBall: (ball, reason) => {
        ball.isAlive = false;
        this.pendingEvents.push({ type: "ball_despawned", ballId: ball.id, reason, position: { ...ball.position }, velocity: { ...ball.velocity }, effect: String(ball.metadata?.effect ?? "") });
      },
      damageBall: (ball, amount, reason = "damaged") => this.damageBall(ball, amount, reason),
      elapsedTime: this.elapsedTime,
      logEnabled: this.logEnabled,
      computeHpGrowDiameter: (ball) => this.computeHpGrowDiameter(ball),
      getComboStreak: () => this.comboStreak,
      setComboStreak: (streak) => { this.comboStreak = streak; },
      clearActiveGrenade: (grenadeId) => { if (this.activeGrenadeId === grenadeId) this.activeGrenadeId = null; },
    };

    // Step 1: Apply rule handlers
    for (const ball of allBalls) {
      if (!ball.isAlive || ball.isFrozen) continue;
      const handler = this.ruleHandlers.get(ball.rule);
      if (handler) handler(ball, delta, context);
      else this.applyMovement(ball, delta, arena);
    }

    // Step 2: Resolve ball-to-ball collisions (skip projectiles — they handle their own)
    this.resolveBallCollisions(allBalls, arena);
    this.resolveHospitalInteractions(allBalls);


    this.balls.forEach((ball) => {
      if (ball.isAlive && ball.isBoss) this.syncBossDiameterWithHp(ball);
    });

    // Step 3: Remove dead balls
    this.balls.forEach((ball, id) => {
      if (!ball.isAlive) this.balls.delete(id);
    });

    // Step 4: Session-clear flag
    if (this.bossSpawned) {
      this.bossDefeated = !Array.from(this.balls.values()).some((b) => b.isAlive && b.isBoss);
    }
    this.sessionCleared = this.bossMasteredRemaining <= 0 && this.isSessionFinished();

    const state = this.getState();
    this.isInsideUpdate = false;
    return state;
  }

  private configureHospitalForCurrentLevel(): void {
    const hospital = this.getCurrentLevel()?.hospital;
    if (!hospital) {
      this.hospital = null;
      return;
    }
    const maxHp = hospital.maxHp ?? hospital.hp;
    const diameterFromBossHp = hospital.diameter_from_boss_hp ?? 100;
    const baseBossDiameter = this.config.graphics.ball_sizes[BallSize.LARGE]?.diameter ?? 1;
    const diameter = baseBossDiameter * Math.max(0.1, diameterFromBossHp / 100);
    this.hospital = {
      x: hospital.x,
      y: hospital.y,
      vx: 0,
      vy: 0,
      diameter,
      hp: hospital.hp,
      maxHp,
      healPerContact: hospital.heal_per_contact ?? 1,
      contactIds: new Set<string>(),
    };
  }

  private resolveHospitalInteractions(balls: Ball[]): void {
    if (!this.hospital || this.hospital.hp <= 0) return;
    const currentContacts = new Set<string>();
    const restitution = this.config.rule_parameters.ball_collision?.restitution ?? 0.95;
    for (const ball of balls) {
      if (!ball.isAlive || ball.color === "orange") continue;
      const dx = ball.position.x - this.hospital.x;
      const dy = ball.position.y - this.hospital.y;
      const minDist = (ball.diameter + this.hospital.diameter) / 2;
      const distSq = (dx * dx + dy * dy);
      if (distSq > (minDist * minDist)) continue;
      currentContacts.add(ball.id);

      const dist = Math.sqrt(Math.max(distSq, 1e-9));
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      if (overlap > 0) {
        ball.position.x += nx * overlap;
        ball.position.y += ny * overlap;
      }

      const dot = ball.velocity.x * nx + ball.velocity.y * ny;
      if (dot < 0) {
        ball.velocity.x = (ball.velocity.x - (1 + restitution) * dot * nx);
        ball.velocity.y = (ball.velocity.y - (1 + restitution) * dot * ny);
      }

      if (ball.isProjectile()) {
        this.hospital.vx -= ball.velocity.x * 0.015;
        this.hospital.vy -= ball.velocity.y * 0.015;
        ball.isAlive = false;
        this.pendingEvents.push({ type: "ball_despawned", ballId: ball.id, reason: "projectile_hit_hospital", position: { ...ball.position }, velocity: { ...ball.velocity }, effect: String(ball.metadata?.effect ?? "") });
        continue;
      }
      if (this.hospital.contactIds.has(ball.id)) continue;
      const beforeHp = ball.hp;
      const gained = ball.heal(this.hospital.healPerContact);
      if (gained <= 0) {
        ball.maxHp += this.hospital.healPerContact;
        ball.hp = Math.min(ball.maxHp, ball.hp + this.hospital.healPerContact);
      }
      if (ball.color === "red" && !ball.isBoss) {
        ball.maxHp = Math.min(ball.maxHp, 8);
        ball.hp = Math.min(ball.hp, ball.maxHp);
      }
      const applied = ball.hp - beforeHp;
      if (applied <= 0) continue;
      this.pendingEvents.push({ type: "ball_healed", ballId: ball.id, amount: applied, remainingHp: ball.hp, position: { ...ball.position } });
      this.hospital.hp = Math.max(0, this.hospital.hp - 1);
      if (this.hospital.hp <= 0) { this.hospital = null; return; }
    }
    this.hospital.contactIds = currentContacts;
  }

  private updateHospitalMotion(delta: number, arena: Arena2D): void {
    if (!this.hospital) return;
    this.hospital.x += this.hospital.vx * delta;
    this.hospital.y += this.hospital.vy * delta;
    this.hospital.vx *= 0.985;
    this.hospital.vy *= 0.985;
    const r = this.hospital.diameter / 2;
    if (this.hospital.x - r < -arena.halfW) { this.hospital.x = -arena.halfW + r; this.hospital.vx = Math.abs(this.hospital.vx) * 0.7; }
    if (this.hospital.x + r > arena.halfW) { this.hospital.x = arena.halfW - r; this.hospital.vx = -Math.abs(this.hospital.vx) * 0.7; }
    if (this.hospital.y - r < -arena.halfH) { this.hospital.y = -arena.halfH + r; this.hospital.vy = Math.abs(this.hospital.vy) * 0.7; }
    if (this.hospital.y + r > arena.halfH) { this.hospital.y = arena.halfH - r; this.hospital.vy = -Math.abs(this.hospital.vy) * 0.7; }
  }

  /** Apply damage and despawn at 0 HP. Returns true if killed. */
  private damageBall(ball: Ball, amount: number, reason = "damaged"): boolean {
    if (!ball.isAlive) return false;
    const died = ball.takeDamage(amount);
    this.emitEvent({
      type: "ball_damaged",
      ballId: ball.id,
      amount,
      remainingHp: ball.hp,
      position: { ...ball.position },
    }, this.isInsideUpdate ? "update" : "external");
    if (died && this.shouldPreventBossDeath(ball, reason)) {
      const rechargeHp = Math.max(1, Number(ball.metadata.nonMatchingKillRechargeHp ?? 10));
      ball.hp = Math.min(ball.maxHp, rechargeHp);
      this.emitEvent({
        type: "ball_healed",
        ballId: ball.id,
        amount: ball.hp,
        remainingHp: ball.hp,
        position: { ...ball.position },
      }, this.isInsideUpdate ? "update" : "external");
      this.awardGrenades(1, "boss_recharge");
      this.syncBossDiameterWithHp(ball);
      this.maybeFlashGrenadeHelper(ball);
      return false;
    }
    if (died) {
      ball.isAlive = false;
      if (ball.isBoss) this.startBossMasteredOverlay();
      this.emitEvent({ type: "ball_despawned", ballId: ball.id, reason, position: { ...ball.position }, velocity: { ...ball.velocity }, effect: String(ball.metadata?.effect ?? "") }, this.isInsideUpdate ? "update" : "external");
    } else if (ball.isBoss) {
      this.syncBossDiameterWithHp(ball);
      this.maybeFlashGrenadeHelper(ball);
    } else if (ball.rule === "hp_grow_bouncer") {
      // Keep visual diameter in sync with current HP so damage is visible.
      ball.diameter = this.computeHpGrowDiameter(ball);
    }
    return died;
  }

  private awardGrenades(amount: number, reason: string): void {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) return;
    this.grenadesLeft += safeAmount;
    this.emitEvent({ type: "grenade_awarded", amount: safeAmount, reason }, this.isInsideUpdate ? "update" : "external");
  }

  private maybeFlashGrenadeHelper(ball: Ball): void {
    if (!ball.isBoss || !ball.isAlive) return;
    if (ball.metadata.defeatRule !== "grenade_last_hit") return;
    if (this.grenadesLeft <= 0) return;
    const threshold = Math.max(1, Number(ball.metadata.nonMatchingKillRechargeHp ?? 10));
    if (ball.hp > threshold) return;
    if (this.grenadeHelperShownForBossIds.has(ball.id)) return;
    this.grenadeHelperShownForBossIds.add(ball.id);
    this.emitEvent({ type: "grenade_helper_flash", reason: "boss_vulnerable" }, this.isInsideUpdate ? "update" : "external");
  }

  private startBossMasteredOverlay(): void {
    this.bossMasteredRemaining = Math.max(0, this.config.levels?.boss_mastered_overlay_seconds ?? 2);
  }


  private shouldPreventBossDeath(ball: Ball, reason: string): boolean {
    if (!ball.isBoss) return false;
    if (ball.metadata.defeatRule !== "grenade_last_hit") return false;
    return reason !== "killed_by_grenade";
  }

  // --------------------------------------------------------
  // Ball Spawning
  // --------------------------------------------------------
  spawnBall(
    color: BallColor,
    size: BallSize,
    position: Vec2,
    velocity: Vec2,
    overrideRule?: BallRule,
    overrideHp?: { hp: number; maxHp: number },
    options?: { isBoss?: boolean; bypassHpBonuses?: boolean }
  ): Ball {
    const diameter = this.config.graphics.ball_sizes[size]?.diameter ?? 0.5;
    const rule = overrideRule ?? this.config.ball_rules[color]?.rule ?? "neutral";
    const bounceCondition = this.getBounceCondition(color);

    // HP defaults: 1 / 1, but dark_green (hp_grow_bouncer) reads from rule_parameters
    let hp = 1;
    let maxHp = 1;
    if (overrideHp) {
      hp = overrideHp.hp;
      maxHp = overrideHp.maxHp;
    } else if (rule === "hp_grow_bouncer") {
      const p = this.config.rule_parameters.hp_grow_bouncer;
      hp = p?.default_hp ?? 2;
      maxHp = p?.max_hp ?? 5;
    } else if (rule === "blink_hp_bouncer") {
      const p = this.config.rule_parameters.yellow_blinker;
      hp = p?.default_hp ?? 4;
      maxHp = p?.max_hp ?? 4;
    } else if (rule === "red_split_bouncer") {
      const p = this.config.rule_parameters.red_split_bouncer;
      hp = p?.default_hp ?? 5;
      maxHp = p?.max_hp ?? 5;
    }

    if (options?.bypassHpBonuses !== true) {
      const relativeHp = 1 + this.difficultyBonusHp + this.hpAdjustment;
      hp = Math.max(1, hp + relativeHp);
      maxHp = Math.max(1, maxHp + relativeHp);
    }
    if (color === "red" && options?.isBoss !== true) {
      maxHp = Math.min(maxHp, 8);
      hp = Math.min(hp, maxHp);
    }
    if (options?.bypassHpBonuses !== true && options?.isBoss !== true && rule !== "player_projectile" && color !== "orange") {
      hp = Math.max(1, Math.round(hp * this.runtimeModifiers.enemyHpMultiplier));
      maxHp = Math.max(1, Math.round(maxHp * this.runtimeModifiers.enemyHpMultiplier));
      velocity = {
        x: velocity.x * this.runtimeModifiers.enemySpeedMultiplier,
        y: velocity.y * this.runtimeModifiers.enemySpeedMultiplier,
      };
    }
    const ball = new Ball(color, size, position, velocity, diameter, rule, bounceCondition, hp, maxHp, options?.isBoss === true);

    // Initial diameter scaling for hp_grow_bouncer
    if (rule === "hp_grow_bouncer" && !ball.isBoss) {
      ball.diameter = this.computeHpGrowDiameter(ball);
    }

    this.balls.set(ball.id, ball);
    this.pendingEvents.push({ type: "ball_spawned", ball: ball.getState() });
    return ball;
  }


  private syncBossDiameterWithHp(ball: Ball): void {
    const ratio = ball.maxHp > 0 ? ball.hp / ball.maxHp : 0;
    ball.diameter = ball.baseDiameter * Math.max(0.35, ratio);
  }
  private computeHpGrowDiameter(ball: Ball): number {
    const p = this.config.rule_parameters.hp_grow_bouncer;
    if (!p) return ball.baseDiameter;
    const factor = 1 + (ball.hp - p.default_hp) * p.diameter_per_extra_hp;
    return ball.baseDiameter * Math.max(0.4, factor);
  }

}
