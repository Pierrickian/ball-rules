import { useState } from "react";
import type { GameConfig } from "../../engine/types";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";
import { useI18n } from "../i18n";
import { terrainColors } from "./colorHelpers";

export function BallCard({ colorKey, config }: { colorKey: string; config: GameConfig }) {
  const { t } = useI18n();
  const colorEntry = config.ball_colors[colorKey as keyof typeof config.ball_colors];
  const ruleEntry  = config.ball_rules[colorKey  as keyof typeof config.ball_rules];
  const hasRule = !!ruleEntry;
  const bounceCondition = config.bounce_conditions?.ball_bounce_conditions?.[colorKey] ?? "—";
  const spawnCond  = config.gameplay[colorKey]?.spawn?.condition  ?? "—";
  const despawnCond = config.gameplay[colorKey]?.despawn?.condition ?? "—";

  const bounceLabels: Record<string, string> = {
    against_wall:     "Rebondit sur les murs",
    against_ball:     "Rebondit sur les balles (traverse les murs)",
    against_obstacle: "Rebondit sur les obstacles",
    against_all:      "Rebondit sur tout",
  };

  const isWhite = colorKey === "white";

  // HP info for hp_grow_bouncer
  let hpInfo: string | null = null;
  if (ruleEntry?.rule === "hp_grow_bouncer") {
    const p = config.rule_parameters.hp_grow_bouncer;
    if (p) hpInfo = `${p.default_hp} PV (max ${p.max_hp}) · +${p.hp_gained_per_traversal} PV par traversée`;
  }

  return (
    <div
      style={{
        background: "rgba(6,16,45,0.9)",
        border: `1.5px solid ${colorEntry?.hex ?? "#334"}55`,
        borderRadius: 14,
        padding: "20px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 320,
        opacity: hasRule ? 1 : 0.85,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: "50%",
            background: colorEntry?.hex ?? "#888",
            boxShadow: `0 0 18px ${colorEntry?.hex ?? "#888"}88`,
            border: isWhite ? "1px solid #555" : "none",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: "bold", color: "#ddeeff" }}>
            {colorEntry?._label ?? colorKey}
          </div>
          <div style={{ fontSize: 11, color: "#445", fontFamily: "monospace", marginTop: 2 }}>
            {colorEntry?.hex} &nbsp;|&nbsp; rgb({colorEntry?.rgb?.join(", ")})
          </div>
        </div>
      </div>

      {colorEntry?.system_role ? (
        <div
          style={{
            background: "rgba(30,80,140,0.22)",
            border: "1px solid rgba(120,180,255,0.45)",
            borderRadius: 10,
            padding: "14px 14px",
            color: "#cfe5ff",
            fontSize: 12,
            lineHeight: 1.55,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: "bold", letterSpacing: 1, fontSize: 11, color: "#9fc8ff" }}>
            {t("balls.systemRole", { role: colorEntry.system_role.toUpperCase() })}
          </div>
          <div style={{ color: "#bcd6f4" }}>
            {colorEntry._system_role_description ??
              t("balls.systemFallback")}
          </div>
        </div>
      ) : !hasRule ? (
        <div
          style={{
            background: "rgba(60,60,30,0.25)",
            border: "1px dashed rgba(220,180,80,0.5)",
            borderRadius: 10,
            padding: "14px 14px",
            color: "#e0c887",
            fontSize: 12,
            lineHeight: 1.55,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: "bold", letterSpacing: 1, fontSize: 11, color: "#f0d896" }}>
            {t("balls.pending")}
          </div>
          <div style={{ color: "#cbb98a" }}>
            {t("balls.pendingHelp")}
          </div>
        </div>
      ) : (
        <>
          <div>
            <div style={TITLE}>{t("balls.rule")}</div>
            <div style={{ fontSize: 13, color: "#7a9fcc", fontStyle: "italic", marginBottom: 3 }}>{ruleEntry?.rule}</div>
            <div style={{ fontSize: 12, color: "#99b0d4", lineHeight: 1.6 }}>{ruleEntry?._description}</div>
          </div>

          {hpInfo && (
            <div>
              <div style={TITLE}>{t("balls.hp")}</div>
              <div style={{ fontSize: 12, color: "#88dd88" }}>{hpInfo}</div>
            </div>
          )}

          <div>
            <div style={TITLE}>{t("balls.bounce")}</div>
            <div style={{
              fontSize: 12, color: "#66aacc",
              background: "rgba(30,90,180,0.12)", borderRadius: 6,
              padding: "5px 10px", display: "inline-block",
              fontFamily: "monospace", marginBottom: 3,
            }}>
              {bounceCondition}
            </div>
            <div style={{ fontSize: 11, color: "#556", marginTop: 4 }}>
              {bounceLabels[bounceCondition] ?? bounceCondition}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={TITLE}>{t("balls.spawn")}</div>
              <div style={{ fontSize: 11, color: "#6faa88" }}>{spawnCond}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={TITLE}>{t("balls.despawn")}</div>
              <div style={{ fontSize: 11, color: "#aa6f6f" }}>{despawnCond}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Balls Carousel
// ============================================================
export function BallsMenu({ config, onBack }: { config: GameConfig; onBack: () => void }) {
  const { t } = useI18n();
  // Show every terrain-side color (the `for_terrain` flag in game_config.json).
  // Includes system mechanics like orange — they get a "Rôle système" badge
  // instead of "En attente de règle". Player-only colors (like gray) are
  // intentionally absent: they live in the player shot queue, not on the
  // terrain.
  const colors = terrainColors(config);
  const [index, setIndex] = useState(0);
  const prev = () => setIndex((i) => (i - 1 + colors.length) % colors.length);
  const next = () => setIndex((i) => (i + 1) % colors.length);
  const colorKey = colors[index];

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>{t("menu.balls")}</div>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#1e90ff" }}>{index + 1} / {colors.length}</div>
      </div>
      <BallCard colorKey={colorKey} config={config} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button onClick={prev} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>
          {t("common.previousFem")}
        </button>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {colors.map((c, i) => {
            const ce = config.ball_colors[c as keyof typeof config.ball_colors];
            return (
              <div
                key={c}
                onClick={() => setIndex(i)}
                style={{
                  width: i === index ? 10 : 6, height: i === index ? 10 : 6,
                  borderRadius: "50%",
                  background: i === index ? (ce?.hex ?? "#1e90ff") : "rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  boxShadow: i === index ? `0 0 6px ${ce?.hex ?? "#1e90ff"}` : "none",
                  transition: "all 0.2s",
                }}
              />
            );
          })}
        </div>
        <button onClick={next} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>
          {t("common.nextFem")}
        </button>
      </div>
      <button style={CLOSE_BTN} onClick={onBack}>{t("menu.back")}</button>
    </div>
  );
}

// ============================================================
// How To Ask — Carousel of 3 tutorials
//
// Each tutorial explains comment formuler une demande à l'agent.
// Tutos 1 & 2 fournissent un prompt prêt à copier ; le tuto 3
// se résout in-game et pointe vers le bon sous-menu.
