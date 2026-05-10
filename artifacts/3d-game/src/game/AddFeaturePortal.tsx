import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type AddFeaturePhase =
  | "closed"
  | "category_select"
  | "category_transition"
  | "proposal_select"
  | "proposal_transition"
  | "element_select"
  | "element_transition"
  | "hormone_select"
  | "hormone_transition"
  | "random_submitting"
  | "ready_to_send";

export type ProposalAction = {
  title: string;
  subtitle: string;
  featureType?: string;
};

export type FeatureCategory = {
  id: string;
  title: string;
  icon: string;
  subtitle: string;
  accent: {
    primary: string;
    secondary: string;
    gradient: string;
    glow: string;
  };
  proposals: ProposalAction[];
};

type RandomElementId = "wood" | "fire" | "earth" | "metal" | "water";
type RandomHormoneId = "dopamine" | "serotonin" | "oxytocin" | "endorphins" | "adrenaline";

type RandomChoice<TId extends string> = {
  id: TId;
  title: string;
  subtitle: string;
  icon: string;
};

const RANDOM_DEEP_DIVE_PROPOSAL = "Random";

const RANDOM_ELEMENTS: RandomChoice<RandomElementId>[] = [
  { id: "wood", title: "Bois", icon: "🌱", subtitle: "Penchant croissance : explorer, pousser, bifurquer" },
  { id: "fire", title: "Feu", icon: "🔥", subtitle: "Penchant éclat : intensifier, révéler, surprendre" },
  { id: "earth", title: "Terre", icon: "⛰️", subtitle: "Penchant ancrage : stabiliser, nourrir, construire" },
  { id: "metal", title: "Métal", icon: "⚙️", subtitle: "Penchant précision : trancher, structurer, récompenser" },
  { id: "water", title: "Eau", icon: "🌊", subtitle: "Penchant fluidité : adapter, contourner, transformer" },
];

const RANDOM_HORMONES: RandomChoice<RandomHormoneId>[] = [
  { id: "dopamine", title: "Dopamine", icon: "🎯", subtitle: "Besoin d'élan, d'objectif clair et de récompense" },
  { id: "serotonin", title: "Sérotonine", icon: "☀️", subtitle: "Besoin d'équilibre, de confiance et de progression lisible" },
  { id: "oxytocin", title: "Ocytocine", icon: "🤝", subtitle: "Besoin de lien, d'aide et de moments protecteurs" },
  { id: "endorphins", title: "Endorphines", icon: "💫", subtitle: "Besoin de relâchement, de fun physique et de soulagement" },
  { id: "adrenaline", title: "Adrénaline", icon: "⚡", subtitle: "Besoin de tension, d'urgence et de réflexes héroïques" },
];

