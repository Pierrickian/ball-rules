import { useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ExplosionSprite } from "../../scenes/ExplosionSprite";
import { CLOSE_BTN, PANEL } from "./menuStyles";

export function EffectPreview3D({ kind, effect, debugTexture }: { kind: "ball" | "grenade"; effect: string; debugTexture: boolean }) {
  const [t, setT] = useState(0);
  useFrame((_, delta: number) => setT((prev) => (prev + delta * (kind === "ball" ? 1 : 0.6)) % 1));
  return <ExplosionSprite kind={kind} effect={effect} t={t} debugTexture={debugTexture} />;
}


export function EffectsMenu({ ballEffect, grenadeEffect, debugExplosionTexture, onDebugExplosionTextureChange, onBallEffectChange, onGrenadeEffectChange, onBack }: { ballEffect: string; grenadeEffect: string; debugExplosionTexture: boolean; onDebugExplosionTextureChange: (v: boolean) => void; onBallEffectChange: (e: string) => void; onGrenadeEffectChange: (e: string) => void; onBack: () => void; }) {
  const [tab, setTab] = useState<"ball" | "grenade">("ball");
  const items = tab === "ball" ? ["pulse", "ring", "spark", "shock", "nova", "wave"] : ["spark", "ring", "burst", "flash", "smoke", "flare", "shard"];
  const active = tab === "ball" ? ballEffect : grenadeEffect;
  const setActive = (e: string) => (tab === "ball" ? onBallEffectChange(e) : onGrenadeEffectChange(e));
  const colorFor = (it: string) => tab === "ball"
    ? (it === "shock" ? "#ffcc66" : it === "nova" ? "#9de0ff" : "#66ccff")
    : (it === "flash" ? "#fff2b5" : it === "smoke" ? "#aab4c4" : it === "flare" ? "#ffb35c" : it === "shard" ? "#7fd0ff" : it === "spark" ? "#9de0ff" : "#ffcc66");
  return <div style={PANEL}>
    <div style={{display:"flex",gap:8}}>
      <button style={CLOSE_BTN} onClick={() => setTab("ball")}>balles terrain</button>
      <button style={CLOSE_BTN} onClick={() => setTab("grenade")}>grenade</button>
    </div>
    <div style={{ fontSize: 12, color: "#89a8d1", lineHeight: 1.35 }}>
      {tab === "ball"
        ? "Les balles de terrain explosent visuellement avec un petit diamètre supplémentaire, sans dégâts de zone."
        : "La grenade explose avec un grand diamètre et inflige des dégâts autour d'elle."}
    </div>
    <div className="fx-preview-panel" style={{ height: 110 }}>
      <Canvas orthographic camera={{ position: [0, 0, 20], zoom: 24 }} gl={{ alpha: true, antialias: true }}>
        <EffectPreview3D kind={tab === "ball" ? "ball" : "grenade"} effect={active} debugTexture={debugExplosionTexture} />
      </Canvas>
    </div>
    <button style={CLOSE_BTN} onClick={() => onDebugExplosionTextureChange(!debugExplosionTexture)}>Debug texture: {debugExplosionTexture ? "ON" : "OFF"}</button>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      {items.map((it)=>{ const color = colorFor(it); return <button key={it} onClick={()=>setActive(it)} style={{...CLOSE_BTN,borderColor:active===it?"#1e90ff":"rgba(30,144,255,0.3)",boxShadow:active===it?"0 0 8px #1e90ff":"none",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}><span>{it}</span><span style={{display:"inline-block",width:18,height:18,borderRadius:"50%",border:tab==="grenade"?"2px solid":"1px solid",borderColor:color,boxShadow:`0 0 8px ${color}`,opacity:it==="smoke"?0.5:0.95}} /></button>;})}
    </div>
    <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
  </div>;
}
