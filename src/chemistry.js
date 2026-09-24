// Chimie carbonatée partagée : le décanteur et la réserve dosent tous les deux
// des réactifs qui déplacent le couple alcalinité / CO2, donc le pH.

// Al2(SO4)3.14H2O + 6 HCO3- -> 2 Al(OH)3 + 6 CO2 + 14 H2O + 3 SO4--
// Par mg d'alun, 0,50 mg d'alcalinité en CaCO3 détruite. Le carbone, lui, ne
// part pas : le bicarbonate consommé ressort en CO2 dissous.
const ALKALINITY_PER_ALUM = 0.5; // mg CaCO3 / mg alun

// Ca(OH)2 + 2 CO2 -> Ca(HCO3)2 : la chaux fait l'inverse exact de l'alun, et
// apporte en prime du calcium, l'autre moitié de l'équilibre calco-carbonique.
// Elle non plus n'ajoute ni n'enlève de carbone : elle reconvertit en
// bicarbonate le CO2 déjà présent.
const ALKALINITY_PER_LIME = 1.35; // mg CaCO3 / mg Ca(OH)2
const CALCIUM_PER_LIME = 1.35; // mg CaCO3 / mg Ca(OH)2

// Système carbonaté complet. Ne modéliser que la première dissociation
// (pH = pK1 + log[HCO3-]/[CO2]) marche tant qu'il reste du CO2, puis diverge :
// la dose de chaux qui épuise le CO2 fait sauter le pH d'une unité d'un coup,
// et la plage 7,5-8,5 — précisément celle qu'un exploitant vise — devient
// inatteignable. La deuxième dissociation est ce qui tamponne cette zone.
const K1 = 10 ** -6.35; // H2CO3* <-> HCO3- + H+
const K2 = 10 ** -10.33; // HCO3- <-> CO3-- + H+
const KW = 1e-14;
const CACO3_MG_PER_EQUIVALENT = 50000;

/**
 * Alcalinité (eq/L) d'une eau contenant `carbonTotal` mol/L de carbone
 * inorganique, à la concentration en H+ donnée : Alc = [HCO3-] + 2[CO3--] + [OH-] - [H+].
 */
function alkalinityAt(h, carbonTotal) {
  const denominator = h * h + K1 * h + K1 * K2;
  return carbonTotal * ((K1 * h + 2 * K1 * K2) / denominator) + KW / h - h;
}

function carbonTotalFrom(pH, alkalinityEq) {
  const h = 10 ** -pH;
  const denominator = h * h + K1 * h + K1 * K2;
  return Math.max(0, (alkalinityEq - KW / h + h) / ((K1 * h + 2 * K1 * K2) / denominator));
}

// L'alcalinité croît de façon monotone avec le pH à carbone total fixé : une
// bissection converge donc sans risque, là où une formule explicite exigerait
// de résoudre un polynôme de degré 4.
function pHFrom(alkalinityEq, carbonTotal) {
  let low = 2;
  let high = 12;
  for (let i = 0; i < 50; i += 1) {
    const mid = (low + high) / 2;
    if (alkalinityAt(10 ** -mid, carbonTotal) < alkalinityEq) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * Applique l'alun et la chaux à l'eau et renvoie le nouvel équilibre.
 * Une eau bien tamponnée encaisse la dose d'alun, une eau douce voit son pH
 * plonger tant qu'on ne la rechaule pas.
 */
export function applyChemicals(water, { alunDose = 0, limeDose = 0 }) {
  const carbonTotal = carbonTotalFrom(water.pH, water.alkalinity / CACO3_MG_PER_EQUIVALENT);
  // Pas de plancher à zéro : passé la neutralisation complète, l'alun en excès
  // s'hydrolyse en acide libre et l'eau devient minéralement acide. C'est
  // exactement ce que mesure une alcalinité négative, et ce qui arrive vraiment
  // quand on coagule fort une eau douce sans rechauler.
  const alkalinity =
    water.alkalinity - ALKALINITY_PER_ALUM * alunDose + ALKALINITY_PER_LIME * limeDose;
  return {
    alkalinity,
    pH: pHFrom(alkalinity / CACO3_MG_PER_EQUIVALENT, carbonTotal),
    calcium: water.calcium + CALCIUM_PER_LIME * limeDose,
  };
}

// Indice de saturation de Langelier : LSI = pH - pHs, où pHs est le pH auquel
// l'eau serait à l'équilibre avec le carbonate de calcium. Négatif, l'eau
// dissout le calcaire et attaque les conduites — c'est ainsi qu'on met du plomb
// et du cuivre dans l'eau du robinet. Légèrement positif, elle dépose un film
// protecteur. Le terme A dépend des solides dissous, très peu sensible : figé
// ici pour une eau de surface ordinaire (~150 mg/L).
const TDS_TERM = 0.12;

export function langelierIndex({ pH, alkalinity, calcium, temperature }) {
  const temperatureTerm = -13.12 * Math.log10(temperature + 273.15) + 34.55;
  const calciumTerm = Math.log10(Math.max(1, calcium)) - 0.4;
  const alkalinityTerm = Math.log10(Math.max(1, alkalinity));
  return pH - (9.3 + TDS_TERM + temperatureTerm - calciumTerm - alkalinityTerm);
}
