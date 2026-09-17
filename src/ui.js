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
  filterSpeed: { min: 1, max: 20 },
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
    input.step = '0.1';
    const bounds = FIELD_BOUNDS[field];
    if (bounds) {
      input.min = bounds.min;
      input.max = bounds.max;
    }
    input.value = value;
    input.addEventListener('input', () => {
      let numericValue = Number(input.value);
      if (bounds) {
        numericValue = Math.min(bounds.max, Math.max(bounds.min, numericValue));
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

export function renderReadouts(container, water, filtrationHeadloss, chlorationCT) {
  container.innerHTML = '';

  const rows = [
    { label: 'Débit', value: water.flow.toFixed(1), unit: 'L/min' },
    { label: 'Turbidité', value: water.turbidity.toFixed(2), rawValue: water.turbidity, unit: 'NTU', threshold: THRESHOLDS.turbidity },
    { label: 'Chlore résiduel', value: water.chlorineResidual.toFixed(2), rawValue: water.chlorineResidual, unit: 'mg/L', threshold: THRESHOLDS.chlorineResidual },
    { label: 'Perte de charge filtre', value: filtrationHeadloss.toFixed(0), unit: 'kPa' },
    { label: 'CT chloration', value: chlorationCT.toFixed(1), unit: 'mg·min/L' },
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
