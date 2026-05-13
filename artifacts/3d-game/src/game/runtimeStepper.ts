export const RUNTIME_CHECKPOINTS = [
  "wave_active",
  "wave_regular_clear",
  "boss_notice",
  "boss_intro",
  "boss_spawned",
  "boss_defeated",
  "boss_mastered",
  "reward_notice",
  "reward_results",
  "evolution_panel",
] as const;

export type RuntimeCheckpoint = (typeof RUNTIME_CHECKPOINTS)[number];
export type RuntimeWaveUiStage = "none" | "notice" | "results" | "evolution";

export interface RuntimeStepperSnapshot {
  wavePhase: string;
  waveUiStage: RuntimeWaveUiStage;
  hasBossBall: boolean;
  bossIntroActive: boolean;
  bossMasteredActive: boolean;
  bossPhaseActive: boolean;
  sessionCleared: boolean;
  lastEventTypes: string[];
}

const CHECKPOINT_ORDER = new Map<RuntimeCheckpoint, number>(
  RUNTIME_CHECKPOINTS.map((checkpoint, index) => [checkpoint, index]),
);

export function currentCheckpoint(snapshot: RuntimeStepperSnapshot): RuntimeCheckpoint {
  if (snapshot.waveUiStage === "evolution") return "evolution_panel";
  if (snapshot.waveUiStage === "results") return "reward_results";
  if (snapshot.wavePhase === "breathing") return "reward_notice";
  if (snapshot.bossMasteredActive) return "boss_mastered";
  if (isBossDefeated(snapshot)) return "boss_defeated";
  if (snapshot.hasBossBall) return "boss_spawned";
  if (snapshot.bossIntroActive) return "boss_intro";
  if (snapshot.wavePhase === "boss_notice") return "boss_notice";
  if (isRegularWaveCleared(snapshot)) return "wave_regular_clear";
  return "wave_active";
}

export function hasReached(snapshot: RuntimeStepperSnapshot, checkpoint: RuntimeCheckpoint): boolean {
  const currentIndex = CHECKPOINT_ORDER.get(currentCheckpoint(snapshot)) ?? 0;
  const targetIndex = CHECKPOINT_ORDER.get(checkpoint) ?? 0;
  return currentIndex >= targetIndex;
}

export function debugLabel(snapshot: RuntimeStepperSnapshot): string {
  const checkpoint = currentCheckpoint(snapshot);
  const events = snapshot.lastEventTypes.length > 0 ? snapshot.lastEventTypes.join(",") : "none";
  return [
    `checkpoint=${checkpoint}`,
    `wave=${snapshot.wavePhase}`,
    `ui=${snapshot.waveUiStage}`,
    `boss=${snapshot.hasBossBall ? "spawned" : "absent"}`,
    `intro=${snapshot.bossIntroActive ? "on" : "off"}`,
    `mastered=${snapshot.bossMasteredActive ? "on" : "off"}`,
    `phaseBoss=${snapshot.bossPhaseActive ? "yes" : "no"}`,
    `cleared=${snapshot.sessionCleared ? "yes" : "no"}`,
    `events=${events}`,
  ].join(" | ");
}

function isRegularWaveCleared(snapshot: RuntimeStepperSnapshot): boolean {
  if (snapshot.wavePhase === "breathing") return true;
  if (snapshot.sessionCleared && !snapshot.hasBossBall && !snapshot.bossIntroActive && !snapshot.bossMasteredActive) return true;
  return snapshot.lastEventTypes.includes("session_clear");
}

function isBossDefeated(snapshot: RuntimeStepperSnapshot): boolean {
  return snapshot.bossMasteredActive || (snapshot.bossPhaseActive && snapshot.sessionCleared && !snapshot.hasBossBall);
}
