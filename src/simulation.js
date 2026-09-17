import { createPuitsStage, defaultRawWater, defaultPuitsSettings } from './stages/puits.js';
import { createOzonationStage, defaultOzonationSettings } from './stages/ozonation.js';
import { createDegazageStage } from './stages/degazage.js';
import { createDecanteurStage, defaultDecanteurSettings } from './stages/decanteur.js';
import { createFiltrationStage, defaultFiltrationSettings } from './stages/filtration.js';
import { createChlorationStage, defaultChlorationSettings } from './stages/chloration.js';
import { createReserveStage, defaultReserveSettings } from './stages/reserve.js';

export function createSimulation() {
  const stages = {
    puits: createPuitsStage(),
    ozonation: createOzonationStage(),
    degazage: createDegazageStage(),
    decanteur: createDecanteurStage(),
    filtration: createFiltrationStage(),
    chloration: createChlorationStage(),
    reserve: createReserveStage(),
  };

  const settings = {
    puits: defaultPuitsSettings(),
    ozonation: defaultOzonationSettings(),
    decanteur: defaultDecanteurSettings(),
    filtration: defaultFiltrationSettings(),
    chloration: defaultChlorationSettings(),
    reserve: defaultReserveSettings(),
  };

  let rawWater = defaultRawWater();
  let elapsedMinutes = 0;

  function tick(dtMinutes) {
    elapsedMinutes += dtMinutes;

    let water = stages.puits.process(settings.puits, rawWater);
    water = stages.ozonation.process(water, settings.ozonation, dtMinutes);
    water = stages.degazage.process(water, dtMinutes);
    water = stages.decanteur.process(water, settings.decanteur, dtMinutes);
    water = stages.filtration.process(water, settings.filtration, dtMinutes);
    water = stages.chloration.process(water, settings.chloration, dtMinutes);
    water = stages.reserve.process(water, settings.reserve, dtMinutes);

    return water;
  }

  return {
    tick,
    settings,
    stages,
    getElapsedMinutes: () => elapsedMinutes,
    setRawWater(patch) {
      rawWater = { ...rawWater, ...patch };
    },
    updateSettings(stageName, patch) {
      settings[stageName] = { ...settings[stageName], ...patch };
    },
  };
}
