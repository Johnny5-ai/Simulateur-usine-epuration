import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const REMOVAL_FRACTION = 0.9; // fraction de l'ozone résiduel éliminée par dégazage
const TIME_CONSTANT_MINUTES = 5;

export function createDegazageStage() {
  let currentResidual = 0;

  return {
    process(waterIn, dtMinutes) {
      const water = cloneWater(waterIn);
      const target = waterIn.ozoneResidual * (1 - REMOVAL_FRACTION);
      currentResidual = applyLag(currentResidual, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.ozoneResidual = currentResidual;
      return water;
    },
  };
}
