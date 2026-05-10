import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type AddFeaturePhase =
  | "closed"
  | "category_select"
  | "category_transition"
  | "proposal_select"
  | "ready_to_send";

export type ProposalAction = {
  title: string;
  subtitle: string;
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

export const FEATURE_CATEGORIES: FeatureCategory[] = [
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

export function buildAddFeaturePrefill(category: FeatureCategory, proposal: ProposalAction): string {
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
}: {
  open: boolean;
  onClose: () => void;
  onSendIdea: (prefillText: string) => void;
}) {
  const [phase, setPhase] = useState<AddFeaturePhase>("closed");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProposalIndex, setSelectedProposalIndex] = useState<number | null>(null);
  const [burstCategoryId, setBurstCategoryId] = useState<string | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase("closed");
      setSelectedCategoryId(null);
      setSelectedProposalIndex(null);
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

  const chooseCategory = (category: FeatureCategory) => {
    setSelectedCategoryId(category.id);
    setSelectedProposalIndex(null);
    setBurstCategoryId(category.id);
    setPhase("category_transition");
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => {
      setPhase("proposal_select");
      setBurstCategoryId(null);
      transitionTimerRef.current = null;
    }, 520);
  };

  const chooseProposal = (index: number) => {
    setSelectedProposalIndex(index);
    setPhase("ready_to_send");
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
          <h1>Choose what you want to create</h1>
          {selectedCategory && (
            <p className="add-feature-selected-copy">
              {selectedCategory.icon} {selectedCategory.title} — {selectedCategory.subtitle}
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

        {(phase === "proposal_select" || phase === "ready_to_send") && selectedCategory && (
          <section className="add-feature-proposal-stage" aria-label={`${selectedCategory.title} proposals`}>
            {selectedCategory.proposals.map((proposal, index) => (
              <button
                key={proposal.title}
                type="button"
                className={`add-feature-proposal-button${selectedProposalIndex === index ? " is-selected" : ""}`}
                style={{ animationDelay: `${index * 130}ms` }}
                onClick={() => chooseProposal(index)}
              >
                <span className="add-feature-proposal-shine" aria-hidden="true" />
                <span className="add-feature-proposal-title">{proposal.title}</span>
                <span className="add-feature-proposal-subtitle">{proposal.subtitle}</span>
              </button>
            ))}
          </section>
        )}
      </main>

      <button
        className="add-feature-cta"
        type="button"
        disabled={!selectedCategory || !selectedProposal}
        onClick={sendIdea}
      >
        SEND IDEA TO CODEX
      </button>
    </div>,
    document.body
  );
}
