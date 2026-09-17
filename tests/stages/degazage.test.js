import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createDegazageStage } from '../../src/stages/degazage.js';

describe('DegazageStage', () => {
  it('removes most of the incoming ozone residual after enough time', () => {
    const stage = createDegazageStage();
    // l'eau amont reste constante (ozoneResidual = 2) ; seul l'état interne
    // de lissage de l'étape doit converger d'un tick à l'autre.
    const water = createWater({ ozoneResidual: 2 });
    let result;
    for (let i = 0; i < 20; i++) {
      result = stage.process(water, 5);
    }
    expect(result.ozoneResidual).toBeCloseTo(0.2, 2);
  });

  it('leaves other water properties unchanged', () => {
    const stage = createDegazageStage();
    const water = createWater({ ozoneResidual: 2, turbidity: 8, pH: 7.1 });
    const result = stage.process(water, 5);
    expect(result.turbidity).toBe(8);
    expect(result.pH).toBe(7.1);
  });
});
