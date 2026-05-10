import { useState } from "react";
import type { GameConfig } from "../../engine/types";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";

export function BossMenu({ config, onPlayBossRush, onBack, onClose }: { config: GameConfig; onPlayBossRush: (levelIds: number[]) => void; onBack: () => void; onClose: () => void; }) {
  const bossLevels = (config.levels?.list ?? []).filter((lvl) => !!lvl.boss);
  const [selected, setSelected] = useState<number[]>([]);
  const toggle = (id: number) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  return <div style={PANEL}>
    <h3 style={{ margin: 0 }}>Boss Rush</h3>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {bossLevels.map((lvl) => {
        const on = selected.includes(lvl.id);
        return <button key={lvl.id} onClick={() => toggle(lvl.id)} style={{ ...CLOSE_BTN, minWidth: 32, padding: '4px 8px', background: on ? 'rgba(30,144,255,.3)' : 'transparent' }}>{lvl.id}</button>;
      })}
    </div>
    <button style={CLOSE_BTN} onClick={() => { onPlayBossRush(selected); onClose(); }} disabled={selected.length===0}>▶ Play</button>
    <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
  </div>;
}

// ============================================================
// Root Menu Component
