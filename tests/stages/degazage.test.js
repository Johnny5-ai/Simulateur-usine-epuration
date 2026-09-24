import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createDegazageStage, defaultDegazageSettings } from '../../src/stages/degazage.js';

function runToSteadyState(stage, water, settings, ticks = 20, dt = 5) {
  let result;
  for (let i = 0; i < ticks; i++) {
    result = stage.process(water, settings, dt);
  }
  return result;
}

describe('DegazageStage', () => {
  it('removes most of the incoming ozone residual after enough time', () => {
    const stage = createDegazageStage();
    // l'eau amont reste constante (ozoneResidual = 2) ; seul l'état interne
    // de lissage de l'étape doit converger d'un tick à l'autre.
    const water = createWater({ ozoneResidual: 2 });
    const result = runToSteadyState(stage, water, defaultDegazageSettings());
    expect(result.ozoneResidual).toBeCloseTo(0.2, 2);
  });

  it('leaves other water properties unchanged', () => {
    const stage = createDegazageStage();
    const water = createWater({ ozoneResidual: 2, turbidity: 8, pH: 7.1 });
    const result = stage.process(water, defaultDegazageSettings(), 5);
    expect(result.turbidity).toBe(8);
    expect(result.pH).toBe(7.1);
  });

  // Le stripping suit une loi d'épuisement : les premiers volumes d'air
  // emportent l'essentiel, les derniers pourcents coûtent très cher.
  it('strips more ozone as the air to water ratio rises, with diminishing returns', () => {
    const water = createWater({ ozoneResidual: 2 });
    const [none, half, nominal, double] = [0, 2, 4, 8].map((airRatio) =>
      runToSteadyState(createDegazageStage(), water, { airRatio }).ozoneResidual);
    expect(none).toBeCloseTo(2, 2);
    expect(half).toBeLessThan(none);
    expect(nominal).toBeLessThan(half);
    expect(none - half).toBeGreaterThan(half - nominal);
    expect(half - nominal).toBeGreaterThan(nominal - double);
  });

  // Le dégazage rattrape un excès d'ozone, jamais un excès de bromate : le
  // stripping n'emporte que ce qui est gazeux.
  it('does not touch the bromate already formed upstream', () => {
    const stage = createDegazageStage();
    const water = createWater({ ozoneResidual: 2, bromate: 12 });
    const result = runToSteadyState(stage, water, { airRatio: 10 });
    expect(result.ozoneResidual).toBeLessThan(0.05);
    expect(result.bromate).toBe(12);
  });
});
