import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createFiltrationStage } from '../../src/stages/filtration.js';

describe('FiltrationStage', () => {
  it('reduces turbidity at the reference filter speed', () => {
    const stage = createFiltrationStage();
    let water = createWater({ turbidity: 2, flow: 500 });
    for (let i = 0; i < 20; i++) {
      water = stage.process(water, { filterSpeed: 7 }, 5);
    }
    expect(water.turbidity).toBeLessThan(0.5);
  });

  it('accumulates headloss over time proportional to speed and turbidity', () => {
    const stage = createFiltrationStage();
    const water = createWater({ turbidity: 5, flow: 500 });
    stage.process(water, { filterSpeed: 7 }, 60);
    const first = stage.getHeadloss();
    stage.process(water, { filterSpeed: 7 }, 60);
    const second = stage.getHeadloss();
    expect(second).toBeGreaterThan(first);
  });

  it('drops flow to zero once headloss reaches the clogging threshold', () => {
    const stage = createFiltrationStage();
    let water = createWater({ turbidity: 20, flow: 500 });
    for (let i = 0; i < 200; i++) {
      water = stage.process(water, { filterSpeed: 10 }, 60);
    }
    expect(stage.getHeadloss()).toBeGreaterThanOrEqual(250);
    expect(water.flow).toBe(0);
  });

  it('resets headloss to zero after a backwash', () => {
    const stage = createFiltrationStage();
    let water = createWater({ turbidity: 20, flow: 500 });
    for (let i = 0; i < 200; i++) {
      water = stage.process(water, { filterSpeed: 10 }, 60);
    }
    stage.backwash();
    expect(stage.getHeadloss()).toBe(0);
  });

  it('lets an external event add headloss directly', () => {
    const stage = createFiltrationStage();
    stage.addHeadloss(100);
    expect(stage.getHeadloss()).toBe(100);
  });
});
