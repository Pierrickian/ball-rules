// ============================================================
// BallMesh — 3D visual representation of a Ball
//
// - Reads BallState, renders a metallic sphere.
// - Visual params come from config (no hard-coded values).
// - Player projectiles get an extra glow + colored aura tint.
// - HP > 0 dark_green balls show a subtle ring proportional to HP.
// ============================================================

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { BallState, GameConfig } from "../engine/types";

interface BallMeshProps {
  ball: BallState;
  config: GameConfig;
  showBlackHpLabel?: boolean;
}

const UNIT_RADIUS = 0.5;

export function BallMesh({ ball, config, showBlackHpLabel = false }: BallMeshProps) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const fieldRef = useRef<THREE.Mesh>(null);
  const glowRef  = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef(0);

  const colorEntry = config.ball_colors[ball.color];
  const hexColor   = colorEntry?.hex ?? "#ffffff";
  const threeColor = new THREE.Color(hexColor);

  const matCfg = config.graphics.ball_material ?? { roughness: 0.05, metalness: 0.85, emissive_intensity: 0.25 };
  const isProjectile = ball.metadata?.isProjectile === true;
  const tint = (ball.metadata?.colorTint as string | null | undefined) ?? null;
  const tintColor = tint ? new THREE.Color(tint) : null;
  const visibilityAlpha = typeof ball.metadata?.visibilityAlpha === "number" ? Math.max(0, Math.min(1, ball.metadata.visibilityAlpha as number)) : 1;
  const isInvisibleSprite = ball.color === "black";
  const magnetFieldDiameter = ball.rule === "magnet_field"
    ? (typeof ball.metadata?.magnetFieldDiameter === "number"
      ? Math.max(0, ball.metadata.magnetFieldDiameter as number)
      : ball.diameter * (config.rule_parameters.magnet_field?.field_diameter_multiplier ?? 3))
    : 0;
  const heatAuraDiameter = ball.rule === "protective_heat"
    ? (typeof ball.metadata?.heatAuraDiameter === "number"
      ? Math.max(0, ball.metadata.heatAuraDiameter as number)
      : ball.diameter * (config.rule_parameters.protective_heat?.aura_diameter_multiplier ?? 4.2))
    : 0;
  const heatRatio = typeof ball.metadata?.heatRatio === "number"
    ? Math.max(0, Math.min(1, ball.metadata.heatRatio as number))
    : 0;
  const heatCooldown = typeof ball.metadata?.heatCooldown === "number"
    ? Math.max(0, ball.metadata.heatCooldown as number)
    : 0;
  const showHeatLabel = !isProjectile && ball.rule === "protective_heat" && heatAuraDiameter > 0;
  const heatLabel = heatCooldown > 0 ? "🛡 BOUCLIER" : `🔥 ${Math.round(heatRatio * 100)}%`;

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const targetX = ball.position.x;
    const targetZ = -ball.position.y;

    // Projectiles teleport (no smoothing) to keep aim feel sharp; others lerp.
    if (isProjectile) {
      meshRef.current.position.x = targetX;
      meshRef.current.position.z = targetZ;
    } else {
      meshRef.current.position.x += (targetX - meshRef.current.position.x) * Math.min(1, delta * 40);
      meshRef.current.position.z += (targetZ - meshRef.current.position.z) * Math.min(1, delta * 40);
    }

    meshRef.current.scale.setScalar(ball.diameter);

    pulseRef.current += delta * 4;

    if (fieldRef.current) {
      const mat = fieldRef.current.material as THREE.MeshBasicMaterial;
      const auraDiameter = Math.max(magnetFieldDiameter, heatAuraDiameter);
      mat.opacity = heatAuraDiameter > 0
        ? 0.08 + heatRatio * 0.18 + 0.04 * Math.sin(pulseRef.current * (1.5 + heatRatio * 2))
        : 0.12 + 0.04 * Math.sin(pulseRef.current * 1.5);
      fieldRef.current.scale.setScalar(auraDiameter);
      fieldRef.current.position.x = meshRef.current.position.x;
      fieldRef.current.position.z = meshRef.current.position.z;
    }

    if (glowRef.current) {
      const pulsed = ball.isFrozen ? 0.15 + 0.1 * Math.sin(pulseRef.current) : 0;
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = pulsed;
      glowRef.current.scale.setScalar(ball.diameter * 1.4);
      glowRef.current.position.x = meshRef.current.position.x;
      glowRef.current.position.z = meshRef.current.position.z;
    }

    if (trailRef.current && isProjectile) {
      const mat = trailRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.55 + 0.2 * Math.sin(pulseRef.current * 2);
      trailRef.current.scale.setScalar(ball.diameter * 1.8);
      trailRef.current.position.x = meshRef.current.position.x;
      trailRef.current.position.z = meshRef.current.position.z;
    }
  });

  // Projectile gets boosted emissive
  const emissiveIntensity = ball.isFrozen ? 0 : (isProjectile ? 0.9 : matCfg.emissive_intensity);
  const emissiveColor = tintColor ?? threeColor;

  // HP label is shown on every gameplay ball (not on player projectiles
  // and not on the orange launcher, which is HP-less by design).
  const showHpLabel =
    !isProjectile &&
    ball.color !== "orange" &&
    ball.maxHp > 0 &&
    (ball.color !== "black" || showBlackHpLabel);
  // Slight screen-up offset so the label sits visually above the ball.
  const hpLabelZ = -ball.position.y - ball.diameter * 0.65;
  const hpLabelY = ball.diameter * 0.5 + 0.5;

  return (
    <group>
      {/* Transparent footprints for purple magnetic fields and pink protective heat */}
      {!isInvisibleSprite && (magnetFieldDiameter > 0 || heatAuraDiameter > 0) && (
        <mesh
          ref={fieldRef}
          position={[ball.position.x, Math.max(0.006, ball.diameter * 0.08), -ball.position.y]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={-1}
        >
          <circleGeometry args={[UNIT_RADIUS, 64]} />
          <meshBasicMaterial
            color={heatAuraDiameter > 0 ? "#ff8acb" : threeColor}
            transparent
            opacity={heatAuraDiameter > 0 ? 0.08 + heatRatio * 0.18 : 0.12}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Main metallic ball */}
      {!isInvisibleSprite && <mesh
        ref={meshRef}
        position={[ball.position.x, ball.diameter * UNIT_RADIUS, -ball.position.y]}
        castShadow
      >
        <sphereGeometry args={[UNIT_RADIUS, 32, 24]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={isProjectile ? 0.15 : matCfg.roughness}
          metalness={matCfg.metalness}
          envMapIntensity={1.5}
          transparent={visibilityAlpha < 1}
          opacity={visibilityAlpha}
        />
      </mesh>}

      {/* Frozen ice glow */}
      {!isInvisibleSprite && <mesh ref={glowRef} position={[ball.position.x, ball.diameter * UNIT_RADIUS, -ball.position.y]}>
        <sphereGeometry args={[UNIT_RADIUS, 16, 12]} />
        <meshBasicMaterial color="#88ddff" transparent opacity={0} side={THREE.BackSide} depthWrite={false} />
      </mesh>}

      {/* Projectile aura (colored by shot tint) */}
      {!isInvisibleSprite && isProjectile && (
        <mesh ref={trailRef} position={[ball.position.x, ball.diameter * UNIT_RADIUS, -ball.position.y]}>
          <sphereGeometry args={[UNIT_RADIUS, 16, 12]} />
          <meshBasicMaterial
            color={tintColor ?? threeColor}
            transparent
            opacity={0.55}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Ground shadow disc */}
      {!isInvisibleSprite && <mesh
        position={[ball.position.x, 0.001, -ball.position.y]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[ball.diameter * 0.45, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>}

      {/* HP label above the ball (always faces the camera via Html) */}
      {showHpLabel && (
        <Html
          position={[ball.position.x, hpLabelY, hpLabelZ]}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontWeight: "bold",
              fontSize: 13,
              lineHeight: 1,
              color: "#ffffff",
              textShadow: "0 0 4px #000, 0 0 6px rgba(0,0,0,0.9)",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            {ball.hp}
          </div>
        </Html>
      )}

      {/* Pink protective heat gauge, visible during play so the rule is understandable. */}
      {showHeatLabel && (
        <Html
          position={[ball.position.x, hpLabelY + 1.15, hpLabelZ]}
          center
          zIndexRange={[21, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontWeight: 900,
              fontSize: heatCooldown > 0 ? 12 : 11,
              lineHeight: 1,
              color: heatCooldown > 0 ? "#fff6a8" : "#ffd3ea",
              background: "rgba(36, 0, 24, 0.72)",
              border: "1px solid rgba(255, 138, 203, 0.72)",
              borderRadius: 999,
              padding: "3px 6px",
              textShadow: "0 0 5px #000, 0 0 8px rgba(255,102,180,0.9)",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            {heatLabel}
          </div>
        </Html>
      )}
    </group>
  );
}
