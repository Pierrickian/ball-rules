import type { GameConfig } from "./types";

export type RuntimeModifierKey =
  | "enemy_spawn_rate"
  | "enemy_speed"
  | "enemy_hp"
  | "projectile_speed"
  | "wave_duration"
  | "ammo_count"
  | "grenade_count"
  | "gameplay_speed"
  | "enemy_density";

export type GameplayAlveoleId =
  | "more_chaos"
  | "more_precision"
  | "slower_enemies"
  | "faster_gameplay"
  | "longer_waves"
  | "more_enemy_hp"
  | "more_grenades"
  | "more_bullets"
  | "more_pressure"
  | "better_readability"
  | "more_explosive_gameplay"
  | "more_survival_time"
  | "different_enemy_balls";

export interface RuntimeModifiers {
  enemy_spawn_rate: number;
  enemy_speed: number;
  enemy_hp: number;
  projectile_speed: number;
  wave_duration: number;
  ammo_count: number;
  grenade_count: number;
  gameplay_speed: number;
  enemy_density: number;
}

export interface GameplayAlveole {
  id: GameplayAlveoleId;
  label: string;
  description: string;
  tags: RuntimeModifierKey[];
  effects: Partial<RuntimeModifiers>;
}

export interface RuntimeEngineModifiers {
  spawnIntervalMultiplier: number;
  enemySpeedMultiplier: number;
  enemyHpMultiplier: number;
  gameplaySpeedMultiplier: number;
  enemyDensityMultiplier: number;
}

export const DEFAULT_RUNTIME_MODIFIERS: RuntimeModifiers = {
  enemy_spawn_rate: 1,
  enemy_speed: 1,
  enemy_hp: 1,
  projectile_speed: 1,
  wave_duration: 1,
  ammo_count: 1,
  grenade_count: 1,
  gameplay_speed: 1,
  enemy_density: 1,
};

export const GAMEPLAY_ALVEOLES: GameplayAlveole[] = [
  { id: "more_chaos", label: "More chaos", description: "Plus d'oranges, plus de pression, sans casser le flow.", tags: ["enemy_spawn_rate", "enemy_density"], effects: { enemy_spawn_rate: 1.18, enemy_density: 1.15 } },
  { id: "more_precision", label: "More precision", description: "Projectiles plus lisibles et waves un peu plus propres.", tags: ["projectile_speed", "enemy_spawn_rate"], effects: { projectile_speed: 1.14, enemy_spawn_rate: 0.94 } },
  { id: "slower_enemies", label: "Slower enemies", description: "Les ennemis respirent plus lentement.", tags: ["enemy_speed"], effects: { enemy_speed: 0.88 } },
  { id: "faster_gameplay", label: "Faster gameplay", description: "Rythme global plus nerveux.", tags: ["gameplay_speed", "enemy_speed"], effects: { gameplay_speed: 1.08, enemy_speed: 1.08 } },
  { id: "longer_waves", label: "Longer waves", description: "Respirations plus longues, plus de temps pour finir.", tags: ["wave_duration", "ammo_count"], effects: { wave_duration: 1.18, ammo_count: 1.08 } },
  { id: "more_enemy_hp", label: "More enemy HP", description: "Cibles plus robustes, meilleure valeur par grenade.", tags: ["enemy_hp"], effects: { enemy_hp: 1.18 } },
  { id: "more_grenades", label: "More grenades", description: "Ajoute du contrôle explosif au runtime.", tags: ["grenade_count"], effects: { grenade_count: 1.35 } },
  { id: "more_bullets", label: "More bullets", description: "Plus de marge de tir pour rester en flow.", tags: ["ammo_count"], effects: { ammo_count: 1.22 } },
  { id: "more_pressure", label: "More pressure", description: "Spawn et densité montent doucement.", tags: ["enemy_spawn_rate", "enemy_density", "wave_duration"], effects: { enemy_spawn_rate: 1.12, enemy_density: 1.12, wave_duration: 0.94 } },
  { id: "better_readability", label: "Better readability", description: "Ralentit légèrement les ennemis et aère la vague.", tags: ["enemy_speed", "enemy_density"], effects: { enemy_speed: 0.92, enemy_density: 0.9 } },
  { id: "more_explosive_gameplay", label: "More explosive gameplay", description: "Plus de grenades et projectiles plus vifs.", tags: ["grenade_count", "projectile_speed"], effects: { grenade_count: 1.2, projectile_speed: 1.1 } },
  { id: "more_survival_time", label: "More survival time", description: "Temps et munitions respirent davantage.", tags: ["wave_duration", "ammo_count", "enemy_speed"], effects: { wave_duration: 1.12, ammo_count: 1.12, enemy_speed: 0.95 } },
  { id: "different_enemy_balls", label: "Different enemy balls", description: "Invite la future IA à varier la composition des balles.", tags: ["enemy_density"], effects: { enemy_density: 1.04 } },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function applyAlveoleModifier(current: RuntimeModifiers, alveole: GameplayAlveole): RuntimeModifiers {
  return {
    enemy_spawn_rate: clamp(current.enemy_spawn_rate * (alveole.effects.enemy_spawn_rate ?? 1), 0.35, 2.5),
    enemy_speed: clamp(current.enemy_speed * (alveole.effects.enemy_speed ?? 1), 0.45, 2.2),
    enemy_hp: clamp(current.enemy_hp * (alveole.effects.enemy_hp ?? 1), 0.6, 3),
    projectile_speed: clamp(current.projectile_speed * (alveole.effects.projectile_speed ?? 1), 0.65, 2.4),
    wave_duration: clamp(current.wave_duration * (alveole.effects.wave_duration ?? 1), 0.55, 2.4),
    ammo_count: clamp(current.ammo_count * (alveole.effects.ammo_count ?? 1), 0.6, 2.8),
    grenade_count: clamp(current.grenade_count * (alveole.effects.grenade_count ?? 1), 0.7, 3),
    gameplay_speed: clamp(current.gameplay_speed * (alveole.effects.gameplay_speed ?? 1), 0.65, 1.8),
    enemy_density: clamp(current.enemy_density * (alveole.effects.enemy_density ?? 1), 0.45, 2.4),
  };
}

export function toEngineRuntimeModifiers(modifiers: RuntimeModifiers, breathingSpawnBrake = 1): RuntimeEngineModifiers {
  return {
    spawnIntervalMultiplier: clamp((1 / modifiers.enemy_spawn_rate) * breathingSpawnBrake / modifiers.enemy_density, 0.18, 99),
    enemySpeedMultiplier: modifiers.enemy_speed,
    enemyHpMultiplier: modifiers.enemy_hp,
    gameplaySpeedMultiplier: modifiers.gameplay_speed,
    enemyDensityMultiplier: modifiers.enemy_density,
  };
}

export function applyRuntimeModifiersToConfig(config: GameConfig, modifiers: RuntimeModifiers): GameConfig {
  const speedMultiplier = modifiers.projectile_speed;
  const shotTypes = Object.fromEntries(
    Object.entries(config.gameplay_controls.shot_types).map(([kind, shot]) => [kind, { ...shot, speed: shot.speed * speedMultiplier }])
  ) as GameConfig["gameplay_controls"]["shot_types"];

  return {
    ...config,
    gameplay_controls: {
      ...config.gameplay_controls,
      shot_types: shotTypes,
    },
  };
}
