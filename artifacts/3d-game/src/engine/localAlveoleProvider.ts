import { GAMEPLAY_ALVEOLES, type GameplayAlveole } from "./runtimeModifiers";

export interface PlayerTelemetrySnapshot {
  waveNumber: number;
  ammoRemaining: number;
  activeEnemies: number;
  grenadesLeft: number;
  reason: "breathing_wave" | "idle_micro_pause";
}

export interface AlveoleProvider {
  recommend(snapshot: PlayerTelemetrySnapshot, options?: { count?: number; ids?: string[] }): Promise<GameplayAlveole[]>;
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export class LocalRandomAlveoleProvider implements AlveoleProvider {
  async recommend(snapshot: PlayerTelemetrySnapshot, options?: { count?: number; ids?: string[] }): Promise<GameplayAlveole[]> {
    const latency = snapshot.reason === "breathing_wave"
      ? 3000 + Math.random() * 1000
      : 450 + Math.random() * 350;
    await sleep(latency);

    const pool = options?.ids?.length
      ? GAMEPLAY_ALVEOLES.filter((alveole) => options.ids?.includes(alveole.id))
      : GAMEPLAY_ALVEOLES;
    const count = Math.max(1, Math.min(options?.count ?? (Math.random() > 0.5 ? 3 : 2), pool.length));
    return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  }
}
