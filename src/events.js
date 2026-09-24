const DEFAULT_PUMP_FLOW = 500;

// Catalogue des événements de scénario. Il vit hors de main.js pour une raison
// précise : les fichiers de data/scenarios/ n'ont aucun moyen de se valider
// eux-mêmes, et un type mal orthographié y passait inaperçu. Les tests lisent
// cette table, elle est donc la seule définition de ce qu'un scénario peut dire.
export const SCENARIO_EVENTS = {
  turbidite_brute: {
    apply: (simulation, payload) => simulation.setRawWater({ turbidity: payload.valeur }),
    message: (payload) => `Turbidité brute changée à ${payload.valeur} NTU`,
  },
  cot_brut: {
    apply: (simulation, payload) => simulation.setRawWater({ toc: payload.valeur }),
    message: (payload) => `COT brut changé à ${payload.valeur} mg/L`,
  },
  bromure_brut: {
    apply: (simulation, payload) => simulation.setRawWater({ bromide: payload.valeur }),
    message: (payload) => `Bromure brut changé à ${payload.valeur} µg/L`,
  },
  alcalinite_brute: {
    apply: (simulation, payload) => simulation.setRawWater({ alkalinity: payload.valeur }),
    message: (payload) => `Alcalinité brute changée à ${payload.valeur} mg/L CaCO₃`,
  },
  temperature_brute: {
    apply: (simulation, payload) => simulation.setRawWater({ temperature: payload.valeur }),
    message: (payload) => `Température de l'eau brute : ${payload.valeur} °C`,
  },
  demande_reseau: {
    apply: (simulation, payload) => simulation.setNetworkDemand(payload.facteur),
    message: (payload) => `Demande du réseau à ${(payload.facteur * 100).toFixed(0)} % de la normale`,
  },
  panne_pompe_puits: {
    apply: (simulation) => simulation.updateSettings('puits', { pumpFlow: 0 }),
    message: () => 'Panne de la pompe du puits',
  },
  panne_resolue: {
    apply: (simulation) => simulation.updateSettings('puits', { pumpFlow: DEFAULT_PUMP_FLOW }),
    message: () => 'Panne résolue, pompe redémarrée',
  },
  colmatage_accelere: {
    apply: (simulation, payload) => simulation.stages.filtration.addHeadloss(payload.metres),
    message: (payload) => `Colmatage accéléré : +${payload.metres} m d'eau de perte de charge`,
  },
};
