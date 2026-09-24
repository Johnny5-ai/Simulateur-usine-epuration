// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderSchematic,
  setActiveStage,
  renderControls,
  renderReadouts,
  logEvent,
  updateClock,
} from '../src/ui.js';
import { createSimulation } from '../src/simulation.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
});

// L'état de l'usine sert de source aux tests d'affichage : une grandeur
// ajoutée au tableau de bord sans être affichée se verra ici, et une case
// affichée qui n'existe plus côté procédé aussi.
function plant(configure = () => {}) {
  const sim = createSimulation();
  configure(sim);
  let water;
  for (let i = 0; i < 200; i += 1) water = sim.tick(1);
  return { water, readings: sim.getReadings() };
}

describe('renderSchematic', () => {
  it('draws one box per stage and reports the one that was clicked', () => {
    const clicked = [];
    renderSchematic(container, (key) => clicked.push(key));
    const boxes = container.querySelectorAll('.stage-box');
    expect(boxes.length).toBe(7);
    boxes[3].click();
    expect(clicked).toEqual(['decanteur']);
  });

  it('marks a single stage as active at a time', () => {
    renderSchematic(container, () => {});
    setActiveStage(container, 'filtration');
    setActiveStage(container, 'chloration');
    const active = [...container.querySelectorAll('.active')].map((b) => b.dataset.stage);
    expect(active).toEqual(['chloration']);
  });
});

describe('renderControls', () => {
  const settings = { decanteur: { alunDose: 10, polymerDose: 0.3, limeDose: 0, purgeDuty: 3.5 } };

  it('draws one input per setting of the selected stage', () => {
    renderControls(container, 'decanteur', settings, () => {});
    expect(container.querySelectorAll('input').length).toBe(4);
  });

  it('draws nothing when no stage is selected', () => {
    renderControls(container, null, settings, () => {});
    expect(container.children.length).toBe(0);
  });

  // Le champ est la seule protection contre une consigne absurde : une dose
  // d'alun de 900 mg/L n'existe pas, et la valeur affichée doit dire la même
  // chose que la valeur transmise, sans quoi l'exploitant pilote à l'aveugle.
  it('clamps an out-of-range entry and shows back what it actually applied', () => {
    const applied = [];
    renderControls(container, 'decanteur', settings, (stage, patch) => applied.push([stage, patch]));
    const alun = container.querySelector('input');
    alun.value = '900';
    alun.dispatchEvent(new Event('input'));
    expect(applied).toEqual([['decanteur', { alunDose: 100 }]]);
    expect(alun.value).toBe('100');
  });

  it('passes a value inside the bounds through untouched', () => {
    const applied = [];
    renderControls(container, 'decanteur', settings, (stage, patch) => applied.push(patch));
    const alun = container.querySelector('input');
    alun.value = '18';
    alun.dispatchEvent(new Event('input'));
    expect(applied).toEqual([{ alunDose: 18 }]);
  });

  // Le lavage n'est pas une consigne mais un geste : il n'a pas de valeur, il
  // a un instant. D'où un bouton, et seulement sur le filtre.
  it('offers a backwash button on the filter and nowhere else', () => {
    renderControls(container, 'filtration', { filtration: { filtersInService: 3 } }, () => {});
    expect(container.querySelector('button')).not.toBeNull();

    renderControls(container, 'decanteur', settings, () => {});
    expect(container.querySelector('button')).toBeNull();
  });

  it('reports the backwash as its own kind of change', () => {
    const applied = [];
    renderControls(container, 'filtration', { filtration: { filtersInService: 3 } }, (stage) => applied.push(stage));
    container.querySelector('button').click();
    expect(applied).toEqual(['filtration:backwash']);
  });
});

describe('renderReadouts', () => {
  it('renders every reading the plant exposes', () => {
    const { water, readings } = plant();
    renderReadouts(container, water, readings);
    expect(container.querySelectorAll('.readout').length).toBeGreaterThan(15);
    expect(container.textContent).not.toContain('undefined');
    expect(container.textContent).not.toContain('NaN');
  });

  function rowFor(label) {
    return [...container.querySelectorAll('.readout')].find((d) => d.textContent.startsWith(`${label} :`));
  }

  it('marks a plant running on defaults as compliant throughout', () => {
    const { water, readings } = plant();
    renderReadouts(container, water, readings);
    expect(container.querySelectorAll('.non-conforme').length).toBe(0);
  });

  // Un dépassement doit se voir : c'est tout ce que l'interface a à dire.
  it('flags the reading that breaches its threshold', () => {
    const { water, readings } = plant((sim) => sim.updateSettings('chloration', { dose: 8 }));
    renderReadouts(container, water, readings);
    expect(rowFor('Chlore résiduel').className).toContain('non-conforme');
    expect(rowFor('pH').className).toContain('conforme');
  });

  // Pompe du puits à l'arrêt : le décanteur ne reçoit rien, son voile n'est
  // ni haut ni bas. L'interface doit le dire au lieu de crier au dépassement.
  it('says the clarifier is stopped instead of judging a blanket it cannot see', () => {
    const { water, readings } = plant((sim) => sim.updateSettings('puits', { pumpFlow: 0 }));
    renderReadouts(container, water, readings);
    const row = rowFor('Voile de boue');
    expect(row.textContent).toContain("décanteur à l'arrêt");
    expect(row.className).not.toContain('non-conforme');
  });

  it('judges the blanket again as soon as the water flows', () => {
    const { water, readings } = plant();
    renderReadouts(container, water, readings);
    expect(rowFor('Voile de boue').className).toContain('conforme');
  });

  // Une seule cuve au débit nominal, c'est 20 m/h : au-delà de 18 le média ne
  // retient plus rien, sa capacité est nulle et le rapport charge/capacité
  // part à l'infini. C'est un état, pas un pourcentage.
  it('names a saturated media instead of printing an infinite percentage', () => {
    const { water, readings } = plant((sim) => sim.updateSettings('filtration', { filtersInService: 1 }));
    renderReadouts(container, water, readings);
    const row = rowFor('Charge du média');
    expect(row.textContent).not.toContain('Infinity');
    expect(row.textContent).toContain('saturé');
    expect(row.className).toContain('non-conforme');
  });

  it('replaces the previous reading instead of stacking a new one', () => {
    const { water, readings } = plant();
    renderReadouts(container, water, readings);
    const first = container.querySelectorAll('.readout').length;
    renderReadouts(container, water, readings);
    expect(container.querySelectorAll('.readout').length).toBe(first);
  });
});

describe('logEvent', () => {
  it('puts the newest entry on top', () => {
    logEvent(container, 'premier');
    logEvent(container, 'second');
    expect([...container.children].map((li) => li.textContent)).toEqual(['second', 'premier']);
  });
});

describe('updateClock', () => {
  it('reads elapsed minutes as a time of day', () => {
    updateClock(container, 0);
    expect(container.textContent).toBe('0h00');
    updateClock(container, 605);
    expect(container.textContent).toBe('10h05');
  });
});
