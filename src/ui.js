import { THRESHOLDS, conformity } from './thresholds.js';

const STAGE_LABELS = {
  puits: 'Puits',
  ozonation: 'Ozonation',
  degazage: 'Dégazage',
  decanteur: 'Décanteur Pulsator',
  filtration: 'Filtration',
  chloration: 'Chloration',
  reserve: 'Réserve + pompage HP',
};

export function renderSchematic(container, onSelectStage) {
  container.innerHTML = '';
  Object.entries(STAGE_LABELS).forEach(([key, label]) => {
    const box = document.createElement('div');
    box.className = 'stage-box';
    box.dataset.stage = key;
    box.textContent = label;
    box.addEventListener('click', () => onSelectStage(key));
    container.appendChild(box);
  });
}

export function setActiveStage(container, stageKey) {
  container.querySelectorAll('.stage-box').forEach((box) => {
    box.classList.toggle('active', box.dataset.stage === stageKey);
  });
}

const FIELD_BOUNDS = {
  pumpFlow: { min: 0, max: 1000 },
  dose: { min: 0, max: 10 },
  alunDose: { min: 0, max: 100 },
  polymerDose: { min: 0, max: 5 },
  limeDose: { min: 0, max: 25 },
  purgeDuty: { min: 0, max: 100, step: 0.5 },
  airRatio: { min: 0, max: 10, step: 0.5 },
  filtersInService: { min: 1, max: 4, step: 1 },
  pumpPressure: { min: 0, max: 12 },
};

export function renderControls(container, stageKey, settings, onChange) {
  container.innerHTML = '';
  if (!stageKey || !settings[stageKey]) return;

  Object.entries(settings[stageKey]).forEach(([field, value]) => {
    const label = document.createElement('label');
    label.textContent = `${field} : `;
    const input = document.createElement('input');
    input.type = 'number';
    const bounds = FIELD_BOUNDS[field];
    input.step = bounds?.step ?? 0.1;
    if (bounds) {
      input.min = bounds.min;
      input.max = bounds.max;
    }
    input.value = value;
    input.addEventListener('input', () => {
      let numericValue = Number(input.value);
      if (bounds) {
        numericValue = Math.min(bounds.max, Math.max(bounds.min, numericValue));
        input.value = numericValue;
      }
      onChange(stageKey, { [field]: numericValue });
    });
    label.appendChild(input);
    container.appendChild(label);
  });

  if (stageKey === 'filtration') {
    const backwashButton = document.createElement('button');
    backwashButton.textContent = 'Backwash';
    backwashButton.addEventListener('click', () => onChange('filtration:backwash', {}));
    container.appendChild(backwashButton);
  }
}

