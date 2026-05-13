import { useEffect, useMemo, useRef, useState } from "react";
import type { GameEvent, GameState } from "../engine/types";
import type { BreathingWaveState } from "../engine/useGameEngine";
import { useI18n } from "./i18n";

type WaveUiStage = "none" | "notice" | "results" | "evolution";

type DebugColumn = "event" | "state";

interface DebugItem {
  key: string;
  label: string;
  column: DebugColumn;
  active: boolean;
}

interface RuntimeDebugOverlayProps {
  gameState: GameState;
  lastEvents: GameEvent[];
  breathingWave: BreathingWaveState;
  waveUiStage: WaveUiStage;
}

const GAME_EVENT_ORDER: Array<GameEvent["type"]> = [
  "ball_spawned",
  "orange_launched",
  "player_shot",
  "collision",
  "ball_damaged",
  "ball_healed",
  "ball_split",
  "rule_transferred",
  "combo_popup",
  "grenade_awarded",
  "grenade_helper_flash",
  "mine_placed",
  "ball_despawned",
  "session_clear",
  "session_reboot",
  "level_changed",
];

function hasLivingBoss(gameState: GameState): boolean {
  return Array.from(gameState.balls.values()).some((ball) => ball.isAlive && ball.isBoss === true);
}

function enemyCount(gameState: GameState): number {
  return Array.from(gameState.balls.values()).filter((ball) => {
    if (!ball.isAlive) return false;
    if (ball.color === "orange") return false;
    if (ball.metadata?.isProjectile === true) return false;
    return true;
  }).length;
}

function useTouchDebugCursor(items: DebugItem[]): { cursor: number; visible: boolean } {
  const [visible, setVisible] = useState(false);
  const [cursor, setCursor] = useState(0);
  const lastGestureAtRef = useRef(0);

  useEffect(() => {
    const firstActive = () => Math.max(0, items.findIndex((item) => item.active));
    const onTouchStart = (event: TouchEvent) => {
      const touchCount = event.touches.length;
      if (touchCount === 1 && visible) {
        setVisible(false);
        return;
      }

      const direction = touchCount === 4 ? 1 : touchCount === 3 ? -1 : 0;
      if (direction === 0 || items.length === 0) return;
      if (event.cancelable) event.preventDefault();

      const now = performance.now();
      if (now - lastGestureAtRef.current < 360) return;
      lastGestureAtRef.current = now;

      if (!visible) {
        setVisible(true);
        setCursor(firstActive());
        return;
      }

      setCursor((current) => (current + direction + items.length) % items.length);
    };
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    return () => window.removeEventListener("touchstart", onTouchStart, { capture: true });
  }, [items, visible]);

  return { cursor, visible };
}

