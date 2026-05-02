// ============================================================
// HpPopups — floating "-N PV" / "+N PV" indicators
//
// Subscribes to GameState.events and spawns short-lived,
// world-anchored DOM labels that float upward and fade out.
// Cleanup is timer-based (no per-frame React state churn).
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import type { GameEvent } from "../engine/types";

const POPUP_DURATION_MS = 1000;

type PopupKind = "damage" | "heal";

interface HpPopup {
  id: string;
  x: number;
  y: number;
  amount: number;
  kind: PopupKind;
}

interface HpPopupsProps {
  events: GameEvent[];
}

export function HpPopups({ events }: HpPopupsProps) {
  const [popups, setPopups] = useState<HpPopup[]>([]);
  const seqRef = useRef(0);
  // All in-flight removal timers, cleared only on full component unmount so
  // that a new batch arriving mid-flight does not cancel a previous batch's
  // cleanup (which would leak popups forever).
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!events || events.length === 0) return;

    const fresh: HpPopup[] = [];
    for (const ev of events) {
      if (ev.type !== "ball_damaged" && ev.type !== "ball_healed") continue;
      const kind: PopupKind = ev.type === "ball_damaged" ? "damage" : "heal";
      seqRef.current += 1;
      fresh.push({
        id: `${kind}-${ev.ballId}-${seqRef.current}`,
        x: ev.position.x,
        y: ev.position.y,
        amount: ev.amount,
        kind,
      });
    }
    if (fresh.length === 0) return;

    setPopups((prev) => [...prev, ...fresh]);

    const ids = new Set(fresh.map((p) => p.id));
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      setPopups((prev) => prev.filter((p) => !ids.has(p.id)));
    }, POPUP_DURATION_MS);
    timersRef.current.add(timer);
    // No cleanup here on purpose: cancelling this timer when a new batch
    // arrives would leak the popups it owns.
  }, [events]);

  // Clear every pending timer only when the component itself unmounts.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
    };
  }, []);

  return (
    <>
      {popups.map((p) => {
        const isHeal = p.kind === "heal";
        const color = isHeal ? "#5cff9a" : "#ff5a5a";
        const sign = isHeal ? "+" : "-";
        return (
          <Html
            key={p.id}
            position={[p.x, 1.2, -p.y]}
            center
            zIndexRange={[300, 0]}
            occlude={false}
            prepend
            style={{ pointerEvents: "none" }}
          >
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                fontWeight: "bold",
                fontSize: 16,
                color,
                textShadow: `0 0 6px ${color}, 0 0 2px #000`,
                whiteSpace: "nowrap",
                animation: `ballGameHpPopup ${POPUP_DURATION_MS}ms ease-out forwards`,
                userSelect: "none",
              }}
            >
              {sign}{p.amount} PV
            </div>
          </Html>
        );
      })}
    </>
  );
}
