import { createSimulation } from './simulation.js';
import { createScenarioEngine } from './scenarios.js';
import { SCENARIO_EVENTS } from './events.js';
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
  const handler = SCENARIO_EVENTS[event.type];
  if (!handler) {
    logEvent(eventLogEl, `Événement inconnu : ${event.type}`);
    return;
  }
  handler.apply(simulation, event.payload);
  logEvent(eventLogEl, handler.message(event.payload));
}

async function loadScenario(name) {
  const response = await fetch(`./data/scenarios/${name}.json`);
  const scenario = await response.json();
  scenarioEngine = createScenarioEngine(scenario.events);
  eventLogEl.innerHTML = '';
  logEvent(eventLogEl, `Scénario chargé : ${scenario.name}`);
}

// L'accélération multiplie le nombre de pas d'une minute, sans allonger le pas
// lui-même : un pas de 60 min écraserait les dynamiques courtes (colmatage,
// filtration) et ferait démarrer et finir un événement de 15 min dans le même pas.
function tick() {
  if (paused) return;

  let water;
  for (let step = 0; step < speedMultiplier; step += 1) {
    scenarioEngine.collectDueEvents(simulation.getElapsedMinutes()).forEach(applyScenarioEvent);
    water = simulation.tick(TICK_MINUTES);
  }

  renderReadouts(readoutsEl, water, simulation.getReadings());
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
