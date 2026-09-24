import { createWater } from '../water.js';

/**
 * Étape "Puits" : source d'eau brute. Il s'agit d'un puits SOUS INFLUENCE
 * DIRECTE D'EAU DE SURFACE — une nappe alluviale peu profonde en bordure de
 * rivière. C'est ce qui explique qu'il encaisse les crues (turbidité à 40 NTU,
 * COT qui grimpe, alcalinité diluée) et les variations saisonnières de
 * température, là où un vrai puits profond serait d'une stabilité ennuyeuse.
 * C'est aussi ce qui lui vaut d'être classé comme une eau de surface au sens
 * réglementaire et d'exiger la filière complète avec barrière au Cryptosporidium.
 *
 * La qualité de l'eau brute est pilotée par le scénario actif, pas par
 * l'étudiant. Seul le débit de pompage est réglable.
 */
export function createPuitsStage() {
  return {
    process(settings, rawWater) {
      return createWater({
        flow: settings.pumpFlow,
        turbidity: rawWater.turbidity,
        pH: rawWater.pH,
        temperature: rawWater.temperature,
        alkalinity: rawWater.alkalinity,
        toc: rawWater.toc,
        calcium: rawWater.calcium,
        bromide: rawWater.bromide,
        bromate: 0,
        ozoneResidual: 0,
        chlorineResidual: 0,
      });
    },
  };
}

export function defaultRawWater() {
  return { turbidity: 2, pH: 7.2, temperature: 12, alkalinity: 120, toc: 4, calcium: 120, bromide: 60 };
}

export function defaultPuitsSettings() {
  return { pumpFlow: 500 }; // L/min
}
