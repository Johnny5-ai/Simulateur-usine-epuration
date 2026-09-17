import { describe, it, expect } from 'vitest';
import { applyLag } from '../src/lag.js';

describe('applyLag', () => {
  it('moves partially toward target after one step', () => {
    const result = applyLag(0, 10, 60, 10);
    expect(result).toBeCloseTo(1.535, 2);
  });

  it('converges to target after many steps', () => {
    let value = 0;
    for (let i = 0; i < 100; i++) {
      value = applyLag(value, 10, 60, 10);
    }
    expect(value).toBeCloseTo(10, 3);
  });

  it('returns target immediately when time constant is zero', () => {
    expect(applyLag(0, 10, 0, 5)).toBe(10);
  });
});
