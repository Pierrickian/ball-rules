import { useMemo, useState } from "react";
import type { RuntimeModifierKey, RuntimeModifiers } from "../../engine/runtimeModifiers";
import { DEFAULT_RUNTIME_MODIFIERS } from "../../engine/runtimeModifiers";
import { CLOSE_BTN, MENU_BTN, PANEL, TITLE } from "./menuStyles";

const HORMONES = ["dopamine", "serotonine", "ocytocine", "endorphines", "adrénaline"] as const;
type HormoneId = typeof HORMONES[number];

type IntentionId = "tension" | "chaos" | "stabilite" | "flow" | "lisibilite";

type IntentionSpec = {
  id: IntentionId;
  label: string;
  keys: RuntimeModifierKey[];
  fromHormones: (h: Record<HormoneId, number>) => number;
  toRuntime: (value: number, ranges: Record<RuntimeModifierKey, { min: number; max: number }>) => Partial<RuntimeModifiers>;
};

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const mix = (min: number, max: number, t: number) => min + (max - min) * clamp(t, 0, 100) / 100;

const DEFAULT_RANGES: Record<RuntimeModifierKey, { min: number; max: number }> = {
  enemy_spawn_rate: { min: 0.75, max: 1.55 },
  enemy_speed: { min: 0.75, max: 1.45 },
  enemy_hp: { min: 0.8, max: 1.7 },
  projectile_speed: { min: 0.9, max: 1.45 },
  wave_duration: { min: 0.7, max: 1.4 },
  ammo_count: { min: 0.8, max: 1.7 },
  grenade_count: { min: 0.8, max: 1.8 },
  gameplay_speed: { min: 0.85, max: 1.3 },
  enemy_density: { min: 0.65, max: 1.75 },
};

const INTENTIONS: IntentionSpec[] = [
  {
    id: "tension",
    label: "Tension",
    keys: ["wave_duration", "enemy_spawn_rate", "enemy_density"],
    fromHormones: (h) => (h.adrénaline * 0.72 + h.dopamine * 0.18 + (100 - h.serotonine) * 0.1),
    toRuntime: (value, r) => ({
      wave_duration: mix(r.wave_duration.max, r.wave_duration.min, value),
      enemy_spawn_rate: mix(r.enemy_spawn_rate.min, r.enemy_spawn_rate.max, value),
      enemy_density: mix(r.enemy_density.min, r.enemy_density.max, value),
    }),
  },
  {
    id: "chaos",
    label: "Chaos",
    keys: ["enemy_density", "enemy_speed", "gameplay_speed"],
    fromHormones: (h) => (h.dopamine * 0.28 + h.adrénaline * 0.42 + (100 - h.serotonine) * 0.3),
    toRuntime: (value, r) => ({
      enemy_density: mix(r.enemy_density.min, r.enemy_density.max, value),
      enemy_speed: mix(r.enemy_speed.min, r.enemy_speed.max, value),
      gameplay_speed: mix(r.gameplay_speed.min, r.gameplay_speed.max, value),
    }),
  },
  {
    id: "stabilite",
    label: "Stabilité",
    keys: ["enemy_speed", "enemy_density", "wave_duration"],
    fromHormones: (h) => (h.serotonine * 0.62 + h.ocytocine * 0.18 + h.endorphines * 0.2),
    toRuntime: (value, r) => ({
      enemy_speed: mix(r.enemy_speed.max, r.enemy_speed.min, value),
      enemy_density: mix(r.enemy_density.max, r.enemy_density.min, value),
      wave_duration: mix(r.wave_duration.min, r.wave_duration.max, value),
    }),
  },
  {
    id: "flow",
    label: "Flow",
    keys: ["projectile_speed", "ammo_count", "grenade_count"],
    fromHormones: (h) => (h.dopamine * 0.38 + h.endorphines * 0.38 + h.ocytocine * 0.24),
    toRuntime: (value, r) => ({
      projectile_speed: mix(r.projectile_speed.min, r.projectile_speed.max, value),
      ammo_count: mix(r.ammo_count.min, r.ammo_count.max, value),
      grenade_count: mix(r.grenade_count.min, r.grenade_count.max, value),
    }),
  },
  {
    id: "lisibilite",
    label: "Lisibilité",
    keys: ["enemy_hp", "projectile_speed", "enemy_spawn_rate"],
    fromHormones: (h) => (h.serotonine * 0.45 + h.ocytocine * 0.35 + (100 - h.adrénaline) * 0.2),
    toRuntime: (value, r) => ({
      enemy_hp: mix(r.enemy_hp.min, r.enemy_hp.max, value),
      projectile_speed: mix(r.projectile_speed.min, r.projectile_speed.max, value),
      enemy_spawn_rate: mix(r.enemy_spawn_rate.max, r.enemy_spawn_rate.min, value),
    }),
  },
];

function RangeSlider({ value, min = 0, max = 100, readOnly, onChange }: { value: number; min?: number; max?: number; readOnly?: boolean; onChange?: (v: number) => void }) {
  return <input type="range" min={min} max={max} step="1" value={value} disabled={readOnly} onChange={(e) => onChange?.(Number(e.target.value))} style={{ width: "100%", accentColor: readOnly ? "#7afcff" : "#c084fc" }} />;
}

