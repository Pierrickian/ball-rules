---
name: agent-architecture
description: Guider les agents lors des refactors et évolutions pour préserver une architecture lisible, typée et compatible avec un workflow IA-first.
---

# Objectif

Garder le dépôt facile à comprendre, inspecter et modifier par des agents IA.

Les changements doivent rester locaux, typés et organisés par responsabilité.

# Règles de découpage

- Préférer plusieurs petits fichiers cohérents plutôt qu'un très gros fichier.
- Viser des fichiers sous 300 à 400 lignes quand c'est raisonnable.
- Garder les fichiers orchestrateurs légers.
- Ne pas transformer un orchestrateur en fichier fourre-tout.
- Extraire progressivement les blocs cohérents.
- Ne pas mélanger plusieurs refactors sans lien dans le même commit.

Exemples de fichiers orchestrateurs à garder simples:

- `src/App.tsx`
- `src/game/Menu.tsx`
- `src/engine/game_engine.ts`
- `src/engine/useGameEngine.ts`

# Modules recommandés

Pour le moteur:

- `collisionSystem.ts`
- `bossSystem.ts`
- `launchSystem.ts`
- `projectileSystem.ts`
- `levelSystem.ts`
- `ruleHandlers.ts`
- `engineMath.ts`

Pour l'interface:

- sous-composants par écran de menu,
- helpers purs pour couleurs, poids et labels,
- styles partagés isolés,
- types de props séparés si le fichier grossit.

# Typage TypeScript

- Éviter `any`.
- Éviter `this: any`.
- Préférer des interfaces de contexte étroites.
- Passer uniquement les dépendances nécessaires.
- Si un système dépend de l'état moteur, créer un contexte dédié minimal.
- Ne pas exposer tout le moteur à un module si quelques méthodes suffisent.

Si un `any` temporaire est inévitable:

- le limiter à une frontière très courte,
- ajouter une note expliquant pourquoi,
- prévoir une extraction typée ensuite.

# Règles pour le moteur

- La logique moteur ne doit pas importer React.
- La logique moteur ne doit pas importer Three.js.
- Le rendu et la physique restent découplés.
- Les paramètres de gameplay viennent de `game_config.json`.
- Ne pas réintroduire de constantes gameplay en dur quand une clé config existe.
- Garder `GameEngine` comme API publique principale.
- Déplacer les helpers privés seulement si le contrat est clair.

# Règles pour les capabilities instantanées

- Une capability doit déclarer ce que le moteur sait faire.
- L'UI ne doit pas deviner les possibilités du moteur.
- Distinguer:
  - capability demandée,
  - contexte de ciblage,
  - patch runtime,
  - éventuelle évolution moteur.

Les modifications instantanées sont runtime-only:

- ne pas écrire dans `public/game_config.json`,
- ne pas modifier la source de vérité persistante,
- ne pas créer de commit automatiquement.

Après un apply instantané:

- lancer directement une session jouable,
- cibler le bon niveau ou boss,
- créer un niveau temporaire pour tester une balle si nécessaire,
- éviter toute navigation manuelle inutile.

# Validation attendue

Avant de terminer:

- lancer le typecheck ou build disponible,
- vérifier que le comportement existant est préservé,
- lister les fichiers créés ou extraits,
- signaler les gros fichiers encore à découper,
- signaler les `any` restants si pertinents.
