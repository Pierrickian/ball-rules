import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameEvent, RuntimePhase } from "../../engine/types";
import type { ImpactPopupPayload, StarPopupPayload, UiEntity, UiEntityInput, UiEntityKind } from "./uiEntityTypes";

function buildEntity<TKind extends UiEntityKind>(input: UiEntityInput<TKind>): Extract<UiEntity, { type: TKind }> {
  const createdAt = Date.now();

  return {
    ...input,
    id: input.id ?? `${input.type}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    expiresAt: input.durationMs ? createdAt + input.durationMs : undefined,
  } as Extract<UiEntity, { type: TKind }>;
}

export function useUiEntities(runtimePhase?: RuntimePhase) {
  const [entities, setEntities] = useState<UiEntity[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const lastAmmoWarningAtRef = useRef(0);

  const remove = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setEntities((previous) => previous.filter((entity) => entity.id !== id));
  }, []);

  const spawn = useCallback(<TKind extends UiEntityKind>(input: UiEntityInput<TKind>) => {
    const entity = buildEntity(input);

    setEntities((previous) => {
      const now = Date.now();
      const filtered = previous.filter((candidate) => !candidate.expiresAt || candidate.expiresAt > now);
      return [...filtered, entity];
    });

    if (entity.expiresAt) {
      const timer = window.setTimeout(() => remove(entity.id), Math.max(0, entity.expiresAt - Date.now()));
      timersRef.current.set(entity.id, timer);
    }

    return entity.id;
  }, [remove]);

  const showGrenadeAwardPopup = useCallback((amount: number) => {
    return spawn({
      type: "grenade_award_popup",
      payload: { amount },
      durationMs: 900,
    });
  }, [spawn]);

  const showStarPopup = useCallback((label: string, kind: StarPopupPayload["kind"] = "earned", durationMs = 2300) => {
    return spawn({
      type: "star_popup",
      payload: { label, kind },
      durationMs,
    });
  }, [spawn]);

  const showAmmoWarning = useCallback(() => {
    const now = Date.now();
    if (now - lastAmmoWarningAtRef.current < 700) return null;
    lastAmmoWarningAtRef.current = now;
    return spawn({
      type: "ammo_warning_popup",
      payload: {},
      durationMs: 1200,
    });
  }, [spawn]);

  const showImpactPopup = useCallback((kind: ImpactPopupPayload["kind"], label: string, from: number, to: number) => {
    const start = Math.round(from);
    const target = Math.max(start, Math.round(to));
    return spawn({
      type: "impact_popup",
      payload: { kind, label, from: start, to: target },
      durationMs: 1900,
    });
  }, [spawn]);

  const spawnForGameEvent = useCallback((event: GameEvent) => {
    if (event.type === "grenade_awarded") {
      showGrenadeAwardPopup(event.amount);
      return true;
    }
    return false;
  }, [showGrenadeAwardPopup]);

  const clearPhase = useCallback((phase: RuntimePhase) => {
    setEntities((previous) => {
      const kept: UiEntity[] = [];
      for (const entity of previous) {
        if (entity.phase === phase) {
          const timer = timersRef.current.get(entity.id);
          if (timer !== undefined) window.clearTimeout(timer);
          timersRef.current.delete(entity.id);
        } else {
          kept.push(entity);
        }
      }
      return kept;
    });
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) window.clearTimeout(timer);
      timersRef.current.clear();
    };
  }, []);

  const grouped = useMemo(() => {
    return entities.reduce<Record<string, UiEntity[]>>((accumulator, entity) => {
      accumulator[entity.type] ??= [];
      accumulator[entity.type].push(entity);
      return accumulator;
    }, {});
  }, [entities]);

  return {
    entities,
    grouped,
    runtimePhase,
    spawn,
    remove,
    clearPhase,
    showGrenadeAwardPopup,
    showStarPopup,
    showAmmoWarning,
    showImpactPopup,
    spawnForGameEvent,
  };
}
