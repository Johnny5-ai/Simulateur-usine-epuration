import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createReserveStage } from '../../src/stages/reserve.js';

const MINUTES_PER_DAY = 1440;
const night = { minuteOfDay: 0, demandFactor: 1 };
const decanted = () =>
  createWater({ flow: 500, pH: 6.87, alkalinity: 35, calcium: 120, temperature: 12 });

describe('ReserveStage', () => {
  // La réserve ne distribue pas ce que l'usine produit, elle distribue ce que
  // la ville demande. C'est tout l'intérêt d'avoir un volume tampon.
  it('serves the network demand rather than the production flow', () => {
    const stage = createReserveStage();
    const water = stage.process(createWater({ flow: 500 }), { pumpPressure: 6 }, 10, night);
    expect(water.flow).toBeCloseTo(stage.getDemand(), 6);
    expect(water.flow).toBeLessThan(500);
  });

  // Courbe caractéristique de pompe : le débit refoulé décroît quand la
  // contre-pression monte, l'inverse d'une simple proportionnalité.
  it('delivers less flow as the pump pressure rises', () => {
    const stage = createReserveStage();
    const thirsty = { minuteOfDay: 0, demandFactor: 6 };
    const low = stage.process(createWater({ flow: 2000 }), { pumpPressure: 3 }, 10, thirsty);
    const high = stage.process(createWater({ flow: 2000 }), { pumpPressure: 9 }, 10, thirsty);
    expect(high.flow).toBeLessThan(low.flow);
  });

  it('stops delivering at the pump shutoff pressure', () => {
    const stage = createReserveStage();
    const water = stage.process(createWater({ flow: 2000 }), { pumpPressure: 12 }, 10, night);
    expect(water.flow).toBe(0);
  });

  // Le creux nocturne et les deux pointes sont ce qui donne son sens au volume
  // de stockage ; leur moyenne vaut la production nominale par construction,
  // faute de quoi la réserve dériverait d'un jour sur l'autre.
  it('follows a daily demand curve whose mean is the nominal production', () => {
    const stage = createReserveStage();
    const water = createWater({ flow: 500 });
    const demands = [];
    for (let minute = 0; minute < MINUTES_PER_DAY; minute += 1) {
      stage.process(water, { pumpPressure: 6, limeDose: 0 }, 1, { minuteOfDay: minute, demandFactor: 1 });
      demands.push(stage.getDemand());
    }
    expect(demands.reduce((a, b) => a + b, 0) / demands.length).toBeCloseTo(500, 0);
    expect(Math.max(...demands)).toBeGreaterThan(650);
    expect(Math.min(...demands)).toBeLessThan(200);
  });

  it('fills overnight and draws down at the peaks, returning to its level after a full day', () => {
    const stage = createReserveStage();
    const water = createWater({ flow: 500 });
    const start = stage.getLevel();
    const levels = [];
    for (let minute = 0; minute < MINUTES_PER_DAY; minute += 1) {
      stage.process(water, { pumpPressure: 6, limeDose: 0 }, 1, { minuteOfDay: minute, demandFactor: 1 });
      levels.push(stage.getLevel());
    }
    expect(Math.max(...levels)).toBeGreaterThan(start);
    expect(Math.min(...levels)).toBeLessThan(start);
    expect(stage.getLevel()).toBeCloseTo(start, 0);
  });

  // Une réserve vide, c'est la chute de pression chez l'usager : on ne peut
  // pas distribuer une eau qu'on n'a pas produite et pas stockée.
  it('cannot distribute more than it holds once it runs dry', () => {
    const stage = createReserveStage();
    const peak = { minuteOfDay: 7.5 * 60, demandFactor: 3 };
    let water;
    for (let i = 0; i < 400; i += 1) {
      water = stage.process(createWater({ flow: 0 }), { pumpPressure: 6 }, 10, peak);
    }
    expect(stage.getLevel()).toBe(0);
    expect(water.flow).toBe(0);
    expect(stage.getUnmetDemand()).toBeGreaterThan(0);
  });

  // Le trop-plein n'est pas anodin : c'est de l'eau traitée, chlorée et payée
  // qui part à l'égout.
  it('overflows when production keeps running on a full reserve', () => {
    const stage = createReserveStage();
    for (let i = 0; i < 200; i += 1) {
      stage.process(createWater({ flow: 2000 }), { pumpPressure: 6 }, 10, night);
    }
    expect(stage.getLevel()).toBe(100);
    expect(stage.getOverflowRate()).toBeGreaterThan(0);
  });

  it('smooths incoming turbidity and chlorine changes over time', () => {
    const stage = createReserveStage();
    const water = createWater({ flow: 500, turbidity: 5, chlorineResidual: 1 });
    const afterOneTick = stage.process(water, { pumpPressure: 6 }, 10, night);
    expect(afterOneTick.turbidity).toBeGreaterThan(0);
    expect(afterOneTick.turbidity).toBeLessThan(5);
  });

  it('converges to the incoming water quality after enough time', () => {
    const stage = createReserveStage();
    const water = createWater({ flow: 500, turbidity: 5, chlorineResidual: 1 });
    let result = water;
    for (let i = 0; i < 100; i++) {
      result = stage.process(water, { pumpPressure: 6 }, 10, night);
    }
    expect(result.turbidity).toBeCloseTo(5, 2);
    expect(result.chlorineResidual).toBeCloseTo(1, 2);
  });

  // Une eau décantée sans rechaulage est douce et acide : elle dissout le
  // calcaire des conduites et met du plomb et du cuivre dans l'eau du robinet.
  it('leaves the water corrosive when no lime is dosed', () => {
    const stage = createReserveStage();
    stage.process(decanted(), { pumpPressure: 6, limeDose: 0 }, 1, night);
    expect(stage.getLSI()).toBeLessThan(-0.5);
  });

  it('raises pH, alkalinity, calcium and the Langelier index when lime is dosed', () => {
    const stage = createReserveStage();
    const water = stage.process(decanted(), { pumpPressure: 6, limeDose: 7.5 }, 1, night);
    expect(water.pH).toBeGreaterThan(decanted().pH);
    expect(water.alkalinity).toBeGreaterThan(decanted().alkalinity);
    expect(water.calcium).toBeGreaterThan(decanted().calcium);
    expect(stage.getLSI()).toBeGreaterThan(-0.5);
    expect(stage.getLSI()).toBeLessThan(0.5);
  });

  it('pushes the pH above the drinking water limit when lime is overdosed', () => {
    const stage = createReserveStage();
    const water = stage.process(decanted(), { pumpPressure: 6, limeDose: 10 }, 1, night);
    expect(water.pH).toBeGreaterThan(8.5);
  });
});
