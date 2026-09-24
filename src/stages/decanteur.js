import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';
import { applyChemicals } from '../chemistry.js';

const MAX_REMOVAL_RATE = 0.95; // taux de réduction de turbidité atteignable au dosage optimal
const TIME_CONSTANT_MINUTES = 90; // temps de séjour typique d'un décanteur Pulsator (~1-2h)

// L'hydroxyde d'aluminium est le moins soluble vers pH 6,5 ; hors de la fenêtre
// 5,0-8,0 l'alun reste dissous et ne forme plus de floc exploitable.
const OPTIMAL_COAGULATION_PH = 6.5;
const COAGULATION_PH_TOLERANCE = 1.5;

/**
 * Courbe en pic centré sur la dose optimale : un sous-dosage donne une
 * floculation incomplète, un sur-dosage restabilise les particules.
 * L'efficacité retombe à 0 en dessous de l'optimal ou au double de l'optimal.
 */
function doseEfficiency(dose, optimalDose) {
  if (optimalDose <= 0) return 0;
  const deviation = (dose - optimalDose) / optimalDose;
  return Math.max(0, 1 - deviation * deviation);
}

// L'eau froide est près de deux fois plus visqueuse qu'à 25 °C : le floc se
// forme plus lentement et monte moins vite dans le voile. La parade d'usine est
// connue — on augmente la dose de coagulant quand l'eau refroidit, et l'optimum
// se déplace donc avec la température. Mais elle ne rachète pas tout : la
// cinétique perd un reste qu'aucune dose ne compense, et c'est pourquoi un
// décanteur est toujours moins bon en janvier qu'en juillet.
const COLD_REFERENCE_C = 12; // au-dessus, la viscosité ne limite plus
const COLD_DOSE_SHIFT_PER_DEGREE = 0.04;
const COLD_PENALTY_PER_DEGREE = 0.015; // part irréductible

function coldDoseFactor(temperatureC) {
  return Math.min(1.6, Math.max(1, 1 + COLD_DOSE_SHIFT_PER_DEGREE * (COLD_REFERENCE_C - temperatureC)));
}

function temperatureEfficiency(temperatureC) {
  return Math.min(1, Math.max(0.5, 1 - COLD_PENALTY_PER_DEGREE * (COLD_REFERENCE_C - temperatureC)));
}

function optimalAlunDose(rawTurbidity, temperatureC) {
  return Math.min(40, Math.max(10, 0.5 * rawTurbidity)) * coldDoseFactor(temperatureC);
}

// Coagulation renforcée : l'alun n'enlève pas que des particules, il adsorbe
// aussi la matière organique sur le floc. L'acidification protone les sites
// carboxyliques de cette matière, qui s'accroche alors bien mieux — d'où la
// cible pH 5,5-6,5 de la coagulation renforcée, plus basse que l'optimum
// turbidité de 6,5. Enlever ce COT en amont est la seule vraie parade aux
// sous-produits chlorés : une fois le chlore ajouté, il est trop tard.
const ENHANCED_COAGULATION_PH = 6;
const TOC_REMOVAL_PER_ALUM = 0.025; // fraction enlevée par mg/L d'alun
const MAX_TOC_REMOVAL = 0.6;

// La coagulation ne prend pas le COT au hasard : elle emporte d'abord la
// fraction hydrophobe et aromatique, celle qui fait les THM. Le COT qui reste
// est donc à la fois moins abondant ET moins réactif, et c'est pourquoi
// l'abattement de THM mesuré dépasse toujours l'abattement de COT.
const PREFERENTIAL_PRECURSOR_REMOVAL = 0.4;

function tocRemovalFraction(alunDose, pH) {
  const byDose = Math.min(0.55, TOC_REMOVAL_PER_ALUM * alunDose);
  const pHFactor = Math.min(1.2, Math.max(0.6, 1.2 - 0.25 * (pH - ENHANCED_COAGULATION_PH)));
  return Math.min(MAX_TOC_REMOVAL, byDose * pHFactor);
}

function pHEfficiency(pH) {
  const deviation = (pH - OPTIMAL_COAGULATION_PH) / COAGULATION_PH_TOLERANCE;
  return Math.max(0, 1 - deviation * deviation);
}

