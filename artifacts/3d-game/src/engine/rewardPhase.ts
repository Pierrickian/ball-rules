export type RewardNoticeTrigger = "regular_wave_no_boss" | "boss_defeated";

export interface RewardNoticeSnapshot {
  rewardNoticeAlreadyEmitted: boolean;
  bossRewardAlreadyEmitted: boolean;
  activeEnemyCount: number;
  launchedCount: number;
  bossConfigured: boolean;
  bossSpawned: boolean;
  bossDefeated: boolean;
  bossMasteredActive: boolean;
}

/**
 * Single runtime guard for the reward-notice transition.
 *
 * A reward can start only after a wave had activity, the terrain is clear,
 * and either no boss is pending for this wave or the current boss has been
 * defeated and its mastery overlay is finished.
 */
export function getRewardNoticeTrigger(snapshot: RewardNoticeSnapshot): RewardNoticeTrigger | null {
  if (snapshot.rewardNoticeAlreadyEmitted) return null;
  if (snapshot.activeEnemyCount > 0) return null;
  if (snapshot.launchedCount <= 0) return null;

  const bossPending = snapshot.bossConfigured && !snapshot.bossSpawned;
  if (bossPending) return null;

  const bossCleared = snapshot.bossConfigured && snapshot.bossSpawned && snapshot.bossDefeated && !snapshot.bossMasteredActive;
  if (bossCleared && !snapshot.bossRewardAlreadyEmitted) return "boss_defeated";

  if (!snapshot.bossConfigured || snapshot.bossRewardAlreadyEmitted) return "regular_wave_no_boss";

  return null;
}
