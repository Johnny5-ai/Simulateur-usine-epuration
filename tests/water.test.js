import { describe, it, expect } from 'vitest';
import { createWater, cloneWater } from '../src/water.js';

describe('createWater', () => {
  it('applies default values when no overrides given', () => {
    const water = createWater();
    expect(water).toEqual({
      flow: 0,
      turbidity: 0,
      pH: 7,
      temperature: 15,
      alkalinity: 120,
      toc: 4,
      calcium: 120,
      bromide: 60,
      bromate: 0,
      precursorFraction: 1,
      disinfectionCredit: 0,
      ozoneResidual: 0,
      chlorineResidual: 0,
    });
  });

  it('applies provided overrides', () => {
    const water = createWater({ turbidity: 12, pH: 7.4 });
    expect(water.turbidity).toBe(12);
    expect(water.pH).toBe(7.4);
    expect(water.flow).toBe(0);
  });
});

describe('cloneWater', () => {
  it('returns an independent copy', () => {
    const original = createWater({ turbidity: 5 });
    const copy = cloneWater(original);
    copy.turbidity = 99;
    expect(original.turbidity).toBe(5);
  });
});
