import { describe, it, expect } from 'vitest';
import { createSimulation } from '../src/simulation.js';
import { defaultReserveSettings } from '../src/stages/reserve.js';

describe('createSimulation', () => {
  it('runs a full pipeline tick and returns a water object with all properties', () => {
    const sim = createSimulation();
    const water = sim.tick(10);
    expect(water).toHaveProperty('flow');
    expect(water).toHaveProperty('turbidity');
    expect(water).toHaveProperty('chlorineResidual');
  });

  it('tracks elapsed simulated time across ticks', () => {
    const sim = createSimulation();
    sim.tick(10);
    sim.tick(15);
    expect(sim.getElapsedMinutes()).toBe(25);
  });

  it('applies a raw water override so it flows through the whole pipeline', () => {
    const sim = createSimulation();
    sim.setRawWater({ turbidity: 30 });
    let water;
    for (let i = 0; i < 300; i++) {
      water = sim.tick(10);
    }
    expect(water.turbidity).toBeGreaterThan(0);
  });

  it('lets settings be updated for a given stage', () => {
    const sim = createSimulation();
    sim.updateSettings('chloration', { dose: 3 });
    expect(sim.settings.chloration.dose).toBe(3);
  });

  it('exposes the filtration stage so the UI can trigger a backwash', () => {
    const sim = createSimulation();
    expect(typeof sim.stages.filtration.backwash).toBe('function');
  });

  // Le même réactif, au même dosage, donne la même eau au robinet — mais dosé
  // avant la bâche de contact il remonte le pH pendant la désinfection, où le
  // chlore se dissocie en hypochlorite bien moins actif. Le CT exigé monte donc,
  // et l'essentiel de la marge de désinfection y passe. C'est pourquoi on
  // reminéralise en bout de chaîne : au même coût de réactif, on garde la marge.
  it('gives the same finished water whether lime is dosed early or late, but dosing early eats the CT margin', () => {
    function runToSteadyState(configure) {
      const sim = createSimulation();
      configure(sim);
      let water;
      for (let i = 0; i < 2000; i++) water = sim.tick(1);
      return { water, chloration: sim.stages.chloration, reserve: sim.stages.reserve };
    }

    // Ozone coupé dans les deux cas : sinon son crédit de désinfection couvre
    // à lui seul l'inactivation requise et le CT ne dit plus rien du pH.
    const late = runToSteadyState((sim) => {
      sim.updateSettings('ozonation', { dose: 0 });
    });
    const early = runToSteadyState((sim) => {
      sim.updateSettings('ozonation', { dose: 0 });
      // la même dose que celle que l'autre branche laisse à la réserve, sinon
      // on ne compare plus l'ordre du dosage mais deux dosages différents
      sim.updateSettings('reserve', { limeDose: 0 });
      sim.updateSettings('decanteur', { limeDose: defaultReserveSettings().limeDose });
    });

    expect(early.water.pH).toBeCloseTo(late.water.pH, 2);
    expect(early.reserve.getLSI()).toBeCloseTo(late.reserve.getLSI(), 2);

    expect(early.chloration.getRequiredCT()).toBeGreaterThan(late.chloration.getRequiredCT());

    const margin = (run) => run.chloration.getCT() / run.chloration.getRequiredCT();
    expect(margin(late)).toBeGreaterThan(1.5);
    expect(margin(early)).toBeLessThan(0.7 * margin(late));
  });

  // L'ozone n'est pas qu'un producteur de bromate : il désinfecte cinquante
  // fois mieux que le chlore, et ce qu'il a inactivé la chloration n'a plus à
  // l'inactiver. C'est ce qui rend le dilemme intéressant au lieu d'être une
  // simple pénalité.
  it('lets the ozone carry the disinfection requirement the chlorine would otherwise owe', () => {
    function run(ozoneDose) {
      const sim = createSimulation();
      sim.updateSettings('ozonation', { dose: ozoneDose });
      for (let i = 0; i < 300; i++) sim.tick(1);
      return sim.stages.chloration.getRequiredCT();
    }

    expect(run(0)).toBeGreaterThan(0);
    expect(run(2)).toBeLessThan(run(0));
    expect(run(2)).toBeCloseTo(0, 5);
  });

  // La réserve découple production et consommation : elle se remplit la nuit
  // et se vide aux pointes, sur l'horloge de la simulation et pas sur l'eau
  // qui arrive. Sans ça, elle n'est qu'un retard de plus.
  it('drives the reserve on the clock, filling at night and drawing down at the peaks', () => {
    const sim = createSimulation();
    const levels = [];
    for (let i = 0; i < 1440; i++) {
      sim.tick(1);
      levels.push(sim.stages.reserve.getLevel());
    }
    expect(Math.max(...levels)).toBeGreaterThan(levels[0]);
    expect(Math.min(...levels)).toBeLessThan(levels[0]);
    // Défauts conformes : la journée entière tient dans la plage d'exploitation.
    expect(Math.min(...levels)).toBeGreaterThan(20);
    expect(Math.max(...levels)).toBeLessThan(95);
  });

  it('lets a scenario push the network demand without touching the plant settings', () => {
    const sim = createSimulation();
    for (let i = 0; i < 60; i++) sim.tick(1);
    const normal = sim.stages.reserve.getDemand();
    sim.setNetworkDemand(1.5);
    sim.tick(1);
    expect(sim.stages.reserve.getDemand()).toBeGreaterThan(normal);
  });
});