// Microfloculation : l'ozone casse les macromolécules organiques en fragments
// plus courts et polaires, qui se lient mieux au floc d'alun. À l'entrée du
// décanteur, precursorFraction ne dépend que de la dose d'ozone appliquée —
// il mesure donc directement la pré-ozonation reçue.
const MICROFLOC_BONUS = 0.18; // par point de réactivité du COT détruite en amont

function microflocculationBonus(precursorFraction) {
  return 1 + MICROFLOC_BONUS * (1 - precursorFraction);
}

// À l'inverse, l'ozone qui a échappé au dégazage oxyde le polymère et recharge
// les particules : le floc ne prend plus. C'est toute la raison d'être du
// dégazeur, et l'erreur se lit ici et pas à l'ozonation.
const OZONE_FLOC_PENALTY = 0.25; // par mg/L d'ozone résiduel entrant

function ozoneFlocPenalty(ozoneResidual) {
  return Math.max(0, 1 - OZONE_FLOC_PENALTY * ozoneResidual);
}

// Le Pulsator n'est pas un décanteur ordinaire : le floc n'y décante pas
// librement, il traverse un lit de boue fluidisé qui le capte par contact.
// Sans voile, il ne reste rien qu'un bassin de passage. Trop épais, le voile
// atteint les goulottes de reprise et part entier vers les filtres. Le tenir à
// hauteur en réglant la purge est le geste quotidien d'un exploitant, et le
// seul réglage de cette usine qui ne soit pas un dosage.
const CLARIFIER_AREA_M2 = 12; // 2,5 m/h de vitesse ascensionnelle au débit nominal
const BLANKET_OPTIMAL_M = 1.5;
const BLANKET_OVERFLOW_M = 2.6; // hauteur des goulottes de reprise
const NOMINAL_UPFLOW_MH = 2.5;

function upflowVelocity(flowLPM) {
  return (flowLPM * 0.06) / CLARIFIER_AREA_M2; // L/min -> m³/h, puis m³/h par m²
}

// Le voile est fluidisé par le débit qui le traverse : pousser la production
// le dilate, et un voile dilaté atteint les goulottes bien avant sa hauteur au
// repos. Remplir la réserve en forçant le débit se paie donc ici.
function expandedHeight(heightM, upflowMH) {
  return heightM * Math.max(0.6, upflowMH / NOMINAL_UPFLOW_MH);
}

function blanketEfficiency(heightM, upflowMH) {
  const effective = expandedHeight(heightM, upflowMH);
  const build = Math.min(1, effective / BLANKET_OPTIMAL_M);
  const carryover = Math.min(1, Math.max(0,
    (effective - BLANKET_OPTIMAL_M) / (BLANKET_OVERFLOW_M - BLANKET_OPTIMAL_M)));
  return Math.max(0, build - carryover);
}

// La boue vient de deux sources : les particules captées, et l'hydroxyde
// d'aluminium que l'alun forme lui-même (~0,26 mg de matière sèche par mg
// d'alun). C'est pourquoi le voile monte même sur une eau parfaitement claire
// dès qu'on coagule fort.
const SLUDGE_PER_NTU = 1.5; // mg/L de matière sèche par NTU captée
const SLUDGE_PER_ALUM = 0.26; // mg de matière sèche par mg d'alun
const BLANKET_CONCENTRATION_MGL = 2500; // siccité du voile, 2,5 g/L
const BLANKET_CAPACITY_MG_PER_M = BLANKET_CONCENTRATION_MGL * CLARIFIER_AREA_M2 * 1000;

// L'extraction se fait par une vanne de purge à débit fixe ouverte une
// fraction du temps — c'est ainsi qu'on règle un Pulsator, pas par un débit
// continu. Le réglage est donc un pourcentage d'ouverture.
const PURGE_VALVE_LPM = 30;

function sludgeProduction(flowLPM, capturedNTU, alunDose) {
  return flowLPM * (SLUDGE_PER_NTU * capturedNTU + SLUDGE_PER_ALUM * alunDose);
}

function sludgeExtraction(purgeDuty) {
  return (Math.max(0, purgeDuty) / 100) * PURGE_VALVE_LPM * BLANKET_CONCENTRATION_MGL;
}

