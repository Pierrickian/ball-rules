// ============================================================
// GameScene — Three.js 3D Scene (top-down portrait view)
//
// ARCHITECTURE NOTE:
// - This component is purely graphical.
// - The orthographic camera dynamically computes its zoom to
//   fit the arena to the viewport (with a small padding).
// - Arena dimensions come from game_config.json (graphics.arena),
//   which is updated live by useGameEngine.setArena().
// ============================================================

import { Canvas, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";
import type { ReactElement } from "react";
import { BallMesh } from "./BallMesh";
import type { BallState, GameConfig, GameState } from "../engine/types";

interface GameSceneProps {
  gameState: GameState;
  config: GameConfig;
}

// ============================================================
// FitCamera — viewport-aware orthographic camera
// Picks the zoom that makes the arena fill the viewport with
// the configured padding. Re-evaluates on viewport / config
// changes (React component re-renders when config changes).
// ============================================================
function FitCamera({ config }: { config: GameConfig }) {
  const { size } = useThree();
  const arenaW = config.graphics.arena.width;
  const arenaH = config.graphics.arena.height;
  const padding = config.graphics.camera?.fit_padding ?? 0.94;
  const camY    = config.graphics.camera?.height ?? 200;

  // Drei OrthographicCamera with `zoom`: visible_world = viewport_pixels / zoom
  // We want arena_dim to fit viewport_dim with padding, so:
  //   zoom = (viewport / arena_dim) * padding
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
// Arena floor + grid + walls
// ============================================================
function Arena({ config }: { config: GameConfig }) {
  const w = config.graphics.arena.width;
  const h = config.graphics.arena.height;

  const gridLines = useMemo(() => {
    const lines: ReactElement[] = [];
    // Adaptive spacing — keep ~10–14 lines per axis regardless of arena size
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
      {/* Floor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#0a1520" roughness={0.9} metalness={0.0} />
      </mesh>

      {/* Grid overlay */}
      {gridLines}

      {/* Border walls (visible glow) */}
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

function Scene({ gameState, config }: GameSceneProps) {
  const balls: BallState[] = Array.from(gameState.balls.values()).filter((b) => b.isAlive);
  const w = config.graphics.arena.width;
  const h = config.graphics.arena.height;
  const lightHeight = Math.max(80, Math.max(w, h) * 0.8);

  return (
    <>
      <FitCamera config={config} />

      {/* Ambient light */}
      <ambientLight intensity={0.4} />

      {/* Key directional light (shadows fitted to arena) */}
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

      {/* Subtle fill light from below */}
      <pointLight position={[0, -10, 0]} intensity={0.15} color="#4488ff" />

      {/* Arena */}
      <Arena config={config} />

      {/* Balls */}
      {balls.map((ball) => (
        <BallMesh key={ball.id} ball={ball} config={config} />
      ))}
    </>
  );
}

export function GameScene({ gameState, config }: GameSceneProps) {
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
      <Scene gameState={gameState} config={config} />
    </Canvas>
  );
}
