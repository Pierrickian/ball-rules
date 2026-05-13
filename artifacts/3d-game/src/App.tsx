// ============================================================
// App — Entry point for the Ball Game
//
// Layers:
// 1. useGameEngine() — logic loop (config-driven)
// 2. GameScene       — 3D Three.js rendering
// 3. HUD             — top bar + bottom controls
// 4. PlayerQueue     — bottom strip with the next 3 balls
// 5. ChargeBar       — visualize hold duration / shot tier
// 6. Menu            — Game menu
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useGameEngine } from "./engine/useGameEngine";
import { GameScene } from "./scenes/GameScene";
import { HUD } from "./game/HUD";
import { Menu } from "./game/Menu";
import { RetryOverlay } from "./game/RetryOverlay";
import { AddFeaturePortal } from "./game/AddFeaturePortal";
import { submitEvolutionRequest } from "./game/evolutionRequest";
import { LanguageToggle } from "./game/LanguageToggle";
import { I18nProvider, readStoredLanguage, useI18n, type Language } from "./game/i18n";
import type { GameConfig, GameState, ShotKind, Vec2 } from "./engine/types";
import type { GameplayAlveole, RuntimeModifiers } from "./engine/runtimeModifiers";
import { ChargeBar, IncomingBallsOverlay, PlayerQueue } from "./AppOverlays";

