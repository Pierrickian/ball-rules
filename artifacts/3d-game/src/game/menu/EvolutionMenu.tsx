import { useEffect, useState } from "react";
import type { EvolutionRequestConfig } from "../../engine/types";
import { submitEvolutionRequest, type EvolutionSubmitStatus } from "../evolutionRequest";
import { CLOSE_BTN, PANEL, TITLE } from "./menuStyles";
import type { Difficulty } from "./menuTypes";

export function EvolutionMenu({
  evolutionRequest,
  currentLevelNumber,
  difficulty,
  hpAdjustment,
  onBack,
  initialText = "",
}: {
  evolutionRequest?: EvolutionRequestConfig;
  currentLevelNumber: number;
  difficulty: Difficulty;
  hpAdjustment: number;
  onBack: () => void;
  initialText?: string;
}) {
  const [requestText, setRequestText] = useState(initialText);
  const [voiceActive, setVoiceActive] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<EvolutionSubmitStatus>({ phase: "idle" });
  useEffect(() => { setRequestText(initialText); }, [initialText]);
  const startVoiceInput = () => {
    const SpeechRecognitionCtor = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setRequestText((prev) => `${prev}${prev.trim() ? "\n" : ""}Micro non disponible sur ce navigateur.`);
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
      if (text) setRequestText((prev) => `${prev}${prev.endsWith(" ") ? "" : " "}${text}`);
    };
    recognition.start();
  };

  const sendEvolutionRequest = async () => {
    setSubmitStatus({ phase: "submitting", message: "Envoi en cours…" });
    try {
      const result = await submitEvolutionRequest({
        evolutionRequest,
        requestText,
        currentLevelNumber,
        difficulty,
        hpAdjustment,
      });
      setSubmitStatus({
        phase: "success",
        message: `Demande${typeof result.number === "number" ? ` #${result.number}` : ""} créée : ${result.title}`,
        url: result.url,
      });
    } catch (error) {
      setSubmitStatus({ phase: "error", message: `Création impossible : ${error instanceof Error ? error.message : "erreur inconnue"}` });
    }
  };

  return (
    <div style={PANEL}>
      <div>
        <div style={TITLE}>Evolution</div>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#1e90ff" }}>Demande d'amélioration</div>
      </div>
      <div style={{ fontSize: 12, color: "#8aa6cc", lineHeight: 1.5 }}>
        Décris clairement l'amélioration souhaitée : comportement attendu, menu concerné ou règle à modifier.
      </div>
      <textarea
        value={requestText}
        onChange={(event) => setRequestText(event.currentTarget.value)}
        placeholder="Décris l'évolution voulue…"
        rows={6}
        style={{ width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid rgba(30,144,255,0.35)", background: "rgba(0,0,0,0.45)", color: "#eaf4ff", padding: 12, fontFamily: "inherit", resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={startVoiceInput} disabled={submitStatus.phase === "submitting"} style={{ ...CLOSE_BTN, flex: 1, color: "#ffe6f0", borderColor: "rgba(255,255,255,0.28)", background: voiceActive ? "rgba(255,77,122,0.34)" : "rgba(0,0,0,0.25)" }}>{voiceActive ? "🎙️ écoute…" : "🎙️ Vocal"}</button>
        <button onClick={() => void sendEvolutionRequest()} disabled={submitStatus.phase === "submitting"} style={{ ...CLOSE_BTN, flex: 1, color: "#061122", background: "#1e90ff", borderColor: "#1e90ff", fontWeight: 900 }}>{submitStatus.phase === "submitting" ? "En cours" : "Envoyer"}</button>
      </div>
      {submitStatus.phase !== "idle" && (
        <div style={{ border: `1px solid ${submitStatus.phase === "error" ? "rgba(255,77,122,0.65)" : "rgba(102,255,187,0.45)"}`, background: submitStatus.phase === "error" ? "rgba(80,0,20,0.38)" : "rgba(0,60,42,0.34)", color: submitStatus.phase === "error" ? "#ffd0dc" : "#c8ffe7", borderRadius: 8, padding: "8px 10px", fontSize: 12, lineHeight: 1.4 }}>
          {submitStatus.message}
          {submitStatus.phase === "success" && submitStatus.url && <div><a href={submitStatus.url} target="_blank" rel="noreferrer" style={{ color: "#8fd3ff" }}>Voir le suivi</a></div>}
        </div>
      )}
      <button style={CLOSE_BTN} onClick={onBack}>← Retour</button>
    </div>
  );
}

// ============================================================
// Release Notes View
