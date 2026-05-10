import { useState } from "react";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";

export interface HowToAskTuto {
  id: string;
  emoji: string;
  title: string;
  intro: string;
  /** Si défini, on affiche un bouton "Copier le prompt". */
  prompt?: string;
  /** Si défini, on affiche un encart "C'est dans le jeu !". */
  inGame?: { menuName: string; instructions: string };
}

export const HOW_TO_ASK_TUTOS: HowToAskTuto[] = [
  {
    id: "add_color",
    emoji: "🎨",
    title: "Ajouter une nouvelle couleur",
    intro:
      "Demande à l'agent qu'une nouvelle couleur de balle entre en jeu, et précise à quelle fréquence elle doit apparaître dans l'arène.",
    prompt:
      "Je voudrais que la couleur [NOM_COULEUR] apparaisse dans l'arène. Fais en sorte qu'une nouvelle balle de cette couleur entre en jeu environ toutes les [FREQUENCE_EN_SECONDES] secondes.",
  },
  {
    id: "edit_color_rules",
    emoji: "✏️",
    title: "Éditer / créer les règles d'une couleur",
    intro:
      "Demande à l'agent de définir ou modifier le comportement d'une couleur de balle : sur quoi elle rebondit, ses points de vie, ses dégâts, comment elle apparaît et comment elle disparaît.",
    prompt:
      "Je voudrais définir le comportement de la couleur [NOM_COULEUR]. Voici ce que je veux qu'elle fasse en jeu : [DÉCRIS_LE_COMPORTEMENT — par exemple : « elle rebondit sur les murs et sur les autres balles, démarre avec 3 points de vie, perd 1 point de vie à chaque rebond contre un mur, disparaît à 0 point de vie, et fait 2 dégâts à chaque balle qu'elle touche »].",
  },
  {
    id: "color_rules",
    emoji: "📋",
    title: "Connaître les règles d'une couleur",
    intro:
      "Demande à l'agent un récapitulatif complet d'une couleur : son comportement, ses points de vie, ses dégâts, ses rebonds, ses conditions d'apparition et de disparition.",
    prompt:
      "Décris-moi en détail le comportement de la couleur [NOM_COULEUR] en jeu : ses points de vie de départ, ses dégâts, comment elle se déplace, sur quoi elle rebondit, comment elle apparaît, comment elle disparaît, et tout effet spécial qu'elle peut avoir.",
  },
  {
    id: "player_colors",
    emoji: "🎯",
    title: "Tirer d'autres couleurs en tant que joueur",
    intro:
      "Pas besoin de prompt pour ça : la sélection des couleurs disponibles dans la file de tir du joueur se fait directement depuis le menu, en jeu.",
    inGame: {
      menuName: "Couleur joueur",
      instructions:
        "Ouvre le menu, puis va dans « Couleur joueur ». Active ou désactive les couleurs que tu veux voir apparaître dans ta file de tir (sélection multiple = tirage aléatoire). Au moins une couleur doit rester active.",
    },
  },
];

// ---- Glossary used in the intro panel of the "How to ask" carousel ----
export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const HOW_TO_ASK_GLOSSARY: GlossaryEntry[] = [
  {
    term: "Arène",
    definition: "Le terrain de jeu rectangulaire dans lequel évoluent toutes les balles.",
  },
  {
    term: "Balle",
    definition: "N'importe quelle bille colorée présente dans l'arène (les balles ennemies, les balles spéciales, etc.).",
  },
  {
    term: "Lanceur (balle orange)",
    definition: "La balle orange qui apparaît sur les bords de l'arène et fait entrer en jeu de nouvelles balles.",
  },
  {
    term: "Couleur",
    definition: "Le « type » d'une balle. Chaque couleur a son propre comportement (= sa règle).",
  },
  {
    term: "Règle",
    definition: "Le comportement associé à une couleur : rebonds, dégâts, points de vie, effets spéciaux, conditions d'apparition et de disparition.",
  },
  {
    term: "Points de vie (PV)",
    definition: "Quantité de dégâts qu'une balle peut encaisser avant de disparaître. Affichés au-dessus de chaque balle en jeu.",
  },
  {
    term: "Tir / Projectile",
    definition: "La balle lancée par le joueur depuis le bas de l'écran. Il en existe trois types selon la durée d'appui : tir léger, tir appuyé, méga tir.",
  },
  {
    term: "Tir à charge",
    definition: "Le type de projectile dépend du temps d'appui avant le relâchement : léger (blanc), appuyé (jaune), méga (rose).",
  },
  {
    term: "Menu « Couleur joueur »",
    definition: "Sous-menu qui choisit le pool de couleurs piochées pour la file d'attente des tirs du joueur.",
  },
  {
    term: "Menu « Détail des balles »",
    definition: "Carrousel qui présente chaque couleur de la palette, avec sa règle si elle est définie ou un statut « en attente de règle » sinon.",
  },
  {
    term: "Menu « Terrain »",
    definition: "Sous-menu qui règle le ratio d'aspect et la résolution de l'arène.",
  },
];