const RANDOM_ELEMENT_HORMONE_PROMPTS: Record<RandomElementId, Record<RandomHormoneId, string>> = {
  wood: {
    dopamine: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Bois + Dopamine. Crée une mécanique de croissance orientée objectifs, où le joueur nourrit une progression vivante qui débloque une récompense claire au bon moment.",
    serotonin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Bois + Sérotonine. Crée une mécanique de croissance rassurante, avec une progression lisible qui aide le joueur à sentir qu'il maîtrise mieux l'arène.",
    oxytocin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Bois + Ocytocine. Crée une mécanique de croissance alliée, où quelque chose pousse pour protéger, soutenir ou créer un lien utile avec le joueur.",
    endorphins: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Bois + Endorphines. Crée une mécanique de croissance fun et libératrice, qui transforme les erreurs ou collisions en moments satisfaisants et joyeux.",
    adrenaline: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Bois + Adrénaline. Crée une mécanique de croissance sous pression, qui s'étend vite quand le danger monte et force des décisions instinctives.",
  },
  fire: {
    dopamine: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Feu + Dopamine. Crée une mécanique explosive à objectif court, qui donne envie d'enchaîner les actions pour déclencher une récompense spectaculaire.",
    serotonin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Feu + Sérotonine. Crée une mécanique lumineuse et maîtrisable, qui rend les moments intenses plus lisibles et donne confiance au joueur.",
    oxytocin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Feu + Ocytocine. Crée une mécanique de chaleur protectrice, où l'intensité du combat peut aussi sauver, relier ou renforcer le joueur.",
    endorphins: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Feu + Endorphines. Crée une mécanique de défoulement flamboyant, avec des impacts généreux, des réactions en chaîne et un plaisir immédiat.",
    adrenaline: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Feu + Adrénaline. Crée une mécanique brûlante d'urgence, qui augmente le risque et la vitesse pour produire des sauvetages de dernière seconde.",
  },
  earth: {
    dopamine: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Terre + Dopamine. Crée une mécanique de construction gratifiante, où placer, tenir ou consolider quelque chose mène à une récompense nette.",
    serotonin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Terre + Sérotonine. Crée une mécanique d'ancrage stable, qui rend l'arène plus compréhensible et donne au joueur une sensation de contrôle durable.",
    oxytocin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Terre + Ocytocine. Crée une mécanique de refuge ou de soutien, où le terrain protège le joueur et encourage des choix plus bienveillants.",
    endorphins: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Terre + Endorphines. Crée une mécanique de choc satisfaisant, avec du poids, des rebonds massifs et un soulagement physique quand tout retombe bien.",
    adrenaline: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Terre + Adrénaline. Crée une mécanique de forteresse sous siège, où le joueur doit tenir une position malgré une pression qui monte.",
  },
  metal: {
    dopamine: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Métal + Dopamine. Crée une mécanique de précision récompensée, où viser juste, timer juste ou choisir juste déclenche un bonus très satisfaisant.",
    serotonin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Métal + Sérotonine. Crée une mécanique claire et élégante, qui structure le chaos avec des règles simples, lisibles et rassurantes.",
    oxytocin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Métal + Ocytocine. Crée une mécanique de bouclier, pacte ou aimant protecteur, qui transforme la précision en soutien pour le joueur.",
    endorphins: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Métal + Endorphines. Crée une mécanique de percussion jouissive, avec des cliquetis, ricochets ou combos nets qui donnent une sensation de relâchement.",
    adrenaline: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Métal + Adrénaline. Crée une mécanique de réflexe tranchant, où une fenêtre de timing courte permet un retournement spectaculaire.",
  },
  water: {
    dopamine: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Eau + Dopamine. Crée une mécanique de flux récompensé, où maintenir un mouvement ou une chaîne fluide débloque une récompense visible.",
    serotonin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Eau + Sérotonine. Crée une mécanique apaisante et adaptative, qui aide le joueur à reprendre le contrôle quand l'arène devient confuse.",
    oxytocin: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Eau + Ocytocine. Crée une mécanique d'entraide fluide, où des courants, liens ou zones douces guident et protègent le joueur.",
    endorphins: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Eau + Endorphines. Crée une mécanique de glisse libératrice, avec des enchaînements souples, des esquives satisfaisantes et des surprises amusantes.",
    adrenaline: "Ajoute une fonctionnalité Random dans l'esprit du jeu : inspiration Eau + Adrénaline. Crée une mécanique de vague dangereuse, où le joueur surfe une menace mobile pour transformer l'urgence en opportunité.",
  },
};

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: "random",
    title: "RANDOM",
    icon: "🎲",
    subtitle: "Let the IA spark a surprise feature",
    accent: { primary: "#f9a8d4", secondary: "#fde047", gradient: "linear-gradient(135deg, #ec4899, #f97316, #fde047, #22d3ee)", glow: "rgba(249, 168, 212, 0.58)" },
    proposals: [
      { title: "Random", subtitle: "Spin the cosmic roulette and let a wild mechanic escape", featureType: "Random" },
      { title: "Gameplay", subtitle: "Twist the rules of motion, impact, and split-second decisions", featureType: "Gameplay" },
      { title: "Level", subtitle: "Open a strange arena where the terrain rewrites the battle", featureType: "Level" },
      { title: "Boss", subtitle: "Summon a larger-than-life menace with a memorable gimmick", featureType: "Boss" },
      { title: "Ball", subtitle: "Release a new sphere with physics that feel almost alive", featureType: "Ball" },
      { title: "UI", subtitle: "Enchant the interface with clearer signals and playful feedback", featureType: "UI" },
    ],
  },
  {
    id: "new_boss",
    title: "NEW BOSS",
    icon: "👹",
    subtitle: "Create a new enemy personality",
    accent: { primary: "#ff4d7a", secondary: "#ffb347", gradient: "linear-gradient(135deg, #ff2f68, #ff8a3d, #ffd166)", glow: "rgba(255, 77, 122, 0.58)" },
    proposals: [
      { title: "Forge a Boss", subtitle: "Design a dangerous new opponent" },
      { title: "Wake a Threat", subtitle: "Create something powerful and unexpected" },
      { title: "Invent a Rival", subtitle: "Give the player a new challenge to overcome" },
    ],
  },
  {
    id: "new_ball",
    title: "NEW BALL",
    icon: "🟢",
    subtitle: "Add a new moving gameplay element",
    accent: { primary: "#65ffb8", secondary: "#4ddcff", gradient: "linear-gradient(135deg, #00ffa3, #42d9ff, #6b7cff)", glow: "rgba(101, 255, 184, 0.55)" },
    proposals: [
      { title: "Create a Ball", subtitle: "Add a new bouncing entity" },
      { title: "Imagine a Projectile", subtitle: "Design a new shot behavior" },
      { title: "Invent an Orbit", subtitle: "Create strange movement patterns" },
    ],
  },
  {
    id: "new_level",
    title: "NEW LEVEL",
    icon: "🌍",
    subtitle: "Expand the world of the game",
    accent: { primary: "#59a6ff", secondary: "#9b7cff", gradient: "linear-gradient(135deg, #3296ff, #815dff, #e071ff)", glow: "rgba(89, 166, 255, 0.55)" },
    proposals: [
      { title: "Open a Zone", subtitle: "Create a fresh place to play" },
      { title: "Create an Arena", subtitle: "Design a new gameplay space" },
      { title: "Build a World", subtitle: "Invent a whole new environment" },
    ],
  },
  {
    id: "new_weapon",
    title: "NEW WEAPON",
    icon: "⚔️",
    subtitle: "Give players new ways to act",
    accent: { primary: "#ffdf5d", secondary: "#ff6b35", gradient: "linear-gradient(135deg, #ffe45d, #ff9f1c, #ff4d4d)", glow: "rgba(255, 223, 93, 0.55)" },
    proposals: [
      { title: "Forge a Weapon", subtitle: "Create a brand new attack" },
      { title: "Invent a Shot", subtitle: "Imagine unique projectile behavior" },
      { title: "Create an Arsenal", subtitle: "Expand combat possibilities" },
    ],
  },
  {
    id: "new_ability",
    title: "NEW ABILITY",
    icon: "✨",
    subtitle: "Add new powers and interactions",
    accent: { primary: "#c084fc", secondary: "#67e8f9", gradient: "linear-gradient(135deg, #a855f7, #38bdf8, #5eead4)", glow: "rgba(192, 132, 252, 0.58)" },
    proposals: [
      { title: "Unlock a Power", subtitle: "Give players new possibilities" },
      { title: "Imagine an Ability", subtitle: "Create surprising interactions" },
      { title: "Add a Talent", subtitle: "Expand movement or strategy" },
    ],
  },
  {
    id: "new_object",
    title: "NEW OBJECT",
    icon: "🧩",
    subtitle: "Populate the game with interactive things",
    accent: { primary: "#2dd4bf", secondary: "#f472b6", gradient: "linear-gradient(135deg, #14b8a6, #22d3ee, #f472b6)", glow: "rgba(45, 212, 191, 0.55)" },
    proposals: [
      { title: "Add an Object", subtitle: "Place something new in the world" },
      { title: "Invent a Gadget", subtitle: "Create useful or chaotic interactions" },
      { title: "Create an Artifact", subtitle: "Add mysterious gameplay elements" },
    ],
  },
  {
    id: "other",
    title: "OTHER",
    icon: "🌀",
    subtitle: "Something impossible to classify",
    accent: { primary: "#f0abfc", secondary: "#94a3b8", gradient: "linear-gradient(135deg, #f0abfc, #818cf8, #94a3b8)", glow: "rgba(240, 171, 252, 0.52)" },
    proposals: [
      { title: "Unclassified Idea", subtitle: "Describe an idea freely" },
      { title: "Creative Chaos", subtitle: "Experiment without limits" },
      { title: "Something Unique", subtitle: "Create something unexpected" },
    ],
  },
  {
    id: "new_game",
    title: "NEW GAME",
    icon: "🚀",
    subtitle: "Start a completely new experience",
    accent: { primary: "#7dd3fc", secondary: "#fb7185", gradient: "linear-gradient(135deg, #0ea5e9, #6366f1, #fb7185)", glow: "rgba(125, 211, 252, 0.55)" },
    proposals: [
      { title: "Launch a New Game", subtitle: "Start from a fresh concept" },
      { title: "Create an Experience", subtitle: "Design a whole new gameplay loop" },
      { title: "Imagine a Universe", subtitle: "Build an entirely new world" },
    ],
  },
];

