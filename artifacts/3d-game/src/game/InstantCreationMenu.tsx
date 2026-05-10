import type { GameConfig } from "../engine/types";
import { InstantHoneycombWizard } from "./InstantHoneycombWizard";

export function InstantCreationMenu({
  config,
  onApplyInstantConfig,
  onOpenEvolution,
}: {
  config: GameConfig;
  onApplyInstantConfig: (
    nextConfig: GameConfig,
    options?: { reset?: boolean; playtestTarget?: unknown }
  ) => void;
  onOpenEvolution: (preprompt: string) => void;
}) {
  return <InstantHoneycombWizard config={config} onApplyInstantConfig={onApplyInstantConfig} onOpenEvolution={onOpenEvolution} />;
}
