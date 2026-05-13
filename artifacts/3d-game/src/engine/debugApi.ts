export interface BallDebugApi {
  debugClearRegularWave: () => number;
  debugFinishBossNotice: () => void;
  debugWeakenBoss: () => number;
  debugKillBoss: () => number;
  debugOpenRewardResults: () => void;
  debugOpenEvolution: () => void;
  debugStartRewardNotice: () => void;
}

type BallDebugCommands = Partial<BallDebugApi>;

declare global {
  interface Window {
    __ballDebug?: BallDebugCommands;
  }
}

// Installed in all browser builds because the mobile debug overlay is opened by
// a hidden four-finger gesture even outside Vite dev mode.
export function installBallDebugApi(commands: BallDebugCommands): () => void {
  if (typeof window === "undefined") return () => {};

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
