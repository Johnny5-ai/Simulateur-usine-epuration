import { createPuitsStage, defaultRawWater, defaultPuitsSettings } from './stages/puits.js';
import { createOzonationStage, defaultOzonationSettings } from './stages/ozonation.js';
import { createDegazageStage, defaultDegazageSettings } from './stages/degazage.js';
import { createDecanteurStage, defaultDecanteurSettings } from './stages/decanteur.js';
import { createFiltrationStage, defaultFiltrationSettings } from './stages/filtration.js';
import { createChlorationStage, defaultChlorationSettings } from './stages/chloration.js';
import { createReserveStage, defaultReserveSettings } from './stages/reserve.js';

const MINUTES_PER_DAY = 1440;

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
    degazage: defaultDegazageSettings(),
    decanteur: defaultDecanteurSettings(),
    filtration: defaultFiltrationSettings(),
    chloration: defaultChlorationSettings(),
    reserve: defaultReserveSettings(),
  };

  let rawWater = defaultRawWater();
  // La demande du réseau est exogène comme la qualité de l'eau brute :
  // l'exploitant la subit, il ne la règle pas. Le scénario en décide.
  let networkDemandFactor = 1;
  let elapsedMinutes = 0;

  function tick(dtMinutes) {
    elapsedMinutes += dtMinutes;

    let water = stages.puits.process(settings.puits, rawWater);
    water = stages.ozonation.process(water, settings.ozonation, dtMinutes);
    water = stages.degazage.process(water, settings.degazage, dtMinutes);
    water = stages.decanteur.process(water, settings.decanteur, dtMinutes);
    water = stages.filtration.process(water, settings.filtration, dtMinutes);
    water = stages.chloration.process(water, settings.chloration, dtMinutes);
    // Seule la réserve a besoin de l'heure : c'est la seule étape dont le
    // comportement dépend du moment de la journée et pas de l'eau qui arrive.
    water = stages.reserve.process(water, settings.reserve, dtMinutes, {
      minuteOfDay: elapsedMinutes % MINUTES_PER_DAY,
      demandFactor: networkDemandFactor,
    });

    return water;
  }

  // Tout ce que l'exploitant lit sans que ce soit une propriété de l'eau :
  // l'état des organes. Ça vit ici et pas dans l'interface parce que c'est
  // l'instrumentation de l'usine, pas une question d'affichage.
  function getReadings() {
    const { filtration, chloration, decanteur, reserve } = stages;
    return {
      headloss: filtration.getHeadloss(),
      filtrationRate: filtration.getFiltrationRate(),
      bedLoading: filtration.getBedLoading(),
      effluentTurbidity: filtration.getEffluentTurbidity(),
      turbidityCompliance: filtration.getTurbidityCompliance(),
      peakTurbidity: filtration.getPeakTurbidity(),
      ct: chloration.getCT(),
      requiredCT: chloration.getRequiredCT(),
      thm: chloration.getTHM(),
      haa: chloration.getHAA(),
      lsi: reserve.getLSI(),
      blanketHeight: decanteur.getBlanketHeight(),
      effectiveBlanketHeight: decanteur.getEffectiveBlanketHeight(),
      upflowVelocity: decanteur.getUpflowVelocity(),
      balancedPurgeDuty: decanteur.getBalancedPurgeDuty(),
      reserveLevel: reserve.getLevel(),
      storedM3: reserve.getStoredM3(),
      demand: reserve.getDemand(),
      unmetDemand: reserve.getUnmetDemand(),
    };
  }

  return {
    tick,
    settings,
    stages,
    getReadings,
    getElapsedMinutes: () => elapsedMinutes,
    setRawWater(patch) {
      rawWater = { ...rawWater, ...patch };
    },
    setNetworkDemand(factor) {
      networkDemandFactor = factor;
    },
    updateSettings(stageName, patch) {
      settings[stageName] = { ...settings[stageName], ...patch };
    },
  };
}
