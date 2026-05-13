import type { GameConfig } from "../../engine/types";
import { InstantCreationMenu } from "../InstantCreationMenu";
import { CLOSE_BTN, MENU_BTN, PANEL, TITLE } from "./menuStyles";
import { useI18n } from "../i18n";

export function MainMenu({
  config, onSettings, onChange, onEvolution, onEvolutionPrompt, onDifficulty, onRules, onLevels, onBoss, onBalls, onTerrain, onPlayerColors, onHowToAsk, onReleaseNotes, onEffects, onApplyInstantConfig, onClose,
}: {
  config:           GameConfig;
  onSettings:       () => void;
  onChange:         () => void;
  onEvolution:      () => void;
  onEvolutionPrompt: (preprompt: string) => void;
  onDifficulty:     () => void;
  onRules:          () => void;
  onLevels:         () => void;
  onBoss:           () => void;
  onBalls:          () => void;
  onTerrain:        () => void;
  onPlayerColors:   () => void;
  onHowToAsk:       () => void;
  onReleaseNotes:   () => void;
  onEffects:        () => void;
  onApplyInstantConfig: (nextConfig: GameConfig, options?: { reset?: boolean; playtestTarget?: unknown }) => void;
  onClose:          () => void;
}) {
  const { t } = useI18n();
  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>{t("app.title.menu")}</div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#1e90ff" }}>{t("menu.main.gameTitle")}</div>
      </div>
      <button style={MENU_BTN} onClick={onSettings}>
        <span style={{ fontSize: 20 }}>⚙️</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Settings</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Langue, hormones et réglages experts</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onChange}>
        <span style={{ fontSize: 20 }}>🍯</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Change</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Graphe honeycomb vivant de la partie</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onEvolution}>
        <span style={{ fontSize: 20 }}>🧬</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{t("menu.evolution")}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.evolution.subtitle")}</div>
        </div>
      </button>
      <InstantCreationMenu config={config} onApplyInstantConfig={onApplyInstantConfig} onOpenEvolution={onEvolutionPrompt} />
      <button style={MENU_BTN} onClick={onDifficulty}>
        <div>🎚️</div><div><div style={{ fontWeight: "bold" }}>{t("menu.difficulty")}</div><div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.difficulty.subtitle")}</div></div>
      </button>
      <button style={MENU_BTN} onClick={onLevels}>
        <span style={{ fontSize: 20 }}>🏁</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{t("menu.level")}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.level.subtitle")}</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onBoss}>
        <span style={{ fontSize: 20 }}>👑</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{t("menu.boss")}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.boss.subtitle")}</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onBalls}>
        <span style={{ fontSize: 20 }}>🔮</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{t("menu.balls")}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.balls.subtitle")}</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onPlayerColors}>
        <span style={{ fontSize: 20 }}>🎯</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{t("menu.playerColors")}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.playerColors.subtitle")}</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onEffects}>
        <span style={{ fontSize: 20 }}>💥</span><div><div style={{ fontWeight: "bold" }}>{t("menu.effects")}</div></div>
      </button>
      <button style={MENU_BTN} onClick={onRules}>
        <span style={{ fontSize: 20 }}>📖</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{t("menu.rules")}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.rules.subtitle")}</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onTerrain}>
        <span style={{ fontSize: 20 }}>⬛</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{t("menu.terrain")}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.terrain.subtitle")}</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onHowToAsk}>
        <span style={{ fontSize: 20 }}>💬</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{t("menu.howToAsk")}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.howToAsk.subtitle")}</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onReleaseNotes}>
        <span style={{ fontSize: 20 }}>📝</span>
        <div>
          <div style={{ fontWeight: "bold" }}>{t("menu.releaseNotes")}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>{t("menu.releaseNotes.subtitle")}</div>
        </div>
      </button>
      <button style={CLOSE_BTN} onClick={onClose}>{t("menu.backToGame")}</button>
    </div>
  );
}