function AppContent() {
  const { t, language, setLanguage } = useI18n();
  const {
    gameState, config, lastEvents, isRunning, playerQueue,
    pause, resume, reset, setArena,
    shoot, setCustomTerrainDistribution, setActiveLevel, setLevelWeights, applyRuntimeConfig, openRetryMenu, goToBoss, playBossRush, classifyHold, toggleGrenade, placeMine, upgradeBetterShot, grenadesLeft, setDifficulty, difficulty, setHpAdjustment, hpAdjustment, breathingWave, runtimeModifiers, applyAlveole, reloadWave, launchNextWave, requestContextualAlveoles, setRuntimeModifiersFromSettings, resetRuntimeModifiers,
  } = useGameEngine();

  const [menuOpen, setMenuOpen] = useState(false);
  const [holdTime, setHoldTime] = useState(0);
  const animRef = useRef<number>(0);
  const cycleStartRef = useRef<number>(performance.now());
  const pointerActiveRef = useRef(false);
  // Latest game-space pointer position, updated on every move; used as a
  // fallback target if a pointerup arrives at the window level (e.g. the
  // user released outside the canvas DOM).
  const lastTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 1000 });
  const lastDirectionRef = useRef<Vec2>({ x: 0, y: 1 });
  const [aimDirection, setAimDirection] = useState<Vec2>({ x: 0, y: 1 });
  const [lockOn, setLockOn] = useState(false);
  const [lockedBallId, setLockedBallId] = useState<string | null>(null);
  const [homingOn, setHomingOn] = useState(false);
  const [ballEffect, setBallEffect] = useState(() => localStorage.getItem("bg_effect_ball") ?? "spark");
  const [grenadeEffect, setGrenadeEffect] = useState(() => localStorage.getItem("bg_effect_grenade") ?? "spark");
  const [debugExplosionTexture, setDebugExplosionTexture] = useState(() => localStorage.getItem("bg_debug_explosion_texture") === "1");
  const [autoFire, setAutoFire] = useState(false);
  const [minePlacementMode, setMinePlacementMode] = useState(false);
  const [addFeaturePortalOpen, setAddFeaturePortalOpen] = useState(false);
  const [evolutionInitialText, setEvolutionInitialText] = useState("");
  const [grenadeAwardPopups, setGrenadeAwardPopups] = useState<Array<{ id: number; amount: number }>>([]);
  const [starPopups, setStarPopups] = useState<Array<{ id: number; label: string; kind: "earned" | "lost" | "reloadLost" }>>([]);
  const [ammoWarningPopups, setAmmoWarningPopups] = useState<Array<{ id: number }>>([]);
  const [impactPopups, setImpactPopups] = useState<Array<{ id: number; kind: "ammo" | "balls" | "hp"; label: string; from: number; to: number; current: number }>>([]);
  const [animatedAmmoRemaining, setAnimatedAmmoRemaining] = useState<number | null>(null);
  const [timeUpNoticeUntil, setTimeUpNoticeUntil] = useState(0);
  const [reloadFlashKey, setReloadFlashKey] = useState(0);
  const [grenadeFlashKey, setGrenadeFlashKey] = useState(0);
  const [idleMicroPauseOpen, setIdleMicroPauseOpen] = useState(false);
  const [waveNoticeUntil, setWaveNoticeUntil] = useState(0);
  const [ammoEndNoticeVisible, setAmmoEndNoticeVisible] = useState(false);
  const [selectedAlveoleIds, setSelectedAlveoleIds] = useState<string[]>([]);
  const [betterShotSelected, setBetterShotSelected] = useState(false);
  const [uiNow, setUiNow] = useState(() => Date.now());
  const [waveUiStage, setWaveUiStage] = useState<"none" | "notice" | "results" | "evolution">("none");
  const [waveResult, setWaveResult] = useState<null | { outcome: "victory" | "defeat"; durationSeconds: number; reloadCount: number; maxCombo: number; previousRecord: number; combos: Record<string, number> }>(null);
  const waveStartedAtRef = useRef(performance.now());
  const waveReloadCountRef = useRef(0);
  const preWaveReloadCountRef = useRef(0);
  const waveMaxComboRef = useRef(0);
  const previousWaveMaxComboRef = useRef(0);
  const waveCombosRef = useRef<Record<string, number>>({});
  const ammoEndNoticeShownRef = useRef(false);
  const ammoEndNoticeArmedRef = useRef(true);
  const comboStarShownRef = useRef(false);
  const timeStarShownRef = useRef(false);
  const reloadStarLostShownRef = useRef(false);
  const lastAmmoWarningAtRef = useRef(0);
  const ammoAnimationTimerRef = useRef<number | null>(null);
  const hadPlayerInputRef = useRef(false);
  useEffect(() => { localStorage.setItem("bg_language", language); }, [language]);
  useEffect(() => { localStorage.setItem("bg_effect_ball", ballEffect); }, [ballEffect]);
  useEffect(() => { localStorage.setItem("bg_effect_grenade", grenadeEffect); }, [grenadeEffect]);
  useEffect(() => { localStorage.setItem("bg_debug_explosion_texture", debugExplosionTexture ? "1" : "0"); }, [debugExplosionTexture]);
  useEffect(() => () => {
    if (ammoAnimationTimerRef.current !== null) window.clearInterval(ammoAnimationTimerRef.current);
  }, []);
  const showStarPopup = (label: string, kind: "earned" | "lost" | "reloadLost" = "earned", durationMs = 2300) => {
    const id = Date.now() + Math.random();
    setStarPopups((prev) => [...prev, { id, label, kind }]);
    window.setTimeout(() => {
      setStarPopups((prev) => prev.filter((popup) => popup.id !== id));
    }, durationMs);
  };

  const animateAmmoCounter = (from: number, to: number) => {
    if (ammoAnimationTimerRef.current !== null) window.clearInterval(ammoAnimationTimerRef.current);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
    let current = Math.max(0, Math.round(from));
    const target = Math.max(current, Math.round(to));
    setAnimatedAmmoRemaining(current);
    setReloadFlashKey((prev) => prev + 1);
    ammoAnimationTimerRef.current = window.setInterval(() => {
      current += 1;
      setAnimatedAmmoRemaining(current);
      if (current >= target) {
        if (ammoAnimationTimerRef.current !== null) window.clearInterval(ammoAnimationTimerRef.current);
        ammoAnimationTimerRef.current = null;
        window.setTimeout(() => setAnimatedAmmoRemaining(null), 420);
      }
    }, 34);
  };

  const showImpactPopup = (kind: "ammo" | "balls" | "hp", label: string, from: number, to: number) => {
    const id = Date.now() + Math.random();
    const start = Math.round(from);
    const target = Math.max(start, Math.round(to));
    setImpactPopups((prev) => [...prev, { id, kind, label, from: start, to: target, current: start }]);
    let current = start;
    const step = Math.max(1, Math.ceil(Math.abs(target - start) / 24));
    const timer = window.setInterval(() => {
      current = Math.min(target, current + step);
      setImpactPopups((prev) => prev.map((popup) => popup.id === id ? { ...popup, current } : popup));
      if (current >= target) window.clearInterval(timer);
    }, 38);
    window.setTimeout(() => {
      window.clearInterval(timer);
      setImpactPopups((prev) => prev.filter((popup) => popup.id !== id));
    }, 1900);
  };

  const showEvolutionImpact = (effects: Partial<RuntimeModifiers> | undefined, ammoAdded: number, ammoFrom: number) => {
    if (ammoAdded > 0) {
      animateAmmoCounter(ammoFrom, ammoFrom + ammoAdded);
      showImpactPopup("ammo", "Munitions +", ammoFrom, ammoFrom + ammoAdded);
    }
    const densityBoost = Math.max(effects?.enemy_density ?? 1, effects?.enemy_spawn_rate ?? 1);
    if (densityBoost > 1.01) showImpactPopup("balls", "Plus de balles", 0, Math.max(2, Math.round((densityBoost - 1) * 20)));
    if ((effects?.enemy_hp ?? 1) > 1.01) showImpactPopup("hp", "HP ennemis", 100, Math.round(100 * (effects?.enemy_hp ?? 1)));
  };

  const showAmmoWarning = () => {
    const now = Date.now();
    if (now - lastAmmoWarningAtRef.current < 700) return;
    lastAmmoWarningAtRef.current = now;
    const id = now + Math.random();
    setAmmoWarningPopups((prev) => [...prev, { id }]);
    setReloadFlashKey((prev) => prev + 1);
    window.setTimeout(() => {
      setAmmoWarningPopups((prev) => prev.filter((popup) => popup.id !== id));
    }, 1200);
  };

  useEffect(() => {
    for (const event of lastEvents) {
      if (event.type === "grenade_awarded") {
        const id = Date.now() + Math.random();
        setGrenadeAwardPopups((prev) => [...prev, { id, amount: event.amount }]);
        window.setTimeout(() => {
          setGrenadeAwardPopups((prev) => prev.filter((popup) => popup.id !== id));
        }, 900);
      }
      if (event.type === "grenade_helper_flash") {
        setGrenadeFlashKey((prev) => prev + 1);
      }
      if (event.type === "combo_popup") {
        waveMaxComboRef.current = Math.max(waveMaxComboRef.current, event.streak);
        waveCombosRef.current[event.label] = (waveCombosRef.current[event.label] ?? 0) + 1;
        if (!comboStarShownRef.current && event.streak > previousWaveMaxComboRef.current) {
          comboStarShownRef.current = true;
          showStarPopup(language === "en" ? "Combo Star" : "Étoile Combo", "earned");
        }
      }
    }
  }, [lastEvents, language]);
  // Refs that mirror UI state so window-level listeners (installed once at
  // mount) always read the latest values without re-subscribing.
  const menuOpenRef = useRef(menuOpen);
  const isRunningRef = useRef(isRunning);
  const gameStateRef = useRef<GameState | null>(gameState);
  const configRef = useRef<GameConfig | null>(config);
  const lockOnRef = useRef(lockOn);
  const lockedBallIdRef = useRef<string | null>(lockedBallId);
  const homingOnRef = useRef(homingOn);
  useEffect(() => { menuOpenRef.current = menuOpen; }, [menuOpen]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { lockOnRef.current = lockOn; }, [lockOn]);
  useEffect(() => { lockedBallIdRef.current = lockedBallId; }, [lockedBallId]);
  useEffect(() => { homingOnRef.current = homingOn; }, [homingOn]);

  useEffect(() => {
    if (breathingWave.phase !== "breathing") return;
    const id = window.setInterval(() => setUiNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [breathingWave.phase]);

  useEffect(() => {
    if (breathingWave.phase === "breathing" && breathingWave.outcome) {
      const result = {
        outcome: breathingWave.outcome,
        durationSeconds: Math.max(0, (performance.now() - waveStartedAtRef.current) / 1000),
        reloadCount: waveReloadCountRef.current,
        maxCombo: waveMaxComboRef.current,
        previousRecord: previousWaveMaxComboRef.current,
        combos: { ...waveCombosRef.current },
      };
      setWaveResult(result);
      if (!timeStarShownRef.current) {
        timeStarShownRef.current = true;
        showStarPopup(result.outcome === "victory" ? (language === "en" ? "Kill Star" : "Étoile Kill") : (language === "en" ? "Kill Star Lost" : "Étoile Kill perdue"), result.outcome === "victory" ? "earned" : "lost");
      }
      previousWaveMaxComboRef.current = result.maxCombo;
      const noticeUntil = Date.now() + 2000;
      setTimeUpNoticeUntil(noticeUntil);
      setWaveNoticeUntil(noticeUntil);
      setWaveUiStage("notice");
      setSelectedAlveoleIds([]);
      setBetterShotSelected(false);
      setAmmoEndNoticeVisible(false);
    } else if (breathingWave.phase === "active") {
      setWaveUiStage("none");
      setSelectedAlveoleIds([]);
      setBetterShotSelected(false);
    }
  }, [breathingWave.phase, breathingWave.waveNumber, breathingWave.outcome, language]);

  useEffect(() => {
    if (waveUiStage !== "notice") return;
    const delay = Math.max(0, waveNoticeUntil - Date.now());
    const timer = window.setTimeout(() => setWaveUiStage("results"), delay);
    return () => window.clearTimeout(timer);
  }, [waveUiStage, waveNoticeUntil]);

  const handleMenuOpen = () => { setEvolutionInitialText(""); setAddFeaturePortalOpen(false); pause(); setMenuOpen(true); };
  const handleApplyInstantConfig = (nextConfig: GameConfig, options?: { reset?: boolean; playtestTarget?: unknown }) => {
    applyRuntimeConfig(nextConfig, options);
    setMenuOpen(false);
    resume();
  };

  const handleMenuClose = () => { setMenuOpen(false); setEvolutionInitialText(""); resume(); };
  const handleAddFeatureOpen = () => { pause(); setAddFeaturePortalOpen(true); };
  const handleAddFeatureClose = () => { setAddFeaturePortalOpen(false); resume(); };
  const openEvolutionFromAdd = (prompt: string) => {
    setEvolutionInitialText(prompt);
    setAddFeaturePortalOpen(false);
    pause();
    setMenuOpen(true);
  };
  const submitRandomIdeaFromAdd = async (prompt: string) => {
    if (!config || !gameState) throw new Error(t("app.error.configUnavailable"));
    await submitEvolutionRequest({
      evolutionRequest: config.evolution_request,
      requestText: prompt,
      currentLevelNumber: gameState.currentLevelId || gameState.currentLevelIndex + 1,
      difficulty,
      hpAdjustment,
    });
    setAddFeaturePortalOpen(false);
    resume();
  };

  const getDisplayMax = (): number => {
    if (!config) return 1.2;
    const types = config.gameplay_controls.shot_types;
    return Math.max((types.heavy?.max_hold_seconds ?? 0.8) * 1.2, 1.2);
  };

  const tryShootBall = (targetX: number, targetY: number, holdSeconds: number): boolean => {
    if (!isBossPhase && shotsRemaining <= 0) {
      showAmmoWarning();
      return false;
    }
    return shoot(targetX, targetY, holdSeconds) !== null;
  };

  const isBossPhase = (() => {
    if (!gameState) return false;
    if (gameState.bossIntroActive) return true;
    return Array.from(gameState.balls.values()).some((b) => b.isAlive && b.isBoss);
  })();
  const retryReason = gameState?.retryReason ?? null;
  const shotsRemaining = gameState?.ammoRemaining ?? 50;

  useEffect(() => { if (shotsRemaining > 15) ammoEndNoticeArmedRef.current = true; }, [shotsRemaining]);

  useEffect(() => {
    if (breathingWave.phase !== "active") return;
    if (shotsRemaining > 15 || ammoEndNoticeShownRef.current || !ammoEndNoticeArmedRef.current) return;
    ammoEndNoticeShownRef.current = true;
    setAmmoEndNoticeVisible(true);
    const timer = window.setTimeout(() => setAmmoEndNoticeVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [shotsRemaining, breathingWave.phase]);

  const computeInterceptTarget = (targetPos: Vec2, targetVel: Vec2, shotSpeed: number): Vec2 => {
    const shooter = { x: 0, y: -(config?.graphics.arena.height ?? 14) * 0.5 };
    const rx = targetPos.x - shooter.x;
    const ry = targetPos.y - shooter.y;
    const vx = targetVel.x;
    const vy = targetVel.y;
    const s2 = shotSpeed * shotSpeed;
    const a = vx * vx + vy * vy - s2;
    const b = 2 * (rx * vx + ry * vy);
    const c = rx * rx + ry * ry;
    let t = 0;
    if (Math.abs(a) < 1e-6) t = Math.abs(b) < 1e-6 ? 0 : Math.max(0, -c / b);
    else {
      const d = b * b - 4 * a * c;
      if (d >= 0) {
        const sd = Math.sqrt(d);
        const t1 = (-b - sd) / (2 * a);
        const t2 = (-b + sd) / (2 * a);
        const cs = [t1, t2].filter((x) => x > 0);
        t = cs.length ? Math.min(...cs) : 0;
      }
    }
    return { x: targetPos.x + targetVel.x * t, y: targetPos.y + targetVel.y * t };
  };

  // ---- Charge tracking (always visible cursor) ----
  useEffect(() => {
    const tick = () => {
      const hold = (performance.now() - cycleStartRef.current) / 1000;
      setHoldTime(Math.min(hold, getDisplayMax()));
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [config]);


  const handlePointerDown = (gameX: number, gameY: number) => {
    hadPlayerInputRef.current = true;
    setIdleMicroPauseOpen(false);
    if (menuOpenRef.current || !isRunningRef.current) return;
    if (minePlacementMode) return;
    pointerActiveRef.current = true;
    lastTargetRef.current = { x: gameX, y: gameY };
    const dx = gameX;
    const dy = gameY + (config?.graphics.arena.height ?? 0) * 0.5;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) {
      const next = { x: dx / len, y: dy / len };
      lastDirectionRef.current = next;
      setAimDirection(next);
    }
  };

  const handlePointerMove = (gameX: number, gameY: number) => {
    if (lockOn) return;
    lastTargetRef.current = { x: gameX, y: gameY };
    const dx = gameX;
    const dy = gameY + (config?.graphics.arena.height ?? 0) * 0.5;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) {
      const next = { x: dx / len, y: dy / len };
      lastDirectionRef.current = next;
      setAimDirection(next);
    }
  };

  const resolveShotTarget = (gameX: number, gameY: number, chargeSeconds: number): Vec2 => {
    const currentConfig = configRef.current;
    const currentState = gameStateRef.current;
    let tx = gameX;
    let ty = gameY;
    if (lockOnRef.current && lockedBallIdRef.current && currentState) {
      const b = currentState.balls.get(lockedBallIdRef.current);
      if (b?.isAlive) {
        const shotKind = classifyHold(chargeSeconds);
        const shotSpeed = currentConfig?.gameplay_controls.shot_types?.[shotKind]?.speed ?? 28;
        const intercept = homingOnRef.current ? computeInterceptTarget(b.position, b.velocity, shotSpeed) : b.position;
        tx = intercept.x;
        ty = intercept.y;
      }
    }
    const halfW = (currentConfig?.graphics.arena.width ?? 8) * 0.5;
    const halfH = (currentConfig?.graphics.arena.height ?? 14) * 0.5;
    return {
      x: Math.max(-halfW + 0.2, Math.min(halfW - 0.2, tx)),
      y: Math.max(-halfH + 0.2, Math.min(halfH - 0.2, ty)),
    };
  };


  useEffect(() => {
    if (!autoFire || !config) return;
    const interval = window.setInterval(() => {
      // Auto-fire owns only the idle state: pressing does nothing special,
      // releasing still fires manually, and no pointer held lets the virtual
      // charge shoot as soon as the mega tier is available.
      if (menuOpenRef.current || !isRunningRef.current || pointerActiveRef.current) return;
      const types = config.gameplay_controls.shot_types;
      const threshold = types.heavy?.max_hold_seconds ?? 0.8;
      const currentHold = (performance.now() - cycleStartRef.current) / 1000;
      if (currentHold < threshold) return;
      const injectedHold = Math.max(types.mega?.min_hold_seconds ?? threshold, threshold + 0.01);
      const target = resolveShotTarget(lastTargetRef.current.x, lastTargetRef.current.y, injectedHold);
      if (tryShootBall(target.x, target.y, injectedHold)) {
        cycleStartRef.current = performance.now();
        setHoldTime(0);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [autoFire, config, shoot, classifyHold]);

  const handlePointerUp = (gameX: number, gameY: number) => {
    hadPlayerInputRef.current = true;
    setIdleMicroPauseOpen(false);
    if (minePlacementMode) {
      if (!menuOpenRef.current && isRunningRef.current && placeMine({ x: gameX, y: gameY }, "mine")) setMinePlacementMode(false);
      cycleStartRef.current = performance.now();
      setHoldTime(0);
      return;
    }
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    if (!menuOpenRef.current && isRunningRef.current) {
      const target = resolveShotTarget(gameX, gameY, holdTime);
      tryShootBall(target.x, target.y, holdTime);
    }
    cycleStartRef.current = performance.now();
    setHoldTime(0);
  };

  const handlePointerCancel = () => {
    // The browser fires `pointercancel` quite aggressively on mobile
    // (e.g. when it decides a drag should become a scroll, even after
    // we set touch-action: none on some surfaces). Treating it as a
    // pure abort would silently swallow legitimate shots. Instead we
    // promote it to a release at the last tracked position — this is
    // the same idempotent path as a normal pointerup.
    const { x, y } = lastTargetRef.current;
    handlePointerUp(x, y);
  };

  // ---- Window-level pointerup safety net (installed once at mount) ----
  // If the user releases outside the canvas R3F won't emit onPointerUp,
  // so we always listen at the window. The handlers are gated by
  // holdStartRef so they no-op when no charge is in progress, and they
  // share the same idempotent path as the in-canvas handlers (no double
  // shot when both fire for the same release). Installed at mount to
  // close the small race window that would otherwise exist between
  // pointerdown and a `[isHolding]` effect remounting.
  useEffect(() => {
    const onWindowUp = () => {
      const { x, y } = lastTargetRef.current;
      handlePointerUp(x, y);
    };
    const onWindowCancel = () => {
      if (!pointerActiveRef.current) return;
      handlePointerCancel();
    };
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowCancel);
    return () => {
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gameState) return;
    const lastAliveHit = [...lastEvents].reverse().find((e) => e.type === "ball_damaged" && e.remainingHp > 0) as Extract<(typeof lastEvents)[number], { type: "ball_damaged" }> | undefined;
    const currentLocked = lockedBallId ? gameState.balls.get(lockedBallId) : null;
    if ((!currentLocked || !currentLocked.isAlive || currentLocked.hp <= 0) && lastAliveHit) setLockedBallId(lastAliveHit.ballId);
    if (!lockOn) return;
    let id = lockedBallId;
    const current = id ? gameState.balls.get(id) : null;
    if (!current || !current.isAlive) {
      let best: { id: string; d: number } | null = null;
      for (const b of gameState.balls.values()) {
        if (!b.isAlive || b.rule === "player_projectile" || b.color === "orange") continue;
        const d = b.position.x * b.position.x + b.position.y * b.position.y;
        if (!best || d < best.d) best = { id: b.id, d };
      }
      id = best?.id ?? null;
      setLockedBallId(id);
    }
    if (id) {
      const b = gameState.balls.get(id);
      if (b) {
        const shotKind = classifyHold(holdTime);
        const shotSpeed = config?.gameplay_controls.shot_types?.[shotKind]?.speed ?? 28;
        const intercept = homingOn ? computeInterceptTarget(b.position, b.velocity, shotSpeed) : b.position;
        const dx = intercept.x;
        const halfH = (config?.graphics.arena.height ?? 14) * 0.5;
        const ty = Math.max(-halfH + 0.2, Math.min(halfH - 0.2, intercept.y));
        const dy = ty + (config?.graphics.arena.height ?? 0) * 0.5;
        const len = Math.hypot(dx, dy);
        if (len > 0.001) {
          const next = { x: dx / len, y: dy / len };
          lastDirectionRef.current = next;
          setAimDirection(next);
        }
      }
    }
  }, [gameState, lastEvents, lockOn, lockedBallId, config, homingOn, classifyHold, holdTime]);


  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!hadPlayerInputRef.current && !menuOpenRef.current && isRunningRef.current) {
        setIdleMicroPauseOpen(true);
        requestContextualAlveoles();
      }
    }, 6500);
    const closeTimer = window.setTimeout(() => setIdleMicroPauseOpen(false), 10000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(closeTimer);
    };
  }, [requestContextualAlveoles]);


  if (!gameState || !config) {
    return (
      <div
        style={{
          width: "100vw", height: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#020810", color: "#1e90ff",
          fontFamily: "monospace", flexDirection: "column", gap: 12,
        }}
      >
        <div style={{ fontSize: 32 }}>◉</div>
        <div style={{ fontSize: 14, color: "#4466aa" }}>{t("app.loading")}</div>
      </div>
    );
  }

  const CartridgeIcon = ({ dimmed = false }: { dimmed?: boolean }) => (
    <span aria-hidden="true" style={{ display:"inline-flex", gap:2, alignItems:"center", justifyContent:"center" }}>
      {[0, 1, 2].map((idx) => (
        <span key={idx} style={{ width:6, height:18, borderRadius:"2px 2px 4px 4px", background: dimmed ? "#6b7280" : "linear-gradient(180deg, #ffe8a3 0%, #ffd166 58%, #b7791f 59%, #8a4f16 100%)", border:"1px solid rgba(255,255,255,.38)", boxShadow: dimmed ? "none" : "0 0 7px rgba(255,209,102,.45)", display:"inline-block" }} />
      ))}
    </span>
  );

  const currentShotKind: ShotKind = (() => {
    const types = config.gameplay_controls.shot_types;
    if (holdTime > types.mega.min_hold_seconds) return "mega";
    if (holdTime > types.heavy.min_hold_seconds) return "heavy";
    return "light";
  })();

  const visibleAlveoles = breathingWave.alveoles;
  const rawTimerSeconds = gameState.timerSecondsRemaining ?? Infinity;
  const finalCountdownSeconds = Number.isFinite(rawTimerSeconds) ? rawTimerSeconds : null;
  const reloadNeedsAttention = !isBossPhase && shotsRemaining <= 0;
  const showWaveNotice = breathingWave.phase === "breathing" && waveUiStage === "notice" && uiNow < waveNoticeUntil;
  const showTimeUpNotice = showWaveNotice && uiNow < timeUpNoticeUntil;
  const showResultsFrame = breathingWave.phase === "breathing" && waveUiStage === "results" && waveResult !== null;
  const showGameFunnel = breathingWave.phase === "breathing" && waveUiStage === "evolution";
  const selectedAlveoles = selectedAlveoleIds
    .map((id) => visibleAlveoles.find((alveole) => alveole.id === id))
    .filter((alveole): alveole is GameplayAlveole => Boolean(alveole));
  const handleGameplayReload = () => {
    const ammoBefore = Number.isFinite(shotsRemaining) ? shotsRemaining : 0;
    const feedback = reloadWave();
    if (feedback.ammoAdded > 0) {
      animateAmmoCounter(ammoBefore, ammoBefore + feedback.ammoAdded);
      showImpactPopup("ammo", "Recharge", ammoBefore, ammoBefore + feedback.ammoAdded);
    }
    const targetReloadRef = breathingWave.phase === "breathing" ? preWaveReloadCountRef : waveReloadCountRef;
    targetReloadRef.current += 1;
    if (targetReloadRef.current > 1) {
      reloadStarLostShownRef.current = true;
      showStarPopup(language === "en" ? "Reload Star Lost" : "Étoile recharge perdue", "reloadLost", 3300);
    }
  };
  const resetWaveTracking = () => {
    waveStartedAtRef.current = performance.now();
    waveReloadCountRef.current = preWaveReloadCountRef.current;
    preWaveReloadCountRef.current = 0;
    waveMaxComboRef.current = 0;
    waveCombosRef.current = {};
    ammoEndNoticeShownRef.current = false;
    ammoEndNoticeArmedRef.current = shotsRemaining > 15;
    comboStarShownRef.current = false;
    timeStarShownRef.current = false;
    reloadStarLostShownRef.current = waveReloadCountRef.current > 1;
    setAmmoEndNoticeVisible(false);
  };
  const handlePlayFunnel = () => {
    let ammoCursor = Number.isFinite(shotsRemaining) ? shotsRemaining : 0;
    for (const alveole of selectedAlveoles) {
      const feedback = applyAlveole(alveole);
      showEvolutionImpact(feedback.effects, feedback.ammoAdded, ammoCursor);
      ammoCursor += feedback.ammoAdded;
    }
    setSelectedAlveoleIds([]);
    if (betterShotSelected) upgradeBetterShot();
    setBetterShotSelected(false);
    resetWaveTracking();
    launchNextWave();
    setWaveUiStage("none");
  };

  return (
    <div
      style={{
        width: "100vw", height: "100vh",
        maxWidth: "100vh", margin: "0 auto",
        background: "#020810", position: "relative", overflow: "hidden",
        userSelect: "none",
        // Disable native touch gestures (scroll/pan/zoom) on the whole game
        // surface. Without this, mobile browsers fire a synthetic
        // `pointercancel` as soon as the finger drags far enough to be
        // interpreted as a scroll, which aborts the charge.
        touchAction: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        overscrollBehavior: "none",
      }}
    >
      {/* 3D Scene */}
      <div style={{ position: "absolute", inset: 0, touchAction: "none" }}>
        <GameScene
          gameState={gameState}
          config={config}
          events={lastEvents}
          ballEffect={ballEffect}
          grenadeEffect={grenadeEffect}
          aimDirection={aimDirection}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          debugExplosionTexture={debugExplosionTexture}
        />
      </div>

      {/* Charge bar (always visible) */}
      <ChargeBar holdTime={holdTime} shotKind={currentShotKind} config={config} />


      {gameState.bossIntroActive && (
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", pointerEvents:"none", zIndex:11 }}>
          <div style={{ fontSize:64, fontWeight:900, letterSpacing:8, color:"#fff", textShadow:"0 0 24px #ff3b3b, 0 0 8px #000" }}>{t("app.boss")}</div>
        </div>
      )}

      {gameState.bossHintActive && gameState.bossHintMessage && (
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", pointerEvents:"none", zIndex:11 }}>
          <div style={{ marginTop:118, fontSize:24, fontWeight:800, letterSpacing:1.5, color:"#ffe8a3", textShadow:"0 0 16px #000, 0 0 10px #ff8c00", textTransform:"uppercase" }}>
            {gameState.bossHintMessage}
          </div>
        </div>
      )}

      {showTimeUpNotice && (
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", pointerEvents:"none", zIndex:11 }}>
          <div style={{ fontSize:52, fontWeight:950, letterSpacing:5, color:"#fff", textAlign:"center", textShadow:"0 0 24px #ff7a00, 0 0 8px #000", textTransform:"uppercase" }}>
            {language === "en" ? "Time up" : "Temps écoulé"}
          </div>
        </div>
      )}

      {/* HUD */}
      <style>{`
        @keyframes grenade-helper-flash {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(255, 214, 102, 0); }
          50% { transform: scale(1.16); box-shadow: 0 0 24px rgba(255, 214, 102, 0.95), 0 0 42px rgba(255, 122, 0, 0.8); }
        }
        @keyframes alveole-breathe {
          0%, 100% { transform: translateY(0) scale(1); opacity: .92; }
          50% { transform: translateY(-2px) scale(1.025); opacity: 1; }
        }
        @keyframes ammo-countdown-pulse {
          0%, 100% { transform: scale(1); opacity: .9; text-shadow: 0 0 10px rgba(255,209,102,.55); }
          50% { transform: scale(1.18); opacity: 1; text-shadow: 0 0 20px rgba(255,209,102,.95), 0 0 34px rgba(255,77,122,.55); }
        }
        @keyframes star-earned-bounce {
          0%, 100% { transform: scale(1) rotate(-2deg); }
          35% { transform: scale(1.2) rotate(3deg); }
          65% { transform: scale(.96) rotate(-1deg); }
        }
        @keyframes star-earned-glow {
          0%, 100% { opacity: .68; transform: scale(.88); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes star-sparkle-drift {
          0% { opacity: 0; transform: translateY(8px) scale(.65); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-16px) scale(1.05); }
        }
        @keyframes mine-placement-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(255,77,122,0); }
          50% { transform: scale(1.08); box-shadow: 0 0 22px rgba(255,77,122,.75); }
        }
        @keyframes grenade-award-float {
          0% { opacity: 0; transform: translateY(8px) scale(0.8); }
          20% { opacity: 1; transform: translateY(0) scale(1.05); }
          100% { opacity: 0; transform: translateY(-34px) scale(1); }
        }
        @keyframes star-popup-earned {
          0% { opacity: 0; transform: translate(-50%, 16px) scale(.72) rotate(-8deg); }
          18% { opacity: 1; transform: translate(-50%, -8px) scale(1.18) rotate(4deg); }
          45%, 72% { opacity: 1; transform: translate(-50%, 0) scale(1) rotate(-2deg); }
          100% { opacity: 0; transform: translate(-50%, -48px) scale(1.04) rotate(2deg); }
        }
        @keyframes star-popup-lost {
          0% { opacity: 0; transform: translate(-50%, -22px) scale(1.08) rotate(7deg); }
          18%, 72% { opacity: 1; transform: translate(-50%, 0) scale(1) rotate(-4deg); }
          100% { opacity: 0; transform: translate(-50%, 46px) scale(.82) rotate(12deg); }
        }
        @keyframes reload-star-lost-pop {
          0% { opacity: 0; transform: translate(-50%, -26px) scale(.82) rotate(9deg); }
          16% { opacity: 1; transform: translate(-50%, 0) scale(1.22) rotate(-5deg); }
          28%, 72% { opacity: 1; transform: translate(-50%, 0) scale(1.06) rotate(-2deg); }
          100% { opacity: 0; transform: translate(-50%, 52px) scale(.9) rotate(10deg); }
        }
        @keyframes impact-popup-bump {
          0% { opacity: 0; transform: translateY(14px) scale(.8); }
          18% { opacity: 1; transform: translateY(-4px) scale(1.12); }
          38% { transform: translateY(0) scale(1); }
          78% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-26px) scale(.96); }
        }
        @keyframes impact-icon-bump {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          45% { transform: scale(1.28); filter: brightness(1.45) drop-shadow(0 0 12px rgba(122,252,255,.9)); }
        }
        @keyframes reload-needs-ammo-flash {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(122,252,255,0); }
          50% { transform: scale(1.13); box-shadow: 0 0 24px rgba(122,252,255,.95), 0 0 36px rgba(255,209,102,.48); }
        }
      `}</style>
      <button
        key={`reload-${reloadFlashKey}`}
        onClick={handleGameplayReload}
        style={{position:"absolute", left:16, bottom:140, width:56, height:56, borderRadius:"50%", border:"2px solid #7afcff", background:"radial-gradient(circle at 30% 30%, #366, #123)", color:"#eaffff", zIndex:12, fontWeight:"bold", display:"grid", placeItems:"center", animation: reloadNeedsAttention ? "reload-needs-ammo-flash 0.7s ease-in-out infinite" : reloadFlashKey > 0 ? "reload-needs-ammo-flash 0.42s ease-in-out 5" : undefined}}
        title="Recharger"
        aria-label="Recharger"
      >
        <CartridgeIcon />
      </button>
      <button
        key={`grenade-${grenadeFlashKey}`}
        onClick={() => toggleGrenade(lastDirectionRef.current, grenadeEffect)}
        style={{position:"absolute", right:16, bottom:140, width:56, height:56, borderRadius:"50%", border:"2px solid #ffcc66", background:"radial-gradient(circle at 30% 30%, #667, #223)", color:"#fff", zIndex:12, fontWeight:"bold", animation: grenadeFlashKey > 0 ? "grenade-helper-flash 0.35s ease-in-out 4" : undefined}}
      >
        💣 {grenadesLeft}
      </button>
      <button
        onClick={() => setMinePlacementMode((v) => !v)}
        title={minePlacementMode ? "Cancel mine placement" : "Place mine"}
        style={{position:"absolute", right:16, bottom:206, width:56, height:56, borderRadius:"50%", border:`2px solid ${minePlacementMode ? "#ff4d7a" : "#aab4c4"}`, background: minePlacementMode ? "radial-gradient(circle at 30% 30%, #ff4d7a, #30101c)" : "radial-gradient(circle at 30% 30%, #889, #223)", color:"#fff", zIndex:12, fontWeight:"bold", animation: minePlacementMode ? "mine-placement-pulse 0.8s ease-in-out infinite" : undefined}}
      >
        🧨
      </button>
      {minePlacementMode && <div style={{ position:"absolute", right:84, bottom:220, zIndex:12, pointerEvents:"none", color:"#ffd6e2", fontWeight:900, textShadow:"0 0 8px #000" }}>Release in field</div>}
      {grenadeAwardPopups.map((popup, index) => (
        <div
          key={popup.id}
          style={{ position:"absolute", right:28, bottom:200 + index * 18, zIndex:13, pointerEvents:"none", color:"#ffed9a", fontWeight:900, fontSize:22, textShadow:"0 0 10px #000, 0 0 12px #ff9f1c", animation:"grenade-award-float 0.9s ease-out forwards" }}
        >
          +{popup.amount}
        </div>
      ))}
      {starPopups.map((popup, index) => (
        <div
          key={`title-${popup.id}`}
          style={{ position:"absolute", left:"50%", top:158 + index * 64, transform:"translateX(-50%)", zIndex:13, pointerEvents:"none", width:"96vw", textAlign:"center", fontSize:44, fontWeight:950, letterSpacing:5, color:"rgba(255,255,255,.2)", textShadow:"0 0 22px rgba(122,252,255,.36), 0 0 8px #000", textTransform:"uppercase", animation:`${popup.kind === "reloadLost" ? "reload-star-lost-pop" : popup.kind === "lost" ? "star-popup-lost" : "star-popup-earned"} ${popup.kind === "reloadLost" ? 3.3 : 2.3}s ease-out forwards` }}
        >
          {popup.label}
        </div>
      ))}
      {starPopups.map((popup, index) => {
        const isReloadLost = popup.kind === "reloadLost";
        const isLost = popup.kind === "lost" || isReloadLost;
        return (
          <div
            key={popup.id}
            style={{ position:"absolute", left:"50%", top:210 + index * 64, zIndex:14, pointerEvents:"none", display:"flex", alignItems:"center", gap:12, padding:isReloadLost ? "12px 18px" : "9px 14px", borderRadius:999, border:`2px solid ${isReloadLost ? "rgba(168,85,247,.95)" : isLost ? "rgba(96,165,250,.82)" : "rgba(255,209,102,.82)"}`, background: isReloadLost ? "linear-gradient(135deg, rgba(35,18,80,.96), rgba(12,35,90,.94))" : isLost ? "rgba(15,23,42,.84)" : "rgba(60,40,5,.82)", color: isReloadLost ? "#f3e8ff" : isLost ? "#dbeafe" : "#fff4b8", fontWeight:1000, fontSize:isReloadLost ? 26 : 21, letterSpacing:isReloadLost ? 1.1 : .5, textTransform:isReloadLost ? "uppercase" : undefined, textShadow:isReloadLost ? "0 0 12px #000, 0 0 18px rgba(168,85,247,.95), 0 0 8px rgba(96,165,250,.9)" : "0 0 10px #000", boxShadow: isReloadLost ? "0 0 28px rgba(168,85,247,.65), 0 0 48px rgba(37,99,235,.38)" : isLost ? "0 0 20px rgba(96,165,250,.32)" : "0 0 24px rgba(255,209,102,.42)", animation:`${isReloadLost ? "reload-star-lost-pop" : isLost ? "star-popup-lost" : "star-popup-earned"} ${isReloadLost ? 3.3 : 2.3}s ease-out forwards` }}
          >
            <span style={{ fontSize:isReloadLost ? 40 : 31, color: isReloadLost ? "#a78bfa" : isLost ? "#60a5fa" : "#ffd166", filter: isLost ? "drop-shadow(0 0 12px rgba(96,165,250,.85))" : "drop-shadow(0 0 9px rgba(255,209,102,.88))" }}>★</span>
            <span>{popup.label}</span>
          </div>
        );
      })}
      {impactPopups.map((popup, index) => (
        <div
          key={popup.id}
          style={{ position:"absolute", left:18, top:190 + index * 74, zIndex:14, pointerEvents:"none", minWidth:168, padding:"10px 12px", borderRadius:18, border:"1px solid rgba(122,252,255,.58)", background:"rgba(3,10,24,.9)", color:"#eaffff", fontWeight:950, textShadow:"0 0 8px #000", boxShadow:"0 0 24px rgba(122,252,255,.24)", animation:"impact-popup-bump 1.9s ease-out forwards" }}
        >
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ display:"inline-grid", placeItems:"center", width:42, height:42, borderRadius:"50%", background:"rgba(122,252,255,.12)", animation:"impact-icon-bump .55s ease-in-out 3" }}>
              {popup.kind === "ammo" ? <CartridgeIcon /> : popup.kind === "balls" ? <span style={{ display:"flex", gap:3 }}>{[0,1,2].map((i) => <span key={i} style={{ width:12, height:12, borderRadius:"50%", background:["#7afcff", "#ffd166", "#c084fc"][i], boxShadow:"0 0 8px currentColor" }} />)}</span> : <span style={{ position:"relative", width:26, height:26, borderRadius:"50%", background:"radial-gradient(circle at 30% 25%, #ffe8a3, #ff4d7a)", boxShadow:"0 0 14px rgba(255,77,122,.75)" }} />}
            </span>
            <span style={{ flex:1 }}>
              <div style={{ fontSize:12, color:"#9db8d6", letterSpacing:1.5, textTransform:"uppercase" }}>{popup.label}</div>
              <div style={{ fontSize:22, color:"#fff", lineHeight:1.05 }}>{popup.kind === "balls" ? `+${popup.current}` : `${popup.current}`}</div>
            </span>
          </div>
        </div>
      ))}
      {ammoWarningPopups.map((popup, index) => (
        <div
          key={popup.id}
          style={{ position:"absolute", left:20, bottom:204 + index * 34, zIndex:14, pointerEvents:"none", padding:"8px 12px", borderRadius:999, border:"1px solid rgba(122,252,255,.55)", background:"rgba(3,10,24,.86)", color:"#eaffff", fontWeight:950, textShadow:"0 0 8px #000", animation:"grenade-award-float 1.2s ease-out forwards" }}
        >
          Plus de munitions
        </div>
      ))}
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 52, display: "flex", gap: 8, zIndex: 12 }}>
        <button
          onClick={() => setLockOn((v) => !v)}
          style={{ border:"1px solid #1e90ff", background: lockOn ? "#1e90ff" : "rgba(0,0,0,.55)", color:"#fff", borderRadius:8, padding:"6px 12px", minWidth: 106, whiteSpace: "nowrap" }}
        >
          {lockOn ? t("app.lock.on") : t("app.lock.off")}
        </button>
        <button
          onClick={() => { if (lockOn) setHomingOn((v) => !v); }}
          disabled={!lockOn}
          style={{ border:"1px solid #00d4aa", background: !lockOn ? "rgba(180,180,180,.55)" : homingOn ? "#00d4aa" : "rgba(0,0,0,.55)", color: !lockOn ? "#1a1a1a" : "#001e1a", borderRadius:8, padding:"6px 12px", fontWeight:700, minWidth: 106, whiteSpace: "nowrap" }}
        >
          {homingOn ? t("app.homing.on") : t("app.homing.off")}
        </button>
        <button
          onClick={() => setAutoFire((v) => !v)}
          style={{ border:"1px solid #ff9f1c", background: autoFire ? "#ff9f1c" : "rgba(0,0,0,.55)", color: autoFire ? "#2d1400" : "#ffe8c2", borderRadius:8, padding:"6px 12px", fontWeight:700, minWidth: 106, whiteSpace: "nowrap" }}
        >
          {autoFire ? t("app.autoFire.on") : t("app.autoFire.off")}
        </button>
      </div>

      <button
        onClick={handleMenuOpen}
        style={{ position: "absolute", top: 12, right: 12, zIndex: 95, pointerEvents: "all", background: "rgba(10,20,50,0.92)", color: "#c0d8ff", border: "1px solid rgba(30,144,255,0.5)", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 900, cursor: "pointer" }}
        title="Settings"
      >
        Settings
      </button>
      <button
        onClick={openRetryMenu}
        style={{ position: "absolute", top: 54, right: 12, width: 42, height: 42, zIndex: 95, pointerEvents: "all", background: "rgba(20,10,35,0.92)", color: "#ffe6f0", border: "1px solid rgba(255,77,122,0.55)", borderRadius: 10, fontSize: 20, cursor: "pointer", display:"grid", placeItems:"center" }}
        title={t("app.title.retry")}
      >
        ↻
      </button>
      <button
        onClick={handleAddFeatureOpen}
        style={{ position: "absolute", top: 102, right: 12, width: 42, height: 42, zIndex: 95, pointerEvents: "all", background: "rgba(10,35,28,0.92)", color: "#d7ffec", border: "1px solid rgba(102,255,187,0.55)", borderRadius: 10, fontSize: 24, fontWeight: 900, cursor: "pointer", display:"grid", placeItems:"center" }}
        title={t("app.title.add")}
      >
        +
      </button>
      <LanguageToggle />
      <AddFeaturePortal
        open={addFeaturePortalOpen}
        onClose={handleAddFeatureClose}
        onSendIdea={openEvolutionFromAdd}
        onSubmitRandomIdea={submitRandomIdeaFromAdd}
      />

      <div style={{ position:"absolute", left:"50%", top:78, transform:"translateX(-50%)", zIndex:20, pointerEvents:"none", display:"flex", flexDirection:"column", gap:8, width:"min(88vw, 430px)" }}>
        {ammoEndNoticeVisible && (
          <div style={{ padding:"8px 12px", borderRadius:14, background:"rgba(32,18,0,.84)", border:"1px solid rgba(255,209,102,.42)", color:"#fff3c4", boxShadow:"0 0 20px rgba(255,209,102,.18)", backdropFilter:"blur(10px)", textAlign:"center", fontWeight:900 }}>
            Fin de vague — ressources basses
          </div>
        )}
        {showResultsFrame && waveResult && (
          <div style={{ pointerEvents:"all", padding:12, borderRadius:16, background:"rgba(3,10,24,.9)", border:"1px solid rgba(255,255,255,.16)", backdropFilter:"blur(10px)", boxShadow:"0 12px 34px rgba(0,0,0,.28)", color:"#eaffff" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:2, fontSize:12 }}>
              <span>Record précédent x{waveResult.previousRecord}</span><span>Max vague x{waveResult.maxCombo}</span>
              <span>Rechargements {waveResult.reloadCount}</span><span>Temps {waveResult.durationSeconds.toFixed(1)}s</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10, marginTop:14 }}>
              {[
                { key:"fast", title:"Rapide", condition:"Kill Star", earned: waveResult.outcome === "victory" },
                { key:"expert", title:"Expert", condition:"1 seule recharge", earned: waveResult.reloadCount <= 1 },
                { key:"pro", title:"Pro", condition:"Record multiplicateur battu", earned: waveResult.maxCombo > waveResult.previousRecord },
              ].map((star, index) => (
                <div key={star.key} style={{ position:"relative", minHeight:118, borderRadius:14, padding:"8px 6px 10px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", gap:5, background: star.earned ? "radial-gradient(circle at 50% 16%, rgba(255,209,102,.22), rgba(255,255,255,.05) 46%, rgba(0,0,0,.12))" : "rgba(255,255,255,.035)", border:`1px solid ${star.earned ? "rgba(255,209,102,.48)" : "rgba(255,255,255,.12)"}`, boxShadow: star.earned ? "0 0 20px rgba(255,209,102,.18), inset 0 0 16px rgba(255,255,255,.05)" : "inset 0 0 16px rgba(255,255,255,.03)", overflow:"hidden" }}>
                  {star.earned && (
                    <>
                      <span style={{ position:"absolute", inset:18, borderRadius:"50%", background:"radial-gradient(circle, rgba(255,230,140,.48), rgba(255,209,102,.08) 52%, transparent 70%)", filter:"blur(3px)", animation:`star-earned-glow ${1.7 + index * .18}s ease-in-out infinite` }} />
                      <span style={{ position:"absolute", left:"23%", top:18, color:"#fff6c7", fontSize:10, animation:`star-sparkle-drift ${1.4 + index * .12}s ease-in-out infinite` }}>✦</span>
                      <span style={{ position:"absolute", right:"22%", top:34, color:"#fff6c7", fontSize:8, animation:`star-sparkle-drift ${1.55 + index * .16}s ease-in-out infinite .22s` }}>✧</span>
                    </>
                  )}
                  <svg viewBox="0 0 100 100" width="58" height="58" aria-hidden="true" style={{ position:"relative", zIndex:1, overflow:"visible", animation: star.earned ? `star-earned-bounce ${1.45 + index * .12}s cubic-bezier(.25,.9,.35,1.25) infinite` : undefined, filter: star.earned ? "drop-shadow(0 0 12px rgba(255,209,102,.9)) drop-shadow(0 0 22px rgba(255,153,64,.45))" : "drop-shadow(0 0 8px rgba(255,255,255,.12))" }}>
                    <defs>
                      <linearGradient id={`star-fill-${star.key}`} x1="18" y1="8" x2="82" y2="92" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#fff9bd" />
                        <stop offset="0.45" stopColor="#ffd166" />
                        <stop offset="1" stopColor="#ff9f1c" />
                      </linearGradient>
                    </defs>
                    <polygon points="50,6 62,35 94,37 69,58 77,90 50,73 23,90 31,58 6,37 38,35" fill={star.earned ? `url(#star-fill-${star.key})` : "rgba(255,255,255,.035)"} stroke={star.earned ? "#fff6b0" : "rgba(255,255,255,.42)"} strokeWidth={star.earned ? 3 : 4} strokeLinejoin="round" />
                    {!star.earned && <polygon points="50,19 58,40 80,42 63,56 68,78 50,66 32,78 37,56 20,42 42,40" fill="rgba(255,255,255,.045)" stroke="rgba(255,255,255,.16)" strokeWidth="2" strokeLinejoin="round" />}
                  </svg>
                  <div style={{ position:"relative", zIndex:1, fontSize:13, fontWeight:900, color: star.earned ? "#fff4b8" : "rgba(230,240,255,.62)", textShadow: star.earned ? "0 0 12px rgba(255,209,102,.72), 0 0 4px #000" : "0 0 4px #000" }}>{star.title}</div>
                  <div style={{ position:"relative", zIndex:1, fontSize:9.5, lineHeight:1.15, color: star.earned ? "#ffe8a3" : "rgba(184,216,255,.55)", textAlign:"center" }}>{star.condition}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:10, fontSize:12, color:"#b8d8ff" }}>
              {Object.entries(waveResult.combos).length === 0 ? "Aucun combo" : Object.entries(waveResult.combos).map(([name, count]) => <div key={name}>{name} × {count}</div>)}
            </div>
            <button onClick={() => setWaveUiStage("evolution")} style={{ marginTop:12, border:"1px solid #7afcff", background:"rgba(122,252,255,.14)", color:"#eaffff", borderRadius:999, padding:"8px 14px", fontWeight:900, cursor:"pointer", width:"100%" }}>Suivant</button>
          </div>
        )}
        {showGameFunnel && (
          <div style={{ pointerEvents:"all", padding:10, borderRadius:16, background:"rgba(3,10,24,.86)", border:"1px solid rgba(255,255,255,.16)", backdropFilter:"blur(10px)", boxShadow:"0 12px 34px rgba(0,0,0,.28)" }}>
            <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#7afcff", marginBottom:8 }}>Game</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {visibleAlveoles.map((alveole) => {
                const selected = selectedAlveoleIds.includes(alveole.id);
                return (
                  <button key={alveole.id} onClick={() => setSelectedAlveoleIds((prev) => selected ? prev.filter((id) => id !== alveole.id) : [...prev, alveole.id])} title={alveole.description} style={{ border:`1px solid ${selected ? "#ffd166" : "rgba(122,252,255,.4)"}`, background:selected ? "rgba(255,209,102,.22)" : "radial-gradient(circle at 30% 20%, rgba(122,252,255,.22), rgba(30,70,100,.24))", color:"#f3ffff", borderRadius:999, padding:"8px 11px", fontWeight:800, cursor:"pointer", boxShadow:"0 0 16px rgba(122,252,255,.12)" }}>
                    {alveole.label}
                  </button>
                );
              })}
              <button onClick={() => setBetterShotSelected((v) => !v)} title="Ajoute un nouveau tir plus puissant au cran maximum" style={{ border:`1px solid ${betterShotSelected ? "#ffd166" : "rgba(192,132,252,.55)"}`, background: betterShotSelected ? "rgba(255,209,102,.22)" : "rgba(192,132,252,.18)", color:"#f3e8ff", borderRadius:999, padding:"8px 11px", fontWeight:900, cursor:"pointer", boxShadow:"0 0 16px rgba(192,132,252,.12)" }}>
                Better Shot +{(gameState.betterShotLevel ?? 0) + 1}
              </button>
              {breathingWave.aiAnalyzing && visibleAlveoles.length === 0 && <span style={{ color:"#9db8d6", fontSize:12 }}>Analyse locale…</span>}
            </div>
            <button onClick={handlePlayFunnel} style={{ marginTop:10, border:"1px solid #66ffbb", background:"rgba(102,255,187,.16)", color:"#d7ffec", borderRadius:999, padding:"8px 14px", fontWeight:900, cursor:"pointer", width:"100%" }}>Play</button>
          </div>
        )}
      </div>
      <HUD
        gameState={gameState}
        config={config}
        isRunning={isRunning}
        levelTimerSeconds={isBossPhase ? null : finalCountdownSeconds}
        shotsRemaining={isBossPhase ? null : (animatedAmmoRemaining ?? shotsRemaining)}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        breathingWave={breathingWave}
      />

      {gameState.bossMasteredActive && (
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", pointerEvents:"none", zIndex:12 }}>
          <div style={{ fontSize:42, fontWeight:900, letterSpacing:4, color:"#ffe8a3", textShadow:"0 0 24px #ff9f1c, 0 0 10px #000", textTransform:"uppercase" }}>{t("app.bossMastered")}</div>
        </div>
      )}

      {/* Session clear overlay intentionally disabled for continuous breathing-wave flow. */}
      {retryReason && (
        <RetryOverlay
          reason={retryReason}
          levelNumber={gameState.currentLevelId || gameState.currentLevelIndex + 1}
          onRetry={reset}
          onGoToBoss={goToBoss}
          onSkipLevel={() => setActiveLevel(gameState.currentLevelIndex + 1)}
        />
      )}

      {/* Menu overlay */}
      {menuOpen && (
        <Menu
          config={config}
          onClose={handleMenuClose}
          onArenaChange={setArena}
          onTerrainDistributionPlay={setCustomTerrainDistribution}
          onLevelSelect={setActiveLevel}
          onLevelWeightsChange={setLevelWeights}
          onPlayBossRush={playBossRush}
          onApplyInstantConfig={handleApplyInstantConfig}
          onDifficultyChange={setDifficulty}
          difficulty={difficulty}
          hpAdjustment={hpAdjustment}
          onHpAdjustmentChange={setHpAdjustment}
          evolutionRequest={config.evolution_request}
          evolutionInitialText={evolutionInitialText}
          currentLevelNumber={gameState.currentLevelId || gameState.currentLevelIndex + 1}
          currentLevelIndex={gameState.currentLevelIndex}
          ballEffect={ballEffect}
          grenadeEffect={grenadeEffect}
          onBallEffectChange={setBallEffect}
          onGrenadeEffectChange={setGrenadeEffect}
          debugExplosionTexture={debugExplosionTexture}
          onDebugExplosionTextureChange={setDebugExplosionTexture}
          language={language}
          onLanguageChange={setLanguage}
          runtimeModifiers={runtimeModifiers}
          onRuntimeModifiersChange={setRuntimeModifiersFromSettings}
          onRuntimeModifiersReset={resetRuntimeModifiers}
        />
      )}
    </div>
  );
}

function App() {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());
  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    localStorage.setItem("ball_game_language", nextLanguage);
  };

  return (
    <I18nProvider language={language} setLanguage={setLanguage}>
      <AppContent />
    </I18nProvider>
  );
}

export default App;