export function HowToAskIntro() {
  return (
    <div
      style={{
        background: "rgba(6,16,48,0.8)",
        border: "1px solid rgba(30,144,255,0.25)",
        borderRadius: 12,
        padding: "14px 16px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>📖</span>
        <div style={{ fontSize: 13, fontWeight: "bold", color: "#cfe0ff", letterSpacing: 0.3 }}>
          Comment parler à l'agent
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#8aa6cc", lineHeight: 1.55 }}>
        Pour que l'agent comprenne tes demandes du premier coup, utilise le vocabulaire ci-dessous quand
        tu décris des objets du jeu ou que tu parles d'un menu. Tous les tutos suivants reprennent ces
        termes : remplace simplement les valeurs entre <span style={{ color: "#cfe0ff" }}>[…]</span> par
        ce que tu veux.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          maxHeight: 180,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {HOW_TO_ASK_GLOSSARY.map((g) => (
          <div
            key={g.term}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(110px, 38%) 1fr",
              gap: 8,
              alignItems: "baseline",
              padding: "5px 0",
              borderBottom: "1px solid rgba(30,144,255,0.08)",
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: "bold", color: "#7fb3ff" }}>{g.term}</div>
            <div style={{ fontSize: 11, color: "#aac2dc", lineHeight: 1.5 }}>{g.definition}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowToAskCard({ tuto }: { tuto: HowToAskTuto }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!tuto.prompt) return;
    try {
      await navigator.clipboard.writeText(tuto.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for older / restricted browsers
      const ta = document.createElement("textarea");
      ta.value = tuto.prompt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  };

  return (
    <div
      style={{
        background: "rgba(6,16,48,0.8)",
        border: "1px solid rgba(30,144,255,0.2)",
        borderRadius: 12,
        padding: "16px 16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26 }}>{tuto.emoji}</span>
        <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff" }}>{tuto.title}</div>
      </div>

      <div style={{ fontSize: 12, color: "#8aa6cc", lineHeight: 1.55 }}>
        {tuto.intro}
      </div>

      {tuto.prompt && (
        <>
          <div
            style={{
              background: "rgba(0,5,20,0.7)",
              border: "1px dashed rgba(30,144,255,0.35)",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 11.5,
              color: "#cfe0ff",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              fontFamily: "'Courier New', monospace",
            }}
          >
            {tuto.prompt}
          </div>
          <button
            onClick={onCopy}
            style={{
              background: copied ? "rgba(60,200,120,0.22)" : "rgba(30,144,255,0.2)",
              border: copied ? "1px solid #3cc878" : "1px solid rgba(30,144,255,0.55)",
              color: copied ? "#7fe6a8" : "#cfe0ff",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: "bold",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {copied ? "✓ Copié !" : "📋 Copier le prompt"}
          </button>
          <div style={{ fontSize: 10.5, color: "#556", lineHeight: 1.5 }}>
            Remplace les valeurs entre crochets <span style={{ color: "#8aa6cc" }}>[…]</span> avant d'envoyer le message à l'agent.
          </div>
        </>
      )}

      {tuto.inGame && (
        <div
          style={{
            background: "rgba(20,60,30,0.35)",
            border: "1px solid rgba(60,200,120,0.4)",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎮</span>
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#7fe6a8", letterSpacing: 1 }}>
              C'EST DANS LE JEU
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#cfe0ff", lineHeight: 1.55 }}>
            Menu : <strong style={{ color: "#fff" }}>« {tuto.inGame.menuName} »</strong>
          </div>
          <div style={{ fontSize: 11.5, color: "#aac8b6", lineHeight: 1.55 }}>
            {tuto.inGame.instructions}
          </div>
        </div>
      )}
    </div>
  );
}

export function HowToAskMenu({ onBack }: { onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const tutos = HOW_TO_ASK_TUTOS;
  const prev = () => setIndex((i) => (i - 1 + tutos.length) % tutos.length);
  const next = () => setIndex((i) => (i + 1) % tutos.length);
  const tuto = tutos[index];

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Comment demander</div>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#1e90ff" }}>
          {index + 1} / {tutos.length}
        </div>
      </div>

      <HowToAskIntro />

      <HowToAskCard tuto={tuto} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button onClick={prev} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>
          ← Précédent
        </button>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {tutos.map((t, i) => (
            <div
              key={t.id}
              onClick={() => setIndex(i)}
              style={{
                width: i === index ? 10 : 6, height: i === index ? 10 : 6,
                borderRadius: "50%",
                background: i === index ? "#1e90ff" : "rgba(255,255,255,0.18)",
                cursor: "pointer",
                boxShadow: i === index ? "0 0 6px #1e90ff" : "none",
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>
        <button onClick={next} style={{ ...CLOSE_BTN, flex: 1, textAlign: "center", color: "#aac8f0", borderColor: "rgba(30,144,255,0.4)" }}>
          Suivant →
        </button>
      </div>

      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

