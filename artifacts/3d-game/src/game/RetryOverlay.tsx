import { useState } from "react";
import type { EvolutionRequestConfig } from "../engine/types";

export type Difficulty = "easy" | "medium" | "hard";
type EvolutionSubmitStatus =
  | { phase: "idle" }
  | { phase: "submitting"; message: string }
  | { phase: "success"; message: string; url?: string }
  | { phase: "error"; message: string };

const DEFAULT_EVOLUTION_REQUEST: EvolutionRequestConfig = {
  repo: "Pierrickian/ball-rules",
  mode: "issue",
  endpoint: "",
  default_title: "Demande d'évolution depuis le jeu",
};

const FALLBACK_DIFFICULTY_HP_PRESETS: Record<Difficulty, number> = { easy: 0, medium: 2, hard: 6 };

export function RetryOverlay({
  reason,
  levelNumber,
  evolutionRequest,
  difficulty,
  hpAdjustment,
  difficultyHpPresets,
  onDifficultyChange,
  onHpAdjustmentChange,
  onRetry,
}: {
  reason: "timeout" | "ammo";
  levelNumber: number;
  evolutionRequest?: EvolutionRequestConfig;
  difficulty: Difficulty;
  hpAdjustment: number;
  difficultyHpPresets?: Partial<Record<Difficulty, number>>;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onHpAdjustmentChange: (adjustment: number) => void;
  onRetry: () => void;
}) {
  const subtitle = reason === "timeout" ? "Temps écoulé" : "Munitions épuisées";
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<EvolutionSubmitStatus>({ phase: "idle" });
  const requestConfig = { ...DEFAULT_EVOLUTION_REQUEST, ...evolutionRequest };
  const difficultyHpFor = (value: Difficulty) => difficultyHpPresets?.[value] ?? FALLBACK_DIFFICULTY_HP_PRESETS[value];

  const applyDifficulty = (value: Difficulty) => {
    onDifficultyChange(value);
    onHpAdjustmentChange(difficultyHpFor(value));
  };

  const requestTitle = () => {
    const firstLine = requestText.trim().split("\n").find((line) => line.trim().length > 0)?.replace(/^\/param\s*/i, "").trim();
    if (!firstLine) return requestConfig.default_title;
    return firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine;
  };

  const buildEvolutionPrompt = () => {
    const trimmed = requestText.trim() || "<texte dicté par le joueur>";
    const paramLine = trimmed.startsWith("/param")
      ? `Paramètres custom joueur : niveau ${levelNumber}, difficulté ${difficulty}, ajustement relatif PV ${hpAdjustment >= 0 ? "+" : ""}${hpAdjustment}.`
      : null;
    return [
      "Demande joueur depuis le jeu :",
      "",
      "Contexte :",
      "- Repo : Pierrickian/ball-rules",
      "- App : WebGL / Capacitor",
      "- Respecter replit.md",
      "- Mettre à jour release_notes",
      "- Ne pas casser les tirs, grenades, menus",
      "",
      "Demande :",
      trimmed,
      paramLine,
      "",
      "Livrable :",
      "- créer une branche",
      "- modifier le jeu",
      "- tester",
      "- ouvrir une PR",
    ].filter(Boolean).join("\n");
  };

  const startVoiceInput = () => {
    const SpeechRecognitionCtor = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setRequestText((prev) => `${prev}${prev ? "\n" : ""}Micro non disponible sur ce navigateur.`);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setVoiceActive(true);
    recognition.onend = () => setVoiceActive(false);
    recognition.onresult = (event: any) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      if (text) setRequestText((prev) => `${prev}${prev ? " " : ""}${text}`);
    };
    recognition.start();
  };

  const submitEvolutionRequest = async () => {
    const title = requestTitle();
    const body = buildEvolutionPrompt();
    const endpoint = requestConfig.endpoint?.trim();
    setSubmitStatus({ phase: "submitting", message: "Envoi en cours…" });

    try {
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo: requestConfig.repo,
            type: requestConfig.mode,
            title,
            body,
            params: { level: levelNumber, difficulty, hpAdjustment },
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const created = await response.json() as { type?: "issue" | "pr"; number?: number; title?: string; url?: string };
        const createdTitle = created.title ?? title;
        const numberPart = typeof created.number === "number" ? ` #${created.number}` : "";
        setSubmitStatus({ phase: "success", message: `Demande${numberPart} créée : ${createdTitle}`, url: created.url });
        window.setTimeout(() => setSubmitStatus({ phase: "idle" }), 4500);
        return;
      }

      const issueUrl = `https://github.com/${requestConfig.repo}/issues/new?${new URLSearchParams({ title, body }).toString()}`;
      window.open(issueUrl, "_blank", "noopener,noreferrer");
      setSubmitStatus({
        phase: "success",
        message: `Formulaire ouvert : ${title}. Valide l'envoi pour obtenir son numéro.`,
        url: issueUrl,
      });
      window.setTimeout(() => setSubmitStatus({ phase: "idle" }), 6500);
    } catch (error) {
      setSubmitStatus({ phase: "error", message: `Création impossible : ${error instanceof Error ? error.message : "erreur inconnue"}` });
      window.setTimeout(() => setSubmitStatus({ phase: "idle" }), 6500);
    }
  };

  const difficultyButton = (value: Difficulty) => {
    const active = difficulty === value;
    return (
      <button
        key={value}
        onClick={(event) => { event.stopPropagation(); applyDifficulty(value); }}
        style={{
          border: `1px solid ${active ? "#ffe66d" : "rgba(255,255,255,0.28)"}`,
          background: active ? "linear-gradient(180deg, #ffe66d, #ff9f1c)" : "rgba(0,0,0,0.42)",
          color: active ? "#1b1000" : "#ffe6f0",
          borderRadius: 999,
          padding: "8px 13px",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 1,
          cursor: "pointer",
          boxShadow: active ? "0 0 18px rgba(255,230,109,0.58)" : "none",
        }}
      >
        <span>{value}</span>
        <span style={{ display: "block", fontSize: 10, marginTop: 3 }}>{difficultyHpFor(value) >= 0 ? "+" : ""}{difficultyHpFor(value)} PV</span>
      </button>
    );
  };

  return (
    <div
      onClick={(event) => { if (event.target === event.currentTarget) onRetry(); }}
      style={{
        position: "absolute",
        inset: 0,
        border: "none",
        background: "rgba(10,0,18,0.72)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
        fontFamily: "'Courier New', monospace",
        color: "#ffe6f0",
      }}
    >
      <div onClick={(event) => event.stopPropagation()} style={{ width: "min(92vw, 430px)", maxHeight: "calc(100vh - 24px)", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "stretch", gap: 12, cursor: "default", paddingRight: 4 }}>
        <div style={{ textAlign: "center", fontSize: 72, fontWeight: 900, color: "#ff4d7a", letterSpacing: 8, textShadow: "0 0 16px #ff4d7a" }}>RETRY</div>
        <div style={{ textAlign: "center", fontSize: 18 }}>{subtitle} — cliquez le fond pour rejouer</div>

        <section style={{ background: "rgba(0,0,0,0.38)", border: "1px solid rgba(255,77,122,0.34)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#ff9fca", textTransform: "uppercase" }}>level</div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>#{levelNumber}</div>
          </div>

          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#ff9fca", textTransform: "uppercase", marginBottom: 8 }}>difficulty</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>{(["easy", "medium", "hard"] as Difficulty[]).map(difficultyButton)}</div>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, letterSpacing: 3, color: "#ff9fca", textTransform: "uppercase" }}>PV adjust</span>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={hpAdjustment}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onHpAdjustmentChange(Number(event.currentTarget.value))}
              style={{ width: "100%", accentColor: hpAdjustment === 0 ? "#1e90ff" : hpAdjustment > 0 ? "#ff9f1c" : "#66ffbb" }}
            />
            <span style={{ alignSelf: "center", fontWeight: 900, color: hpAdjustment === 0 ? "#c8deff" : hpAdjustment > 0 ? "#ffd79a" : "#a8ffd7" }}>{hpAdjustment >= 0 ? "+" : ""}{hpAdjustment} PV</span>
          </label>

          <button onClick={(event) => { event.stopPropagation(); setEvolutionOpen((open) => !open); }} style={{ border: "1px solid rgba(30,144,255,0.55)", background: evolutionOpen ? "rgba(30,144,255,0.28)" : "rgba(12,28,72,0.8)", color: "#d9ecff", borderRadius: 10, padding: "10px 14px", fontWeight: 900, cursor: "pointer" }}>Evolution</button>

          {evolutionOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(4,12,35,0.92)", border: "1px solid rgba(30,144,255,0.28)", borderRadius: 12, padding: 12, maxHeight: "min(46vh, 360px)", overflowY: "auto", overscrollBehavior: "contain" }}>
              <div style={{ fontSize: 12, color: "#aac8f0", lineHeight: 1.3 }}>
                Décris ta demande, puis envoie-la.
              </div>
              <textarea
                value={requestText}
                onChange={(event) => setRequestText(event.currentTarget.value)}
                onClick={(event) => event.stopPropagation()}
                placeholder="Décris l'évolution voulue. /param ajoute niveau, difficulté et PV."
                rows={4}
                style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid rgba(30,144,255,0.35)", background: "rgba(0,0,0,0.45)", color: "#eaf4ff", padding: 10, fontFamily: "inherit", resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={(event) => { event.stopPropagation(); startVoiceInput(); }} disabled={submitStatus.phase === "submitting"} style={{ flex: 1, border: "1px solid rgba(255,255,255,0.28)", background: voiceActive ? "rgba(255,77,122,0.34)" : "rgba(0,0,0,0.38)", color: "#ffe6f0", borderRadius: 8, padding: "8px 10px", cursor: submitStatus.phase === "submitting" ? "wait" : "pointer" }}>{voiceActive ? "🎙️ écoute…" : "🎙️ Vocal"}</button>
                <button onClick={(event) => { event.stopPropagation(); void submitEvolutionRequest(); }} disabled={submitStatus.phase === "submitting"} style={{ flex: 1, border: "1px solid #1e90ff", background: submitStatus.phase === "submitting" ? "#88bfff" : "#1e90ff", color: "#061122", borderRadius: 8, padding: "8px 10px", fontWeight: 900, cursor: submitStatus.phase === "submitting" ? "wait" : "pointer" }}>{submitStatus.phase === "submitting" ? "En cours" : "Envoyer"}</button>
              </div>
              {submitStatus.phase !== "idle" && (
                <div style={{ border: `1px solid ${submitStatus.phase === "error" ? "rgba(255,77,122,0.65)" : "rgba(102,255,187,0.45)"}`, background: submitStatus.phase === "error" ? "rgba(80,0,20,0.38)" : "rgba(0,60,42,0.34)", color: submitStatus.phase === "error" ? "#ffd0dc" : "#c8ffe7", borderRadius: 8, padding: "8px 10px", fontSize: 12, lineHeight: 1.4 }}>
                  {submitStatus.message}
                  {submitStatus.phase === "success" && submitStatus.url && <div><a href={submitStatus.url} target="_blank" rel="noreferrer" style={{ color: "#8fd3ff" }}>Voir le suivi</a></div>}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
