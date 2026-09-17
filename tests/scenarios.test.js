import { describe, it, expect } from 'vitest';
import { createScenarioEngine } from '../src/scenarios.js';

describe('createScenarioEngine', () => {
  const events = [
    { t: 120, type: 'panne_pompe_puits', payload: {} },
    { t: 45, type: 'turbidite_brute', payload: { valeur: 15 } },
  ];

  it('sorts events by time regardless of input order', () => {
    const engine = createScenarioEngine(events);
    const due = engine.collectDueEvents(45);
    expect(due).toHaveLength(1);
    expect(due[0].type).toBe('turbidite_brute');
  });

  it('returns events only once each', () => {
    const engine = createScenarioEngine(events);
    engine.collectDueEvents(45);
    const due = engine.collectDueEvents(200);
    expect(due).toHaveLength(1);
    expect(due[0].type).toBe('panne_pompe_puits');
  });

  it('reports finished once all events have fired', () => {
    const engine = createScenarioEngine(events);
    engine.collectDueEvents(200);
    expect(engine.isFinished()).toBe(true);
  });

  it('can be reset to replay from the start', () => {
    const engine = createScenarioEngine(events);
    engine.collectDueEvents(200);
    engine.reset();
    expect(engine.isFinished()).toBe(false);
    expect(engine.collectDueEvents(45)).toHaveLength(1);
  });
});
