---
id: 1
date: 2026-09-17
skill: superpowers:subagent-driven-development
status: open
---

Lors de l'implémentation du simulateur d'eau potable (13 tâches, revue à
deux étages par tâche), un bug d'intégration réel a survécu à toutes les
revues par tâche : l'étape finale du pipeline (`reserve.js`) recalculait
le débit uniquement à partir de sa propre pression de pompe, en ignorant
le débit amont. Résultat : une panne de pompe simulée en amont n'avait
aucun effet visible sur le débit affiché en sortie — alors que la spec
l'exigeait explicitement.

Ni la revue de `reserve.js` (qui testait l'étape isolément) ni celle de
`main.js` (qui testait le câblage des événements) n'ont détecté le
problème, car chacune raisonnait sur son propre fichier. Le bug n'a été
trouvé qu'en exécutant une vérification manuelle bout-en-bout d'un
scénario complet (étape explicitement prévue par le plan mais facile à
survoler une fois toutes les tâches "vertes").

Leçon pour de futurs plans/revues sur des pipelines multi-étapes : prévoir
systématiquement, en plus des revues par tâche, une vérification
fonctionnelle de bout en bout par scénario avant la revue finale — et
envisager d'ajouter au template de revue de code une question explicite
du type "un réglage modifié par un scénario a-t-il l'effet attendu sur le
résultat final affiché, pas seulement sur l'étape qu'il touche
directement ?".
