import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const DEMAND_PER_TOC = 0.05; // la matière organique est le premier consommateur de chlore
const DEMAND_PER_NTU = 0.05; // demande additionnelle par unité de turbidité résiduelle

// Sous-produits de désinfection : le chlore réagit avec le COT résiduel pour
// former trihalométhanes et acides haloacétiques. Modèle empirique de type
// USEPA/Amy — COT, dose, température et temps de séjour poussent les deux
// familles dans le même sens, MAIS le pH joue à l'inverse : il augmente les
// THM et diminue les HAA. Abaisser le pH n'est donc pas gratuit.
// Valeurs de référence Santé Canada : 100 µg/L de THM, 80 µg/L de HAA5.
// Attention, la norme porte sur une moyenne annuelle mobile ; ce qui est
// affiché ici est la projection instantanée pour l'eau produite en ce moment.
const DISTRIBUTION_HOURS = 24; // séjour nominal en réseau avant le point d'échantillonnage
const THM_COEFFICIENT = 0.85;
const HAA_COEFFICIENT = 1.5;
const TIME_CONSTANT_MINUTES = 8;

// Le temps de contact utile est le T10 (temps de passage de 10 % du traceur),
// soit volume x facteur de chicanage / débit : pousser le débit réduit le CT.
const CONTACT_VOLUME_L = 30000;
const BAFFLING_FACTOR = 0.5; // bassin à chicanage moyen (tables EPA SWTR)

// CT requis pour 0,5 log Giardia au chlore libre, pH 7 et 10 °C ; la filtration
// conventionnelle fournit les 2,5 log restants. Deux règles de doublement calées
// sur les tables EPA SWTR : le CT requis double par baisse de 10 °C, et double
// aussi par unité de pH, HOCl (le désinfectant actif) se dissociant en OCl- bien
// moins efficace au-delà du pKa de 7,5.
const CT_REFERENCE_MGMIN_L = 25;
const CT_REFERENCE_TEMPERATURE_C = 10;
const CT_REFERENCE_PH = 7;

function chlorineDemand(toc, turbidity) {
  return DEMAND_PER_TOC * toc + DEMAND_PER_NTU * turbidity;
}

function thmFormation(toc, dose, pH, temperatureC) {
  return (
    THM_COEFFICIENT
    * toc
    * dose ** 0.3
    * (pH - 2.6) ** 0.7
    * temperatureC ** 0.25
    * DISTRIBUTION_HOURS ** 0.35
  );
}

function haaFormation(toc, dose, pH, temperatureC) {
  return (
    HAA_COEFFICIENT
    * toc
    * dose ** 0.3
    * (9.4 - pH) ** 0.5
    * temperatureC ** 0.2
    * DISTRIBUTION_HOURS ** 0.3
  );
}

function contactTimeMinutes(flowLPM) {
  if (flowLPM <= 0) return 0;
  return (CONTACT_VOLUME_L * BAFFLING_FACTOR) / flowLPM;
}

function requiredCT(temperatureC, pH) {
  return (
    CT_REFERENCE_MGMIN_L
    * 2 ** ((CT_REFERENCE_TEMPERATURE_C - temperatureC) / 10)
    * 2 ** (pH - CT_REFERENCE_PH)
  );
}

export function createChlorationStage() {
  let currentResidual = 0;
  let currentCT = 0;
  let currentRequiredCT = requiredCT(CT_REFERENCE_TEMPERATURE_C, CT_REFERENCE_PH);
  let currentTHM = 0;
  let currentHAA = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      const demand = chlorineDemand(waterIn.toc, waterIn.turbidity);
      const target = Math.max(0, settings.dose - demand);
      currentResidual = applyLag(currentResidual, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.chlorineResidual = currentResidual;

      currentCT = currentResidual * contactTimeMinutes(waterIn.flow);
      // Ce que l'ozone a déjà inactivé, le chlore n'a plus à l'inactiver : le
      // CT requis ici ne porte que sur le solde. Une usine qui ozone peut donc
      // chlorer au strict nécessaire pour tenir un résiduel en réseau.
      currentRequiredCT =
        requiredCT(waterIn.temperature, waterIn.pH) * (1 - waterIn.disinfectionCredit);
      // Ce qui fait les sous-produits n'est pas le COT mais sa part réactive :
      // à quantité égale, une eau pré-ozonée en forme nettement moins.
      const precursors = waterIn.toc * waterIn.precursorFraction;
      currentTHM = thmFormation(precursors, settings.dose, waterIn.pH, waterIn.temperature);
      currentHAA = haaFormation(precursors, settings.dose, waterIn.pH, waterIn.temperature);
      return water;
    },

    getCT() {
      return currentCT;
    },

    getRequiredCT() {
      return currentRequiredCT;
    },

    getTHM() {
      return currentTHM;
    },

    getHAA() {
      return currentHAA;
    },
  };
}

export function defaultChlorationSettings() {
  return { dose: 1.5 }; // mg/L
}
