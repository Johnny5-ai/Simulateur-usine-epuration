import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

// Tour de dégazage à contre-courant : l'ozone résiduel est strippé par un
// courant d'air, puis brûlé dans un destructeur catalytique. Le seul réglage
// est le rapport air/eau, et le stripping suit une loi d'épuisement — chaque
// tranche d'air enlève une fraction de ce qui reste, si bien que les derniers
// pourcents coûtent très cher en soufflage.
//
// Ce que le dégazage N'ENLÈVE PAS : le bromate. Le stripping ne prend que ce
// qui est gazeux. L'ozone mal dosé se rattrape ici, le bromate jamais.
const STRIPPING_COEFFICIENT = 0.575; // par unité de rapport air/eau
const TIME_CONSTANT_MINUTES = 5;

function removalFraction(airRatio) {
  return 1 - Math.exp(-STRIPPING_COEFFICIENT * Math.max(0, airRatio));
}

export function createDegazageStage() {
  let currentResidual = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      const target = waterIn.ozoneResidual * (1 - removalFraction(settings.airRatio));
      currentResidual = applyLag(currentResidual, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.ozoneResidual = currentResidual;
      return water;
    },
  };
}

// Rapport air/eau de 4 : 90 % de l'ozone résiduel parti, le réglage courant
// d'un dégazeur d'usine. En dessous, l'ozone qui passe attaque le floc au
// décanteur ; au-dessus, on souffle de l'air pour quelques pourcents.
export function defaultDegazageSettings() {
  return { airRatio: 4 }; // m³ d'air par m³ d'eau
}
