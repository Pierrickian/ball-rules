# Workspace

## Overview

Monorepo pnpm TypeScript. Chaque package gère ses propres dépendances.

## Stack

- **Monorepo**: pnpm workspaces — **Node.js**: 24 — **TypeScript**: 5.9
- **API**: Express 5 — **DB**: PostgreSQL + Drizzle ORM
- **Validation**: Zod — **Codegen**: Orval (OpenAPI)

## Key Commands

- `pnpm run typecheck` — typecheck complet
- `pnpm run build` — build tous packages
- `pnpm --filter @workspace/api-spec run codegen` — regénérer hooks + Zod depuis OpenAPI

---

## Ball Game 3D (`artifacts/3d-game`)

Jeu de balles top-down 3D — React Three Fiber, vue portrait.

### Architecture (logique/graphique décorrélés)

```
src/
  engine/
    types.ts          — Types TS (BallColor, BallSize, BallRule, BounceCondition enum, GameState…)
    Ball.ts           — Classe Ball: data+logic, zéro import Three.js
    game_engine.ts    — GameEngine: handlers de règles, physique 2D, bounce conditions
    useGameEngine.ts  — Hook React: charge config, pilote la boucle de jeu

  scenes/
    GameScene.tsx     — Canvas Three.js + OrthographicCamera (graphique uniquement)
    BallMesh.tsx      — Sphère 3D PBR metallic pour une balle (graphique uniquement)

  game/
    HUD.tsx           — Overlay 2D (compteur balles, pause, menu)
    Menu.tsx          — Menu: Règles du jeu + Carrousel de cartes balles

  App.tsx             — Point d'entrée, relie toutes les couches

public/
  game_config.json    — SOURCE DE VÉRITÉ UNIQUE (lisible par non-développeurs)
```

### game_config.json — sections clés

| Section | Contenu |
|---|---|
| `graphics.ball_sizes` | Diamètre small/medium/large |
| `graphics.ball_material` | roughness, metalness, emissive_intensity |
| `ball_colors` | RGB + hex pour les 12 couleurs |
| `ball_rules` | Règle + description par couleur |
| `bounce_conditions._enum_values` | Définition globale des 4 types de rebond |
| `bounce_conditions.ball_bounce_conditions` | Type de rebond attribué à chaque couleur |
| `rule_parameters` | Réglages fins (rayon, force, durée…) |
| `gameplay.orange` | Spawn timer, couleur lancée (white), vitesse |
| `gameplay.<couleur>` | Spawn/despawn conditions par couleur |
| `game_rules_concept` | Texte affiché dans le menu Règles |

### BounceCondition enum (types.ts + JSON)

```
against_wall     → rebondit murs uniquement
against_ball     → rebondit balles uniquement (sort par les murs)
against_obstacle → rebondit obstacles (future)
against_all      → rebondit tout
```

### Notes de version (`release_notes`)

- Champ `release_notes` (tableau de strings) dans `game_config.json`, affiché dans le sous-menu **Notes de version** du jeu.
- **Avant chaque commit**, l'agent doit ajouter en tête de liste un titre court (≈ 6-10 mots) résumant l'évolution apportée par le commit.
- Le tableau ne dépasse jamais **20 entrées** : si l'ajout fait passer à 21, supprimer la plus ancienne (la dernière du tableau) avant de commiter.
- L'ordre est strictement **du plus récent au plus ancien** (l'index 0 = la nouveauté du commit en cours).
- Pas de date, pas de numéro de version, pas de lien — juste un titre lisible par un joueur non-développeur.
- Si le commit est purement interne (refacto sans impact joueur), ajouter quand même une ligne neutre du type « Refonte interne du moteur » plutôt que de sauter la mise à jour.

### Règles développeur

- **Tout changement de règle → `ball.changeRule()` ou `ball.passRuleTo()`** (Ball.ts)
- **Tout paramètre → `game_config.json`** (jamais de valeur en dur)
- **Ajouter une règle** : JSON `ball_rules` → handler dans `game_engine.ts` → `registerAllHandlers()`
- **Ajouter un BounceCondition** : JSON `bounce_conditions._enum_values` → enum `types.ts` → `resolveWallBounce` / `resolveBallCollisions`
- **Ball est un game object** : instancier via `new Ball(...)`, comportements via engine
- **Graphiques 3D et logique = zéro couplage** (engine files = zéro import Three.js)
- **Physique 2D uniquement** (plan X/Y, caméra overhead)
- **Balles: matériau PBR metallic** (roughness faible, metalness élevé)
