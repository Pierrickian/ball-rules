import { useMemo } from "react";
import * as THREE from "three";

export type ExplosionKind = "ball" | "grenade";

export function effectColor(kind: ExplosionKind, effect: string): string {
  if (kind === "ball") return effect === "shock" ? "#ffe089" : effect === "nova" ? "#9de0ff" : "#66ccff";
  return effect === "flash" ? "#fff2b5" : effect === "smoke" ? "#aab4c4" : effect === "flare" ? "#ffb35c" : effect === "shard" ? "#7fd0ff" : "#ffcc66";
}

function makeSpriteTexture(effect: string, color: string) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.45;
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  core.addColorStop(0, "rgba(255,255,255,0.95)");
  core.addColorStop(0.24, color + "e6");
  core.addColorStop(0.75, color + "55");
  core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  if (effect === "shard" || effect === "spark" || effect === "nova") {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const x = cx + Math.cos(a) * r * 0.55;
      const y = cy + Math.sin(a) * r * 0.55;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(x - 2, y - 8, 4, 16);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function ExplosionSprite({ kind, effect, t, debugTexture = false }: { kind: ExplosionKind; effect: string; t: number; debugTexture?: boolean }) {
  const color = effectColor(kind, effect);
  const texture = useMemo(() => makeSpriteTexture(effect, color), [effect, color]);
  const fade = Math.max(0, 1 - t);
  const scale = (kind === "ball" ? 14.4 : 240) * (0.75 + t * 1.35);
  return (
    <group renderOrder={20}>
      <sprite scale={[scale, scale, 1]}>
        <spriteMaterial
          map={texture ?? undefined}
          color={debugTexture ? "#ff0077" : "#ffffff"}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          opacity={fade * (kind === "ball" ? 0.975 : 0.75)}
        />
      </sprite>
    </group>
  );
}
