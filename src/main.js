import { createSimulation } from './simulation.js';
import { createScenarioEngine } from './scenarios.js';
import {
  renderSchematic,
  setActiveStage,
  renderControls,
  renderReadouts,
  logEvent,
  updateClock,
} from './ui.js';

const TICK_MINUTES = 1;
const TICK_INTERVAL_MS = 500;
const DEFAULT_PUMP_FLOW = 500;

const simulation = createSimulation();
let scenarioEngine = createScenarioEngine([]);
let speedMultiplier = 1;
let paused = false;

const schematicEl = document.getElementById('schematic');
const controlsEl = document.getElementById('controls');
const readoutsEl = document.getElementById('readouts');
const eventLogEl = document.getElementById('event-log');
const clockEl = document.getElementById('clock-display');
const scenarioSelect = document.getElementById('scenario-select');

function handleSelectStage(stageKey) {
  setActiveStage(schematicEl, stageKey);
  renderControls(controlsEl, stageKey, simulation.settings, handleSettingsChange);
}

function handleSettingsChange(stageKey, patch) {
  if (stageKey === 'filtration:backwash') {
    simulation.stages.filtration.backwash();
    logEvent(eventLogEl, 'Backwash du filtre effectué');
    return;
  }
  simulation.updateSettings(stageKey, patch);
}

function applyScenarioEvent(event) {
  switch (event.type) {
    case 'turbidite_brute':
      simulation.setRawWater({ turbidity: event.payload.valeur });
      logEvent(eventLogEl, `Turbidité brute changée à ${event.payload.valeur} NTU`);
      break;
    case 'panne_pompe_puits':
      simulation.updateSettings('puits', { pumpFlow: 0 });
      logEvent(eventLogEl, 'Panne de la pompe du puits');
      break;
    case 'panne_resolue':
      simulation.updateSettings('puits', { pumpFlow: DEFAULT_PUMP_FLOW });
      logEvent(eventLogEl, 'Panne résolue, pompe redémarrée');
      break;
    case 'colmatage_accelere':
      simulation.stages.filtration.addHeadloss(event.payload.amountKPa);
      logEvent(eventLogEl, `Colmatage accéléré : +${event.payload.amountKPa} kPa de perte de charge`);
      break;
    default:
      logEvent(eventLogEl, `Événement inconnu : ${event.type}`);
  }
}

async function loadScenario(name) {
  const response = await fetch(`./data/scenarios/${name}.json`);
  const scenario = await response.json();
  scenarioEngine = createScenarioEngine(scenario.events);
  eventLogEl.innerHTML = '';
  logEvent(eventLogEl, `Scénario chargé : ${scenario.name}`);
}

function tick() {
  if (paused) return;
  const dt = TICK_MINUTES * speedMultiplier;
  const water = simulation.tick(dt);

  scenarioEngine.collectDueEvents(simulation.getElapsedMinutes()).forEach(applyScenarioEvent);

  renderReadouts(
    readoutsEl,
    water,
    simulation.stages.filtration.getHeadloss(),
    simulation.stages.chloration.getCT(),
  );
  updateClock(clockEl, simulation.getElapsedMinutes());
}

document.getElementById('speed-1').addEventListener('click', () => { speedMultiplier = 1; });
document.getElementById('speed-10').addEventListener('click', () => { speedMultiplier = 10; });
document.getElementById('speed-60').addEventListener('click', () => { speedMultiplier = 60; });
document.getElementById('pause').addEventListener('click', () => { paused = !paused; });
scenarioSelect.addEventListener('change', () => loadScenario(scenarioSelect.value));

renderSchematic(schematicEl, handleSelectStage);
loadScenario(scenarioSelect.value);
setInterval(tick, TICK_INTERVAL_MS);
