import { useMemo } from "react";
import type { ReactElement } from "react";
import { useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import type { GameConfig } from "../engine/types";

export function FitCamera({ config }: { config: GameConfig }) {
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
export function ClickPlane({
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
export function Arena({ config }: { config: GameConfig }) {
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

