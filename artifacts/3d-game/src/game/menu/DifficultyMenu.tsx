import { useState } from "react";
import type { GameConfig } from "../../engine/types";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";
import { useI18n } from "../i18n";
import { difficultyHpSettings, FALLBACK_DIFFICULTY_HP_PRESETS, type Difficulty } from "./menuTypes";

export function DifficultyMenu({
  config,
  difficulty,
  hpAdjustment,
  onChange,
  onHpAdjustmentChange,
  onBack,
  onClose,
}: {
  config: GameConfig;
  difficulty: Difficulty;
  hpAdjustment: number;
  onChange: (difficulty: Difficulty) => void;
  onHpAdjustmentChange: (adjustment: number) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const settings = difficultyHpSettings(config);
  const [selected, setSelected] = useState<Difficulty>(difficulty);
  const [sliderValue, setSliderValue] = useState(hpAdjustment);
  const accentColor = sliderValue === 0 ? "#1e90ff" : sliderValue > 0 ? "#ff9f1c" : "#66ffbb";
  const button = (d: Difficulty, label: string, help: string) => {
    const presetHp = settings.presets[d] ?? FALLBACK_DIFFICULTY_HP_PRESETS[d];
    return (
      <button
        key={d}
        style={{ ...CLOSE_BTN, flex: 1, minWidth: 92, background: selected === d ? "rgba(30,144,255,.3)" : "transparent", borderColor: selected === d ? "#1e90ff" : "rgba(30,144,255,0.3)", color: selected === d ? "#eaf4ff" : "#aac8f0" }}
        onClick={() => { setSelected(d); setSliderValue(presetHp); }}
      >
        <span style={{ display: "block", fontWeight: 900 }}>{label}</span>
        <span style={{ display: "block", fontSize: 10, color: "#6f86a8", marginTop: 3 }}>{help}</span>
        <span style={{ display: "block", fontSize: 11, color: "#c8deff", marginTop: 4 }}>{presetHp >= 0 ? "+" : ""}{presetHp} PV</span>
      </button>
    );
  };
  return <div style={PANEL}>
    <div>
      <div style={TITLE}>{t("menu.difficulty")}</div>
      <div style={{ fontSize: 18, fontWeight: "bold", color: "#1e90ff" }}>Change rapide</div>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {button("easy", t("difficulty.easy"), t("difficulty.lessHp"))}
      {button("medium", "Medium", "équilibré")}
      {button("hard", t("difficulty.hard"), t("difficulty.moreHp"))}
    </div>
    <label style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(6,16,48,0.8)", border: "1px solid rgba(30,144,255,0.2)", borderRadius: 12, padding: "14px 16px" }}>
      <span style={TITLE}>{t("difficulty.hpBonus")}</span>
      <input type="range" min={settings.min} max={settings.max} step={1} value={sliderValue} onChange={(event) => setSliderValue(Number(event.currentTarget.value))} style={{ width: "100%", accentColor }} />
      <span style={{ alignSelf: "center", fontWeight: 900, color: sliderValue === 0 ? "#c8deff" : sliderValue > 0 ? "#ffd79a" : "#a8ffd7" }}>{sliderValue >= 0 ? "+" : ""}{sliderValue} PV</span>
      <span style={{ fontSize: 11, color: "#6f86a8", textAlign: "center" }}>Clique Easy / Medium / Hard pour positionner le curseur, ou ajuste-le librement avant de jouer.</span>
    </label>
    <button style={{ ...CLOSE_BTN, color: "#0a1628", background: "#1e90ff", borderColor: "#1e90ff", fontWeight: "bold" }} onClick={() => { onChange(selected); onHpAdjustmentChange(sliderValue); onClose(); }}>▶ Play</button>
    <button style={CLOSE_BTN} onClick={onBack}>{t("menu.back")}</button>
  </div>;
}
