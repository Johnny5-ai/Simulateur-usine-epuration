import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createReserveStage } from '../../src/stages/reserve.js';

describe('ReserveStage', () => {
  it('computes the distributed flow from the pump pressure', () => {
    const stage = createReserveStage();
    const water = stage.process(createWater({ flow: 500 }), { pumpPressure: 6 }, 10);
    expect(water.flow).toBe(24);
  });

  it('caps the distributed flow at the incoming flow when it is lower than pump capacity', () => {
    const stage = createReserveStage();
    const water = stage.process(createWater({ flow: 0 }), { pumpPressure: 6 }, 10);
    expect(water.flow).toBe(0);
  });

  it('smooths incoming turbidity and chlorine changes over time', () => {
    const stage = createReserveStage();
    const water = createWater({ turbidity: 5, chlorineResidual: 1 });
    const afterOneTick = stage.process(water, { pumpPressure: 6 }, 10);
    expect(afterOneTick.turbidity).toBeGreaterThan(0);
    expect(afterOneTick.turbidity).toBeLessThan(5);
  });

  it('converges to the incoming water quality after enough time', () => {
    const stage = createReserveStage();
    const water = createWater({ turbidity: 5, chlorineResidual: 1 });
    let result = water;
    for (let i = 0; i < 100; i++) {
      result = stage.process(water, { pumpPressure: 6 }, 10);
    }
    expect(result.turbidity).toBeCloseTo(5, 2);
    expect(result.chlorineResidual).toBeCloseTo(1, 2);
  });
});
