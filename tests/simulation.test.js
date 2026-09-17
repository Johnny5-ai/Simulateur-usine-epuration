import { describe, it, expect } from 'vitest';
import { createSimulation } from '../src/simulation.js';

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
});