const PARTICLES = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: (index * 37) % 100,
  top: (index * 53) % 100,
  size: 3 + (index % 5) * 2,
  delay: (index % 9) * 0.45,
  duration: 6 + (index % 7) * 0.7,
}));

export function buildAddFeaturePrefill(
  category: FeatureCategory,
  proposal: ProposalAction,
  randomContext?: { elementId: RandomElementId; hormoneId: RandomHormoneId }
): string {
  if (category.id === "random") {
    if (proposal.featureType === RANDOM_DEEP_DIVE_PROPOSAL && randomContext) {
      return RANDOM_ELEMENT_HORMONE_PROMPTS[randomContext.elementId][randomContext.hormoneId];
    }
    return `Ajoute une fonctionnalité ${proposal.featureType ?? proposal.title} dans l'esprit du jeu.`;
  }

  return [
    "Add Feature request from the creative portal:",
    `Category: ${category.title}`,
    `Proposal: ${proposal.title}`,
    `Proposal subtitle: ${proposal.subtitle}`,
    "",
    "Describe the idea here:",
  ].join("\n");
}


export function AddFeaturePortal({
  open,
  onClose,
  onSendIdea,
  onSubmitRandomIdea,
}: {
  open: boolean;
  onClose: () => void;
  onSendIdea: (prefillText: string) => void;
  onSubmitRandomIdea: (prefillText: string) => Promise<void>;
}) {
  const [phase, setPhase] = useState<AddFeaturePhase>("closed");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProposalIndex, setSelectedProposalIndex] = useState<number | null>(null);
  const [selectedRandomElementId, setSelectedRandomElementId] = useState<RandomElementId | null>(null);
  const [selectedRandomHormoneId, setSelectedRandomHormoneId] = useState<RandomHormoneId | null>(null);
  const [randomSubmitError, setRandomSubmitError] = useState<string | null>(null);
  const [burstCategoryId, setBurstCategoryId] = useState<string | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase("closed");
      setSelectedCategoryId(null);
      setSelectedProposalIndex(null);
      setSelectedRandomElementId(null);
      setSelectedRandomHormoneId(null);
      setRandomSubmitError(null);
      setBurstCategoryId(null);
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      return;
    }
    setPhase("category_select");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const selectedCategory = useMemo(
    () => FEATURE_CATEGORIES.find((category) => category.id === selectedCategoryId) ?? null,
    [selectedCategoryId]
  );
  const selectedProposal = selectedCategory && selectedProposalIndex !== null
    ? selectedCategory.proposals[selectedProposalIndex]
    : null;
  const selectedRandomElement = RANDOM_ELEMENTS.find((element) => element.id === selectedRandomElementId) ?? null;
  const selectedRandomHormone = RANDOM_HORMONES.find((hormone) => hormone.id === selectedRandomHormoneId) ?? null;

  const chooseCategory = (category: FeatureCategory) => {
    setSelectedCategoryId(category.id);
    setSelectedProposalIndex(null);
    setSelectedRandomElementId(null);
    setSelectedRandomHormoneId(null);
    setRandomSubmitError(null);
    setBurstCategoryId(category.id);
    setPhase("category_transition");
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => {
      setPhase("proposal_select");
      setBurstCategoryId(null);
      transitionTimerRef.current = null;
    }, 1000);
  };

  const submitRandomPrompt = async (prefillText: string, fallbackPhase: AddFeaturePhase) => {
    setRandomSubmitError(null);
    setPhase("random_submitting");
    try {
      await onSubmitRandomIdea(prefillText);
    } catch (error) {
      setRandomSubmitError(`Création impossible : ${error instanceof Error ? error.message : "erreur inconnue"}`);
      setPhase(fallbackPhase);
    }
  };

  const chooseProposal = (index: number) => {
    if (!selectedCategory) return;
    setSelectedProposalIndex(index);
    setSelectedRandomElementId(null);
    setSelectedRandomHormoneId(null);
    setRandomSubmitError(null);
    setPhase("proposal_transition");
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => {
      const proposal = selectedCategory.proposals[index];
      if (selectedCategory.id === "random" && proposal) {
        if (proposal.featureType === RANDOM_DEEP_DIVE_PROPOSAL) {
          setPhase("element_select");
        } else {
          void submitRandomPrompt(buildAddFeaturePrefill(selectedCategory, proposal), "proposal_select");
        }
      } else {
        setPhase("ready_to_send");
      }
      transitionTimerRef.current = null;
    }, 1000);
  };

  const chooseRandomElement = (elementId: RandomElementId) => {
    setSelectedRandomElementId(elementId);
    setSelectedRandomHormoneId(null);
    setPhase("element_transition");
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => {
      setPhase("hormone_select");
      transitionTimerRef.current = null;
    }, 1000);
  };

  const chooseRandomHormone = (hormoneId: RandomHormoneId) => {
    if (!selectedCategory || !selectedProposal || !selectedRandomElementId) return;
    setSelectedRandomHormoneId(hormoneId);
    setPhase("hormone_transition");
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => {
      void submitRandomPrompt(
        buildAddFeaturePrefill(selectedCategory, selectedProposal, { elementId: selectedRandomElementId, hormoneId }),
        "hormone_select"
      );
      transitionTimerRef.current = null;
    }, 1000);
  };

  const sendIdea = () => {
    if (!selectedCategory || !selectedProposal) return;
    onSendIdea(buildAddFeaturePrefill(selectedCategory, selectedProposal));
  };

  if (phase === "closed") return null;

  const accent = selectedCategory?.accent ?? {
    primary: "#65ffb8",
    secondary: "#59a6ff",
    gradient: "linear-gradient(135deg, #00ffa3, #42d9ff, #a855f7)",
    glow: "rgba(101, 255, 184, 0.5)",
  };
  const headingTitle = (() => {
    if (phase === "element_select" || phase === "element_transition") return "Choisis ton élément MTC";
    if (phase === "hormone_select" || phase === "hormone_transition") return "Choisis l'hormone à favoriser";
    if (phase === "random_submitting") return "Validation directe";
    return "Choose what you want to create";
  })();

  return createPortal(
    <div
      className={`add-feature-portal add-feature-portal--${phase}`}
      style={{
        "--af-primary": accent.primary,
        "--af-secondary": accent.secondary,
        "--af-gradient": accent.gradient,
        "--af-glow": accent.glow,
      } as CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label="Choose what you want to create"
    >
      <div className="add-feature-bg" />
      <div className="add-feature-fog add-feature-fog-a" />
      <div className="add-feature-fog add-feature-fog-b" />
      <div className="add-feature-particles" aria-hidden="true">
        {PARTICLES.map((particle) => (
          <span
            key={particle.id}
            className="add-feature-particle"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: particle.size,
              height: particle.size,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}
      </div>

      <button className="add-feature-close" type="button" onClick={onClose} aria-label="Close Add Feature portal">×</button>

      <main className="add-feature-content">
        <div className="add-feature-heading">
          <p className="add-feature-kicker">Creative Portal</p>
          <h1>{headingTitle}</h1>
          {selectedCategory && (
            <p className="add-feature-selected-copy">
              {selectedCategory.icon} {selectedCategory.title} — {selectedCategory.subtitle}
              {selectedProposal?.featureType === RANDOM_DEEP_DIVE_PROPOSAL && selectedRandomElement && ` → ${selectedRandomElement.title}`}
              {selectedProposal?.featureType === RANDOM_DEEP_DIVE_PROPOSAL && selectedRandomHormone && ` → ${selectedRandomHormone.title}`}
            </p>
          )}
        </div>

        {(phase === "category_select" || phase === "category_transition") && (
          <section className="add-feature-category-grid" aria-label="Feature categories">
            {FEATURE_CATEGORIES.map((category) => {
              const isSelected = category.id === selectedCategoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`add-feature-category-card${isSelected ? " is-selected" : ""}${selectedCategoryId && !isSelected ? " is-dissolving" : ""}`}
                  style={{
                    "--card-gradient": category.accent.gradient,
                    "--card-glow": category.accent.glow,
                    "--card-primary": category.accent.primary,
                  } as CSSProperties}
                  onClick={() => chooseCategory(category)}
                  disabled={phase === "category_transition"}
                >
                  <span className="add-feature-card-glow" />
                  {burstCategoryId === category.id && <span className="add-feature-burst" aria-hidden="true" />}
                  <span className="add-feature-category-icon" aria-hidden="true">{category.icon}</span>
                  <span className="add-feature-category-title">{category.title}</span>
                  <span className="add-feature-category-subtitle">{category.subtitle}</span>
                </button>
              );
            })}
          </section>
        )}

        {(phase === "proposal_select" || phase === "proposal_transition" || phase === "ready_to_send") && selectedCategory && (
          <section className="add-feature-proposal-stage" aria-label={`${selectedCategory.title} proposals`}>
            {selectedCategory.proposals.map((proposal, index) => (
              <button
                key={proposal.title}
                type="button"
                className={`add-feature-proposal-button${selectedProposalIndex === index ? " is-selected" : ""}${phase === "proposal_transition" && selectedProposalIndex !== index ? " is-dissolving" : ""}`}
                style={{ animationDelay: `${index * 130}ms` }}
                onClick={() => chooseProposal(index)}
                disabled={phase === "proposal_transition"}
              >
                <span className="add-feature-proposal-shine" aria-hidden="true" />
                <span className="add-feature-proposal-title">{proposal.title}</span>
                <span className="add-feature-proposal-subtitle">{proposal.subtitle}</span>
              </button>
            ))}
          </section>
        )}

        {(phase === "element_select" || phase === "element_transition") && selectedCategory && selectedProposal && (
          <section className="add-feature-proposal-stage add-feature-proposal-stage--five" aria-label="Choix d'élément MTC">
            {RANDOM_ELEMENTS.map((element, index) => (
              <button
                key={element.id}
                type="button"
                className={`add-feature-proposal-button add-feature-proposal-button--compact${selectedRandomElementId === element.id ? " is-selected" : ""}${phase === "element_transition" && selectedRandomElementId !== element.id ? " is-dissolving" : ""}`}
                style={{ animationDelay: `${index * 90}ms` }}
                onClick={() => chooseRandomElement(element.id)}
                disabled={phase === "element_transition"}
              >
                <span className="add-feature-proposal-shine" aria-hidden="true" />
                <span className="add-feature-choice-icon" aria-hidden="true">{element.icon}</span>
                <span className="add-feature-proposal-title">{element.title}</span>
                <span className="add-feature-proposal-subtitle">{element.subtitle}</span>
              </button>
            ))}
          </section>
        )}

        {(phase === "hormone_select" || phase === "hormone_transition") && selectedCategory && selectedProposal && selectedRandomElement && (
          <section className="add-feature-proposal-stage add-feature-proposal-stage--five" aria-label="Choix d'hormone à favoriser">
            {RANDOM_HORMONES.map((hormone, index) => (
              <button
                key={hormone.id}
                type="button"
                className={`add-feature-proposal-button add-feature-proposal-button--compact${selectedRandomHormoneId === hormone.id ? " is-selected" : ""}${phase === "hormone_transition" && selectedRandomHormoneId !== hormone.id ? " is-dissolving" : ""}`}
                style={{ animationDelay: `${index * 90}ms` }}
                onClick={() => chooseRandomHormone(hormone.id)}
                disabled={phase === "hormone_transition"}
              >
                <span className="add-feature-proposal-shine" aria-hidden="true" />
                <span className="add-feature-choice-icon" aria-hidden="true">{hormone.icon}</span>
                <span className="add-feature-proposal-title">{hormone.title}</span>
                <span className="add-feature-proposal-subtitle">{hormone.subtitle}</span>
              </button>
            ))}
          </section>
        )}
      </main>

      {(phase === "category_transition" || phase === "proposal_transition" || phase === "element_transition" || phase === "hormone_transition" || phase === "random_submitting") && (
        <div className="add-feature-loading" role="status" aria-live="polite">
          <span className="add-feature-loading-orb" aria-hidden="true" />
          <span>{phase === "random_submitting" ? "L'IA valide la demande…" : "L'IA mélange les idées…"}</span>
        </div>
      )}

      {randomSubmitError && (
        <div className="add-feature-submit-error" role="alert">
          {randomSubmitError}
        </div>
      )}

      <button
        className="add-feature-cta"
        type="button"
        disabled={!selectedCategory || !selectedProposal || phase !== "ready_to_send"}
        onClick={sendIdea}
      >
        ENVOYER L'IDÉE À L'IA
      </button>
    </div>,
    document.body
  );
}
