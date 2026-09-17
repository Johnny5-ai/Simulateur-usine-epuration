import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createChlorationStage } from '../../src/stages/chloration.js';

function runToSteadyState(stage, water, settings, ticks = 100, dt = 5) {
  let result = water;
  for (let i = 0; i < ticks; i++) {
    result = stage.process(result, settings, dt);
  }
  return result;
}

describe('ChlorationStage', () => {
  it('produces no residual when the dose is below the chlorine demand', () => {
    const stage = createChlorationStage();
    const water = createWater({ turbidity: 0.5 });
    const result = runToSteadyState(stage, water, { dose: 0.1 });
    expect(result.chlorineResidual).toBeCloseTo(0, 3);
  });

  it('produces a residual equal to dose minus demand once above demand', () => {
    const stage = createChlorationStage();
    const water = createWater({ turbidity: 0.5 });
    const result = runToSteadyState(stage, water, { dose: 1.5 });
    expect(result.chlorineResidual).toBeCloseTo(1.275, 2);
  });

  it('requires a higher dose to reach the same residual when turbidity is higher', () => {
    const stageLow = createChlorationStage();
    const stageHigh = createChlorationStage();
    const lowTurbidity = runToSteadyState(stageLow, createWater({ turbidity: 0.2 }), { dose: 1 });
    const highTurbidity = runToSteadyState(stageHigh, createWater({ turbidity: 5 }), { dose: 1 });
    expect(highTurbidity.chlorineResidual).toBeLessThan(lowTurbidity.chlorineResidual);
  });

  it('computes CT as residual times the contact time', () => {
    const stage = createChlorationStage();
    const water = createWater({ turbidity: 0.5 });
    const result = runToSteadyState(stage, water, { dose: 1.5 });
    expect(stage.getCT()).toBeCloseTo(result.chlorineResidual * 30, 2);
  });
});
