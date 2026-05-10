import type { GameConfig } from "../engine/types";
import { InstantHoneycombWizard } from "./InstantHoneycombWizard";

export function InstantCreationMenu({
  config,
  onApplyInstantConfig,
}: {
  config: GameConfig;
  onApplyInstantConfig: (
    nextConfig: GameConfig,
    options?: { reset?: boolean; playtestTarget?: unknown }
  ) => void;
}) {
  return <InstantHoneycombWizard config={config} onApplyInstantConfig={onApplyInstantConfig} />;
}
