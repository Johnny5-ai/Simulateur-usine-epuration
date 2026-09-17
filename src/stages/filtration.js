import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const MAX_HEADLOSS_KPA = 250; // colmatage complet : backwash requis
const HEADLOSS_RATE_COEFFICIENT = 0.02; // vitesse d'accumulation de la perte de charge
const TIME_CONSTANT_MINUTES = 3; // réponse rapide de la turbidité en sortie de filtre

function removalEfficiency(filterSpeed) {
  return Math.min(0.95, Math.max(0, 0.9 - 0.03 * (filterSpeed - 7)));
}

export function createFiltrationStage() {
  let currentTurbidity = 0;
  let headloss = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);

      headloss += HEADLOSS_RATE_COEFFICIENT * settings.filterSpeed * waterIn.turbidity * dtMinutes;

      if (headloss >= MAX_HEADLOSS_KPA) {
        water.flow = 0;
        water.turbidity = waterIn.turbidity; // percée : plus de traitement effectif
        currentTurbidity = water.turbidity;
        return water;
      }

      const efficiency = removalEfficiency(settings.filterSpeed);
      const target = waterIn.turbidity * (1 - efficiency);
      currentTurbidity = applyLag(currentTurbidity, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.turbidity = currentTurbidity;
      return water;
    },

    backwash() {
      headloss = 0;
    },

    addHeadloss(amountKPa) {
      headloss += amountKPa;
    },

    getHeadloss() {
      return headloss;
    },
  };
}

export function defaultFiltrationSettings() {
  return { filterSpeed: 7 }; // m/h
}
