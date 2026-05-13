import { useCallback, useMemo, useState } from "react";
import type { RuntimePhase } from "../../engine/types";
import type { UiEntity, UiEntityInput, UiEntityKind } from "./uiEntityTypes";

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

  const spawn = useCallback(<TKind extends UiEntityKind>(input: UiEntityInput<TKind>) => {
    const entity = buildEntity(input);

    setEntities((previous) => {
      const now = Date.now();
      const filtered = previous.filter((candidate) => !candidate.expiresAt || candidate.expiresAt > now);
      return [...filtered, entity];
    });

    return entity.id;
  }, []);

  const remove = useCallback((id: string) => {
    setEntities((previous) => previous.filter((entity) => entity.id !== id));
  }, []);

  const clearPhase = useCallback((phase: RuntimePhase) => {
    setEntities((previous) => previous.filter((entity) => entity.phase !== phase));
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
  };
}
