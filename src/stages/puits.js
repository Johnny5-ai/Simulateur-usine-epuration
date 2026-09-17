import { createWater } from '../water.js';

/**
 * Étape "Puits" : source d'eau brute. La qualité de l'eau brute (turbidité,
 * pH, température) est pilotée par le scénario actif, pas par l'étudiant.
 * Seul le débit de pompage est réglable par l'étudiant.
 */
export function createPuitsStage() {
  return {
    process(settings, rawWater) {
      return createWater({
        flow: settings.pumpFlow,
        turbidity: rawWater.turbidity,
        pH: rawWater.pH,
        temperature: rawWater.temperature,
        ozoneResidual: 0,
        chlorineResidual: 0,
      });
    },
  };
}

export function defaultRawWater() {
  return { turbidity: 2, pH: 7.2, temperature: 12 };
}

export function defaultPuitsSettings() {
  return { pumpFlow: 500 }; // L/min
}
