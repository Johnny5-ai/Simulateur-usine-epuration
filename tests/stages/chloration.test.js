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
    // 500 L/min dans 30 000 L à facteur de chicanage 0,5 -> T10 = 30 min
    const water = createWater({ turbidity: 0.5, flow: 500 });
    const result = runToSteadyState(stage, water, { dose: 1.5 });
    expect(stage.getCT()).toBeCloseTo(result.chlorineResidual * 30, 2);
  });

  it('halves the CT when the flow doubles, because the contact time falls', () => {
    const slow = createChlorationStage();
    const fast = createChlorationStage();
    runToSteadyState(slow, createWater({ turbidity: 0.5, flow: 500 }), { dose: 1.5 });
    runToSteadyState(fast, createWater({ turbidity: 0.5, flow: 1000 }), { dose: 1.5 });
    expect(fast.getCT()).toBeCloseTo(slow.getCT() / 2, 2);
  });

  it('requires a higher dose to reach the same residual when the TOC is higher', () => {
    const lean = createChlorationStage();
    const rich = createChlorationStage();
    const leanResult = runToSteadyState(lean, createWater({ toc: 2 }), { dose: 1.5 });
    const richResult = runToSteadyState(rich, createWater({ toc: 8 }), { dose: 1.5 });
    expect(richResult.chlorineResidual).toBeLessThan(leanResult.chlorineResidual);
  });

  it('forms more by-products as the organic precursor rises', () => {
    const lean = createChlorationStage();
    const rich = createChlorationStage();
    lean.process(createWater({ flow: 500, toc: 2 }), { dose: 1.5 }, 1);
    rich.process(createWater({ flow: 500, toc: 8 }), { dose: 1.5 }, 1);
    expect(rich.getTHM()).toBeGreaterThan(lean.getTHM());
    expect(rich.getHAA()).toBeGreaterThan(lean.getHAA());
  });

  // Le pH est le seul moteur qui sépare les deux familles : il pousse les THM
  // et retient les HAA. Aucun réglage de pH ne les fait baisser ensemble.
  it('pushes THM up and HAA down when the pH rises', () => {
    const low = createChlorationStage();
    const high = createChlorationStage();
    low.process(createWater({ flow: 500, toc: 5, pH: 6.5 }), { dose: 1.5 }, 1);
    high.process(createWater({ flow: 500, toc: 5, pH: 7.5 }), { dose: 1.5 }, 1);
    expect(high.getTHM()).toBeGreaterThan(low.getTHM());
    expect(high.getHAA()).toBeLessThan(low.getHAA());
  });

  it('requires roughly twice the CT when the water is 10 °C colder', () => {
    const stage = createChlorationStage();
    stage.process(createWater({ flow: 500, temperature: 10 }), { dose: 1.5 }, 1);
    const at10 = stage.getRequiredCT();
    stage.process(createWater({ flow: 500, temperature: 0 }), { dose: 1.5 }, 1);
    expect(stage.getRequiredCT()).toBeCloseTo(at10 * 2, 5);
  });

  // Seul HOCl désinfecte : au-delà du pKa de 7,5 il se dissocie en OCl-,
  // bien moins actif, et il faut donc bien plus de CT pour le même abattement.
  it('requires twice the CT when the pH rises by one unit', () => {
    const stage = createChlorationStage();
    stage.process(createWater({ flow: 500, temperature: 10, pH: 7 }), { dose: 1.5 }, 1);
    const atPH7 = stage.getRequiredCT();
    stage.process(createWater({ flow: 500, temperature: 10, pH: 8 }), { dose: 1.5 }, 1);
    expect(stage.getRequiredCT()).toBeCloseTo(atPH7 * 2, 5);
  });

  // À COT identique, une eau pré-ozonée forme moins de sous-produits : ce sont
  // les précurseurs réactifs qui comptent, pas la quantité de carbone.
  it('forms fewer by-products from pre-ozonated water at the same TOC', () => {
    const stage = createChlorationStage();
    stage.process(createWater({ flow: 500, toc: 4, precursorFraction: 1 }), { dose: 1.5 }, 1);
    const raw = { thm: stage.getTHM(), haa: stage.getHAA() };
    stage.process(createWater({ flow: 500, toc: 4, precursorFraction: 0.77 }), { dose: 1.5 }, 1);
    expect(stage.getTHM()).toBeLessThan(raw.thm);
    expect(stage.getHAA()).toBeLessThan(raw.haa);
  });

  // La réactivité ne change pas la demande en chlore : le carbone est toujours
  // là et se fait toujours oxyder, il fait juste moins de THM.
  it('keeps the same chlorine demand whatever the precursor reactivity', () => {
    const stage = createChlorationStage();
    const ozonated = runToSteadyState(
      stage, createWater({ flow: 500, toc: 4, precursorFraction: 0.5 }), { dose: 1.5 },
    );
    const plain = runToSteadyState(
      createChlorationStage(), createWater({ flow: 500, toc: 4, precursorFraction: 1 }), { dose: 1.5 },
    );
    expect(ozonated.chlorineResidual).toBeCloseTo(plain.chlorineResidual, 6);
  });
});
