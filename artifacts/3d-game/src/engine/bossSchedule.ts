/**
 * Boss wave cadence is intentionally runtime state, not level data.
 * Wave numbers are 1-based: wave 1 has a boss, wave 2 does not, wave 3 has
 * a boss, and so on. A level still needs `level.boss` to provide the boss
 * template used by scheduled boss waves.
 */
export function shouldWaveHaveBoss(waveNumber: number): boolean {
  return Math.max(1, Math.floor(waveNumber)) % 2 === 1;
}
