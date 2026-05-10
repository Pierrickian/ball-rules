import type { EvolutionRequestConfig } from "../engine/types";

export type EvolutionSubmitStatus =
  | { phase: "idle" }
  | { phase: "submitting"; message: string }
  | { phase: "success"; message: string; url?: string }
  | { phase: "error"; message: string };

export type EvolutionSubmitParams = {
  evolutionRequest?: EvolutionRequestConfig;
  requestText: string;
  currentLevelNumber: number;
  difficulty: string;
  hpAdjustment: number;
};

export type EvolutionSubmitResult = {
  title: string;
  url?: string;
  number?: number;
};

export const DEFAULT_EVOLUTION_REQUEST: EvolutionRequestConfig = {
  repo: "Pierrickian/ball-rules",
  mode: "issue",
  endpoint: "",
  default_title: "Demande d'évolution depuis le jeu",
};

export function buildEvolutionRequestTitle(requestText: string, evolutionRequest?: EvolutionRequestConfig): string {
  const requestConfig = { ...DEFAULT_EVOLUTION_REQUEST, ...evolutionRequest };
  const firstLine = requestText.trim().split("\n").find((line) => line.trim().length > 0)?.trim();
  if (!firstLine) return requestConfig.default_title;
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine;
}

export function buildEvolutionRequestBody(requestText: string): string {
  const trimmed = requestText.trim() || "<demande du joueur>";
  return [
    "Demande joueur depuis le menu Evolution :",
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
    "",
    "Livrable : modifier le jeu, tester, ouvrir une PR.",
  ].join("\n");
}

export async function submitEvolutionRequest({
  evolutionRequest,
  requestText,
  currentLevelNumber,
  difficulty,
  hpAdjustment,
}: EvolutionSubmitParams): Promise<EvolutionSubmitResult> {
  const requestConfig = { ...DEFAULT_EVOLUTION_REQUEST, ...evolutionRequest };
  const title = buildEvolutionRequestTitle(requestText, evolutionRequest);
  const body = buildEvolutionRequestBody(requestText);
  const endpoint = requestConfig.endpoint?.trim();

  if (endpoint) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repo: requestConfig.repo,
        type: requestConfig.mode,
        title,
        body,
        params: { level: currentLevelNumber, difficulty, hpAdjustment },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const created = await response.json() as { number?: number; title?: string; url?: string };
    return { title: created.title ?? title, url: created.url, number: created.number };
  }

  const issueUrl = `https://github.com/${requestConfig.repo}/issues/new?${new URLSearchParams({ title, body }).toString()}`;
  window.open(issueUrl, "_blank", "noopener,noreferrer");
  return { title, url: issueUrl };
}
