import type { BallColor, GameConfig } from "../../engine/types";

// ============================================================
// Color list helpers — derived from per-color attributes
// ============================================================
//
// Each entry in `ball_colors` (game_config.json) carries two flags:
//   - `selectable_by_player` → can be picked into the player's shot queue.
//   - `for_terrain`          → belongs to the terrain side of the game
//                              (visible in the carousel, eligible for the
//                              orange launcher's projectile pool).
//
// Plus an optional `system_role` field (e.g. "launcher" for orange) that marks
// the color as a terrain *mechanic* instead of a regular ball type. System
// colors stay visible on the terrain side but are excluded from the launcher's
// projectile pool (the launcher cannot launch itself).
//
// All menu lists are derived from these flags so the JSON config is the only
// place to edit when ball categorisation changes.

/** Helper: list of color keys (excludes the JSON metadata fields). */
export function realColorKeys(config: GameConfig): BallColor[] {
  return Object.keys(config.ball_colors).filter(
    (c) => c !== "_description" && c !== "_color_format"
  ) as BallColor[];
}

/** Colors picked by the player's shot queue ("Couleur joueur" menu). */
export function playerColors(config: GameConfig): BallColor[] {
  return realColorKeys(config).filter(
    (c) => config.ball_colors[c]?.selectable_by_player === true
  );
}

/** Colors visible in the "Détail des balles" carousel. */
export function terrainColors(config: GameConfig): BallColor[] {
  return realColorKeys(config).filter(
    (c) => config.ball_colors[c]?.for_terrain === true
  );
}

/** Colors the orange launcher can shoot ("Couleur lancée" menu).
 *  = terrain colors that have a rule AND are not system mechanics. */

export function launcherColors(config: GameConfig): BallColor[] {
  return terrainColors(config).filter(
    (c) =>
      !config.ball_colors[c]?.system_role &&
      !!config.ball_rules[c]
  );
}
