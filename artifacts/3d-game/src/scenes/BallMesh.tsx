// ============================================================
// BallMesh — 3D visual representation of a Ball
//
// ARCHITECTURE NOTE:
// - This component is purely visual. It reads BallState and
//   renders a 3D sphere. It has no game logic.
// - Colors and sizes come from game_config.json via props.
//   Do NOT hard-code colors or sizes here.
// - The Y axis (Three.js) maps to the game's Z (top-down view).
//   All game positions (x, y) map to Three.js (x, 0, -y).
// ============================================================

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BallState, GameConfig } from "../engine/types";

interface BallMeshProps {
  ball: BallState;
  config: GameConfig;
}

export function BallMesh({ ball, config }: BallMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef(0);

  // Resolve color from config
  const colorEntry = config.ball_colors[ball.color];
  const hexColor = colorEntry?.hex ?? "#ffffff";
  const color = new THREE.Color(hexColor);

  const radius = ball.diameter / 2;
  const glowRadius = radius * 1.35;

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Smoothly move to game position (game x,y → three x,z)
    const targetX = ball.position.x;
    const targetZ = -ball.position.y; // flip y→z for top-down
    meshRef.current.position.x += (targetX - meshRef.current.position.x) * Math.min(1, delta * 30);
    meshRef.current.position.z += (targetZ - meshRef.current.position.z) * Math.min(1, delta * 30);

    // Pulsing glow for frozen balls
    pulseRef.current += delta * 3;
    if (glowRef.current) {
      const pulse = ball.isFrozen ? 0.8 + 0.2 * Math.sin(pulseRef.current * 4) : 0;
      glowRef.current.scale.setScalar(pulse > 0 ? 1 + pulse * 0.2 : 1);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = ball.isFrozen ? 0.3 + 0.15 * Math.sin(pulseRef.current * 4) : 0;
    }

    // Update mesh scale to reflect diameter changes (e.g., absorb rule)
    const targetScale = ball.diameter / (config.graphics.ball_sizes.small?.diameter ?? 0.3) *
      (config.graphics.ball_sizes.small?.diameter ?? 0.3);
    meshRef.current.scale.setScalar(targetScale / (config.graphics.ball_sizes.small?.diameter ?? 0.3));
  });

  const emissiveIntensity = ball.isFrozen ? 0 : 0.3;

  return (
    <group>
      {/* Main ball sphere */}
      <mesh ref={meshRef} position={[ball.position.x, 0.05, -ball.position.y]} castShadow>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>

      {/* Frozen glow overlay */}
      <mesh ref={glowRef} position={[ball.position.x, 0.05, -ball.position.y]}>
        <sphereGeometry args={[glowRadius, 16, 12]} />
        <meshBasicMaterial color="#aaddff" transparent opacity={0} side={THREE.BackSide} />
      </mesh>

      {/* Shadow circle on ground */}
      <mesh
        position={[ball.position.x, 0.001, -ball.position.y]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[radius * 0.9, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}
