import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const OZONE_DEMAND_MGL = 1.2; // ozone consommé par la matière oxydable de l'eau brute
const PLATEAU_DOSE_MGL = 3; // au-delà, rendement décroissant
const PLATEAU_FACTOR = 0.2;
const TIME_CONSTANT_MINUTES = 10; // temps de contact typique du contacteur d'ozone

function targetResidual(doseMgL) {
  const net = Math.max(0, doseMgL - OZONE_DEMAND_MGL);
  if (net <= PLATEAU_DOSE_MGL) return net;
  return PLATEAU_DOSE_MGL + (net - PLATEAU_DOSE_MGL) * PLATEAU_FACTOR;
}

// Bromate : loi de puissance empirique de type Ozekin-Amy, calée sur des eaux
// naturelles ozonées. C'est le prix de l'ozone — plus on en met, plus on oxyde
// le bromure en bromate, et le bromate ne se rattrape nulle part en aval.
// L'exposant du pH est énorme (5,82) : une eau brute alcaline en fabrique
// beaucoup plus. Celui du COT est négatif : la matière organique piège les
// radicaux et protège, si bien qu'une eau chargée en fait moins — mais elle
// paiera en THM à la chloration. Aucune direction n'est gratuite.
const BROMATE_COEFFICIENT = 1.63e-6;
const BROMIDE_EXPONENT = 0.73;
const TOC_EXPONENT = -1.26;
const DOSE_EXPONENT = 1.57;
const PH_EXPONENT = 5.82;
const CONTACT_EXPONENT = 0.28;
const CONTACT_TIME_MINUTES = 10; // temps de séjour dans le contacteur

function bromateFormation({ bromide, toc, pH }, doseMgL) {
  if (doseMgL <= 0 || bromide <= 0) return 0;
  return (BROMATE_COEFFICIENT
    * bromide ** BROMIDE_EXPONENT
    * Math.max(0.1, toc) ** TOC_EXPONENT
    * doseMgL ** DOSE_EXPONENT
    * pH ** PH_EXPONENT
    * CONTACT_TIME_MINUTES ** CONTACT_EXPONENT);
}

// Le bénéfice qui justifie l'ozone, et la contrepartie exacte du bromate :
// l'ozone attaque les structures aromatiques riches en électrons, précisément
// celles qui réagissent avec le chlore pour former les THM. Il ne minéralise
// presque pas le COT — la quantité reste, la réactivité tombe. L'effet sature :
// les premiers mg/L cassent l'essentiel de l'aromaticité, au-delà on ne fait
// plus guère que du bromate.
const MAX_PRECURSOR_REMOVAL = 0.45;
const PRECURSOR_RATE = 0.35; // par mg/L d'ozone appliqué

function precursorFraction(doseMgL) {
  return 1 - MAX_PRECURSOR_REMOVAL * (1 - Math.exp(-PRECURSOR_RATE * Math.max(0, doseMgL)));
}

// Troisième effet de l'ozone, et le plus sous-estimé : c'est un désinfectant
// redoutable. Il faut 0,48 mg·min/L d'ozone pour 0,5 log de Giardia à 10 °C
// contre 25 mg·min/L de chlore libre — un facteur cinquante. La filière doit
// 3 log de Giardia ; la filtration conventionnelle en crédite 2,5, et c'est
// ce demi-log restant que l'ozone peut couvrir à lui seul. Ce qu'il couvre,
// la chloration n'a plus à le fournir : le crédit sort d'ici en fraction de
// l'inactivation requise, entre 0 et 1.
// Le crédit n'existe qu'au-delà de la demande en ozone de l'eau (1,2 mg/L) :
// tant qu'elle n'est pas satisfaite, il ne reste aucun résiduel pour tuer
// quoi que ce soit. Le CT requis double par baisse de 10 °C, ici comme au chlore.
const OZONE_CT_05LOG_10C = 0.48;
const CONTACT_T10_MINUTES = 6; // 10 min de séjour, facteur de chicanage 0,6

function disinfectionCredit(residualMgL, temperatureC) {
  const ctRequired = OZONE_CT_05LOG_10C * 2 ** ((10 - temperatureC) / 10);
  return Math.min(1, (residualMgL * CONTACT_T10_MINUTES) / ctRequired);
}

export function createOzonationStage() {
  let currentResidual = 0;
  let currentBromate = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      const target = targetResidual(settings.dose);
      currentResidual = applyLag(currentResidual, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.ozoneResidual = currentResidual;

      const bromateTarget = bromateFormation(waterIn, settings.dose);
      currentBromate = applyLag(currentBromate, bromateTarget, TIME_CONSTANT_MINUTES, dtMinutes);
      water.bromate = currentBromate;

      water.precursorFraction = precursorFraction(settings.dose);
      water.disinfectionCredit = disinfectionCredit(currentResidual, waterIn.temperature);
      return water;
    },

    getBromate() {
      return currentBromate;
    },
  };
}

export function defaultOzonationSettings() {
  return { dose: 2 }; // mg/L
}
