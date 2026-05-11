export type ChangeTone = "harder" | "easier" | "different";
export type ChangeCategory = "ball" | "time" | "ammo" | "boss" | "level";

export type ChangeNode = {
  id: string;
  labelKey: string;
  tone?: ChangeTone;
  category?: ChangeCategory;
  modifierId?: string;
};

export const CHANGE_MAIN_NODES: ChangeNode[] = [
  { id: "harder", tone: "harder", labelKey: "change.node.harder" },
  { id: "easier", tone: "easier", labelKey: "change.node.easier" },
  { id: "different", tone: "different", labelKey: "change.node.different" },
];

const COMMON_CATEGORIES: ChangeNode[] = [
  { id: "ball", category: "ball", labelKey: "change.node.ball" },
  { id: "time", category: "time", labelKey: "change.node.time" },
  { id: "ammo", category: "ammo", labelKey: "change.node.ammo" },
];

export function getCategoryNodes(tone: ChangeTone, isBossPhase: boolean): ChangeNode[] {
  if (tone === "different") {
    return [
      { id: "ball", category: "ball", labelKey: "change.node.ball" },
      isBossPhase
        ? { id: "level", category: "level", labelKey: "change.node.level" }
        : { id: "boss", category: "boss", labelKey: "change.node.boss" },
      { id: "time", category: "time", labelKey: "change.node.time" },
      { id: "ammo", category: "ammo", labelKey: "change.node.ammo" },
    ];
  }
  return COMMON_CATEGORIES;
}

const FINAL_NODE_MAP: Record<ChangeTone, Partial<Record<ChangeCategory, ChangeNode[]>>> = {
  harder: {
    ball: [
      { id: "harder_ball_add", labelKey: "change.node.add", modifierId: "dominant_ball" },
      { id: "harder_ball_accelerate", labelKey: "change.node.accelerate", modifierId: "accelerate_ball" },
      { id: "harder_ball_stronger", labelKey: "change.node.stronger", modifierId: "stronger_ball" },
    ],
    time: [
      { id: "harder_time_less", labelKey: "change.node.lessTime", modifierId: "less_time" },
      { id: "harder_time_restart", labelKey: "change.node.fasterRestart", modifierId: "faster_restart" },
      { id: "harder_time_pressure", labelKey: "change.node.timePressure", modifierId: "time_pressure" },
    ],
    ammo: [
      { id: "harder_ammo_less", labelKey: "change.node.lessAmmo", modifierId: "less_ammo" },
      { id: "harder_ammo_precision", labelKey: "change.node.precisionShots", modifierId: "precision_shots" },
      { id: "harder_ammo_no_waste", labelKey: "change.node.noWaste", modifierId: "no_waste" },
    ],
    boss: [
      { id: "harder_boss_big", labelKey: "change.node.biggerBoss", modifierId: "bigger_boss" },
      { id: "harder_boss_fast", labelKey: "change.node.fasterBoss", modifierId: "faster_boss" },
      { id: "harder_boss_swarm", labelKey: "change.node.bossSwarm", modifierId: "boss_swarm" },
      { id: "harder_boss_hp", labelKey: "change.node.moreBossHp", modifierId: "bigger_boss" },
    ],
    level: [
      { id: "harder_level_timer", labelKey: "change.node.smallerTimer", modifierId: "less_time" },
      { id: "harder_level_weights", labelKey: "change.node.dangerWeights", modifierId: "harder_distribution" },
      { id: "harder_level_ammo", labelKey: "change.node.lessAmmo", modifierId: "less_ammo" },
    ],
  },
  easier: {
    ball: [
      { id: "easier_ball_remove", labelKey: "change.node.remove", modifierId: "remove_ball" },
      { id: "easier_ball_decelerate", labelKey: "change.node.decelerate", modifierId: "decelerate_ball" },
      { id: "easier_ball_weaker", labelKey: "change.node.weaker", modifierId: "weaker_ball" },
    ],
    time: [
      { id: "easier_time_more", labelKey: "change.node.moreTime", modifierId: "more_time" },
      { id: "easier_time_slower", labelKey: "change.node.slowerPace", modifierId: "slower_pace" },
      { id: "easier_time_relaxed", labelKey: "change.node.relaxedTimer", modifierId: "relaxed_timer" },
    ],
    ammo: [
      { id: "easier_ammo_more", labelKey: "change.node.moreAmmo", modifierId: "more_ammo" },
      { id: "easier_ammo_bonus", labelKey: "change.node.bonusAmmo", modifierId: "bonus_ammo" },
      { id: "easier_ammo_practice", labelKey: "change.node.practiceShots", modifierId: "practice_shots" },
    ],
    boss: [
      { id: "easier_boss_weak", labelKey: "change.node.weakerBoss", modifierId: "weaker_boss" },
      { id: "easier_boss_slow", labelKey: "change.node.slowerBoss", modifierId: "slower_boss" },
      { id: "easier_boss_fewer", labelKey: "change.node.fewerBosses", modifierId: "fewer_bosses" },
    ],
    level: [
      { id: "easier_level_timer", labelKey: "change.node.moreTimer", modifierId: "more_time" },
      { id: "easier_level_ammo", labelKey: "change.node.moreAmmo", modifierId: "more_ammo" },
      { id: "easier_level_weights", labelKey: "change.node.easyWeights", modifierId: "easier_distribution" },
    ],
  },
  different: {
    ball: [
      { id: "different_ball_new", labelKey: "change.node.newBall", modifierId: "new_ball" },
      { id: "different_ball_rebalance", labelKey: "change.node.rebalance", modifierId: "rebalance_ball" },
      { id: "different_ball_skill", labelKey: "change.node.addSkill", modifierId: "add_skill" },
    ],
    time: [
      { id: "different_time_random", labelKey: "change.node.randomTimer", modifierId: "random_timer" },
      { id: "different_time_short", labelKey: "change.node.shortBurst", modifierId: "short_burst" },
      { id: "different_time_long", labelKey: "change.node.longChallenge", modifierId: "long_challenge" },
    ],
    ammo: [
      { id: "different_ammo_random", labelKey: "change.node.randomAmmo", modifierId: "random_ammo" },
      { id: "different_ammo_mega", labelKey: "change.node.megaFocus", modifierId: "mega_focus" },
      { id: "different_ammo_light", labelKey: "change.node.lightFocus", modifierId: "light_focus" },
    ],
    boss: [
      { id: "different_boss_next", labelKey: "change.node.bossNext", modifierId: "boss_next" },
      { id: "different_boss_random", labelKey: "change.node.randomBoss", modifierId: "random_boss_level" },
      { id: "different_boss_color", labelKey: "change.node.bossColor", modifierId: "boss_color_change" },
    ],
    level: [
      { id: "different_level_jump", labelKey: "change.node.jumpLevel", modifierId: "jump_level" },
      { id: "different_level_random", labelKey: "change.node.randomLevel", modifierId: "random_level" },
      { id: "different_level_distribution", labelKey: "change.node.newDistribution", modifierId: "rebalance_ball" },
    ],
  },
};

export function getFinalNodes(tone: ChangeTone, category: ChangeCategory): ChangeNode[] {
  return FINAL_NODE_MAP[tone][category] ?? [];
}
