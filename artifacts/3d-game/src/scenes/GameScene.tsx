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
import { useMemo } from "react";
import type { ReactElement } from "react";
import { BallMesh } from "./BallMesh";
import { HpPopups } from "./HpPopups";
import type { BallState, GameConfig, GameEvent, GameState } from "../engine/types";

interface GameSceneProps {
  gameState: GameState;
  config: GameConfig;
  events: GameEvent[];
  onPointerDown?: () => void;
  onPointerUp?: (gameX: number, gameY: number) => void;
  onPointerCancel?: () => void;
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
// IMPORTANT: we capture the pointer on press so the hold survives
// even if the finger drags off the arena. The plane itself is
// drawn very large so raycasting keeps hitting it during drags.
// We deliberately do NOT cancel on pointerleave (that aborted
// every drag); we only honor real OS-level pointercancel events.
// ============================================================
function ClickPlane({
  config, onPointerDown, onPointerUp, onPointerCancel,
}: {
  config: GameConfig;
  onPointerDown?: () => void;
  onPointerUp?: (gameX: number, gameY: number) => void;
  onPointerCancel?: () => void;
}) {
  const w = config.graphics.arena.width;
  const h = config.graphics.arena.height;
  // Very large catch plane so a finger drag never escapes the raycast.
  const planeSize = Math.max(w, h) * 20;

  const tryCapture = (target: unknown, pointerId: number) => {
    const el = target as { setPointerCapture?: (id: number) => void } | null;
    if (el && typeof el.setPointerCapture === "function") {
      try { el.setPointerCapture(pointerId); } catch { /* ignore */ }
    }
  };
  const tryRelease = (target: unknown, pointerId: number) => {
    const el = target as { releasePointerCapture?: (id: number) => void } | null;
    if (el && typeof el.releasePointerCapture === "function") {
      try { el.releasePointerCapture(pointerId); } catch { /* ignore */ }
    }
  };

  return (
    <mesh
      position={[0, 0.04, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.pointerId !== undefined) tryCapture(e.target, e.pointerId);
        onPointerDown?.();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (e.pointerId !== undefined) tryRelease(e.target, e.pointerId);
        if (onPointerUp) onPointerUp(e.point.x, -e.point.z);
      }}
      onPointerCancel={(e) => {
        if (e.pointerId !== undefined) tryRelease(e.target, e.pointerId);
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

function Scene({ gameState, config, events, onPointerDown, onPointerUp, onPointerCancel }: GameSceneProps) {
  const balls: BallState[] = Array.from(gameState.balls.values()).filter((b) => b.isAlive);
  const w = config.graphics.arena.width;
  const h = config.graphics.arena.height;
  const lightHeight = Math.max(80, Math.max(w, h) * 0.8);

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
      {balls.map((ball) => <BallMesh key={ball.id} ball={ball} config={config} />)}
      <HpPopups events={events} />
      <ClickPlane
        config={config}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
    </>
  );
}

export function GameScene({ gameState, config, events, onPointerDown, onPointerUp, onPointerCancel }: GameSceneProps) {
  return (
    <Canvas
      shadows
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <Scene
        gameState={gameState}
        config={config}
        events={events}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
    </Canvas>
  );
}
