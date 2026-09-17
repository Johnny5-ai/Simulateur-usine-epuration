import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const MAX_REMOVAL_RATE = 0.95; // taux de réduction de turbidité atteignable au dosage optimal
const TIME_CONSTANT_MINUTES = 90; // temps de séjour typique d'un décanteur Pulsator (~1-2h)

/**
 * Courbe en pic centré sur la dose optimale : un sous-dosage donne une
 * floculation incomplète, un sur-dosage restabilise les particules.
 * L'efficacité retombe à 0 en dessous de l'optimal ou au double de l'optimal.
 */
function doseEfficiency(dose, optimalDose) {
  if (optimalDose <= 0) return 0;
  const deviation = (dose - optimalDose) / optimalDose;
  return Math.max(0, 1 - deviation * deviation);
}

function optimalAlunDose(rawTurbidity) {
  return Math.min(40, Math.max(10, 0.5 * rawTurbidity));
}

export function createDecanteurStage() {
  let currentTurbidity = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      const optimalAlun = optimalAlunDose(waterIn.turbidity);
      const alunEfficiency = doseEfficiency(settings.alunDose, optimalAlun);
      const optimalPolymer = 0.03 * settings.alunDose;
      const polymerEfficiency = doseEfficiency(settings.polymerDose, optimalPolymer);

      // l'alun fait le gros du travail ; le polymère apporte un bonus
      // allant jusqu'à 20% d'efficacité supplémentaire
      const combinedEfficiency = alunEfficiency * (0.8 + 0.2 * polymerEfficiency);

      const target = waterIn.turbidity * (1 - MAX_REMOVAL_RATE * combinedEfficiency);
      currentTurbidity = applyLag(currentTurbidity, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.turbidity = currentTurbidity;
      return water;
    },
  };
}

export function defaultDecanteurSettings() {
  return { alunDose: 20, polymerDose: 0.6 }; // mg/L
}
