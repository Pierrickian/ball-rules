import type { RuntimePhase } from "../../engine/types";

export type UiEntityKind =
  | "grenade_award_popup"
  | "star_popup"
  | "ammo_warning_popup"
  | "impact_popup"
  | "wave_notice"
  | "wave_results"
  | "evolution_panel"
  | "ammo_end_notice"
  | "time_up_notice";

export type UiEntityBlocking = "none" | "pointer" | "modal";

interface UiEntityBase<TKind extends UiEntityKind, TPayload> {
  id: string;
  type: TKind;
  payload: TPayload;
  createdAt: number;
  expiresAt?: number;
  durationMs?: number;
  blocking?: UiEntityBlocking;
  phase?: RuntimePhase;
}

export interface GrenadeAwardPayload {
  amount: number;
}

export interface StarPopupPayload {
  label: string;
  kind: "earned" | "lost" | "reloadLost";
}

export interface AmmoWarningPayload {
  label?: string;
}

export interface ImpactPopupPayload {
  kind: "ammo" | "balls" | "hp";
  label: string;
  from: number;
  to: number;
  current: number;
}

export interface WaveNoticePayload {
  outcome: "victory" | "defeat";
  title: string;
}

export interface WaveResultsPayload {
  outcome: "victory" | "defeat";
  durationSeconds: number;
  reloadCount: number;
  maxCombo: number;
  previousRecord: number;
  combos: Record<string, number>;
}

export interface EvolutionPanelPayload {
  selectedAlveoleIds: string[];
}

export type UiEntity =
  | UiEntityBase<"grenade_award_popup", GrenadeAwardPayload>
  | UiEntityBase<"star_popup", StarPopupPayload>
  | UiEntityBase<"ammo_warning_popup", AmmoWarningPayload>
  | UiEntityBase<"impact_popup", ImpactPopupPayload>
  | UiEntityBase<"wave_notice", WaveNoticePayload>
  | UiEntityBase<"wave_results", WaveResultsPayload>
  | UiEntityBase<"evolution_panel", EvolutionPanelPayload>
  | UiEntityBase<"ammo_end_notice", AmmoWarningPayload>
  | UiEntityBase<"time_up_notice", WaveNoticePayload>;

export type UiEntityInput<TKind extends UiEntityKind = UiEntityKind> = Omit<
  Extract<UiEntity, { type: TKind }>,
  "id" | "createdAt" | "expiresAt"
> & {
  id?: string;
  durationMs?: number;
};

export interface UiEntitySpawnOptions {
  id?: string;
  durationMs?: number;
  blocking?: UiEntityBlocking;
  phase?: RuntimePhase;
}
