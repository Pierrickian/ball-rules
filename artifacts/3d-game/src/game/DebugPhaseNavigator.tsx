import { useMemo, useState } from "react";
import type { GameConfig, GameState, RuntimePhase } from "../engine/types";
import type { RuntimeStepperSnapshot } from "./runtimeStepper";
import { currentCheckpoint } from "./runtimeStepper";

interface DebugPhaseNavigatorProps {
  open: boolean;
  config: GameConfig;
  gameState: GameState;
  snapshot: RuntimeStepperSnapshot;
  waveResultReady: boolean;
  onClose: () => void;
  onGoToBoss: () => void;
  onRecordPhase: (phase: RuntimePhase) => void;
  onLaunchNextWave: () => void;
}

type DebugCondition = {
  id: string;
  label: string;
  value: string;
  passWhen: string;
  met: boolean;
  forceHint: string;
};

type DebugStep = {
  id: string;
  eventName: string;
  title: string;
  description: string;
  conditions: DebugCondition[];
  run: (forced: boolean) => void;
};

type DebugCategory = {
  id: string;
  label: string;
  steps: DebugStep[];
};

const DEBUG_BUTTON: React.CSSProperties = {
  border: "1px solid rgba(122,252,255,.45)",
  borderRadius: 10,
  background: "rgba(122,252,255,.12)",
  color: "#ecfeff",
  padding: "8px 10px",
  fontWeight: 800,
  cursor: "pointer",
};

function yesNo(value: boolean): string {
  return value ? "oui" : "non";
}

function countRegularEnemies(gameState: GameState, config: GameConfig): number {
  let count = 0;
  for (const ball of gameState.balls.values()) {
    if (!ball.isAlive) continue;
    if (ball.isBoss) continue;
    if (ball.color === "orange") continue;
    if (ball.rule === "player_projectile") continue;
    if (config.ball_colors[ball.color]?.for_terrain !== true) continue;
    count += 1;
  }
  return count;
}

function hasBossBall(gameState: GameState): boolean {
  for (const ball of gameState.balls.values()) {
    if (ball.isAlive && ball.isBoss) return true;
  }
  return false;
}

function runDebugCommand<K extends keyof NonNullable<Window["__ballDebug"]>>(key: K): void {
  const command = window.__ballDebug?.[key];
  if (typeof command === "function") command();
}

