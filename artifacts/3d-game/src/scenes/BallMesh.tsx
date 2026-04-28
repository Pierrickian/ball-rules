// ============================================================
// BallMesh — 3D visual representation of a Ball
//
// ARCHITECTURE NOTE:
// - Purely visual. Reads BallState, renders a metallic sphere.
// - All visual parameters (color, roughness, metalness) come
//   from game_config.json via props. Nothing hard-coded.
// - Physics stays in 2D (X/Y). Y-axis in Three.js = Z in game.
// - Balls are lit with metallic shiny material (PBR).
// - Scale is driven by ball.diameter, geometry uses unit radius.
// ============================================================

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BallState, GameConfig } from "../engine/types";

interface BallMeshProps {
  ball: BallState;
  config: GameConfig;
}

const UNIT_RADIUS = 0.5; // geometry built at radius=0.5, scaled by diameter

export function BallMesh({ ball, config }: BallMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef(0);

  // Color from config
  const colorEntry = config.ball_colors[ball.color];
  const hexColor = colorEntry?.hex ?? "#ffffff";
  const threeColor = new THREE.Color(hexColor);

  // Material params from config
  const matCfg = config.graphics.ball_material ?? { roughness: 0.05, metalness: 0.85, emissive_intensity: 0.25 };

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Move to game position (game x,y → Three x,z)
    const targetX = ball.position.x;
    const targetZ = -ball.position.y;
    meshRef.current.position.x += (targetX - meshRef.current.position.x) * Math.min(1, delta * 40);
    meshRef.current.position.z += (targetZ - meshRef.current.position.z) * Math.min(1, delta * 40);

    // Scale by current diameter (handles absorb growth)
    const s = ball.diameter;
    meshRef.current.scale.setScalar(s);

    // Frozen pulse glow
    pulseRef.current += delta * 4;
    if (glowRef.current) {
      const pulsed = ball.isFrozen ? 0.15 + 0.1 * Math.sin(pulseRef.current) : 0;
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = pulsed;
      glowRef.current.scale.setScalar(ball.diameter * 1.4);
      glowRef.current.position.x = meshRef.current.position.x;
      glowRef.current.position.z = meshRef.current.position.z;
    }
  });

  const emissiveIntensity = ball.isFrozen ? 0 : matCfg.emissive_intensity;

  return (
    <group>
      {/* Main metallic ball */}
      <mesh
        ref={meshRef}
        position={[ball.position.x, ball.diameter * UNIT_RADIUS, -ball.position.y]}
        castShadow
      >
        {/* Unit sphere: radius=0.5, scaled by diameter in useFrame */}
        <sphereGeometry args={[UNIT_RADIUS, 32, 24]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={emissiveIntensity}
          roughness={matCfg.roughness}
          metalness={matCfg.metalness}
          envMapIntensity={1.5}
        />
      </mesh>

      {/* Frozen ice glow */}
      <mesh
        ref={glowRef}
        position={[ball.position.x, ball.diameter * UNIT_RADIUS, -ball.position.y]}
      >
        <sphereGeometry args={[UNIT_RADIUS, 16, 12]} />
        <meshBasicMaterial
          color="#88ddff"
          transparent
          opacity={0}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Ground shadow disc */}
      <mesh
        position={[ball.position.x, 0.001, -ball.position.y]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[ball.diameter * 0.45, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}
