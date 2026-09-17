import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createOzonationStage } from '../../src/stages/ozonation.js';

describe('OzonationStage', () => {
  it('produces no residual when dose is below the ozone demand', () => {
    const stage = createOzonationStage();
    let water = createWater();
    for (let i = 0; i < 50; i++) {
      water = stage.process(water, { dose: 1 }, 10);
    }
    expect(water.ozoneResidual).toBeCloseTo(0, 5);
  });

  it('tracks dose minus demand below the plateau', () => {
    const stage = createOzonationStage();
    let water = createWater();
    for (let i = 0; i < 50; i++) {
      water = stage.process(water, { dose: 2 }, 10);
    }
    expect(water.ozoneResidual).toBeCloseTo(0.8, 2);
  });

  it('attenuates growth above the plateau dose', () => {
    const stage = createOzonationStage();
    let water = createWater();
    for (let i = 0; i < 50; i++) {
      water = stage.process(water, { dose: 5 }, 10);
    }
    expect(water.ozoneResidual).toBeCloseTo(3.16, 2);
  });

  it('does not jump to the target instantly (delai de transit)', () => {
    const stage = createOzonationStage();
    const water = createWater();
    const afterOneTick = stage.process(water, { dose: 2 }, 10);
    expect(afterOneTick.ozoneResidual).toBeGreaterThan(0);
    expect(afterOneTick.ozoneResidual).toBeLessThan(0.8);
  });
});
