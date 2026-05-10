import { useCallback, useEffect, useRef, useState } from "react";

export interface SnapSliderProps {
  count: number;
  selected: number;
  onChange: (index: number) => void;
  defaultIndex?: number;
  accentColor?: string;
}

export function SnapSlider({ count, selected, onChange, defaultIndex, accentColor = "#1e90ff" }: SnapSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const indexFromX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return selected;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(pct * (count - 1));
    },
    [count, selected]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      onChange(indexFromX(e.clientX));
      const onMove = (ev: MouseEvent) => { if (isDragging.current) onChange(indexFromX(ev.clientX)); };
      const onUp = () => { isDragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [indexFromX, onChange]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isDragging.current = true;
      onChange(indexFromX(e.touches[0].clientX));
      const onMove = (ev: TouchEvent) => { if (isDragging.current && ev.touches[0]) onChange(indexFromX(ev.touches[0].clientX)); };
      const onEnd = () => { isDragging.current = false; window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", onEnd);
    },
    [indexFromX, onChange]
  );

  const thumbPct = count > 1 ? (selected / (count - 1)) * 100 : 50;

  return (
    <div style={{ position: "relative", padding: "20px 10px 10px" }}>
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={{
          position: "relative",
          height: 4,
          borderRadius: 2,
          background: "rgba(30,144,255,0.18)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0, top: 0, height: "100%",
            width: `${thumbPct}%`,
            borderRadius: 2,
            background: `linear-gradient(to right, rgba(30,144,255,0.4), ${accentColor})`,
            transition: "width 0.08s",
          }}
        />
        {Array.from({ length: count }).map((_, i) => {
          const pct = count > 1 ? (i / (count - 1)) * 100 : 50;
          const isActive = i === selected;
          const isDefault = defaultIndex === i;
          return (
            <div
              key={i}
              onClick={() => onChange(i)}
              style={{
                position: "absolute",
                top: "50%",
                left: `${pct}%`,
                transform: "translate(-50%, -50%)",
                width:  isActive ? 14 : 8,
                height: isActive ? 14 : 8,
                borderRadius: "50%",
                background: isActive ? accentColor : (isDefault ? "rgba(30,144,255,0.55)" : "rgba(30,144,255,0.3)"),
                boxShadow: isActive ? `0 0 8px ${accentColor}` : "none",
                border: isActive ? `2px solid ${accentColor}` : "2px solid rgba(30,144,255,0.18)",
                transition: "all 0.15s",
                cursor: "pointer",
                zIndex: 2,
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${thumbPct}%`,
            transform: "translate(-50%, -50%)",
            width: 22, height: 22,
            borderRadius: "50%",
            background: "rgba(4,12,35,0.9)",
            border: `2px solid ${accentColor}`,
            boxShadow: `0 0 12px ${accentColor}66`,
            zIndex: 3,
            pointerEvents: "none",
            transition: "left 0.08s",
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Terrain Sub-Menu
