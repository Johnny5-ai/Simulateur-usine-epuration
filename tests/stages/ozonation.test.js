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

  it('forms no bromate without ozone, and none without bromide', () => {
    const stage = createOzonationStage();
    let water = createWater({ pH: 7.2 });
    for (let i = 0; i < 50; i++) water = stage.process(water, { dose: 0 }, 10);
    expect(water.bromate).toBeCloseTo(0, 5);

    const clean = createOzonationStage();
    let freeOfBromide = createWater({ pH: 7.2, bromide: 0 });
    for (let i = 0; i < 50; i++) freeOfBromide = clean.process(freeOfBromide, { dose: 3 }, 10);
    expect(freeOfBromide.bromate).toBeCloseTo(0, 5);
  });

  it('stays under the bromate limit at the nominal ozone dose', () => {
    const stage = createOzonationStage();
    let water = createWater({ pH: 7.2, toc: 4, bromide: 60 });
    for (let i = 0; i < 50; i++) water = stage.process(water, { dose: 2 }, 10);
    expect(water.bromate).toBeGreaterThan(0);
    expect(water.bromate).toBeLessThan(10);
  });

  // Le surdosage d'ozone ne se voit ni au résiduel ni à la turbidité : il se
  // paie uniquement ici, et rien en aval ne l'efface.
  it('breaches the bromate limit when ozone is overdosed', () => {
    const stage = createOzonationStage();
    let water = createWater({ pH: 7.2, toc: 4, bromide: 60 });
    for (let i = 0; i < 50; i++) water = stage.process(water, { dose: 6 }, 10);
    expect(water.bromate).toBeGreaterThan(10);
  });

  it('forms more bromate from bromide-rich and alkaline raw water', () => {
    const settle = (overrides) => {
      const stage = createOzonationStage();
      let water = createWater({ pH: 7.2, toc: 4, bromide: 60, ...overrides });
      for (let i = 0; i < 50; i++) water = stage.process(water, { dose: 2 }, 10);
      return water.bromate;
    };
    const reference = settle({});
    expect(settle({ bromide: 300 })).toBeGreaterThan(reference);
    expect(settle({ pH: 8.2 })).toBeGreaterThan(reference);
    // le COT piège les radicaux : plus de matière organique, moins de bromate
    expect(settle({ toc: 9 })).toBeLessThan(reference);
  });

  // Sans bénéfice modélisé, l'ozone ne serait qu'une source de bromate et le
  // bon réglage serait toujours zéro.
  it('destroys THM precursors without mineralising the TOC', () => {
    const stage = createOzonationStage();
    let water = createWater({ toc: 4 });
    for (let i = 0; i < 50; i++) water = stage.process(water, { dose: 2 }, 10);
    expect(water.toc).toBe(4);
    expect(water.precursorFraction).toBeLessThan(1);
    expect(water.precursorFraction).toBeGreaterThan(0.5);
  });

  it('leaves the precursors untouched when ozone is off', () => {
    const stage = createOzonationStage();
    let water = createWater({ toc: 4 });
    for (let i = 0; i < 50; i++) water = stage.process(water, { dose: 0 }, 10);
    expect(water.precursorFraction).toBe(1);
  });

  // L'effet sature : passé les premiers mg/L on ne fabrique plus guère que du
  // bromate, ce qui est exactement ce qui rend le surdosage tentant et coûteux.
  it('gains less precursor destruction per mg of ozone as the dose climbs', () => {
    const settle = (dose) => {
      const stage = createOzonationStage();
      let water = createWater({ toc: 4 });
      for (let i = 0; i < 50; i++) water = stage.process(water, { dose }, 10);
      return water.precursorFraction;
    };
    const firstStep = settle(0) - settle(2);
    const secondStep = settle(2) - settle(4);
    expect(secondStep).toBeLessThan(firstStep);
  });
});
