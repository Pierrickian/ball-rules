# Workspace

## Overview

Monorepo pnpm TypeScript. Chaque package gère ses propres dépendances.

## Instructions agent

For architecture, refactor, engine split, menu split, capability or runtime patch tasks, read and apply `skills/agent-architecture/SKILL.md` before coding.

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

### Catégorisation des couleurs (drapeaux par balle)

Chaque entrée de `ball_colors` (dans `game_config.json`) porte deux drapeaux qui pilotent toute la catégorisation, plus un champ optionnel pour les mécanismes système :

| Champ | Type | Effet |
|---|---|---|
| `selectable_by_player` | bool | La couleur apparaît dans le menu **Couleur joueur** et peut entrer dans `gameplay_controls.queue_ball_colors`. |
| `for_terrain` | bool | La couleur appartient au terrain : visible dans le carrousel **Détail des balles**, et candidate au pool de projectiles du lanceur (si elle a une règle et n'est pas système). |
| `system_role` (optionnel) | string | Marque la couleur comme un mécanisme système (ex. `"launcher"` pour orange). Toujours rendu dans le carrousel avec un encart **Rôle système** au lieu d'**En attente de règle**. Exclu du pool de projectiles du lanceur. |
| `_system_role_description` (optionnel) | string | Texte affiché sous le badge **Rôle système** dans le carrousel. À fournir dès que `system_role` est défini. |

Une même couleur peut combiner les deux drapeaux (ex. `white` est joueur + terrain). `gray` est joueur uniquement (`for_terrain: false`). `orange` est terrain + `system_role: "launcher"`. Toutes les couleurs en attente de règle (jaune, rouge, etc.) restent `for_terrain: true` pour rester visibles dans le carrousel avec leur badge d'attente.

Les listes affichées dans les sous-menus sont **dérivées** automatiquement des drapeaux par les helpers `playerColors`, `terrainColors`, `launcherColors` dans `Menu.tsx`. Ne JAMAIS ré-introduire de constantes en dur — la source unique de vérité est `ball_colors` dans `game_config.json`.

### Cohérence règles ↔ carrousel ↔ couleurs lançables

À chaque ajout, modification ou suppression de règle dans `ball_rules`, l'agent doit propager les changements :

- **`ball_rules.<couleur>`** → toute couleur listée ici DOIT avoir une description (`_description`) et un type de règle (`rule`) à jour, puisque ces champs sont rendus tels quels dans le carrousel **Détail des balles**.
- **`bounce_conditions.ball_bounce_conditions.<couleur>`** → entrée obligatoire pour chaque couleur ayant une règle, sinon le rebond tombe sur le défaut moteur.
- **`gameplay.<couleur>`** → doit définir `spawn` et `despawn` pour chaque couleur ayant une règle.
- **`gameplay.orange.launch_config.allow_colors`** → doit lister TOUTES les couleurs lançables (= `for_terrain: true` + a une règle + pas de `system_role`). Le menu **Couleur lancée** filtre via le helper `launcherColors(config)` ; `allow_colors` doit refléter exactement le même ensemble pour le mode `color: "random"` du lanceur.
- **Drapeaux dans `ball_colors`** → si l'ajout d'une règle rend une couleur jouable / lançable, vérifier que `selectable_by_player` et `for_terrain` reflètent l'intention.

Conventions actuelles :

- **`gray`** = joueur seulement. `selectable_by_player: true`, `for_terrain: false`. Ne doit jamais être lançable par l'orange.
- **`orange`** = mécanisme système (lanceur). `for_terrain: true`, `system_role: "launcher"`, pas d'entrée dans `ball_rules`. Géré dans `gameplay.orange` + moteur (`performOrangeSpawn` / `performOrangeLaunch`). Reste visible dans le carrousel avec un encart **Rôle système** : ne jamais le supprimer de `ball_colors`.

### Système de niveaux (`levels`)

Le jeu progresse par niveaux. Chaque entrée de `levels.list` (dans `game_config.json`) définit :

- `id` : numéro du niveau (1-indexé, lisible).
- `name` : titre court affiché dans le carrousel et l'overlay de fin de manche.
- `description` : phrase courte expliquant ce qui change pour le joueur.
- `launch_color_weights` : poids relatifs par couleur pour la pioche du lanceur orange (ex. `{ "white": 0.8, "dark_green": 0.2 }`). Les poids sont normalisés à 1 au runtime — l'échelle des nombres ne compte pas.

Règles d'enchaînement :

- À chaque clear (toutes les balles de `game_session.max_balls_spawned` détruites), le hook `useGameEngine` incrémente l'index de niveau (mod `levels.list.length`) avant de relancer le moteur. Au-delà du dernier niveau, on boucle au premier.
- Le drapeau `game_session.advance_level_on_clear` (défaut `true`) permet de désactiver la progression — le même niveau rejoue alors en boucle.
- Le `reset` manuel (bouton) **ne change pas** le niveau actif : il rejoue le niveau courant. Seul l'auto-reboot fait progresser.
- Le sous-menu **Niveau** (🏁) est un carrousel descriptif. Il démarre sur le niveau actif (badge **★ NIVEAU ACTIF**) et affiche la pondération sous forme de barres horizontales avec pourcentages.

Priorité de la pioche du lanceur orange (`game_engine.ts > performOrangeLaunch`) :

1. **Niveau actif** : si `levels.list` est non vide, on tire selon `launch_color_weights` du niveau courant via `weightedPickColor`.
2. **`launch_config.color === "random"`** : tirage uniforme dans `allow_colors`.
3. **`launch_config.color` fixe** : couleur unique forcée.

Conséquence : le sous-menu **Couleur lancée** (🟠) reste fonctionnel mais son réglage est ignoré tant que des niveaux sont configurés. Il sert de mode debug.

Pour ajouter / éditer un niveau :

- Vérifier que toutes les couleurs listées dans `launch_color_weights` ont une entrée dans `ball_rules` ET sont `for_terrain: true`.
- Les couleurs `selectable_by_player`-only (ex. `gray`) ne doivent pas apparaître dans les poids — elles sont réservées au joueur.
- Penser à ajouter une note de version (`release_notes`) décrivant le nouveau niveau.

### Notes de version (`release_notes`)

- Champ `release_notes` (tableau de strings) dans `game_config.json`, affiché dans le sous-menu **Notes de version** du jeu.
- **Avant chaque commit**, l'agent doit ajouter en tête de liste un titre court (≈ 6-10 mots) résumant l'évolution apportée par le commit.
- Le tableau ne dépasse jamais **20 entrées** : si l'ajout fait passer à 21, supprimer la plus ancienne (la dernière du tableau) avant de commiter.
- L'ordre est strictement **du plus récent au plus ancien** (l'index 0 = la nouveauté du commit en cours).
- Pas de date, pas de numéro de version, pas de lien — juste un titre lisible par un joueur non-développeur.
- Si le commit est purement interne (refacto sans impact joueur), ajouter quand même une ligne neutre du type « Refonte interne du moteur » plutôt que de sauter la mise à jour.

### Localisation UI

- Tout texte affiché au joueur doit être localisé par défaut, sauf demande explicite contraire.
- Chaque nouveau texte UI doit avoir une version française et anglaise.
- Les textes doivent réagir au changement de langue runtime sans nécessiter de rechargement.
- Ne pas afficher simultanément les deux langues pour un même message, sauf si la demande utilisateur l'exige explicitement.

### Règles développeur

- **Tout changement de règle → `ball.changeRule()` ou `ball.passRuleTo()`** (Ball.ts)
- **Tout paramètre → `game_config.json`** (jamais de valeur en dur)
- **Ajouter une règle** : JSON `ball_rules` → handler dans `game_engine.ts` → `registerAllHandlers()`
- **Ajouter un BounceCondition** : JSON `bounce_conditions._enum_values` → enum `types.ts` → `resolveWallBounce` / `resolveBallCollisions`
- **Ball est un game object** : instancier via `new Ball(...)`, comportements via engine
- **Graphiques 3D et logique = zéro couplage** (engine files = zéro import Three.js)
- **Physique 2D uniquement** (plan X/Y, caméra overhead)
- **Balles: matériau PBR metallic** (roughness faible, metalness élevé)
