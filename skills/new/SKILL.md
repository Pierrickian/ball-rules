---
name: new
description: Exécuter automatiquement une séquence Git de démarrage de tâche.
---

# Procédure

1. git status --short --branch
2. git checkout main
3. git pull
4. git log -1 --pretty=%s
5. git checkout -b <nouvelle-branche>

# Branch rules

- Si branche déjà mergée → en créer une nouvelle
- Ne jamais réutiliser une branche mergée

# Link rules

- PR: https://github.com/<owner>/<repo>/pull/<number>
- Pas de lien compare
- Deploy: lien GitHub Pages après merge
