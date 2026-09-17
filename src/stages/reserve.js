import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const TIME_CONSTANT_MINUTES = 60; // mélange dans le volume de la réserve
const PUMP_COEFFICIENT = 4; // L/min de débit distribué par bar de pression

export function createReserveStage() {
  let currentTurbidity = 0;
  let currentChlorine = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);

      currentTurbidity = applyLag(currentTurbidity, waterIn.turbidity, TIME_CONSTANT_MINUTES, dtMinutes);
      currentChlorine = applyLag(currentChlorine, waterIn.chlorineResidual, TIME_CONSTANT_MINUTES, dtMinutes);

      water.turbidity = currentTurbidity;
      water.chlorineResidual = currentChlorine;
      water.flow = settings.pumpPressure * PUMP_COEFFICIENT;
      return water;
    },
  };
}

export function defaultReserveSettings() {
  return { pumpPressure: 6 }; // bar
}
