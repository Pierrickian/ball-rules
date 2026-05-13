import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameEvent, RuntimePhase } from "../../engine/types";
import type { UiEntity, UiEntityInput, UiEntityKind } from "./uiEntityTypes";

function buildEntity<TKind extends UiEntityKind>(
  input: UiEntityInput<TKind>,
): Extract<UiEntity, { type: TKind }> {
  const createdAt = Date.now();
  const durationMs = input.durationMs;

  return {
    ...input,
    id: input.id ?? `${input.type}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    expiresAt: durationMs ? createdAt + durationMs : undefined,
  } as Extract<UiEntity, { type: TKind }>;
}

export function useUiEntities(lastEvents: GameEvent[], runtimePhase?: RuntimePhase) {
  const [entities, setEntities] = useState<UiEntity[]>([]);

  const spawn = useCallback(<TKind extends UiEntityKind>(input: UiEntityInput<TKind>) => {
    const entity = buildEntity(input);
    setEntities((previous) => [...previous, entity]);
    return entity.id;
  }, []);

  const remove = useCallback((id: string) => {
    setEntities((previous) => previous.filter((entity) => entity.id !== id));
  }, []);

  const clearPhase = useCallback((phase: RuntimePhase) => {
    setEntities((previous) => previous.filter((entity) => entity.phase !== phase));
  }, []);

  useEffect(() => {
    const now = Date.now();
    setEntities((previous) => previous.filter((entity) => !entity.expiresAt || entity.expiresAt > now));
  }, [entities.length]);

  useEffect(() => {
    for (const event of lastEvents) {
      if (event.type === "grenade_awarded") {
        spawn({
          type: "grenade_award_popup",
          payload: { amount: event.amount },
          durationMs: 900,
        });
      }

      if (event.type === "combo_popup") {
        spawn({
          type: "star_popup",
          payload: {
            label: event.label,
            kind: "earned",
          },
          durationMs: 2300,
        });
      }
    }
  }, [lastEvents, spawn]);

  const grouped = useMemo(() => {
    return entities.reduce<Record<UiEntityKind, UiEntity[]>>((accumulator, entity) => {
      accumulator[entity.type] ??= [];
      accumulator[entity.type].push(entity);
      return accumulator;
    }, {
      grenade_award_popup: [],
      star_popup: [],
      ammo_warning_popup: [],
      impact_popup: [],
      wave_notice: [],
      wave_results: [],
      evolution_panel: [],
      ammo_end_notice: [],
      time_up_notice: [],
    });
  }, [entities]);

  return {
    entities,
    grouped,
    runtimePhase,
    spawn,
    remove,
    clearPhase,
  };
}
