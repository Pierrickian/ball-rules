---
name: new
description: Exécuter automatiquement une séquence Git de démarrage de tâche: checkout main, pull, journaliser le titre du dernier commit, créer une nouvelle branche, puis lire replit.md comme source d'instructions. Utiliser ce skill quand l'utilisateur demande de lancer une nouvelle branche avec cette checklist.
---

# Procédure

1. Vérifier l'état du dépôt:
   - `git status --short --branch`

2. Basculer sur `main`:
   - `git checkout main`

3. Mettre à jour `main`:
   - `git pull`

4. Journaliser le titre du dernier commit de `main`:
   - `git log -1 --pretty=%s`

5. Créer une nouvelle branche (nom fourni par l'utilisateur, sinon proposer `feat/<sujet>`):
   - `git checkout -b <nouvelle-branche>`

6. Charger les instructions du dépôt:
   - Lire `replit.md` à la racine
   - Appliquer ces règles pour toute la suite du travail

# Sortie attendue

- Donner un récapitulatif court:
  - branche source (`main`) synchronisée ou non,
  - titre du dernier commit,
  - nom de la nouvelle branche créée,
  - confirmation de lecture de `replit.md`.