export function RuntimeDebugOverlay({ gameState, lastEvents, breathingWave, waveUiStage }: RuntimeDebugOverlayProps) {
  const { t } = useI18n();
  const lastEventTypes = useMemo(() => new Set(lastEvents.map((event) => event.type)), [lastEvents]);
  const livingBoss = hasLivingBoss(gameState);
  const enemies = enemyCount(gameState);
  const ammo = gameState.ammoRemaining ?? Infinity;

  const eventItems: DebugItem[] = GAME_EVENT_ORDER.map((eventType) => ({
    key: `event:${eventType}`,
    label: eventType,
    column: "event",
    active: lastEventTypes.has(eventType),
  }));

  const stateItems: DebugItem[] = [
    { key: "state:wave_active", label: "wave_active", column: "state", active: breathingWave.phase === "active" && !gameState.bossIntroActive && !gameState.bossMasteredActive },
    { key: "state:boss_notice", label: "boss_notice", column: "state", active: breathingWave.phase === "boss_notice" },
    { key: "state:boss_intro", label: "boss_intro", column: "state", active: gameState.bossIntroActive === true },
    { key: "state:boss_alive", label: "boss_alive", column: "state", active: livingBoss },
    { key: "state:boss_phase", label: "boss_phase", column: "state", active: gameState.isBossPhase === true },
    { key: "state:boss_mastered", label: "boss_mastered", column: "state", active: gameState.bossMasteredActive === true },
    { key: "state:reward_notice", label: "reward_notice", column: "state", active: breathingWave.phase === "breathing" && waveUiStage === "notice" },
    { key: "state:reward_results", label: "reward_results", column: "state", active: breathingWave.phase === "breathing" && waveUiStage === "results" },
    { key: "state:evolution_panel", label: "evolution_panel", column: "state", active: breathingWave.phase === "breathing" && waveUiStage === "evolution" },
    { key: "state:session_cleared", label: "session_cleared", column: "state", active: gameState.sessionCleared },
    { key: "state:low_ammo", label: "low_ammo", column: "state", active: Number.isFinite(ammo) && ammo <= 10 },
    { key: "state:enemies_alive", label: `enemies_alive:${enemies}`, column: "state", active: enemies > 0 },
  ];

  const items = [...eventItems, ...stateItems];
  const { cursor, visible } = useTouchDebugCursor(items);
  if (!visible) return null;
  const selectedKey = items[cursor]?.key;

  const renderColumn = (title: string, columnItems: DebugItem[]) => (
    <div style={panelStyle}>
      <div style={titleStyle}>{title}</div>
      {columnItems.map((item) => {
        const selected = item.key === selectedKey;
        return (
          <div
            key={item.key}
            style={{
              ...rowStyle,
              color: selected || item.active ? "#fff7b0" : "#ffffff",
              borderColor: selected ? "rgba(255,209,102,.9)" : item.active ? "rgba(255,209,102,.55)" : "rgba(255,255,255,.14)",
              background: selected ? "rgba(255,209,102,.24)" : item.active ? "rgba(255,209,102,.13)" : "rgba(0,0,0,.2)",
              boxShadow: selected || item.active ? "0 0 18px rgba(255,209,102,.32)" : "none",
              animation: item.active ? "runtime-debug-pulse .78s ease-in-out infinite" : undefined,
            }}
          >
            <span style={{ opacity: selected ? 1 : .74 }}>{selected ? "▶" : item.active ? "●" : "○"}</span>
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={overlayStyle} aria-hidden="true">
      <style>{`
        @keyframes runtime-debug-pulse {
          0%, 100% { filter: brightness(1); transform: scale(1); }
          50% { filter: brightness(1.45); transform: scale(1.018); }
        }
      `}</style>
      <div style={headerStyle}>{t("debugOverlay.title")}</div>
      <div style={hintStyle}>{t("debugOverlay.hint")}</div>
      <div style={columnsStyle}>
        {renderColumn(t("debugOverlay.events"), eventItems)}
        {renderColumn(t("debugOverlay.states"), stateItems)}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: "76px 10px auto 10px",
  zIndex: 96,
  pointerEvents: "none",
  fontFamily: "'Courier New', monospace",
  color: "#ffffff",
  textShadow: "0 0 8px #000",
};

const headerStyle: React.CSSProperties = {
  width: "fit-content",
  margin: "0 auto 4px",
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,209,102,.55)",
  background: "rgba(3,10,24,.72)",
  color: "#fff7b0",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1.8,
  textTransform: "uppercase",
};

const hintStyle: React.CSSProperties = {
  width: "fit-content",
  margin: "0 auto 8px",
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(0,0,0,.44)",
  color: "rgba(255,255,255,.8)",
  fontSize: 10,
  fontWeight: 700,
};

const columnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 8,
};

const panelStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(122,252,255,.28)",
  background: "rgba(3,10,24,.58)",
  backdropFilter: "blur(7px)",
  padding: 8,
  boxShadow: "0 10px 28px rgba(0,0,0,.22)",
};

const titleStyle: React.CSSProperties = {
  color: "#7afcff",
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  marginBottom: 6,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minHeight: 20,
  marginBottom: 3,
  padding: "3px 6px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,.14)",
  fontSize: 10.5,
  fontWeight: 850,
  letterSpacing: .2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
