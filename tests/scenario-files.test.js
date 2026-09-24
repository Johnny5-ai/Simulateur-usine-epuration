import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SCENARIO_EVENTS } from '../src/events.js';
import { createSimulation } from '../src/simulation.js';

const read = (path) => readFileSync(new URL(path, new URL('..', import.meta.url)), 'utf8');

const offered = [...read('index.html').matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
const handledTypes = Object.keys(SCENARIO_EVENTS);

describe('scenario files', () => {
  it('offers several scenarios in the selector', () => {
    expect(offered.length).toBeGreaterThan(1);
  });

  it.each(offered)('%s loads, is named and carries events', (name) => {
    const scenario = JSON.parse(read(`data/scenarios/${name}.json`));
    expect(typeof scenario.name).toBe('string');
    expect(Array.isArray(scenario.events)).toBe(true);
    // Un scénario vide ne joue rien : c'est passé inaperçu une fois déjà.
    expect(scenario.events.length).toBeGreaterThan(0);
  });

  it.each(offered)('%s only uses event types the app handles', (name) => {
    const scenario = JSON.parse(read(`data/scenarios/${name}.json`));
    scenario.events.forEach((event) => {
      expect(handledTypes).toContain(event.type);
      expect(typeof event.t).toBe('number');
      expect(event.t).toBeGreaterThanOrEqual(0);
      expect(event.payload).toBeTypeOf('object');
    });
  });

  // Un handler qui lit une clé absente du payload ne plante pas, il produit
  // undefined et empoisonne le modèle en silence. On joue donc chaque
  // événement des scénarios sur une simulation espionne pour vérifier que
  // rien de non numérique ne passe.
  it.each(offered)('%s passes only numbers to the simulation', (name) => {
    const scenario = JSON.parse(read(`data/scenarios/${name}.json`));
    const received = [];
    const spy = {
      setRawWater: (patch) => received.push(...Object.values(patch)),
      setNetworkDemand: (factor) => received.push(factor),
      updateSettings: (_stage, patch) => received.push(...Object.values(patch)),
      stages: { filtration: { addHeadloss: (m) => received.push(m) } },
    };
    scenario.events.forEach((event) => {
      SCENARIO_EVENTS[event.type].apply(spy, event.payload);
      expect(SCENARIO_EVENTS[event.type].message(event.payload)).not.toContain('undefined');
    });
    received.forEach((value) => expect(Number.isFinite(value)).toBe(true));
  });

  // L'espion ci-dessus accepterait un handler qui appelle une méthode que la
  // simulation n'a plus. On rejoue donc chaque type du catalogue sur une vraie
  // simulation : c'est la seule façon de voir qu'un renommage l'a cassé.
  it.each(handledTypes)('%s changes a real simulation against an untouched twin', (type) => {
    const state = (sim) => JSON.stringify([sim.settings, sim.tick(1), sim.getReadings()]);
    // Relancer une pompe qui tourne ne fait rien : cet événement-là ne se juge
    // que sur une usine en panne.
    const prepare = type === 'panne_resolue'
      ? (s2) => SCENARIO_EVENTS.panne_pompe_puits.apply(s2, {})
      : () => {};
    const temoin = createSimulation();
    const sim = createSimulation();
    prepare(temoin);
    prepare(sim);
    for (let i = 0; i < 30; i += 1) { temoin.tick(1); sim.tick(1); }

    SCENARIO_EVENTS[type].apply(sim, { valeur: 99, facteur: 1.4, metres: 0.5 });
    expect(state(sim)).not.toBe(state(temoin));
  });

  it('routes events through the shared table rather than a private switch', () => {
    expect(read('src/main.js')).toContain('SCENARIO_EVENTS[event.type]');
  });
});
