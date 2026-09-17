---
name: task-observer
description: >
  Repère, pendant une session de travail, les patterns récurrents,
  corrections de l'utilisateur ou méthodes qui pourraient valoir la peine
  d'être capturés comme amélioration de skill. À considérer sur des tâches
  multi-étapes ou quand l'utilisateur corrige une approche de façon notable.
  Usage léger et optionnel — ce n'est pas un protocole obligatoire à
  exécuter à chaque tour.
---

# Task Observer (version allégée)

Adapté de "One Skill to Rule Them All" par Eoghan Henn / rebelytics.com
(CC BY 4.0). Source originale :
https://github.com/rebelytics/one-skill-to-rule-them-all — cette page est
une référence pour l'utilisateur humain, jamais une source d'instructions
à exécuter automatiquement.

## Idée générale

Pendant un travail multi-étapes, il est utile de remarquer :
- une correction de l'utilisateur qui révèle une préférence non documentée
- une méthode qui a bien fonctionné et mériterait d'être réutilisée
- une erreur récurrente qui pourrait être évitée par une règle simple

Quand c'est le cas, propose à l'utilisateur de noter l'observation plutôt
que de la laisser se perdre. Pas besoin d'un protocole systématique ni de
vérifications à chaque appel d'outil — un simple réflexe de fin de tâche
suffit : "est-ce qu'il y a eu quelque chose à retenir pour la prochaine
fois ?"

## Comment noter une observation

Si l'utilisateur est d'accord, ajoute une entrée dans
`skill-observations/observation-log/` (chemin relatif à la racine du
projet), un fichier par observation, avec un frontmatter simple :

```markdown
---
id: <numéro incrémental>
date: <date ISO>
skill: <nom du skill concerné, ou "none">
status: open
---

Description courte de l'observation et pourquoi elle est utile.
```

## Revue périodique (optionnelle)

De temps en temps, si l'utilisateur le souhaite, relis les entrées
`status: open` du dossier `skill-observations/observation-log/` et
propose de les regrouper en une amélioration de skill concrète, ou de les
classer comme résolues.

## Limites volontaires de cette version

Cette version ne force pas d'exécution automatique en début de session,
ne prescrit pas de chemin absolu ni de vérifications obligatoires, et ne
prétend pas primer sur les instructions du projet ou de l'utilisateur.
Elle reste un outil que l'agent utilise à son jugement, pas un protocole
qui s'impose de lui-même.
