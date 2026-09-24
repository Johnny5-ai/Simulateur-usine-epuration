---
id: 2
date: 2026-09-18
skill: superpowers:test-driven-development
status: open
---

En recalibrant l'eau brute du simulateur (alcalinité 40 → 120 mg/L CaCO₃) et la
dose de chaux par défaut qui va avec (7,5 → 12,5 mg/L), deux tests ont échoué.
Aucun des deux ne signalait ce qu'il avait l'air de signaler.

Le plus trompeur : `simulation.test.js` comparait le dosage de chaux « tôt »
(au décanteur) et « tard » (à la réserve). La branche « tard » utilisait le
réglage par défaut, la branche « tôt » codait `limeDose: 7.5` en dur. Après le
recalibrage, le test ne comparait plus deux *ordres* de dosage mais deux *doses*
différentes, et rapportait un écart de pH de 0,37 comme si le modèle avait
cessé de commuter. Une fois la constante importée depuis
`defaultReserveSettings()`, l'écart est tombé à zéro : le modèle était correct
depuis le début.

Le second échec était réel mais mal cadré : le test exigeait moins de 2 NTU en
sortie de décanteur, alors qu'un Pulsator qui rend 1 à 3 NTU fonctionne bien —
c'est le filtre qui doit descendre sous 0,3. L'attente encodait une performance
que le procédé n'a jamais eu à fournir.

Leçon pour de futurs travaux de calibration : un test qui duplique une valeur
par défaut au lieu de l'importer ne casse pas franchement quand cette valeur
bouge, il se met à mesurer autre chose en silence — et le diagnostic part alors
sur une fausse piste (« le modèle ne commute plus ») au lieu du vrai problème
(« le test ne compare plus la même chose »). Avant de conclure qu'un
recalibrage a cassé la physique, vérifier que chaque test échoué compare encore
ce que son titre annonce. Envisager d'ajouter à la revue une question du type
« ce test fige-t-il une constante de calibration qu'il devrait importer ? ».
