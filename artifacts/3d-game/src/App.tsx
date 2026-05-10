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
import type { GameConfig, GameState, ShotKind, Vec2 } from "./engine/types";
import { ChargeBar, IncomingBallsOverlay, PlayerQueue, SessionClearOverlay } from "./AppOverlays";

function App() {
  const {
    gameState, config, lastEvents, isRunning, playerQueue,
    pause, resume, reset, setArena,
    shoot, setCustomTerrainDistribution, setActiveLevel, setLevelWeights, applyRuntimeConfig, openRetryMenu, goToBoss, playBossRush, classifyHold, toggleGrenade, grenadesLeft, setDifficulty, difficulty, setHpAdjustment, hpAdjustment,
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
  const [addFeaturePortalOpen, setAddFeaturePortalOpen] = useState(false);
  const [evolutionInitialText, setEvolutionInitialText] = useState("");
  const [grenadeAwardPopups, setGrenadeAwardPopups] = useState<Array<{ id: number; amount: number }>>([]);
  const [grenadeFlashKey, setGrenadeFlashKey] = useState(0);
  useEffect(() => { localStorage.setItem("bg_effect_ball", ballEffect); }, [ballEffect]);
  useEffect(() => { localStorage.setItem("bg_effect_grenade", grenadeEffect); }, [grenadeEffect]);
  useEffect(() => { localStorage.setItem("bg_debug_explosion_texture", debugExplosionTexture ? "1" : "0"); }, [debugExplosionTexture]);
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
    }
  }, [lastEvents]);
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
    if (!config || !gameState) throw new Error("configuration du jeu indisponible");
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
    return shoot(targetX, targetY, holdSeconds) !== null;
  };

  const isBossPhase = (() => {
    if (!gameState) return false;
    if (gameState.bossIntroActive) return true;
    return Array.from(gameState.balls.values()).some((b) => b.isAlive && b.isBoss);
  })();
  const retryReason = gameState?.retryReason ?? null;
  const levelTimerSeconds = gameState?.timerSecondsRemaining ?? 60;
  const shotsRemaining = gameState?.ammoRemaining ?? 50;

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
    if (menuOpenRef.current || !isRunningRef.current) return;
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
        <div style={{ fontSize: 14, color: "#4466aa" }}>Chargement du moteur de jeu…</div>
      </div>
    );
  }

  const currentShotKind: ShotKind = (() => {
    const types = config.gameplay_controls.shot_types;
    if (holdTime > types.mega.min_hold_seconds) return "mega";
    if (holdTime > types.heavy.min_hold_seconds) return "heavy";
    return "light";
  })();

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
          <div style={{ fontSize:64, fontWeight:900, letterSpacing:8, color:"#fff", textShadow:"0 0 24px #ff3b3b, 0 0 8px #000" }}>BOSS</div>
        </div>
      )}

      {gameState.bossHintActive && gameState.bossHintMessage && (
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", pointerEvents:"none", zIndex:11 }}>
          <div style={{ marginTop:118, fontSize:24, fontWeight:800, letterSpacing:1.5, color:"#ffe8a3", textShadow:"0 0 16px #000, 0 0 10px #ff8c00", textTransform:"uppercase" }}>
            {gameState.bossHintMessage}
          </div>
        </div>
      )}

      {/* HUD */}
      <style>{`
        @keyframes grenade-helper-flash {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(255, 214, 102, 0); }
          50% { transform: scale(1.16); box-shadow: 0 0 24px rgba(255, 214, 102, 0.95), 0 0 42px rgba(255, 122, 0, 0.8); }
        }
        @keyframes grenade-award-float {
          0% { opacity: 0; transform: translateY(8px) scale(0.8); }
          20% { opacity: 1; transform: translateY(0) scale(1.05); }
          100% { opacity: 0; transform: translateY(-34px) scale(1); }
        }
      `}</style>
      <button
        key={`grenade-${grenadeFlashKey}`}
        onClick={() => toggleGrenade(lastDirectionRef.current, grenadeEffect)}
        style={{position:"absolute", right:16, bottom:140, width:56, height:56, borderRadius:"50%", border:"2px solid #ffcc66", background:"radial-gradient(circle at 30% 30%, #667, #223)", color:"#fff", zIndex:12, fontWeight:"bold", animation: grenadeFlashKey > 0 ? "grenade-helper-flash 0.35s ease-in-out 4" : undefined}}
      >
        💣 {grenadesLeft}
      </button>
      {grenadeAwardPopups.map((popup, index) => (
        <div
          key={popup.id}
          style={{ position:"absolute", right:28, bottom:200 + index * 18, zIndex:13, pointerEvents:"none", color:"#ffed9a", fontWeight:900, fontSize:22, textShadow:"0 0 10px #000, 0 0 12px #ff9f1c", animation:"grenade-award-float 0.9s ease-out forwards" }}
        >
          +{popup.amount}
        </div>
      ))}
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 52, display: "flex", gap: 8, zIndex: 12 }}>
        <button
          onClick={() => setLockOn((v) => !v)}
          style={{ border:"1px solid #1e90ff", background: lockOn ? "#1e90ff" : "rgba(0,0,0,.55)", color:"#fff", borderRadius:8, padding:"6px 12px", minWidth: 106, whiteSpace: "nowrap" }}
        >
          {lockOn ? "🔒 Lock" : "🔓 Lock"}
        </button>
        <button
          onClick={() => { if (lockOn) setHomingOn((v) => !v); }}
          disabled={!lockOn}
          style={{ border:"1px solid #00d4aa", background: !lockOn ? "rgba(180,180,180,.55)" : homingOn ? "#00d4aa" : "rgba(0,0,0,.55)", color: !lockOn ? "#1a1a1a" : "#001e1a", borderRadius:8, padding:"6px 12px", fontWeight:700, minWidth: 106, whiteSpace: "nowrap" }}
        >
          {homingOn ? "Homing ON" : "Homing"}
        </button>
        <button
          onClick={() => setAutoFire((v) => !v)}
          style={{ border:"1px solid #ff9f1c", background: autoFire ? "#ff9f1c" : "rgba(0,0,0,.55)", color: autoFire ? "#2d1400" : "#ffe8c2", borderRadius:8, padding:"6px 12px", fontWeight:700, minWidth: 106, whiteSpace: "nowrap" }}
        >
          {autoFire ? "Auto Fire ON" : "Auto Fire"}
        </button>
      </div>

      <button
        onClick={handleMenuOpen}
        style={{ position: "absolute", top: 12, right: 12, zIndex: 95, pointerEvents: "all", background: "rgba(10,20,50,0.92)", color: "#c0d8ff", border: "1px solid rgba(30,144,255,0.5)", borderRadius: 8, padding: "6px 14px", fontSize: 16, cursor: "pointer" }}
        title="Menu"
      >
        ☰
      </button>
      <button
        onClick={openRetryMenu}
        style={{ position: "absolute", top: 54, right: 12, width: 42, height: 42, zIndex: 95, pointerEvents: "all", background: "rgba(20,10,35,0.92)", color: "#ffe6f0", border: "1px solid rgba(255,77,122,0.55)", borderRadius: 10, fontSize: 20, cursor: "pointer", display:"grid", placeItems:"center" }}
        title="Retry"
      >
        ↻
      </button>
      <button
        onClick={handleAddFeatureOpen}
        style={{ position: "absolute", top: 102, right: 12, width: 42, height: 42, zIndex: 95, pointerEvents: "all", background: "rgba(10,35,28,0.92)", color: "#d7ffec", border: "1px solid rgba(102,255,187,0.55)", borderRadius: 10, fontSize: 24, fontWeight: 900, cursor: "pointer", display:"grid", placeItems:"center" }}
        title="Add"
      >
        +
      </button>
      <AddFeaturePortal
        open={addFeaturePortalOpen}
        onClose={handleAddFeatureClose}
        onSendIdea={openEvolutionFromAdd}
        onSubmitRandomIdea={submitRandomIdeaFromAdd}
      />
      <HUD
        gameState={gameState}
        config={config}
        isRunning={isRunning}
        levelTimerSeconds={isBossPhase ? null : levelTimerSeconds}
        shotsRemaining={isBossPhase ? null : shotsRemaining}
        onPause={pause}
        onResume={resume}
        onReset={reset}
      />

      {gameState.bossMasteredActive && (
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", pointerEvents:"none", zIndex:12 }}>
          <div style={{ fontSize:42, fontWeight:900, letterSpacing:4, color:"#ffe8a3", textShadow:"0 0 24px #ff9f1c, 0 0 10px #000", textTransform:"uppercase" }}>Boss Mastered</div>
        </div>
      )}

      {/* Game-over flash */}
      {gameState.sessionCleared && (
        <SessionClearOverlay config={config} gameState={gameState} />
      )}
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
        />
      )}
    </div>
  );
}

export default App;
