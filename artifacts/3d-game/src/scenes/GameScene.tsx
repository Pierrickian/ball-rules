// ============================================================
// GameScene — Three.js 3D Scene (top-down portrait view)
//
// ARCHITECTURE NOTE:
// - This component is purely graphical.
// - The orthographic camera dynamically computes its zoom to
//   fit the arena to the viewport (with a small padding).
// - An invisible click plane catches player pointer input and
//   converts it to game (x, y) coordinates.
// ============================================================

import { Canvas, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { BallMesh } from "./BallMesh";
import { HpPopups } from "./HpPopups";
import { ExplosionSprite } from "./ExplosionSprite";
import type { BallState, GameConfig, GameEvent, GameState } from "../engine/types";

interface GameSceneProps {
  gameState: GameState;
  config: GameConfig;
  events: GameEvent[];
  ballEffect?: string;
  grenadeEffect?: string;
  aimDirection?: { x: number; y: number };
  onPointerDown?: (gameX: number, gameY: number) => void;
  onPointerMove?: (gameX: number, gameY: number) => void;
  onPointerUp?: (gameX: number, gameY: number) => void;
  onPointerCancel?: () => void;
  debugExplosionTexture?: boolean;
}

// ============================================================
// FitCamera
// ============================================================
function FitCamera({ config }: { config: GameConfig }) {
  const { size } = useThree();
  const arenaW = config.graphics.arena.width;
  const arenaH = config.graphics.arena.height;
  const padding = config.graphics.camera?.fit_padding ?? 0.94;
  const camY    = config.graphics.camera?.height ?? 200;

  const zoomX = (size.width  / Math.max(arenaW, 0.1)) * padding;
  const zoomY = (size.height / Math.max(arenaH, 0.1)) * padding;
  const zoom  = Math.min(zoomX, zoomY);

  return (
    <OrthographicCamera
      makeDefault
      position={[0, camY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      zoom={zoom}
      near={0.1}
      far={camY * 4}
    />
  );
}

// ============================================================
// ClickPlane — invisible plane covering arena to capture input
// e.point gives the world-space hit. Game coords: x = e.point.x,
// y = -e.point.z (we flip Z when rendering balls).
//
// Behaviour:
//  - The plane is drawn very large so onPointerMove keeps firing
//    while the finger drags inside the canvas.
//  - We do NOT cancel on pointerleave (that aborted every drag).
//  - onPointerCancel is honoured for real OS-level cancels only.
//  - We do NOT call setPointerCapture: in R3F that disables the
//    raycaster-based dispatch and the mesh stops receiving
//    onPointerUp. Instead, App.tsx installs a window-level
//    pointerup as a safety net using the last tracked position.
// ============================================================
function ClickPlane({
  config, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
}: {
  config: GameConfig;
  onPointerDown?: (gameX: number, gameY: number) => void;
  onPointerMove?: (gameX: number, gameY: number) => void;
  onPointerUp?: (gameX: number, gameY: number) => void;
  onPointerCancel?: () => void;
  debugExplosionTexture?: boolean;
}) {
  const w = config.graphics.arena.width;
  const h = config.graphics.arena.height;
  // Very large catch plane so a drag never escapes the raycaster.
  const planeSize = Math.max(w, h) * 20;

  return (
    <mesh
      position={[0, 0.04, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.(e.point.x, -e.point.z);
      }}
      onPointerMove={(e) => {
        onPointerMove?.(e.point.x, -e.point.z);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onPointerUp?.(e.point.x, -e.point.z);
      }}
      onPointerCancel={() => {
        onPointerCancel?.();
      }}
    >
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ============================================================
// Arena floor + grid + walls
// ============================================================
function Arena({ config }: { config: GameConfig }) {
  const w = config.graphics.arena.width;
  const h = config.graphics.arena.height;

  const gridLines = useMemo(() => {
    const lines: ReactElement[] = [];
    const xSpacing = Math.max(1, Math.ceil(w / 12));
    const ySpacing = Math.max(1, Math.ceil(h / 18));

    for (let i = -Math.floor(w / 2); i <= Math.floor(w / 2); i += xSpacing) {
      lines.push(
        <mesh key={`vl-${i}`} position={[i, 0.02, 0]}>
          <boxGeometry args={[Math.max(0.05, w * 0.002), 0.005, h]} />
          <meshBasicMaterial color="#1a2a3a" />
        </mesh>
      );
    }
    for (let j = -Math.floor(h / 2); j <= Math.floor(h / 2); j += ySpacing) {
      lines.push(
        <mesh key={`hl-${j}`} position={[0, 0.02, j]}>
          <boxGeometry args={[w, 0.005, Math.max(0.05, h * 0.002)]} />
          <meshBasicMaterial color="#1a2a3a" />
        </mesh>
      );
    }
    return lines;
  }, [w, h]);

  const wallHeight = Math.max(1.0, Math.min(w, h) * 0.025);
  const wallThick  = Math.max(0.2, Math.min(w, h) * 0.005);

  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#0a1520" roughness={0.9} metalness={0.0} />
      </mesh>
      {gridLines}
      <mesh position={[0, wallHeight / 2, -h / 2 - wallThick / 2]}>
        <boxGeometry args={[w + wallThick * 2, wallHeight, wallThick]} />
        <meshStandardMaterial color="#1e90ff" emissive="#1e90ff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, wallHeight / 2, h / 2 + wallThick / 2]}>
        <boxGeometry args={[w + wallThick * 2, wallHeight, wallThick]} />
        <meshStandardMaterial color="#1e90ff" emissive="#1e90ff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-w / 2 - wallThick / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThick, wallHeight, h]} />
        <meshStandardMaterial color="#1e90ff" emissive="#1e90ff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[w / 2 + wallThick / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThick, wallHeight, h]} />
        <meshStandardMaterial color="#1e90ff" emissive="#1e90ff" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}


interface SpawnedExplosion {
  id: string;
  kind: "ball" | "grenade";
  effect: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  spawnedAt: number;
  expiresAt: number;
}

function Scene({ gameState, config, events, aimDirection, ballEffect, grenadeEffect, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, debugExplosionTexture }: GameSceneProps) {
  const balls: BallState[] = Array.from(gameState.balls.values()).filter((b) => b.isAlive);
  const [blackHpVisibleUntil, setBlackHpVisibleUntil] = useState<Record<string, number>>({});
  const hideTimersRef = useRef<Map<string, number>>(new Map());
  const w = config.graphics.arena.width;
  const h = config.graphics.arena.height;
  const lightHeight = Math.max(80, Math.max(w, h) * 0.8);
  const blackHpRevealMs = 1000;
  const baseDiameter = config.graphics.ball_sizes[config.gameplay_controls.queue_ball_size]?.diameter ?? 1;
  const grenadeRadius = baseDiameter * 3;
  const [spawnedExplosions, setSpawnedExplosions] = useState<SpawnedExplosion[]>([]);
  const arenaHalfH = h / 2;
  const grenadeTemplateOriginY = -arenaHalfH + 2;
  const aimLength = Math.max(8, Math.min(w, h) * 0.22);

  useEffect(() => {
    if (!events || events.length === 0) return;
    const now = Date.now();
    for (const ev of events) {
      if (ev.type !== "ball_damaged" && ev.type !== "ball_healed") continue;
      const ball = gameState.balls.get(ev.ballId);
      if (!ball || ball.color !== "black") continue;

      const until = now + blackHpRevealMs;
      setBlackHpVisibleUntil((prev) => ({ ...prev, [ev.ballId]: until }));

      const priorTimer = hideTimersRef.current.get(ev.ballId);
      if (priorTimer !== undefined) window.clearTimeout(priorTimer);

      const timerId = window.setTimeout(() => {
        hideTimersRef.current.delete(ev.ballId);
        setBlackHpVisibleUntil((prev) => {
          const next = { ...prev };
          delete next[ev.ballId];
          return next;
        });
      }, blackHpRevealMs);
      hideTimersRef.current.set(ev.ballId, timerId);
    }
  }, [events, gameState.balls]);

  useEffect(() => {
    return () => {
      for (const timerId of hideTimersRef.current.values()) window.clearTimeout(timerId);
      hideTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    const fresh = events
      .filter((e): e is Extract<GameEvent, { type: "ball_despawned" }> => e.type === "ball_despawned" && !!e.position)
      .filter((e) => e.reason === "killed_by_player" || e.reason === "killed_by_grenade" || e.reason === "grenade_exploded")
      .map((ev, i) => {
        const kind = ev.reason === "killed_by_player" ? "ball" as const : "grenade" as const;
        return {
          id: `${ev.ballId}-${ev.reason}-${i}-${now}`,
          kind,
          effect: ev.effect || (kind === "ball" ? ballEffect ?? "pulse" : grenadeEffect ?? "ring"),
          position: ev.position!,
          velocity: ev.velocity ?? { x: 0, y: 0 },
          spawnedAt: now,
          expiresAt: now + (kind === "ball" ? 1000 : 2000),
        };
      });
    if (fresh.length) {
      for (const fx of fresh) console.info(`[explosion] trigger kind=${fx.kind} effect=${fx.effect} x=${fx.position.x.toFixed(2)} y=${fx.position.y.toFixed(2)}`);
      setSpawnedExplosions((prev) => [...prev.filter((x) => x.expiresAt > now), ...fresh].slice(-20));
    }
    else setSpawnedExplosions((prev) => prev.filter((x) => x.expiresAt > now));
  }, [events, ballEffect, grenadeEffect]);

  return (
    <>
      <FitCamera config={config} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[w * 0.15, lightHeight, h * 0.2]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-w / 2 - 5}
        shadow-camera-right={w / 2 + 5}
        shadow-camera-top={h / 2 + 5}
        shadow-camera-bottom={-h / 2 - 5}
        shadow-camera-near={1}
        shadow-camera-far={lightHeight * 2}
      />
      <pointLight position={[0, -10, 0]} intensity={0.15} color="#4488ff" />
      <Arena config={config} />
      {aimDirection && (
        <>
          <mesh position={[0, 0.08, -grenadeTemplateOriginY]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[grenadeRadius - 0.1, grenadeRadius, 64]} />
            <meshBasicMaterial color="#ffcc66" transparent opacity={0.55} />
          </mesh>
          <mesh position={[aimDirection.x * (aimLength * 0.5), 0.07, -(grenadeTemplateOriginY + aimDirection.y * (aimLength * 0.5))]} rotation={[-Math.PI / 2, 0, Math.atan2(aimDirection.y, aimDirection.x)]}>
            <planeGeometry args={[aimLength, 0.35]} />
            <meshBasicMaterial color="#78c8ff" transparent opacity={0.7} />
          </mesh>
        </>
      )}
      {balls.map((ball) => (
        <BallMesh
          key={ball.id}
          ball={ball}
          config={config}
          showBlackHpLabel={ball.color === "black" && (blackHpVisibleUntil[ball.id] ?? 0) > Date.now()}
        />
      ))}
      <HpPopups events={events} />
      {events.filter((e) => e.type === "ball_damaged").slice(-8).map((e, i) => {
        const ev = e as Extract<GameEvent, { type: "ball_damaged" }>;
        return <mesh key={`${ev.ballId}-${i}`} position={[ev.position.x, 0.1, -ev.position.y]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.2, 0.35, 20]} /><meshBasicMaterial color={ballEffect === "shock" ? "#ffcc66" : "#66ccff"} transparent opacity={0.4} /></mesh>;
      })}
      {spawnedExplosions.map((ev) => {
        const now = Date.now();
        const total = Math.max(1, ev.expiresAt - ev.spawnedAt);
        const t = Math.max(0, Math.min(1, (now - ev.spawnedAt) / total));
        const inertia = t - 0.5 * t * t;
        const pos = { x: ev.position.x + ev.velocity.x * inertia, y: ev.position.y + ev.velocity.y * inertia };
        const fade = 1 - t;
        const scale = 0.75 + t * 1.35;
        const effect = ev.effect;
        const isBall = ev.kind === "ball";
        const color = isBall
          ? (effect === "shock" ? "#ffe089" : effect === "nova" ? "#9de0ff" : "#66ccff")
          : (effect === "flash" ? "#fff2b5" : effect === "smoke" ? "#aab4c4" : effect === "flare" ? "#ffb35c" : effect === "shard" ? "#7fd0ff" : "#ffcc66");
        return (
          <group key={ev.id} position={[pos.x, 0.14, -pos.y]}>
            <ExplosionSprite kind={isBall ? "ball" : "grenade"} effect={effect} t={t} debugTexture={debugExplosionTexture} />
          </group>
        );
      })}
      <ClickPlane
        config={config}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
    </>
  );
}

export function GameScene({ gameState, config, events, aimDirection, ballEffect, grenadeEffect, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, debugExplosionTexture }: GameSceneProps) {
  return (
    <Canvas
      shadows
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      // `touchAction: "none"` here is critical: without it mobile browsers
      // fire a synthetic `pointercancel` as soon as the finger drags far
      // enough to look like a scroll, which aborts the shot charge.
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
        <Scene
          gameState={gameState}
          config={config}
          events={events}
          aimDirection={aimDirection}
          ballEffect={ballEffect}
          grenadeEffect={grenadeEffect}
          onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
    </Canvas>
  );
}
