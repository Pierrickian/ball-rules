export type RewardNoticeTrigger = "regular_wave_no_boss" | "boss_defeated";

export interface RewardNoticeSnapshot {
  rewardNoticeAlreadyEmitted: boolean;
  bossRewardAlreadyEmitted: boolean;
  activeEnemyCount: number;
  launchedCount: number;
  bossPendingForCurrentWave: boolean;
  bossSpawned: boolean;
  bossDefeated: boolean;
  bossMasteredActive: boolean;
}

/**
 * Single runtime guard for the reward-notice transition.
 *
 * A reward can start only after a wave had activity, the terrain is clear,
 * and either this runtime wave does not expect a boss anymore or the current
 * boss has been defeated and its mastery overlay is finished.
 */
export function getRewardNoticeTrigger(snapshot: RewardNoticeSnapshot): RewardNoticeTrigger | null {
  if (snapshot.rewardNoticeAlreadyEmitted) return null;
  if (snapshot.activeEnemyCount > 0) return null;
  if (snapshot.launchedCount <= 0) return null;

  if (!snapshot.bossPendingForCurrentWave) return "regular_wave_no_boss";

  const bossWaitingToSpawn = !snapshot.bossSpawned;
  if (bossWaitingToSpawn) return null;

  const bossCleared = snapshot.bossDefeated && !snapshot.bossMasteredActive;
  if (bossCleared && !snapshot.bossRewardAlreadyEmitted) return "boss_defeated";

  return null;
}