export function RuntimeSettingsMenu({ runtimeModifiers, onRuntimeModifiersChange, onReset, onBack }: { runtimeModifiers: RuntimeModifiers; onRuntimeModifiersChange: (m: RuntimeModifiers) => void; onReset: () => void; onBack: () => void }) {
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [tab, setTab] = useState(0);
  const [hormones, setHormones] = useState<Record<HormoneId, number>>({ dopamine: 50, serotonine: 50, ocytocine: 50, endorphines: 50, adrénaline: 50 });
  const [ranges, setRanges] = useState(DEFAULT_RANGES);

  const intentions = useMemo(() => Object.fromEntries(INTENTIONS.map((item) => [item.id, clamp(item.fromHormones(hormones))])) as Record<IntentionId, number>, [hormones]);

  const applyHormones = (nextHormones: Record<HormoneId, number>) => {
    setHormones(nextHormones);
    let next: RuntimeModifiers = { ...DEFAULT_RUNTIME_MODIFIERS };
    for (const intention of INTENTIONS) next = { ...next, ...intention.toRuntime(intention.fromHormones(nextHormones), ranges) };
    for (const key of Object.keys(next) as RuntimeModifierKey[]) next[key] = clamp(next[key], ranges[key].min, ranges[key].max);
    onRuntimeModifiersChange(next);
  };

  const setHormone = (id: HormoneId, value: number) => {
    const next = { ...hormones, [id]: clamp(value) };
    if (id === "adrénaline") { next.serotonine = clamp(next.serotonine - (value - hormones[id]) * 0.35); next.dopamine = clamp(next.dopamine + (value - hormones[id]) * 0.18); }
    if (id === "serotonine") { next.adrénaline = clamp(next.adrénaline - (value - hormones[id]) * 0.32); }
    if (id === "dopamine") { next.endorphines = clamp(next.endorphines + (value - hormones[id]) * 0.16); }
    if (id === "ocytocine") { next.serotonine = clamp(next.serotonine + (value - hormones[id]) * 0.2); next.adrénaline = clamp(next.adrénaline - (value - hormones[id]) * 0.12); }
    if (id === "endorphines") { next.dopamine = clamp(next.dopamine + (value - hormones[id]) * 0.12); }
    applyHormones(next);
  };

  const resetAll = () => { setHormones({ dopamine: 50, serotonine: 50, ocytocine: 50, endorphines: 50, adrénaline: 50 }); setRanges(DEFAULT_RANGES); onReset(); };
  const current = INTENTIONS[tab - 1];

  return (
    <div style={PANEL}>
      <div><div style={TITLE}>Settings</div><div style={{ fontSize: 20, color: "#7afcff", fontWeight: 900 }}>Game</div></div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...MENU_BTN, justifyContent: "center", background: language === "fr" ? "#1e90ff" : MENU_BTN.background }} onClick={() => setLanguage("fr")}>Français</button>
        <button style={{ ...MENU_BTN, justifyContent: "center", background: language === "en" ? "#1e90ff" : MENU_BTN.background }} onClick={() => setLanguage("en")}>English</button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {["Hormones", ...INTENTIONS.map((i) => i.label)].map((label, i) => <button key={label} onClick={() => setTab(i)} style={{ ...CLOSE_BTN, borderColor: tab === i ? "#7afcff" : "rgba(30,144,255,0.3)", color: tab === i ? "#eaffff" : "#668", whiteSpace: "nowrap" }}>{label}</button>)}
      </div>
      {tab === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {HORMONES.map((id) => <label key={id} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 10, alignItems: "center", color: "#dbeafe", textTransform: "capitalize" }}><span>{id}</span><RangeSlider value={hormones[id]} onChange={(v) => setHormone(id, v)} /></label>)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{INTENTIONS.map((intent) => <div key={intent.id} style={{ fontSize: 11, color: "#9db8d6" }}>{intent.label}<RangeSlider value={intentions[intent.id]} readOnly /></div>)}</div>
          <button style={MENU_BTN} onClick={resetAll}>Reset</button>
        </div>
      ) : current ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ color: "#9db8d6" }}>{current.label}<RangeSlider value={intentions[current.id]} readOnly /></div>
          {current.keys.map((key) => <div key={key} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 10, alignItems: "center" }}><span style={{ fontSize: 11, color: "#dbeafe" }}>{key}</span><div><RangeSlider value={Math.round(runtimeModifiers[key] * 100)} min={Math.round(ranges[key].min * 100)} max={Math.round(ranges[key].max * 100)} readOnly /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><RangeSlider value={Math.round(ranges[key].min * 100)} min={20} max={300} onChange={(v) => setRanges((prev) => ({ ...prev, [key]: { min: Math.min(v / 100, prev[key].max), max: prev[key].max } }))} /><RangeSlider value={Math.round(ranges[key].max * 100)} min={20} max={300} onChange={(v) => setRanges((prev) => ({ ...prev, [key]: { min: prev[key].min, max: Math.max(v / 100, prev[key].min) } }))} /></div></div></div>)}
          <button style={MENU_BTN} onClick={() => setRanges((prev) => ({ ...prev, ...Object.fromEntries(current.keys.map((key) => [key, DEFAULT_RANGES[key]])) } as typeof prev))}>Reset {current.label}</button>
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
        <button style={{ ...CLOSE_BTN, marginTop: 0 }} onClick={() => setTab((prev) => (prev + 5) % 6)}>←</button>
        <button style={{ ...CLOSE_BTN, marginTop: 0 }} onClick={onBack}>Retour</button>
        <button style={{ ...CLOSE_BTN, marginTop: 0 }} onClick={() => setTab((prev) => (prev + 1) % 6)}>→</button>
      </div>
    </div>
  );
}
