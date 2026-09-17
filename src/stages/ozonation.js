import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const OZONE_DEMAND_MGL = 1.2; // ozone consommé par la matière oxydable de l'eau brute
const PLATEAU_DOSE_MGL = 3; // au-delà, rendement décroissant
const PLATEAU_FACTOR = 0.2;
const TIME_CONSTANT_MINUTES = 10; // temps de contact typique du contacteur d'ozone

function targetResidual(doseMgL) {
  const net = Math.max(0, doseMgL - OZONE_DEMAND_MGL);
  if (net <= PLATEAU_DOSE_MGL) return net;
  return PLATEAU_DOSE_MGL + (net - PLATEAU_DOSE_MGL) * PLATEAU_FACTOR;
}

export function createOzonationStage() {
  let currentResidual = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      const target = targetResidual(settings.dose);
      currentResidual = applyLag(currentResidual, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.ozoneResidual = currentResidual;
      return water;
    },
  };
}

export function defaultOzonationSettings() {
  return { dose: 2 }; // mg/L
}
