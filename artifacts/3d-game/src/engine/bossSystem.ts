import { BallSize } from "./types";

interface Arena2D {
  halfW: number;
  halfH: number;
}

function resolveBossColor(lvl: any, boss: any): string {
  const defaultColor = boss.color;
  const weights = lvl?.launch_color_weights;
  if (!weights || typeof weights !== "object") return defaultColor;

  const nonWhiteColors = Object.entries(weights)
    .filter(([color, weight]) => color !== "white" && typeof weight === "number" && weight > 0)
    .map(([color]) => color);

  if (nonWhiteColors.length === 0) return defaultColor;
  if (defaultColor !== "white" && nonWhiteColors.includes(defaultColor)) return defaultColor;

  return nonWhiteColors[Math.floor(Math.random() * nonWhiteColors.length)];
}

export function maybeSpawnLevelBoss(this: any, arena: Arena2D, delta: number): void {
  if (!this.bossPendingForCurrentWave || this.bossSpawned) return;
  const lvl = this.getCurrentLevel();
  const boss = lvl?.boss;
  if (!boss) {
    this.bossPendingForCurrentWave = false;
    return;
  }
  const max = lvl?.max_balls_spawned ?? this.config.game_session?.max_balls_spawned ?? 20;
  if (this.launchedCount < max) return;
  if (this.getEnemyBallCount() > 0) return;

  if (this.bossNoticeRemaining < 0) {
    this.pendingEvents.push({ type: "phase_changed", phase: "boss_notice" });
    this.bossNoticeRemaining = boss.notice_overlay_seconds ?? this.config.levels?.boss_notice_overlay_seconds ?? 1.2;
    return;
  }

  if (this.bossNoticeRemaining > 0) {
    this.bossNoticeRemaining = Math.max(0, this.bossNoticeRemaining - delta);
    if (this.bossNoticeRemaining > 0) return;
  }

  if (this.bossIntroRemaining <= 0) {
    this.bossIntroRemaining = boss.intro_overlay_seconds ?? this.config.levels?.boss_intro_overlay_seconds ?? 1.4;
    this.pendingEvents.push({ type: "phase_changed", phase: "boss_intro" });
    return;
  }

  this.bossIntroRemaining = Math.max(0, this.bossIntroRemaining - delta);
  if (this.bossIntroRemaining > 0) return;

  const spawnPos = {
    x: boss.spawn_position?.x ?? 0,
    y: boss.spawn_position?.y ?? (arena.halfH - 0.05),
  };
  const launcher = this.spawnBall("orange", boss.launcher_size ?? BallSize.LARGE, { ...spawnPos }, { x: 0, y: 0 });
  const launcherMul = boss.launcher_diameter_multiplier ?? 2;
  if (launcherMul > 0) {
    launcher.baseDiameter *= launcherMul;
    launcher.diameter *= launcherMul;
  }

  const bossColor = resolveBossColor(lvl, boss);
  const requestedHp = boss.hp;
  const requestedMaxHp = boss.maxHp ?? boss.hp;
  const spawnCount = Math.max(1, Math.floor(boss.spawn_count ?? 1));
  const spawnSpacingX = boss.spawn_spacing_x ?? 1.6;
  const spawnedIds: string[] = [];
  const baseVelocity = { x: boss.horizontal_speed ?? 8, y: -24 };
  const fanStepDeg = 70;
  for (let i = 0; i < spawnCount; i += 1) {
    const spreadIdx = i - (spawnCount - 1) / 2;
    const spreadX = spawnCount === 1 ? 0 : (spreadIdx * spawnSpacingX);
    const angle = (spreadIdx * fanStepDeg * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const velocity = {
      x: baseVelocity.x * cos - baseVelocity.y * sin,
      y: baseVelocity.x * sin + baseVelocity.y * cos,
    };
    const spawnedBoss = this.spawnBall(bossColor, boss.size ?? BallSize.LARGE, { x: launcher.position.x + spreadX, y: launcher.position.y }, velocity, undefined, { hp: requestedHp, maxHp: requestedMaxHp }, { isBoss: true });
    const bossHealBonus = boss.dark_green_heal_bonus_percent ?? lvl?.dark_green_heal_bonus_percent;
    if (typeof bossHealBonus === "number" && spawnedBoss.color === "dark_green") {
      spawnedBoss.metadata.hpGrowHealMultiplier = Math.max(0, 1 + bossHealBonus / 100);
    }
    if (boss.defeat_rule) spawnedBoss.metadata.defeatRule = boss.defeat_rule;
    if (typeof boss.non_matching_kill_recharge_hp === "number") {
      spawnedBoss.metadata.nonMatchingKillRechargeHp = boss.non_matching_kill_recharge_hp;
    }
    const bossMul = boss.diameter_multiplier ?? 1;
    if (bossMul > 0) {
      spawnedBoss.baseDiameter *= bossMul;
    }
    this.syncBossDiameterWithHp(spawnedBoss);
    spawnedIds.push(spawnedBoss.id);
  }
  this.bossSpawned = true;
  this.awardGrenades(boss.reward_grenades_on_spawn ?? 0, "boss_spawn");
  if (boss.defeat_hint_message) {
    this.bossHintMessage = boss.defeat_hint_message;
    this.bossHintRemaining = Math.max(0, boss.defeat_hint_seconds ?? 2);
  }

  launcher.isAlive = false;
  this.pendingEvents.push({ type: "orange_launched", launcherId: launcher.id, launchedId: spawnedIds[0] });
  this.pendingEvents.push({ type: "ball_despawned", ballId: launcher.id, reason: "after_launch" });
}
