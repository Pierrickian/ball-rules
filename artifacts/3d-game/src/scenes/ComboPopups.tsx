// ============================================================
// ComboPopups — floating player-shot combo labels
//
// Shows short-lived centered DOM labels for notable player
// shot combos emitted by the engine.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import type { GameEvent } from "../engine/types";

const POPUP_DURATION_MS = 1400;

const COMBO_FONT_SIZES: Record<number, number> = {
  1: 24,
  2: 30,
  3: 36,
  4: 44,
  5: 54,
};

function comboFontSize(tier: number): number {
  return COMBO_FONT_SIZES[Math.max(1, Math.min(5, tier))] ?? COMBO_FONT_SIZES[1];
}

type ComboEvent = Extract<GameEvent, { type: "combo_popup" }>;

interface ComboPopup {
  id: string;
  label: string;
  streak: number;
  tier: number;
}

interface ComboPopupsProps {
  events: GameEvent[];
}

export function ComboPopups({ events }: ComboPopupsProps) {
  const [popups, setPopups] = useState<ComboPopup[]>([]);
  const seqRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!events || events.length === 0) return;

    const fresh: ComboPopup[] = [];
    for (const ev of events) {
      if (ev.type !== "combo_popup") continue;
      const combo = ev as ComboEvent;
      seqRef.current += 1;
      fresh.push({
        id: `${combo.projectileId}-${seqRef.current}`,
        label: combo.label,
        streak: combo.streak,
        tier: combo.tier,
      });
    }
    if (fresh.length === 0) return;

    setPopups((prev) => [...prev, ...fresh].slice(-8));

    const ids = new Set(fresh.map((p) => p.id));
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      setPopups((prev) => prev.filter((p) => !ids.has(p.id)));
    }, POPUP_DURATION_MS);
    timersRef.current.add(timer);
  }, [events]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
    };
  }, []);

  return (
    <>
      {popups.map((p) => (
        <Html
          key={p.id}
          position={[0, 1.7, 0]}
          center
          zIndexRange={[360, 0]}
          occlude={false}
          prepend
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              padding: "4px 10px",
              background: "rgba(7, 10, 24, 0.28)",
              color: "rgba(255, 230, 128, 0.94)",
              fontFamily: "'Courier New', monospace",
              fontWeight: "bold",
              textAlign: "center",
              letterSpacing: 1,
              textShadow: "0 0 10px rgba(255, 211, 77, 0.95), 0 2px 2px #000",
              whiteSpace: "nowrap",
              animation: `ballGameComboPopup ${POPUP_DURATION_MS}ms ease-out forwards`,
              userSelect: "none",
            }}
          >
            <div style={{ fontSize: comboFontSize(p.tier), lineHeight: 1.05 }}>{p.label}</div>
            <div style={{ fontSize: 16, marginTop: 3, color: "rgba(157, 224, 255, 0.9)" }}>x{p.streak}</div>
          </div>
        </Html>
      ))}
    </>
  );
}
