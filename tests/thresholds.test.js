import { describe, it, expect } from 'vitest';
import { THRESHOLDS, conformity } from '../src/thresholds.js';

describe('conformity', () => {
  it('flags a value above the max threshold as non-conforme', () => {
    expect(conformity(1.5, THRESHOLDS.turbidity)).toBe('non-conforme');
  });

  it('flags a value at or below the max threshold as conforme', () => {
    expect(conformity(0.8, THRESHOLDS.turbidity)).toBe('conforme');
  });

  it('flags a value below the min threshold as non-conforme', () => {
    expect(conformity(0.1, THRESHOLDS.chlorineResidual)).toBe('non-conforme');
  });

  it('flags a value at or above the min threshold as conforme', () => {
    expect(conformity(0.5, THRESHOLDS.chlorineResidual)).toBe('conforme');
  });
});