export function createDecanteurStage() {
  let currentTurbidity = 0;
  // Une usine ne se remet pas en route chaque matin : le voile est déjà formé
  // et à hauteur quand l'étudiant prend son poste.
  let blanketHeight = BLANKET_OPTIMAL_M;
  let currentUpflow = 0;
  let currentSludgeProduction = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      currentUpflow = upflowVelocity(waterIn.flow);

      const optimalAlun = optimalAlunDose(waterIn.turbidity, waterIn.temperature);
      const alunEfficiency = doseEfficiency(settings.alunDose, optimalAlun);
      const optimalPolymer = 0.03 * settings.alunDose;
      const polymerEfficiency = doseEfficiency(settings.polymerDose, optimalPolymer);

      // le pH de coagulation est celui mesuré dans le floculateur, donc après
      // l'ajout de l'alun : c'est la dose elle-même qui déplace la fenêtre
      const { alkalinity, pH, calcium } = applyChemicals(waterIn, {
        alunDose: settings.alunDose,
        limeDose: settings.limeDose,
      });
      water.alkalinity = alkalinity;
      water.pH = pH;
      water.calcium = calcium;

      const tocRemoval = tocRemovalFraction(settings.alunDose, pH);
      water.toc = waterIn.toc * (1 - tocRemoval);
      water.precursorFraction =
        waterIn.precursorFraction * (1 - PREFERENTIAL_PRECURSOR_REMOVAL * tocRemoval);

      // l'alun fait le gros du travail ; le polymère apporte un bonus
      // allant jusqu'à 20% d'efficacité supplémentaire
      const chemistry = Math.min(1,
        alunEfficiency
        * (0.8 + 0.2 * polymerEfficiency)
        * pHEfficiency(pH)
        * temperatureEfficiency(waterIn.temperature)
        * microflocculationBonus(waterIn.precursorFraction)
        * ozoneFlocPenalty(waterIn.ozoneResidual));
      const combinedEfficiency = chemistry * blanketEfficiency(blanketHeight, currentUpflow);

      const captured = waterIn.turbidity * MAX_REMOVAL_RATE * combinedEfficiency;
      const target = waterIn.turbidity - captured;
      currentTurbidity = applyLag(currentTurbidity, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.turbidity = currentTurbidity;

      currentSludgeProduction = sludgeProduction(waterIn.flow, captured, settings.alunDose);
      const netGrowth = currentSludgeProduction - sludgeExtraction(settings.purgeDuty);
      blanketHeight = Math.max(0, blanketHeight + (netGrowth * dtMinutes) / BLANKET_CAPACITY_MG_PER_M);

      return water;
    },

    getBlanketHeight() {
      return blanketHeight;
    },

    // L'ouverture de purge qui évacuerait exactement la boue produite en ce
    // moment. C'est la consigne que cherche l'exploitant : au-dessus le voile
    // maigrit, en dessous il monte. Elle bouge avec la turbidité brute et avec
    // la dose d'alun, donc à chaque changement de conditions.
    getBalancedPurgeDuty() {
      return (currentSludgeProduction * 100) / (PURGE_VALVE_LPM * BLANKET_CONCENTRATION_MGL);
    },

    // Ce que « voit » le voile, dilatation du débit comprise : c'est cette
    // hauteur-là qui atteint les goulottes, pas celle au repos. Décanteur à
    // l'arrêt, il n'y a rien à mesurer : un voile qui ne reçoit pas d'eau est
    // simplement décanté, pas hors consigne. Même règle qu'au filtre — pas
    // d'eau, pas de mesure.
    getEffectiveBlanketHeight() {
      if (currentUpflow <= 0) return null;
      return expandedHeight(blanketHeight, currentUpflow);
    },

    getUpflowVelocity() {
      return currentUpflow;
    },
  };
}

// Doses alignées sur l'optimum calculé pour l'eau brute par défaut (2 NTU) :
// optimalAlunDose(2) = 10 mg/L et optimalPolymer = 0,03 x 10 = 0,3 mg/L.
// Toute autre valeur ferait démarrer la simulation avec un décanteur inefficace.
// Pas de chaux par défaut : l'eau brute est assez tamponnée pour encaisser
// cette dose d'alun, le rechaulage ne sert qu'aux eaux douces ou fortement dosées.
// Purge à 3,5 % : ce qu'il faut pour évacuer exactement la boue produite sur
// l'eau brute par défaut, soit 1 L/min de boue pour 500 L/min traités.
export function defaultDecanteurSettings() {
  return { alunDose: 10, polymerDose: 0.3, limeDose: 0, purgeDuty: 3.5 }; // mg/L, %
}

export const BLANKET_LIMITS = { optimal: BLANKET_OPTIMAL_M, overflow: BLANKET_OVERFLOW_M };
