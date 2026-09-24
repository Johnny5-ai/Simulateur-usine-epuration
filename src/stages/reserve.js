import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';
import { applyChemicals, langelierIndex } from '../chemistry.js';

const TIME_CONSTANT_MINUTES = 60; // mélange dans le volume de la réserve
// Caractéristique de pompe centrifuge H = H0 - k Q², soit Q = Qmax x sqrt(1 - H/H0).
// Plus la pression de refoulement demandée est haute, moins la pompe débite ; à la
// hauteur de coupure elle n'envoie plus rien. Une pompe de reprise ne se dimensionne
// pas sur la consommation moyenne mais sur la POINTE HORAIRE : à 6 bar elle donne
// 740 L/min pour une pointe de 675, soit 10 % de marge. Monter la pression
// d'un bar mange cette marge, et à 8 bar le réseau n'est plus servi le soir.
const PUMP_SHUTOFF_PRESSURE_BAR = 12;
const PUMP_FREE_DELIVERY_LPM = 1050;

function pumpCapacity(pressureBar) {
  if (pressureBar >= PUMP_SHUTOFF_PRESSURE_BAR) return 0;
  return PUMP_FREE_DELIVERY_LPM * Math.sqrt(1 - pressureBar / PUMP_SHUTOFF_PRESSURE_BAR);
}

// La réserve est le seul organe de l'usine qui ne traite rien : elle découple
// la production de la consommation. C'est ce découplage qui fait le métier —
// produire au bon moment pour tenir la pointe, sans déborder la nuit.
// 300 m³ pour 720 m³/j distribués, soit 10 h d'autonomie moyenne : un
// dimensionnement courant pour un petit réseau.
const RESERVE_CAPACITY_L = 300000;
const START_FILL = 0.5; // l'étudiant prend son poste sur une réserve à mi-hauteur
const AVERAGE_DEMAND_LPM = 500; // égale la production nominale : sur 24 h, ça s'équilibre
const MINUTES_PER_DAY = 1440;

// Courbe de demande d'un petit réseau : creux nocturne vers 1 h 30, pointe du
// matin vers 7 h 30, pointe du soir vers 19 h 30. Deux harmoniques suffisent à
// en reproduire la forme, et leur moyenne vaut exactement 1 par construction —
// ce qui garantit qu'à production nominale la journée se referme à l'équilibre.
// Pointe à 1,35 fois la moyenne, creux à 0,35 : c'est cet écart, pas la
// moyenne, qui dimensionne la réserve.
const DAILY_AMPLITUDE = 0.35;
const TWICE_DAILY_AMPLITUDE = 0.3;
const DAILY_PEAK_HOUR = 13;
const TWICE_DAILY_PEAK_HOUR = 7.5;

function demandShape(minuteOfDay) {
  const angle = (2 * Math.PI * minuteOfDay) / MINUTES_PER_DAY;
  return (
    1
    + DAILY_AMPLITUDE * Math.cos(angle - (2 * Math.PI * DAILY_PEAK_HOUR) / 24)
    + TWICE_DAILY_AMPLITUDE * Math.cos(2 * angle - (2 * Math.PI * TWICE_DAILY_PEAK_HOUR) / 12)
  );
}

export function createReserveStage() {
  let currentTurbidity = 0;
  let currentChlorine = 0;
  let currentLSI = 0;
  let storedLitres = RESERVE_CAPACITY_L * START_FILL;
  let currentDemand = 0;
  let unmetDemand = 0;
  let overflowLitres = 0;

  return {
    process(waterIn, settings, dtMinutes, network) {
      const water = cloneWater(waterIn);

      currentTurbidity = applyLag(currentTurbidity, waterIn.turbidity, TIME_CONSTANT_MINUTES, dtMinutes);
      currentChlorine = applyLag(currentChlorine, waterIn.chlorineResidual, TIME_CONSTANT_MINUTES, dtMinutes);

      water.turbidity = currentTurbidity;
      water.chlorineResidual = currentChlorine;

      // La ville tire ce qu'elle veut ; l'usine ne peut que la servir ou non.
      // On ne distribue jamais plus que ce que la pompe passe, ni plus que ce
      // que la cuve contient — une réserve vide, c'est la chute de pression.
      currentDemand = AVERAGE_DEMAND_LPM * network.demandFactor * demandShape(network.minuteOfDay);
      const mobilisable = storedLitres / dtMinutes + waterIn.flow;
      const distributed = Math.max(0, Math.min(
        currentDemand,
        pumpCapacity(settings.pumpPressure),
        mobilisable,
      ));
      unmetDemand = currentDemand - distributed;

      const balance = storedLitres + (waterIn.flow - distributed) * dtMinutes;
      // Le trop-plein n'est pas un incident anodin : c'est de l'eau traitée,
      // chlorée et payée qui part à l'égout.
      overflowLitres = Math.max(0, balance - RESERVE_CAPACITY_L);
      storedLitres = Math.min(RESERVE_CAPACITY_L, Math.max(0, balance));

      water.flow = distributed;

      // Reminéralisation : la chaux est dosée ICI et pas au décanteur. En bout
      // de chaîne, le CT est déjà acquis à pH bas et la coagulation a déjà eu
      // lieu — remonter le pH maintenant protège le réseau sans rien coûter en
      // désinfection. La même chaux au décanteur ferait exploser le CT requis.
      const { alkalinity, pH, calcium } = applyChemicals(waterIn, {
        limeDose: settings.limeDose,
      });
      water.alkalinity = alkalinity;
      water.pH = pH;
      water.calcium = calcium;
      currentLSI = langelierIndex(water);
      return water;
    },

    getLSI() {
      return currentLSI;
    },

    getLevel() {
      return (storedLitres / RESERVE_CAPACITY_L) * 100;
    },

    getStoredM3() {
      return storedLitres / 1000;
    },

    getDemand() {
      return currentDemand;
    },

    getUnmetDemand() {
      return unmetDemand;
    },

    getOverflowRate() {
      return overflowLitres;
    },
  };
}

export function defaultReserveSettings() {
  // 12,5 mg/L est le centre de la fenêtre commune aux cinq scénarios (11,5 à
  // 14) : assez loin des deux bords pour qu'une eau brute qui change ne fasse
  // pas basculer l'indice de Langelier avant que l'étudiant ait pu réagir.
  return { pumpPressure: 6, limeDose: 12.5 }; // bar, mg/L de Ca(OH)2
}
