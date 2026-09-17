import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const BASE_DEMAND_MGL = 0.2; // demande en chlore de base
const DEMAND_PER_NTU = 0.05; // demande additionnelle par unité de turbidité résiduelle
const CONTACT_TIME_MINUTES = 30; // temps de contact du bassin de chloration
const TIME_CONSTANT_MINUTES = 8;

function chlorineDemand(turbidity) {
  return BASE_DEMAND_MGL + DEMAND_PER_NTU * turbidity;
}

export function createChlorationStage() {
  let currentResidual = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      const demand = chlorineDemand(waterIn.turbidity);
      const target = Math.max(0, settings.dose - demand);
      currentResidual = applyLag(currentResidual, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.chlorineResidual = currentResidual;
      return water;
    },

    getCT() {
      return currentResidual * CONTACT_TIME_MINUTES;
    },
  };
}

export function defaultChlorationSettings() {
  return { dose: 1.5 }; // mg/L
}