export function renderReadouts(container, water, plant) {
  container.innerHTML = '';

  const rows = [
    {
      label: 'Débit distribué',
      value: `${water.flow.toFixed(0)} (demande ${plant.demand.toFixed(0)})`,
      rawValue: plant.unmetDemand,
      unit: 'L/min',
      threshold: { max: 1 },
    },
    {
      label: 'Niveau de la réserve',
      value: `${plant.reserveLevel.toFixed(0)} (${plant.storedM3.toFixed(0)} m³)`,
      rawValue: plant.reserveLevel,
      unit: '%',
      threshold: THRESHOLDS.reserveLevel,
    },
    { label: 'Température', value: water.temperature.toFixed(1), unit: '°C' },
    { label: 'Turbidité sortie filtre', value: plant.effluentTurbidity.toFixed(2), rawValue: plant.effluentTurbidity, unit: 'NTU', threshold: THRESHOLDS.turbidity },
    {
      label: 'Registre turbidité',
      value: `${plant.turbidityCompliance.toFixed(1)} (pointe ${plant.peakTurbidity.toFixed(2)} NTU)`,
      rawValue: plant.turbidityCompliance,
      unit: '% des mesures ≤ 0,3 NTU',
      threshold: THRESHOLDS.turbidityCompliance,
    },
    { label: 'Turbidité distribuée', value: water.turbidity.toFixed(2), unit: 'NTU' },
    { label: 'Chlore résiduel', value: water.chlorineResidual.toFixed(2), rawValue: water.chlorineResidual, unit: 'mg/L', threshold: THRESHOLDS.chlorineResidual },
    { label: 'pH', value: water.pH.toFixed(2), rawValue: water.pH, unit: '', threshold: THRESHOLDS.pH },
    { label: 'Alcalinité résiduelle', value: water.alkalinity.toFixed(0), unit: 'mg/L CaCO₃' },
    { label: 'COT résiduel', value: water.toc.toFixed(2), unit: 'mg/L' },
    { label: 'Précurseurs de THM', value: (water.toc * water.precursorFraction).toFixed(2), unit: `mg/L (${(water.precursorFraction * 100).toFixed(0)} % du COT réactif)` },
    { label: 'Indice de Langelier', value: plant.lsi.toFixed(2), rawValue: plant.lsi, unit: '', threshold: THRESHOLDS.lsi },
    { label: 'Trihalométhanes', value: plant.thm.toFixed(0), rawValue: plant.thm, unit: 'µg/L', threshold: THRESHOLDS.thm },
    { label: 'Acides haloacétiques', value: plant.haa.toFixed(0), rawValue: plant.haa, unit: 'µg/L', threshold: THRESHOLDS.haa },
    { label: 'Bromate', value: water.bromate.toFixed(1), rawValue: water.bromate, unit: 'µg/L', threshold: THRESHOLDS.bromate },
    { label: 'Bromure brut', value: water.bromide.toFixed(0), unit: 'µg/L' },
    {
      label: 'Voile de boue',
      value: plant.effectiveBlanketHeight === null
        ? "décanteur à l'arrêt"
        : `${plant.effectiveBlanketHeight.toFixed(2)} m (au repos ${plant.blanketHeight.toFixed(2)})`,
      rawValue: plant.effectiveBlanketHeight,
      unit: '',
      threshold: plant.effectiveBlanketHeight === null ? null : THRESHOLDS.blanketHeight,
    },
    {
      label: 'Purge à l’équilibre',
      value: plant.balancedPurgeDuty.toFixed(1),
      unit: '% (le voile monte en dessous, maigrit au-dessus)',
    },
    { label: 'Vitesse ascensionnelle décanteur', value: plant.upflowVelocity.toFixed(2), unit: 'm/h' },
    { label: 'Vitesse de filtration', value: plant.filtrationRate.toFixed(1), unit: 'm/h' },
    { label: 'Perte de charge filtre', value: plant.headloss.toFixed(2), unit: "m d'eau" },
    {
      // Au-delà d'environ 18 m/h le média ne retient plus rien du tout : sa
      // capacité est nulle, et un pourcentage de remplissage n'a plus de sens.
      label: 'Charge du média',
      value: Number.isFinite(plant.bedLoading)
        ? `${(plant.bedLoading * 100).toFixed(0)} % (percée au-delà de 100)`
        : 'média saturé, le filtre ne retient plus rien à cette vitesse',
      rawValue: plant.bedLoading,
      unit: '',
      threshold: { max: 1 },
    },
    {
      label: 'Crédit de désinfection ozone',
      value: (water.disinfectionCredit * 100).toFixed(0),
      unit: "% de l'inactivation requise",
    },
    {
      label: 'CT chloration',
      value: `${plant.ct.toFixed(1)} (requis ${plant.requiredCT.toFixed(1)})`,
      rawValue: plant.ct,
      unit: 'mg·min/L',
      threshold: { min: plant.requiredCT },
    },
  ];

  rows.forEach((row) => {
    const div = document.createElement('div');
    div.className = 'readout';
    if (row.threshold) {
      div.classList.add(conformity(row.rawValue, row.threshold));
    }
    div.textContent = `${row.label} : ${row.value} ${row.unit}`;
    container.appendChild(div);
  });
}

export function logEvent(container, message) {
  const item = document.createElement('li');
  item.textContent = message;
  container.prepend(item);
}

export function updateClock(display, elapsedMinutes) {
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = Math.floor(elapsedMinutes % 60);
  display.textContent = `${hours}h${String(minutes).padStart(2, '0')}`;
}
