export const THRESHOLDS = {
  // Norme à deux étages sur la sortie de filtre : le plafond instantané attrape
  // l'accident, le taux de 95 % attrape la dérive qu'un plafond seul laisserait
  // passer. Une eau qui traîne à 0,8 NTU en permanence ne dépasse jamais 1 NTU
  // et n'est pourtant pas traitée correctement.
  turbidity: { max: 1, unit: 'NTU', label: 'Turbidité sortie filtre' },
  turbidityCompliance: { min: 95, unit: '% des mesures ≤ 0,3 NTU', label: 'Registre turbidité' },
  // Plancher de 0,3 mg/L pour tenir le réseau ; plafond de 5 mg/L, la valeur
  // guide de l'OMS. Bien avant ce plafond le goût et l'odeur font fuir
  // l'usager : le sur-chloration se paie d'abord en plaintes, pas en analyses.
  chlorineResidual: { min: 0.3, max: 5, unit: 'mg/L', label: 'Chlore résiduel libre' },
  pH: { min: 6.5, max: 8.5, unit: '', label: 'pH' },
  thm: { max: 100, unit: 'µg/L', label: 'Trihalométhanes' },
  // Cancérogène probable, limite très basse : 10 µg/L. Contrairement aux THM,
  // aucun traitement en aval ne le rattrape — seul le réglage de l'ozone compte.
  bromate: { max: 10, unit: 'µg/L', label: 'Bromate' },
  haa: { max: 80, unit: 'µg/L', label: 'Acides haloacétiques' },
  // Négatif, l'eau dissout le calcaire et attaque les conduites ; trop positif,
  // elle entartre. La cible d'exploitation est légèrement positive.
  lsi: { min: -0.5, max: 0.5, unit: '', label: 'Indice de Langelier' },
  // Consignes d'exploitation, pas normes sanitaires : sous 20 % il ne reste
  // plus la réserve d'incendie, au-dessus de 95 % le trop-plein est proche et
  // c'est de l'eau traitée qui partira à l'égout.
  reserveLevel: { min: 20, max: 95, unit: '%', label: 'Niveau de la réserve' },
  // Le voile de boue vu par le débit qui le traverse. Sous 1,2 m il ne filtre
  // plus rien par contact, au-delà de 2,1 m il commence à partir aux goulottes.
  blanketHeight: { min: 1.2, max: 2.1, unit: 'm', label: 'Voile de boue' },
};

export function conformity(value, threshold) {
  if (threshold.max !== undefined && value > threshold.max) return 'non-conforme';
  if (threshold.min !== undefined && value < threshold.min) return 'non-conforme';
  return 'conforme';
}
