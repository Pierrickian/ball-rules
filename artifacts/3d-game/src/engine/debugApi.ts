export interface BallDebugApi {
  debugClearRegularWave: () => number;
  debugFinishBossNotice: () => void;
  debugWeakenBoss: () => number;
  debugKillBoss: () => number;
  debugOpenRewardResults: () => void;
  debugOpenEvolution: () => void;
}

type BallDebugCommands = Partial<BallDebugApi>;

declare global {
  interface Window {
    __ballDebug?: BallDebugCommands;
  }
}

export function installBallDebugApi(commands: BallDebugCommands): () => void {
  if (!import.meta.env.DEV || typeof window === "undefined") return () => {};

  window.__ballDebug = {
    ...(window.__ballDebug ?? {}),
    ...commands,
  };

  return () => {
    const current = window.__ballDebug;
    if (!current) return;

    const next: BallDebugCommands = { ...current };
    for (const key of Object.keys(commands) as Array<keyof BallDebugApi>) {
      if (current[key] === commands[key]) {
        delete next[key];
      }
    }

    if (Object.keys(next).length === 0) {
      delete window.__ballDebug;
      return;
    }
    window.__ballDebug = next;
  };
}
