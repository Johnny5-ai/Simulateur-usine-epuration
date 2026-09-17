/**
 * Lissage exponentiel de premier ordre (approximation mélange complet / CSTR).
 * Simule le délai de transit d'une étape : la sortie évolue progressivement
 * vers sa valeur cible plutôt que de sauter instantanément.
 */
export function applyLag(current, target, timeConstantMinutes, dtMinutes) {
  if (timeConstantMinutes <= 0) return target;
  const alpha = 1 - Math.exp(-dtMinutes / timeConstantMinutes);
  return current + (target - current) * alpha;
}