export function DebugPhaseNavigator({
  open,
  config,
  gameState,
  snapshot,
  waveResultReady,
  onClose,
  onGoToBoss,
  onRecordPhase,
  onLaunchNextWave,
}: DebugPhaseNavigatorProps) {
  const [forcedConditions, setForcedConditions] = useState<Record<string, true>>({});
  const checkpoint = currentCheckpoint(snapshot);

  const categories = useMemo<DebugCategory[]>(() => {
    const regularEnemies = countRegularEnemies(gameState, config);
    const bossPresent = hasBossBall(gameState);
    const currentLevel = config.levels?.list?.[gameState.currentLevelIndex];
    const levelHasBoss = Boolean(currentLevel?.boss);
    const spawned = gameState.launchedCount;
    const maxSpawned = gameState.maxBallsSpawned;
    const spawnCapReached = spawned >= maxSpawned;
    const breathingActive = snapshot.wavePhase === "breathing";
    const resultsVisible = breathingActive && snapshot.waveUiStage === "results";
    const evolutionVisible = breathingActive && snapshot.waveUiStage === "evolution";

    return [
      {
        id: "wave",
        label: "Phase de vague",
        steps: [
          {
            id: "wave-active",
            eventName: "phase_changed: wave_active",
            title: "Entrer / signaler la vague active",
            description: "Émet le marqueur de debug attendu au début d'une vague jouable.",
            conditions: [
              { id: "wave-not-breathing", label: "Respiration fermée", value: snapshot.wavePhase, passWhen: "phase ≠ breathing", met: !breathingActive, forceHint: "Lancer la vague suivante" },
            ],
            run: (forced) => {
              if (forced && breathingActive) onLaunchNextWave();
              onRecordPhase("wave_active");
            },
          },
          {
            id: "wave-regular-clear",
            eventName: "ball_despawned: debug_regular_wave_cleared",
            title: "Nettoyer la vague régulière",
            description: "Supprime les balles terrain restantes pour simuler une vague jouée et vidée.",
            conditions: [
              { id: "regular-enemies", label: "Balles terrain restantes", value: String(regularEnemies), passWhen: "0 balle régulière active", met: regularEnemies === 0, forceHint: "Détruire les balles régulières" },
            ],
            run: () => runDebugCommand("debugClearRegularWave"),
          },
        ],
      },
      {
        id: "boss",
        label: "Phase de boss",
        steps: [
          {
            id: "boss-notice",
            eventName: "phase_changed: boss_notice",
            title: "Aller à l'annonce du boss",
            description: "Place la session sur un niveau boss et force les prérequis de vague.",
            conditions: [
              { id: "level-has-boss", label: "Niveau courant avec boss", value: `${yesNo(levelHasBoss)} (${currentLevel?.name ?? "aucun"})`, passWhen: "niveau.boss défini", met: levelHasBoss, forceHint: "Aller au prochain niveau boss" },
              { id: "spawn-cap", label: "Cap de spawn", value: `${spawned}/${maxSpawned}`, passWhen: "launchedCount ≥ maxBallsSpawned", met: spawnCapReached, forceHint: "Réduire le cap au nombre lancé" },
              { id: "boss-clear-regular", label: "Balles régulières", value: String(regularEnemies), passWhen: "0 balle régulière active", met: regularEnemies === 0, forceHint: "Détruire les balles régulières" },
            ],
            run: (forced) => {
              if (!levelHasBoss || forced) onGoToBoss();
              if (forced || regularEnemies > 0 || !spawnCapReached) runDebugCommand("debugClearRegularWave");
              onRecordPhase("boss_notice");
            },
          },
          {
            id: "boss-intro",
            eventName: "phase_changed: boss_intro",
            title: "Afficher / franchir l'intro boss",
            description: "Utilise l'état d'intro boss et permet de passer son timer sans attendre.",
            conditions: [
              { id: "boss-intro-active", label: "Intro active", value: yesNo(Boolean(gameState.bossIntroActive)), passWhen: "bossIntroActive = true", met: Boolean(gameState.bossIntroActive), forceHint: "Déclencher le niveau boss" },
            ],
            run: (forced) => {
              if (!gameState.bossIntroActive && forced) onGoToBoss();
              onRecordPhase("boss_intro");
            },
          },
          {
            id: "boss-spawned",
            eventName: "orange_launched + boss ball_spawned",
            title: "Faire apparaître le boss",
            description: "Passe le timer d'intro pour laisser le moteur créer la balle boss au tick suivant.",
            conditions: [
              { id: "boss-intro-can-finish", label: "Intro en cours", value: yesNo(Boolean(gameState.bossIntroActive)), passWhen: "bossIntroActive = true", met: Boolean(gameState.bossIntroActive), forceHint: "Aller au boss puis passer l'intro" },
            ],
            run: (forced) => {
              if (!gameState.bossIntroActive && forced) onGoToBoss();
              runDebugCommand("debugFinishBossNotice");
            },
          },
          {
            id: "boss-defeated",
            eventName: "ball_despawned: debug_boss_killed",
            title: "Vaincre le boss",
            description: "Tue le boss actif pour atteindre la transition de fin de boss.",
            conditions: [
              { id: "boss-present", label: "Boss vivant", value: yesNo(bossPresent), passWhen: "au moins une balle isBoss vivante", met: bossPresent, forceHint: "Aller au boss / passer l'intro avant de tuer" },
            ],
            run: (forced) => {
              if (!bossPresent && forced) {
                onGoToBoss();
                runDebugCommand("debugFinishBossNotice");
              }
              runDebugCommand("debugKillBoss");
            },
          },
          {
            id: "boss-mastered",
            eventName: "phase_changed: boss_mastered",
            title: "Afficher Boss Mastered",
            description: "Même raccourci que la victoire boss, l'événement boss_mastered est émis par le moteur.",
            conditions: [
              { id: "boss-mastered-active", label: "Overlay maîtrisé", value: yesNo(Boolean(gameState.bossMasteredActive)), passWhen: "bossMasteredActive = true", met: Boolean(gameState.bossMasteredActive), forceHint: "Tuer le boss" },
            ],
            run: (forced) => {
              if (forced || !gameState.bossMasteredActive) runDebugCommand("debugKillBoss");
            },
          },
        ],
      },
      {
        id: "reward",
        label: "Phase récompense / Game",
        steps: [
          {
            id: "reward-notice",
            eventName: "phase_changed: reward_notice",
            title: "Ouvrir l'annonce de récompense",
            description: "Démarre la respiration comme si la vague venait d'être gagnée.",
            conditions: [
              { id: "reward-ready", label: "Session nettoyée", value: `${yesNo(gameState.sessionCleared)} / ennemis=${regularEnemies}`, passWhen: "sessionCleared ou 0 ennemi", met: gameState.sessionCleared || regularEnemies === 0, forceHint: "Démarrer une respiration victoire" },
            ],
            run: () => runDebugCommand("debugStartRewardNotice"),
          },
          {
            id: "reward-results",
            eventName: "phase_changed: reward_results",
            title: "Afficher les résultats",
            description: "Passe l'annonce Time Up / Kill Star et ouvre le panneau de résultats.",
            conditions: [
              { id: "breathing-active", label: "Respiration active", value: snapshot.wavePhase, passWhen: "phase = breathing", met: breathingActive, forceHint: "Démarrer la respiration" },
              { id: "wave-result-ready", label: "Résultat calculé", value: yesNo(waveResultReady), passWhen: "waveResult non nul", met: waveResultReady, forceHint: "Créer le résultat via reward_notice" },
            ],
            run: (forced) => {
              if (forced && !breathingActive) runDebugCommand("debugStartRewardNotice");
              runDebugCommand("debugOpenRewardResults");
            },
          },
          {
            id: "evolution-panel",
            eventName: "phase_changed: evolution_panel",
            title: "Ouvrir le Game / évolution",
            description: "Ouvre le choix d'alvéoles et le bouton Play de la prochaine vague.",
            conditions: [
              { id: "results-visible", label: "Résultats visibles", value: yesNo(resultsVisible), passWhen: "waveUiStage = results", met: resultsVisible, forceHint: "Ouvrir les résultats" },
            ],
            run: (forced) => {
              if (forced && !breathingActive) runDebugCommand("debugStartRewardNotice");
              if (forced && !resultsVisible) runDebugCommand("debugOpenRewardResults");
              runDebugCommand("debugOpenEvolution");
            },
          },
          {
            id: "next-wave",
            eventName: "phase_changed: wave_active",
            title: "Play → vague suivante",
            description: "Ferme le Game et relance une vague active sans choisir d'alvéole.",
            conditions: [
              { id: "evolution-visible", label: "Game visible", value: yesNo(evolutionVisible), passWhen: "waveUiStage = evolution", met: evolutionVisible, forceHint: "Ouvrir le Game" },
            ],
            run: (forced) => {
              if (forced && !evolutionVisible) runDebugCommand("debugOpenEvolution");
              onLaunchNextWave();
            },
          },
        ],
      },
    ];
  }, [config, gameState, onGoToBoss, onLaunchNextWave, onRecordPhase, snapshot, waveResultReady]);

  if (!open) return null;

  const conditionIsForced = (stepId: string, conditionId: string) => Boolean(forcedConditions[`${stepId}:${conditionId}`]);
  const stepIsForcedReady = (step: DebugStep) => step.conditions.some((condition) => conditionIsForced(step.id, condition.id));
  const stepCanRun = (step: DebugStep) => step.conditions.every((condition) => condition.met || conditionIsForced(step.id, condition.id));

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 90, background: "rgba(0,7,16,.82)", backdropFilter: "blur(8px)", color: "#e7faff", fontFamily: "'Courier New', monospace", pointerEvents: "all" }}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: 14, boxSizing: "border-box", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#7afcff", letterSpacing: 2, textTransform: "uppercase" }}>Debug navigation phases</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Checkpoint courant: {checkpoint}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: "#a8c7df", lineHeight: 1.4 }}>{snapshot.lastEventTypes.length > 0 ? snapshot.lastEventTypes.join(" · ") : "aucun événement récent"}</div>
          </div>
          <button aria-label="Fermer le debug" onClick={onClose} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.08)", color: "#fff", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflow: "auto", display: "grid", gap: 12, paddingBottom: 12 }}>
          {categories.map((category) => (
            <section key={category.id} style={{ border: "1px solid rgba(122,252,255,.22)", borderRadius: 16, background: "rgba(5,18,36,.72)", padding: 10, boxShadow: "0 12px 34px rgba(0,0,0,.3)" }}>
              <div style={{ fontSize: 13, color: "#7afcff", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{category.label}</div>
              <div style={{ display: "grid", gap: 10 }}>
                {category.steps.map((step, index) => {
                  const canRun = stepCanRun(step);
                  const forcedReady = stepIsForcedReady(step);
                  return (
                    <article key={step.id} style={{ border: "1px solid rgba(255,255,255,.13)", borderRadius: 12, padding: 10, background: "rgba(255,255,255,.045)" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 900, color: "#fff" }}>{index + 1}. {step.title}</div>
                          <div style={{ fontSize: 11, color: "#95b9d6", marginTop: 2 }}>{step.eventName}</div>
                        </div>
                        <button onClick={() => step.run(forcedReady)} disabled={!canRun} style={{ ...DEBUG_BUTTON, opacity: canRun ? 1 : .45, cursor: canRun ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>Exécuter</button>
                      </div>
                      <div style={{ fontSize: 11, color: "#cfe8ff", marginTop: 7, lineHeight: 1.4 }}>{step.description}</div>
                      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                        {step.conditions.map((condition) => {
                          const forced = conditionIsForced(step.id, condition.id);
                          const green = condition.met || forced;
                          return (
                            <div key={condition.id} style={{ border: `1px solid ${green ? "rgba(102,255,187,.55)" : "rgba(255,82,82,.58)"}`, background: green ? "rgba(102,255,187,.09)" : "rgba(255,82,82,.10)", borderRadius: 10, padding: 8, display: "grid", gap: 5 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <strong style={{ color: green ? "#9fffd2" : "#ffaaa8", fontSize: 12 }}>{green ? "● vert" : "● rouge"} — {condition.label}</strong>
                                {!condition.met && (
                                  <button onClick={() => setForcedConditions((prev) => ({ ...prev, [`${step.id}:${condition.id}`]: true }))} style={{ ...DEBUG_BUTTON, padding: "5px 8px", fontSize: 11, borderColor: "rgba(255,209,102,.6)", background: "rgba(255,209,102,.13)", color: "#fff4c1" }}>Forcer</button>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: "#d7eaff" }}>Valeur: <b>{condition.value}</b></div>
                              <div style={{ fontSize: 11, color: "#b6c9dc" }}>Condition: {condition.passWhen}</div>
                              {!condition.met && <div style={{ fontSize: 10, color: "#ffe6a3" }}>Force 1 clic: {condition.forceHint}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
