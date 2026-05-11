import type { GameConfig } from "../../engine/types";
import { InstantCreationMenu } from "../InstantCreationMenu";
import { CLOSE_BTN, MENU_BTN, PANEL, TITLE } from "./menuStyles";

export function MainMenu({
  config, onChange, onEvolution, onDifficulty, onRules, onLevels, onBoss, onBalls, onTerrain, onPlayerColors, onHowToAsk, onReleaseNotes, onEffects, onApplyInstantConfig, onClose,
}: {
  config:           GameConfig;
  onChange:         () => void;
  onEvolution:      () => void;
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
  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Menu</div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#1e90ff" }}>Ball Game</div>
      </div>
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
          <div style={{ fontWeight: "bold" }}>Evolution</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Demander une amélioration depuis le jeu</div>
        </div>
      </button>
      <InstantCreationMenu config={config} onApplyInstantConfig={onApplyInstantConfig} />
      <button style={MENU_BTN} onClick={onDifficulty}>
        <div>🎚️</div><div><div style={{ fontWeight: "bold" }}>Difficulté</div><div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Retry rapide et ajustement PV</div></div>
      </button>
      <button style={MENU_BTN} onClick={onLevels}>
        <span style={{ fontSize: 20 }}>🏁</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Niveau</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Progression et description par niveau</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onBoss}>
        <span style={{ fontSize: 20 }}>👑</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Boss</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Boss Rush multi-niveaux</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onBalls}>
        <span style={{ fontSize: 20 }}>🔮</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Détail des balles</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Carte d'identité de chaque couleur</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onPlayerColors}>
        <span style={{ fontSize: 20 }}>🎯</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Couleur terrain</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Partie custom: répartition des couleurs</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onEffects}>
        <span style={{ fontSize: 20 }}>💥</span><div><div style={{ fontWeight: "bold" }}>Effects</div></div>
      </button>
      <button style={MENU_BTN} onClick={onRules}>
        <span style={{ fontSize: 20 }}>📖</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Règles du jeu</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Comprendre le concept</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onTerrain}>
        <span style={{ fontSize: 20 }}>⬛</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Terrain</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Ratio d'aspect &amp; résolution</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onHowToAsk}>
        <span style={{ fontSize: 20 }}>💬</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Comment demander</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Tutos pour interroger l'agent</div>
        </div>
      </button>
      <button style={MENU_BTN} onClick={onReleaseNotes}>
        <span style={{ fontSize: 20 }}>📝</span>
        <div>
          <div style={{ fontWeight: "bold" }}>Notes de version</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 2 }}>Les dernières évolutions du jeu</div>
        </div>
      </button>
      <button style={CLOSE_BTN} onClick={onClose}>✕ Retour au jeu</button>
    </div>
  );
}

