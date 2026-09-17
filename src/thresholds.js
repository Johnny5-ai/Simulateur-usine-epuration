export const THRESHOLDS = {
  turbidity: { max: 1, unit: 'NTU', label: 'Turbidité' },
  chlorineResidual: { min: 0.3, unit: 'mg/L', label: 'Chlore résiduel libre' },
};

export function conformity(value, threshold) {
  if (threshold.max !== undefined && value > threshold.max) return 'non-conforme';
  if (threshold.min !== undefined && value < threshold.min) return 'non-conforme';
  return 'conforme';
}
