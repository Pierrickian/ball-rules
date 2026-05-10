import type { GameConfig, GameState, ShotKind } from "./engine/types";
import { useI18n } from "./game/i18n";

export function IncomingBallsOverlay({ queue }: { queue: ShotKind[] }) {
  if (queue.length === 0) return null;

  const readyKind = queue[0];
  let readyCount = 0;
  for (const kind of queue) {
    if (kind !== readyKind) break;
    readyCount += 1;
  }

  const tint = readyKind === "light" ? "#F5F5F5" : readyKind === "heavy" ? "#FFE600" : "#ff66ff";

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 9,
        display: "flex",
        gap: 4,
        padding: "4px 8px",
        borderRadius: 999,
        background: "rgba(0, 8, 24, 0.72)",
        border: "1px solid rgba(30,144,255,0.3)",
      }}
    >
      {Array.from({ length: readyCount }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${tint}, ${tint}cc 70%, #000 100%)`,
            border: `1px solid ${tint}`,
            boxShadow: `0 0 8px ${tint}aa`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// PlayerQueue — strip showing next balls (left = next to shoot)
// ============================================================
export function PlayerQueue({ queue, config }: { queue: ShotKind[]; config: GameConfig }) {
  const { t } = useI18n();
  if (queue.length === 0) return null;

  const readyKind = queue[0];
  let readyCount = 0;
  for (const kind of queue) {
    if (kind !== readyKind) break;
    readyCount += 1;
  }
  const readyTint = readyKind === "light" ? "#ffffff" : readyKind === "heavy" ? "#FFE600" : "#ff66ff";

  return (
    <div
      style={{
        position: "absolute",
        left: 0, right: 0, bottom: 64,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: 8,
        flexWrap: "wrap",
        maxWidth: 280,
        pointerEvents: "none",
        zIndex: 8,
      }}
    >
      {queue.map((kind, i) => {
        const entry = kind === "light" ? { hex: "#F5F5F5" } : kind === "heavy" ? { hex: "#FFE600" } : { hex: "#ff66ff" };
        const isNext = i === 0;
        const base = kind === "light" ? 12 : kind === "heavy" ? 15 : 18;
        const sz = isNext ? base + 2 : base;
        return (
          <div
            key={i}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              opacity: i === 0 ? 1 : (i === 1 ? 0.78 : 0.55),
              transform: isNext ? "translateY(-2px)" : "none",
              transition: "all 0.25s",
            }}
          >
            <div
              style={{
                width: sz, height: sz, borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${entry?.hex ?? "#888"}ff, ${entry?.hex ?? "#444"}aa 70%, #000 100%)`,
                boxShadow: isNext
                  ? `0 0 14px ${entry?.hex ?? "#888"}, inset 0 0 4px rgba(255,255,255,0.4)`
                  : `0 0 6px ${entry?.hex ?? "#555"}66`,
                border: isNext ? `2px solid ${entry?.hex ?? "#aaa"}` : "1px solid rgba(255,255,255,0.15)",
              }}
            />
            {isNext && (
              <>
                <div style={{
                  fontSize: 9, color: "#1e90ff", letterSpacing: 2,
                  fontFamily: "'Courier New', monospace", textTransform: "uppercase",
                }}>
                  {t("hud.shoot")}
                </div>
                <div
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 2,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: `1px solid ${readyTint}`,
                    background: "rgba(8,12,20,0.85)",
                    color: readyTint,
                    fontFamily: "'Courier New', monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textShadow: `0 0 8px ${readyTint}`,
                    boxShadow: `0 0 8px ${readyTint}55`,
                  }}
                >
                  x{readyCount}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ChargeBar — power meter while clicking
// ============================================================
export function ChargeBar({ holdTime, shotKind, config }: { holdTime: number; shotKind: ShotKind; config: GameConfig }) {
  const types = config.gameplay_controls.shot_types;
  const lightMax = types.light.max_hold_seconds;  // ~0.5s
  const heavyMax = types.heavy.max_hold_seconds;  // ~1.0s
  const displayMax = Math.max(heavyMax * 1.2, 1.2);
  const pct = Math.min(1, holdTime / displayMax);

  const tint = types[shotKind].color_tint ?? "#1e90ff";
  const label = types[shotKind]._label;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%", transform: "translateX(-50%)",
        bottom: 130,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        pointerEvents: "none",
        zIndex: 9,
        fontFamily: "'Courier New', monospace",
      }}
    >
      <div style={{
        fontSize: 11, color: tint, letterSpacing: 2, textTransform: "uppercase", fontWeight: "bold",
        textShadow: `0 0 6px ${tint}`,
      }}>
        {label}
      </div>
      <div style={{
        width: 180, height: 6, background: "rgba(255,255,255,0.12)",
        borderRadius: 3, overflow: "hidden", position: "relative",
      }}>
        <div style={{
          height: "100%", width: `${pct * 100}%`,
          background: `linear-gradient(to right, #888, ${tint})`,
          boxShadow: `0 0 8px ${tint}`,
          transition: "width 0.05s",
        }} />
        {/* Tier markers */}
        <div style={{ position: "absolute", top: -2, left: `${(lightMax / displayMax) * 100}%`, width: 1, height: 10, background: "#fff8" }} />
        <div style={{ position: "absolute", top: -2, left: `${(heavyMax / displayMax) * 100}%`, width: 1, height: 10, background: "#fff8" }} />
      </div>
      <div style={{ fontSize: 9, color: "#446", letterSpacing: 1 }}>{holdTime.toFixed(2)}s</div>
    </div>
  );
}

// ============================================================
// Session clear overlay
// ============================================================
export function SessionClearOverlay({
  config,
  gameState,
}: {
  config: GameConfig;
  gameState: GameState;
}) {
  const { t } = useI18n();
  const delay = config.game_session?.reboot_delay_seconds ?? 1.5;
  const advance = config.game_session?.advance_level_on_clear !== false;
  const levels = config.levels?.list ?? [];
  let nextLabel: string | null = null;
  if (advance && levels.length > 0) {
    const nextIdx = (gameState.currentLevelIndex + 1) % levels.length;
    const next = levels[nextIdx];
    if (next) nextLabel = t("overlay.clear.nextLevel", { id: next.id, name: next.name.replace(/^Niveau\s*\d+\s*[—-]\s*/i, "") });
  }
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,5,20,0.45)",
        backdropFilter: "blur(2px)",
        pointerEvents: "none",
        zIndex: 50,
        fontFamily: "'Courier New', monospace",
        flexDirection: "column", gap: 8,
        animation: "ballGameFadeIn 0.4s",
      }}
    >
      <div style={{ fontSize: 28, color: "#1e90ff", letterSpacing: 4, textShadow: "0 0 14px #1e90ff" }}>
        {t("overlay.clear.title")}
      </div>
      {nextLabel && (
        <div style={{ fontSize: 16, color: "#dfecff", letterSpacing: 1.5, marginTop: 4 }}>
          → {nextLabel}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#88aaff", letterSpacing: 2 }}>
        {nextLabel ? t("overlay.clear.startIn", { delay: delay.toFixed(1) }) : t("overlay.clear.newGameIn", { delay: delay.toFixed(1) })}
      </div>
    </div>
  );
}
