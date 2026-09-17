# Simulateur d'usine de production d'eau potable — Design

Date : 2026-09-16

## Note sur le nom du projet

Le dépôt s'appelle « Simulateur usine épuration » (traitement des eaux usées), mais
la filière décrite par l'utilisateur est une filière de **production d'eau potable**
(potabilisation), pas une filière d'épuration. Ce document couvre la filière d'eau
potable telle que spécifiée. Le nom du dépôt/projet pourra être clarifié ou renommé
séparément si souhaité — ce n'est pas traité ici.

## Contexte et objectif pédagogique

Outil destiné à des étudiants de niveau technique/collégial en gestion des eaux.
Objectif principal : **faire fonctionner et régler** une filière de production d'eau
potable (ajuster dosages et hydraulique, observer l'effet sur la qualité de l'eau),
plutôt que d'enseigner la théorie des procédés ou le diagnostic de panne en priorité.

Pas de système de suivi/score intégré : l'enseignant observe directement l'étudiant
à l'écran si besoin. C'est un outil d'exploration, pas un outil d'évaluation.

## Filière simulée

1. Puits (eau brute)
2. Ozonation
3. Dégazage
4. Décanteur Pulsator (coagulant alun + polymère)
5. Filtration gravitaire
6. Chloration gazeuse
7. Réserve + pompage haute pression

## Réglages disponibles à l'étudiant

- Dosages chimiques : ozone, alun, polymère, chlore gazeux
- Paramètres hydrauliques : débit de pompage du puits, vitesse de filtration,
  pression de pompage HP
- Action opérationnelle : backwash (contre-lavage) manuel du filtre
- Événements/perturbations : déclenchés par le scénario actif (voir plus bas),
  pas directement par l'étudiant — l'étudiant doit y réagir

## Architecture

Application web statique, 100 % client (HTML/CSS/JS), sans backend ni base de
données. Choisie pour son coût de développement et de maintenance minimal, aucune
infrastructure à héberger, et compatibilité avec le niveau technique visé (pas
besoin de rigueur de calcul avancée type ASM1/EDO).

Trois blocs principaux, en modules JS indépendants :

- **Moteur de simulation** (`simulation.js`) — état de l'eau à chaque étape, mis à
  jour à chaque tick simulé selon les réglages actifs.
- **Moteur de scénarios** (`scenarios.js`) — lit un scénario scripté (JSON) et
  déclenche les événements/perturbations au bon moment.
- **Interface** (`index.html` + `ui.js`) — schéma de procédé interactif (SVG),
  panneaux de contrôle, affichage des mesures et de leur conformité réglementaire.

Aucune persistance au-delà de la session en cours (limite connue et acceptée,
cohérente avec l'absence de suivi enseignant intégré).

## Modèle de simulation par étape

Chaque étape est un module avec une interface commune :
`entrée (eau) → transformation(réglages, temps) → sortie (eau)`.

L'objet « eau » transporte les propriétés pertinentes : débit, turbidité, pH,
ozone résiduel, chlore résiduel, perte de charge du filtre, etc.

**Délai de transit :** chaque étape applique un lissage exponentiel de premier
ordre (constante de temps = temps de séjour réel de l'étape, ex. ~1-2h pour le
décanteur Pulsator) plutôt qu'un effet instantané. Un changement de dosage se
répercute donc progressivement en aval, comme dans une vraie installation
(approximation de type mélange complet/CSTR). Choisi plutôt qu'un flux piston à
file d'attente discrète pour rester simple à implémenter tout en restant réaliste
pédagogiquement.

**Relations dose-réponse par étape :**

| Étape | Entrée réglable | Comportement |
|---|---|---|
| Puits | débit de pompage | turbidité/pH/température pilotés par le scénario |
| Ozonation | dose (mg/L) | réduction bactériologique et oxydation, courbe à effet plafond |
| Dégazage | — | élimine l'ozone résiduel avant floculation, peu de contrôle étudiant |
| Décanteur Pulsator | dose alun + polymère | réduction turbidité en courbe **en creux** : sous-dosage = mauvaise floculation, sur-dosage = restabilisation des particules |
| Filtration gravitaire | vitesse de filtration | réduction turbidité résiduelle + perte de charge croissante (colmatage), nécessite backwash manuel |
| Chloration gazeuse | dose chlore | chlore résiduel fonction de la demande en chlore (dépend de la turbidité/matière organique résiduelle), calcul du CT |
| Réserve + pompage HP | pression de pompage | volume tampon (même lissage), débit de distribution final |

Chaque mesure affiche son **seuil réglementaire de référence** (ex. turbidité
< 1 NTU, chlore résiduel libre minimal) comme repère visuel de conformité
(vert/orange/rouge), sans bloquer ni noter la simulation.

## Interface

- Schéma SVG des 7 étapes en ligne horizontale, chaque étape cliquable ouvre son
  panneau de contrôle et ses mesures en direct.
- Bandeau supérieur : horloge simulée avec contrôle de vitesse (×1 / ×10 / ×60) et
  journal des événements en cours.
- Indicateurs de conformité colorés plutôt que chiffres bruts isolés, pour une
  lecture rapide.

## Moteur de scénarios

Un scénario est un fichier JSON décrivant une séquence d'événements horodatés,
par exemple :

```json
{ "t": "45min", "event": "turbidite_brute", "valeur": 15 }
{ "t": "2h", "event": "panne_pompe_puits" }
```

Le moteur lit le scénario actif et déclenche les événements au bon moment
(modification de l'eau brute, panne d'équipement, colmatage accéléré, etc.).
Les scénarios sont scriptés (reproductibles), pas aléatoires, pour garantir une
expérience équitable et prévisible d'un étudiant à l'autre. Plusieurs scénarios
peuvent être créés sans toucher au code (« journée normale », « pluie et crue »,
« panne d'équipement »).

## Gestion des erreurs et cas limites

- Réglage physiquement impossible (dose négative, vitesse hors plage) : borné
  automatiquement par les contrôles de l'interface (min/max), aucun état invalide
  possible.
- Filtre colmaté à 100 % sans backwash : débit à zéro + alerte visuelle claire,
  pas de crash.
- Chlore ou ozone à zéro : eau non conforme affichée en rouge, sans blocage de la
  simulation — l'objectif est l'apprentissage, pas la pénalisation.

## Tests

Tests unitaires légers en JavaScript (ex. `vitest`) sur les fonctions de
transformation de chaque étape, indépendamment de l'UI : vérifier que les courbes
dose-réponse se comportent comme attendu (optimum de floculation, plafond
d'ozonation, croissance de la perte de charge, etc.).

## Hors périmètre (pour cette version)

- Suivi/score enseignant intégré
- Persistance des sessions au-delà du navigateur courant
- Événements aléatoires (uniquement scénarios scriptés)
- Modélisation physique rigoureuse (EDO, ASM1/ASM2d) — hors de portée pour le
  niveau technique/collégial visé
