import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

// En filtration gravitaire la perte de charge terminale est bornée par la
// hauteur d'eau disponible au-dessus du média, pas par la résistance du sable.
// On la compte donc en mètres d'eau : c'est la grandeur que l'exploitant lit
// directement sur le tube piézométrique du filtre.
const MAX_HEADLOSS_M = 2.5;
// Calé pour un cycle de filtration d'environ 36 h à 7 m/h sur une eau décantée à 2 NTU.
const HEADLOSS_RATE_COEFFICIENT = 0.00008;
const TIME_CONSTANT_MINUTES = 3; // réponse rapide de la turbidité en sortie de filtre

// La vitesse de filtration n'est pas un réglage libre : elle vaut le débit divisé
// par la surface filtrante en service. L'opérateur la règle en mettant des cuves
// en service ou hors service (4 cuves de 1,5 m², une étant gardée pour le lavage).
const FILTER_AREA_M2 = 1.5;

function filtrationRate(flowLPM, filtersInService) {
  const areaM2 = filtersInService * FILTER_AREA_M2;
  if (areaM2 <= 0) return 0;
  return (flowLPM * 0.06) / areaM2; // L/min -> m³/h, puis m³/h par m² = m/h
}

function removalEfficiency(rateMH) {
  return Math.min(0.95, Math.max(0, 0.9 - 0.03 * (rateMH - 7)));
}

// Le média ne stocke qu'une charge finie de floc. Au-delà, le floc déjà retenu
// est cisaillé et ressort : c'est la percée, et elle n'a rien à voir avec le
// colmatage. Le colmatage est hydraulique (le lit bouche, le débit tombe, mais
// l'eau qui sort reste filtrée) ; la percée est qualitative (le débit ne bouge
// pas, c'est la turbidité qui monte). Plus on pousse la vitesse, plus le
// cisaillement réduit la capacité de rétention : un filtre mené trop vite perce
// AVANT de colmater, et c'est le cas dangereux car rien ne coupe le débit pour
// avertir l'opérateur. En dessous de ~10 m/h le colmatage arrive en premier.
// Indice de charge calé sur le même produit vitesse x turbidité x temps que la
// perte de charge, pas une masse physique.
const SOLIDS_CAPACITY_INDEX = 35000;
const CAPACITY_RATE_PENALTY = 0.09; // perte de capacité par m/h au-dessus de 7
const BREAKTHROUGH_SPAN = 0.3; // la percée s'installe de 100 % à 130 % de charge

function solidsCapacity(rateMH) {
  return Math.max(0, SOLIDS_CAPACITY_INDEX * (1 - CAPACITY_RATE_PENALTY * (rateMH - 7)));
}

function breakthroughFraction(retained, capacity) {
  if (capacity <= 0) return 1;
  return Math.min(1, Math.max(0, (retained / capacity - 1) / BREAKTHROUGH_SPAN));
}

// La turbidité se mesure en continu EN SORTIE DE FILTRE, pas au robinet : la
// réserve lisse tout sur une heure, une percée y arrive atténuée et en retard.
// Deux limites, pas une : 0,3 NTU dans 95 % des mesures et 1,0 NTU jamais
// dépassé. C'est ici que se joue la barrière contre les kystes de
// Cryptosporidium, que le chlore ne tue pas — d'où la limite serrée sur la
// durée plutôt qu'un simple plafond instantané. Les minutes où le filtre ne
// produit rien ne comptent pas : pas d'eau, pas de mesure.
const TURBIDITY_95TH_NTU = 0.3;

// Le registre glisse sur les 24 dernières heures et démarre sur un historique
// propre : l'étudiant hérite d'un filtre en règle. Compté depuis zéro, le taux
// serait un cliquet — une percée du matin le clouerait sous 95 % jusqu'au soir
// quoi que fasse l'étudiant, qui ne verrait plus aucun effet de ses corrections.
// Sur une fenêtre glissante, une excursion de deux heures le fait bien tomber
// sous 95 %, puis il remonte si l'exploitation redevient bonne.
const REGISTER_WINDOW_MINUTES = 1440;

export function createFiltrationStage() {
  let currentTurbidity = 0;
  let headloss = 0;
  let currentRate = 0;
  let retainedSolids = 0;
  let bedLoading = 0;
  let monitoredMinutes = REGISTER_WINDOW_MINUTES;
  let compliantMinutes = REGISTER_WINDOW_MINUTES;
  let peakTurbidity = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);

      // Colmatage : la perte de charge a mangé toute la hauteur d'eau
      // disponible au-dessus du média. Le filtre ne passe plus rien — donc
      // plus rien ne s'y accumule non plus, ni perte de charge ni floc retenu,
      // et sa vitesse de filtration est nulle et non pas celle qu'il avait
      // juste avant de se boucher. Ses indicateurs restent figés sur l'état où
      // il s'est fermé ; l'eau déjà filtrée reste bonne, et seul un lavage
      // rouvre le passage.
      if (headloss >= MAX_HEADLOSS_M) {
        currentRate = 0;
        water.flow = 0;
        water.turbidity = currentTurbidity;
        return water;
      }

      currentRate = filtrationRate(waterIn.flow, settings.filtersInService);

      const capacity = solidsCapacity(currentRate);
      bedLoading = capacity > 0 ? retainedSolids / capacity : Infinity;

      // percée : le média saturé relâche le floc, l'efficacité s'effondre
      const efficiency =
        removalEfficiency(currentRate) * (1 - breakthroughFraction(retainedSolids, capacity));

      headloss += HEADLOSS_RATE_COEFFICIENT * currentRate * waterIn.turbidity * dtMinutes;
      retainedSolids += currentRate * waterIn.turbidity * efficiency * dtMinutes;

      const target = waterIn.turbidity * (1 - efficiency);
      currentTurbidity = applyLag(currentTurbidity, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.turbidity = currentTurbidity;

      if (water.flow > 0) {
        const retention = Math.exp(-dtMinutes / REGISTER_WINDOW_MINUTES);
        monitoredMinutes = monitoredMinutes * retention + dtMinutes;
        compliantMinutes = compliantMinutes * retention
          + (currentTurbidity <= TURBIDITY_95TH_NTU ? dtMinutes : 0);
        peakTurbidity = Math.max(peakTurbidity, currentTurbidity);
      }
      return water;
    },

    backwash() {
      headloss = 0;
      retainedSolids = 0;
      bedLoading = 0;
    },

    addHeadloss(amountM) {
      headloss += amountM;
    },

    getHeadloss() {
      return headloss;
    },

    getFiltrationRate() {
      return currentRate;
    },

    getBedLoading() {
      return bedLoading;
    },

    getEffluentTurbidity() {
      return currentTurbidity;
    },

    // Le registre couvre la fenêtre, pas le cycle : un lavage n'efface pas une
    // percée, elle s'efface d'elle-même en sortant de la fenêtre — lentement,
    // c'est exactement ce que vit un exploitant.
    getTurbidityCompliance() {
      if (monitoredMinutes === 0) return 100;
      return (compliantMinutes / monitoredMinutes) * 100;
    },

    getPeakTurbidity() {
      return peakTurbidity;
    },
  };
}

export function defaultFiltrationSettings() {
  return { filtersInService: 3 }; // 6,7 m/h au débit nominal de 500 L/min
}
