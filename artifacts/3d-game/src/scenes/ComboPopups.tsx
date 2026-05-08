// ============================================================
// ComboPopups — floating player-shot combo labels
//
// Shows short-lived world-anchored DOM labels for notable player
// shot combos emitted by the engine.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import type { GameEvent } from "../engine/types";

const POPUP_DURATION_MS = 1400;

type ComboEvent = Extract<GameEvent, { type: "combo_popup" }>;

interface ComboPopup {
  id: string;
  x: number;
  y: number;
  label: string;
  streak: number;
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
        x: combo.position.x,
        y: combo.position.y,
        label: combo.label,
        streak: combo.streak,
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
          position={[p.x, 1.7, -p.y]}
          center
          zIndexRange={[360, 0]}
          occlude={false}
          prepend
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              minWidth: 120,
              padding: "8px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255, 255, 255, 0.65)",
              background: "linear-gradient(180deg, rgba(20, 28, 54, 0.9), rgba(7, 10, 24, 0.78))",
              boxShadow: "0 0 20px rgba(255, 225, 128, 0.5), inset 0 0 10px rgba(255, 255, 255, 0.12)",
              color: "#ffe680",
              fontFamily: "'Courier New', monospace",
              fontWeight: "bold",
              textAlign: "center",
              letterSpacing: 1,
              textShadow: "0 0 8px rgba(255, 211, 77, 0.95), 0 2px 2px #000",
              whiteSpace: "nowrap",
              animation: `ballGameComboPopup ${POPUP_DURATION_MS}ms ease-out forwards`,
              userSelect: "none",
            }}
          >
            <div style={{ fontSize: 20, lineHeight: 1.05 }}>{p.label}</div>
            {p.streak > 1 && (
              <div style={{ fontSize: 16, marginTop: 3, color: "#9de0ff" }}>x{p.streak}</div>
            )}
          </div>
        </Html>
      ))}
    </>
  );
}
