// ============================================================
// GameScene — Three.js 3D Scene (top-down portrait view)
//
// ARCHITECTURE NOTE:
// - This component is purely graphical. It renders the arena,
//   balls, and lighting. It reads from GameState (logic layer)
//   but never modifies it.
// - Camera is fixed overhead (orthographic-style perspective)
//   for the top-down portrait view.
// - Arena dimensions come from game_config.json (graphics.arena).
// ============================================================

import { Canvas } from "@react-three/fiber";
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

function Arena({ config }: { config: GameConfig }) {
  const w = config.graphics.arena.width;
  const h = config.graphics.arena.height;

  const gridLines = useMemo(() => {
    const lines: ReactElement[] = [];
    const cols = Math.floor(w);
    const rows = Math.floor(h);
    for (let i = -Math.floor(cols / 2); i <= Math.floor(cols / 2); i++) {
      lines.push(
        <mesh key={`vl-${i}`} position={[i, 0.002, 0]}>
          <boxGeometry args={[0.01, 0.001, h]} />
          <meshBasicMaterial color="#1a2a3a" />
        </mesh>
      );
    }
    for (let j = -Math.floor(rows / 2); j <= Math.floor(rows / 2); j++) {
      lines.push(
        <mesh key={`hl-${j}`} position={[0, 0.002, j]}>
          <boxGeometry args={[w, 0.001, 0.01]} />
          <meshBasicMaterial color="#1a2a3a" />
        </mesh>
      );
    }
    return lines;
  }, [w, h]);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#0a1520" roughness={0.9} metalness={0.0} />
      </mesh>

      {/* Grid overlay */}
      {gridLines}

      {/* Border walls (visible) */}
      <mesh position={[0, 0.1, -h / 2 - 0.02]}>
        <boxGeometry args={[w + 0.1, 0.2, 0.04]} />
        <meshStandardMaterial color="#1e90ff" emissive="#1e90ff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0.1, h / 2 + 0.02]}>
        <boxGeometry args={[w + 0.1, 0.2, 0.04]} />
        <meshStandardMaterial color="#1e90ff" emissive="#1e90ff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-w / 2 - 0.02, 0.1, 0]}>
        <boxGeometry args={[0.04, 0.2, h]} />
        <meshStandardMaterial color="#1e90ff" emissive="#1e90ff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[w / 2 + 0.02, 0.1, 0]}>
        <boxGeometry args={[0.04, 0.2, h]} />
        <meshStandardMaterial color="#1e90ff" emissive="#1e90ff" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function Scene({ gameState, config }: GameSceneProps) {
  const balls: BallState[] = Array.from(gameState.balls.values()).filter(
    (b) => b.isAlive
  );

  const arenaH = config.graphics.arena.height;
  const camY = config.graphics.camera.height ?? 12;

  return (
    <>
      {/* Overhead camera — portrait top-down */}
      <OrthographicCamera
        makeDefault
        position={[0, camY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        zoom={55 / arenaH}
        near={0.1}
        far={100}
      />

      {/* Ambient light */}
      <ambientLight intensity={0.4} />

      {/* Key light */}
      <directionalLight
        position={[2, 10, 4]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* Subtle fill light from below */}
      <pointLight position={[0, -2, 0]} intensity={0.15} color="#4488ff" />

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
