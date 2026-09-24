import { describe, it, expect } from 'vitest';
import { createPuitsStage, defaultRawWater, defaultPuitsSettings } from '../../src/stages/puits.js';

describe('PuitsStage', () => {
  it('outputs water with the pump flow and raw water quality provided', () => {
    const stage = createPuitsStage();
    const water = stage.process({ pumpFlow: 800 }, { turbidity: 15, pH: 6.9, temperature: 8 });
    expect(water.flow).toBe(800);
    expect(water.turbidity).toBe(15);
    expect(water.pH).toBe(6.9);
    expect(water.temperature).toBe(8);
    expect(water.ozoneResidual).toBe(0);
    expect(water.chlorineResidual).toBe(0);
  });

  it('provides sensible defaults', () => {
    expect(defaultRawWater()).toEqual({ turbidity: 2, pH: 7.2, temperature: 12, alkalinity: 120, toc: 4, calcium: 120, bromide: 60 });
    expect(defaultPuitsSettings()).toEqual({ pumpFlow: 500 });
  });
});
