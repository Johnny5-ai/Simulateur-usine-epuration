# Simulateur d'usine d'eau potable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une application web statique permettant à des étudiants de niveau technique de régler une filière de production d'eau potable (puits → ozonation → dégazage → décanteur Pulsator → filtration gravitaire → chloration gazeuse → réserve/pompage HP) et d'observer l'effet de leurs réglages et d'événements scriptés sur la qualité de l'eau.

**Architecture:** Modules ES (JavaScript vanilla) sans backend ni base de données. Chaque étape de la filière est un module indépendant avec une interface `process(eau, réglages, dt) → eau`, appliquant un lissage exponentiel de premier ordre pour simuler le délai de transit. Un moteur de simulation orchestre le pipeline des 7 étapes, un moteur de scénarios déclenche des événements scriptés (JSON) à des instants donnés, et une couche UI (SVG + DOM) affiche le schéma de procédé, les contrôles et la conformité réglementaire des mesures.

**Tech Stack:** JavaScript ES modules (aucun framework), HTML5/CSS, Vitest pour les tests unitaires, aucun bundler (fichiers statiques servis directement, ex. `npx serve .`).

Référence : `docs/superpowers/specs/2026-09-16-simulateur-eau-potable-design.md`

---

### Task 1: Scaffolding du projet

**Files:**
- Create: `package.json`
- Create: `tests/sanity.test.js`
- Create: `index.html`
- Create: `.gitignore`

- [ ] **Step 1: Créer `package.json`**

```json
{
  "name": "simulateur-eau-potable",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Installer les dépendances**

Run: `npm install`
Expected: `node_modules/` créé, `vitest` installé sans erreur.

- [ ] **Step 3: Créer `.gitignore`**

```
node_modules/
```

- [ ] **Step 4: Écrire un test de sanité pour valider l'outillage**

`tests/sanity.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('outillage de test', () => {
  it('exécute un test simple', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npx vitest run tests/sanity.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Créer le squelette `index.html` et les dossiers de code**

```bash
mkdir -p src/stages data/scenarios tests/stages
```

`index.html`:
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Simulateur d'usine d'eau potable</title>
</head>
<body>
  <h1>Simulateur d'usine d'eau potable</h1>
  <p>En construction.</p>
</body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore index.html tests/sanity.test.js
git commit -m "chore: scaffold project with vitest"
```

---

### Task 2: Modèle d'eau et lissage exponentiel

**Files:**
- Create: `src/water.js`
- Create: `src/lag.js`
- Test: `tests/water.test.js`
- Test: `tests/lag.test.js`

- [ ] **Step 1: Écrire les tests du modèle d'eau**

`tests/water.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createWater, cloneWater } from '../src/water.js';

describe('createWater', () => {
  it('applies default values when no overrides given', () => {
    const water = createWater();
    expect(water).toEqual({
      flow: 0,
      turbidity: 0,
      pH: 7,
      temperature: 15,
      ozoneResidual: 0,
      chlorineResidual: 0,
    });
  });

  it('applies provided overrides', () => {
    const water = createWater({ turbidity: 12, pH: 7.4 });
    expect(water.turbidity).toBe(12);
    expect(water.pH).toBe(7.4);
    expect(water.flow).toBe(0);
  });
});

describe('cloneWater', () => {
  it('returns an independent copy', () => {
    const original = createWater({ turbidity: 5 });
    const copy = cloneWater(original);
    copy.turbidity = 99;
    expect(original.turbidity).toBe(5);
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/water.test.js`
Expected: FAIL avec "Failed to resolve import ../src/water.js"

- [ ] **Step 3: Implémenter `src/water.js`**

```js
export function createWater({
  flow = 0,
  turbidity = 0,
  pH = 7,
  temperature = 15,
  ozoneResidual = 0,
  chlorineResidual = 0,
} = {}) {
  return { flow, turbidity, pH, temperature, ozoneResidual, chlorineResidual };
}

export function cloneWater(water) {
  return { ...water };
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/water.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Écrire les tests du lissage exponentiel**

`tests/lag.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { applyLag } from '../src/lag.js';

describe('applyLag', () => {
  it('moves partially toward target after one step', () => {
    const result = applyLag(0, 10, 60, 10);
    expect(result).toBeCloseTo(1.535, 2);
  });

  it('converges to target after many steps', () => {
    let value = 0;
    for (let i = 0; i < 100; i++) {
      value = applyLag(value, 10, 60, 10);
    }
    expect(value).toBeCloseTo(10, 3);
  });

  it('returns target immediately when time constant is zero', () => {
    expect(applyLag(0, 10, 0, 5)).toBe(10);
  });
});
```

- [ ] **Step 6: Vérifier l'échec, puis implémenter `src/lag.js`**

Run: `npx vitest run tests/lag.test.js` → attendu FAIL.

```js
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
```

- [ ] **Step 7: Vérifier que tous les tests passent**

Run: `npx vitest run tests/water.test.js tests/lag.test.js`
Expected: PASS (6 tests)

- [ ] **Step 8: Commit**

```bash
git add src/water.js src/lag.js tests/water.test.js tests/lag.test.js
git commit -m "feat: add water model and first-order lag helper"
```

---

### Task 3: Seuils réglementaires

**Files:**
- Create: `src/thresholds.js`
- Test: `tests/thresholds.test.js`

- [ ] **Step 1: Écrire le test**

`tests/thresholds.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { THRESHOLDS, conformity } from '../src/thresholds.js';

describe('conformity', () => {
  it('flags a value above the max threshold as non-conforme', () => {
    expect(conformity(1.5, THRESHOLDS.turbidity)).toBe('non-conforme');
  });

  it('flags a value at or below the max threshold as conforme', () => {
    expect(conformity(0.8, THRESHOLDS.turbidity)).toBe('conforme');
  });

  it('flags a value below the min threshold as non-conforme', () => {
    expect(conformity(0.1, THRESHOLDS.chlorineResidual)).toBe('non-conforme');
  });

  it('flags a value at or above the min threshold as conforme', () => {
    expect(conformity(0.5, THRESHOLDS.chlorineResidual)).toBe('conforme');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/thresholds.test.js`
Expected: FAIL avec "Failed to resolve import ../src/thresholds.js"

- [ ] **Step 3: Implémenter `src/thresholds.js`**

```js
export const THRESHOLDS = {
  turbidity: { max: 1, unit: 'NTU', label: 'Turbidité' },
  chlorineResidual: { min: 0.3, unit: 'mg/L', label: 'Chlore résiduel libre' },
};

export function conformity(value, threshold) {
  if (threshold.max !== undefined && value > threshold.max) return 'non-conforme';
  if (threshold.min !== undefined && value < threshold.min) return 'non-conforme';
  return 'conforme';
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/thresholds.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/thresholds.js tests/thresholds.test.js
git commit -m "feat: add regulatory conformity thresholds"
```

---

### Task 4: Étape Puits

**Files:**
- Create: `src/stages/puits.js`
- Test: `tests/stages/puits.test.js`

- [ ] **Step 1: Écrire le test**

`tests/stages/puits.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createPuitsStage, defaultRawWater, defaultPuitsSettings } from '../../src/stages/puits.js';

describe('PuitsStage', () => {
  it('outputs water with the pump flow and raw water quality provided', () => {
    const stage = createPuitsStage();
    const water = stage.process({ pumpFlow: 800 }, { turbidity: 15, pH: 6.9, temperature: 8 });
    expect(water.flow).toBe(800);
    expect(water.turbidity).toBe(15);
    expect(water.pH).toBe(6.9);
    expect(water.temperature).toBe(8);
    expect(water.ozoneResidual).toBe(0);
    expect(water.chlorineResidual).toBe(0);
  });

  it('provides sensible defaults', () => {
    expect(defaultRawWater()).toEqual({ turbidity: 2, pH: 7.2, temperature: 12 });
    expect(defaultPuitsSettings()).toEqual({ pumpFlow: 500 });
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/stages/puits.test.js`
Expected: FAIL avec "Failed to resolve import ../../src/stages/puits.js"

- [ ] **Step 3: Implémenter `src/stages/puits.js`**

```js
import { createWater } from '../water.js';

/**
 * Étape "Puits" : source d'eau brute. La qualité de l'eau brute (turbidité,
 * pH, température) est pilotée par le scénario actif, pas par l'étudiant.
 * Seul le débit de pompage est réglable par l'étudiant.
 */
export function createPuitsStage() {
  return {
    process(settings, rawWater) {
      return createWater({
        flow: settings.pumpFlow,
        turbidity: rawWater.turbidity,
        pH: rawWater.pH,
        temperature: rawWater.temperature,
        ozoneResidual: 0,
        chlorineResidual: 0,
      });
    },
  };
}

export function defaultRawWater() {
  return { turbidity: 2, pH: 7.2, temperature: 12 };
}

export function defaultPuitsSettings() {
  return { pumpFlow: 500 }; // L/min
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/stages/puits.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stages/puits.js tests/stages/puits.test.js
git commit -m "feat: add puits stage"
```

---

### Task 5: Étape Ozonation

**Files:**
- Create: `src/stages/ozonation.js`
- Test: `tests/stages/ozonation.test.js`

- [ ] **Step 1: Écrire le test**

`tests/stages/ozonation.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createOzonationStage } from '../../src/stages/ozonation.js';

describe('OzonationStage', () => {
  it('produces no residual when dose is below the ozone demand', () => {
    const stage = createOzonationStage();
    let water = createWater();
    for (let i = 0; i < 50; i++) {
      water = stage.process(water, { dose: 1 }, 10);
    }
    expect(water.ozoneResidual).toBeCloseTo(0, 5);
  });

  it('tracks dose minus demand below the plateau', () => {
    const stage = createOzonationStage();
    let water = createWater();
    for (let i = 0; i < 50; i++) {
      water = stage.process(water, { dose: 2 }, 10);
    }
    expect(water.ozoneResidual).toBeCloseTo(0.8, 2);
  });

  it('attenuates growth above the plateau dose', () => {
    const stage = createOzonationStage();
    let water = createWater();
    for (let i = 0; i < 50; i++) {
      water = stage.process(water, { dose: 5 }, 10);
    }
    expect(water.ozoneResidual).toBeCloseTo(3.16, 2);
  });

  it('does not jump to the target instantly (delai de transit)', () => {
    const stage = createOzonationStage();
    const water = createWater();
    const afterOneTick = stage.process(water, { dose: 2 }, 10);
    expect(afterOneTick.ozoneResidual).toBeGreaterThan(0);
    expect(afterOneTick.ozoneResidual).toBeLessThan(0.8);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/stages/ozonation.test.js`
Expected: FAIL avec "Failed to resolve import ../../src/stages/ozonation.js"

- [ ] **Step 3: Implémenter `src/stages/ozonation.js`**

```js
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

export function createOzonationStage() {
  let currentResidual = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      const target = targetResidual(settings.dose);
      currentResidual = applyLag(currentResidual, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.ozoneResidual = currentResidual;
      return water;
    },
  };
}

export function defaultOzonationSettings() {
  return { dose: 2 }; // mg/L
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/stages/ozonation.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stages/ozonation.js tests/stages/ozonation.test.js
git commit -m "feat: add ozonation stage"
```

---

### Task 6: Étape Dégazage

**Files:**
- Create: `src/stages/degazage.js`
- Test: `tests/stages/degazage.test.js`

- [ ] **Step 1: Écrire le test**

`tests/stages/degazage.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createDegazageStage } from '../../src/stages/degazage.js';

describe('DegazageStage', () => {
  it('removes most of the incoming ozone residual after enough time', () => {
    const stage = createDegazageStage();
    // l'eau amont reste constante (ozoneResidual = 2) ; seul l'état interne
    // de lissage de l'étape doit converger d'un tick à l'autre.
    const water = createWater({ ozoneResidual: 2 });
    let result;
    for (let i = 0; i < 20; i++) {
      result = stage.process(water, 5);
    }
    expect(result.ozoneResidual).toBeCloseTo(0.2, 2);
  });

  it('leaves other water properties unchanged', () => {
    const stage = createDegazageStage();
    const water = createWater({ ozoneResidual: 2, turbidity: 8, pH: 7.1 });
    const result = stage.process(water, 5);
    expect(result.turbidity).toBe(8);
    expect(result.pH).toBe(7.1);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/stages/degazage.test.js`
Expected: FAIL avec "Failed to resolve import ../../src/stages/degazage.js"

- [ ] **Step 3: Implémenter `src/stages/degazage.js`**

```js
import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const REMOVAL_FRACTION = 0.9; // fraction de l'ozone résiduel éliminée par dégazage
const TIME_CONSTANT_MINUTES = 5;

export function createDegazageStage() {
  let currentResidual = 0;

  return {
    process(waterIn, dtMinutes) {
      const water = cloneWater(waterIn);
      const target = waterIn.ozoneResidual * (1 - REMOVAL_FRACTION);
      currentResidual = applyLag(currentResidual, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.ozoneResidual = currentResidual;
      return water;
    },
  };
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/stages/degazage.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stages/degazage.js tests/stages/degazage.test.js
git commit -m "feat: add degazage stage"
```

---

### Task 7: Étape Décanteur Pulsator

**Files:**
- Create: `src/stages/decanteur.js`
- Test: `tests/stages/decanteur.test.js`

- [ ] **Step 1: Écrire le test**

`tests/stages/decanteur.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createDecanteurStage } from '../../src/stages/decanteur.js';

// L'eau brute entrante reste constante d'un tick à l'autre (conditions amont
// inchangées) ; seul l'état interne de lissage de l'étape évolue. Ne pas
// rechaîner la sortie comme entrée : ça simulerait un recyclage de l'eau sur
// elle-même, pas des conditions amont stables.
function runToSteadyState(stage, water, settings, ticks = 200, dt = 10) {
  let result;
  for (let i = 0; i < ticks; i++) {
    result = stage.process(water, settings, dt);
  }
  return result;
}

describe('DecanteurStage', () => {
  it('removes most turbidity at the optimal alun dose', () => {
    const stage = createDecanteurStage();
    const water = createWater({ turbidity: 20 });
    const result = runToSteadyState(stage, water, { alunDose: 10, polymerDose: 0.3 });
    expect(result.turbidity).toBeLessThan(2);
  });

  it('removes little turbidity when severely under-dosed', () => {
    const stage = createDecanteurStage();
    const water = createWater({ turbidity: 20 });
    const result = runToSteadyState(stage, water, { alunDose: 0, polymerDose: 0 });
    expect(result.turbidity).toBeCloseTo(20, 0);
  });

  it('removes little turbidity when severely over-dosed (restabilisation)', () => {
    const stage = createDecanteurStage();
    const water = createWater({ turbidity: 20 });
    const result = runToSteadyState(stage, water, { alunDose: 20, polymerDose: 0.3 });
    expect(result.turbidity).toBeCloseTo(20, 0);
  });

  it('changes gradually when the dose improves mid-run (delai de transit)', () => {
    const stage = createDecanteurStage();
    const water = createWater({ turbidity: 20 });
    // dosage sous-optimal en régime établi : la turbidité en sortie reste ~20
    const steady = runToSteadyState(stage, water, { alunDose: 0, polymerDose: 0 }, 50, 10);
    expect(steady.turbidity).toBeCloseTo(20, 0);

    // le dosage passe à l'optimal (eau brute toujours à 20 NTU) : la
    // turbidité ne chute pas instantanément
    const afterOneTick = stage.process(water, { alunDose: 10, polymerDose: 0.3 }, 10);
    expect(afterOneTick.turbidity).toBeLessThan(20);
    expect(afterOneTick.turbidity).toBeGreaterThan(2);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/stages/decanteur.test.js`
Expected: FAIL avec "Failed to resolve import ../../src/stages/decanteur.js"

- [ ] **Step 3: Implémenter `src/stages/decanteur.js`**

```js
import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const MAX_REMOVAL_RATE = 0.95; // taux de réduction de turbidité atteignable au dosage optimal
const TIME_CONSTANT_MINUTES = 90; // temps de séjour typique d'un décanteur Pulsator (~1-2h)

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

function optimalAlunDose(rawTurbidity) {
  return Math.min(40, Math.max(10, 0.5 * rawTurbidity));
}

export function createDecanteurStage() {
  let currentTurbidity = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      const optimalAlun = optimalAlunDose(waterIn.turbidity);
      const alunEfficiency = doseEfficiency(settings.alunDose, optimalAlun);
      const optimalPolymer = 0.03 * settings.alunDose;
      const polymerEfficiency = doseEfficiency(settings.polymerDose, optimalPolymer);

      // l'alun fait le gros du travail ; le polymère apporte un bonus
      // allant jusqu'à 20% d'efficacité supplémentaire
      const combinedEfficiency = alunEfficiency * (0.8 + 0.2 * polymerEfficiency);

      const target = waterIn.turbidity * (1 - MAX_REMOVAL_RATE * combinedEfficiency);
      currentTurbidity = applyLag(currentTurbidity, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.turbidity = currentTurbidity;
      return water;
    },
  };
}

export function defaultDecanteurSettings() {
  return { alunDose: 20, polymerDose: 0.6 }; // mg/L
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/stages/decanteur.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stages/decanteur.js tests/stages/decanteur.test.js
git commit -m "feat: add decanteur pulsator stage"
```

---

### Task 8: Étape Filtration gravitaire

**Files:**
- Create: `src/stages/filtration.js`
- Test: `tests/stages/filtration.test.js`

- [ ] **Step 1: Écrire le test**

`tests/stages/filtration.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createFiltrationStage } from '../../src/stages/filtration.js';

describe('FiltrationStage', () => {
  it('reduces turbidity at the reference filter speed', () => {
    const stage = createFiltrationStage();
    let water = createWater({ turbidity: 2, flow: 500 });
    for (let i = 0; i < 20; i++) {
      water = stage.process(water, { filterSpeed: 7 }, 5);
    }
    expect(water.turbidity).toBeLessThan(0.5);
  });

  it('accumulates headloss over time proportional to speed and turbidity', () => {
    const stage = createFiltrationStage();
    const water = createWater({ turbidity: 5, flow: 500 });
    stage.process(water, { filterSpeed: 7 }, 60);
    const first = stage.getHeadloss();
    stage.process(water, { filterSpeed: 7 }, 60);
    const second = stage.getHeadloss();
    expect(second).toBeGreaterThan(first);
  });

  it('drops flow to zero once headloss reaches the clogging threshold', () => {
    const stage = createFiltrationStage();
    let water = createWater({ turbidity: 20, flow: 500 });
    for (let i = 0; i < 200; i++) {
      water = stage.process(water, { filterSpeed: 10 }, 60);
    }
    expect(stage.getHeadloss()).toBeGreaterThanOrEqual(250);
    expect(water.flow).toBe(0);
  });

  it('resets headloss to zero after a backwash', () => {
    const stage = createFiltrationStage();
    let water = createWater({ turbidity: 20, flow: 500 });
    for (let i = 0; i < 200; i++) {
      water = stage.process(water, { filterSpeed: 10 }, 60);
    }
    stage.backwash();
    expect(stage.getHeadloss()).toBe(0);
  });

  it('lets an external event add headloss directly', () => {
    const stage = createFiltrationStage();
    stage.addHeadloss(100);
    expect(stage.getHeadloss()).toBe(100);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/stages/filtration.test.js`
Expected: FAIL avec "Failed to resolve import ../../src/stages/filtration.js"

- [ ] **Step 3: Implémenter `src/stages/filtration.js`**

```js
import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const MAX_HEADLOSS_KPA = 250; // colmatage complet : backwash requis
const HEADLOSS_RATE_COEFFICIENT = 0.02; // vitesse d'accumulation de la perte de charge
const TIME_CONSTANT_MINUTES = 3; // réponse rapide de la turbidité en sortie de filtre

function removalEfficiency(filterSpeed) {
  return Math.min(0.95, Math.max(0, 0.9 - 0.03 * (filterSpeed - 7)));
}

export function createFiltrationStage() {
  let currentTurbidity = 0;
  let headloss = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);

      headloss += HEADLOSS_RATE_COEFFICIENT * settings.filterSpeed * waterIn.turbidity * dtMinutes;

      if (headloss >= MAX_HEADLOSS_KPA) {
        water.flow = 0;
        water.turbidity = waterIn.turbidity; // percée : plus de traitement effectif
        currentTurbidity = water.turbidity;
        return water;
      }

      const efficiency = removalEfficiency(settings.filterSpeed);
      const target = waterIn.turbidity * (1 - efficiency);
      currentTurbidity = applyLag(currentTurbidity, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.turbidity = currentTurbidity;
      return water;
    },

    backwash() {
      headloss = 0;
    },

    addHeadloss(amountKPa) {
      headloss += amountKPa;
    },

    getHeadloss() {
      return headloss;
    },
  };
}

export function defaultFiltrationSettings() {
  return { filterSpeed: 7 }; // m/h
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/stages/filtration.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stages/filtration.js tests/stages/filtration.test.js
git commit -m "feat: add filtration stage with clogging and backwash"
```

---

### Task 9: Étape Chloration gazeuse

**Files:**
- Create: `src/stages/chloration.js`
- Test: `tests/stages/chloration.test.js`

- [ ] **Step 1: Écrire le test**

`tests/stages/chloration.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createChlorationStage } from '../../src/stages/chloration.js';

function runToSteadyState(stage, water, settings, ticks = 100, dt = 5) {
  let result = water;
  for (let i = 0; i < ticks; i++) {
    result = stage.process(result, settings, dt);
  }
  return result;
}

describe('ChlorationStage', () => {
  it('produces no residual when the dose is below the chlorine demand', () => {
    const stage = createChlorationStage();
    const water = createWater({ turbidity: 0.5 });
    const result = runToSteadyState(stage, water, { dose: 0.1 });
    expect(result.chlorineResidual).toBeCloseTo(0, 3);
  });

  it('produces a residual equal to dose minus demand once above demand', () => {
    const stage = createChlorationStage();
    const water = createWater({ turbidity: 0.5 });
    const result = runToSteadyState(stage, water, { dose: 1.5 });
    expect(result.chlorineResidual).toBeCloseTo(1.275, 2);
  });

  it('requires a higher dose to reach the same residual when turbidity is higher', () => {
    const stageLow = createChlorationStage();
    const stageHigh = createChlorationStage();
    const lowTurbidity = runToSteadyState(stageLow, createWater({ turbidity: 0.2 }), { dose: 1 });
    const highTurbidity = runToSteadyState(stageHigh, createWater({ turbidity: 5 }), { dose: 1 });
    expect(highTurbidity.chlorineResidual).toBeLessThan(lowTurbidity.chlorineResidual);
  });

  it('computes CT as residual times the contact time', () => {
    const stage = createChlorationStage();
    const water = createWater({ turbidity: 0.5 });
    const result = runToSteadyState(stage, water, { dose: 1.5 });
    expect(stage.getCT()).toBeCloseTo(result.chlorineResidual * 30, 2);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/stages/chloration.test.js`
Expected: FAIL avec "Failed to resolve import ../../src/stages/chloration.js"

- [ ] **Step 3: Implémenter `src/stages/chloration.js`**

```js
import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const BASE_DEMAND_MGL = 0.2; // demande en chlore de base
const DEMAND_PER_NTU = 0.05; // demande additionnelle par unité de turbidité résiduelle
const CONTACT_TIME_MINUTES = 30; // temps de contact du bassin de chloration
const TIME_CONSTANT_MINUTES = 8;

function chlorineDemand(turbidity) {
  return BASE_DEMAND_MGL + DEMAND_PER_NTU * turbidity;
}

export function createChlorationStage() {
  let currentResidual = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);
      const demand = chlorineDemand(waterIn.turbidity);
      const target = Math.max(0, settings.dose - demand);
      currentResidual = applyLag(currentResidual, target, TIME_CONSTANT_MINUTES, dtMinutes);
      water.chlorineResidual = currentResidual;
      return water;
    },

    getCT() {
      return currentResidual * CONTACT_TIME_MINUTES;
    },
  };
}

export function defaultChlorationSettings() {
  return { dose: 1.5 }; // mg/L
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/stages/chloration.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stages/chloration.js tests/stages/chloration.test.js
git commit -m "feat: add chloration stage with CT calculation"
```

---

### Task 10: Étape Réserve + pompage HP

**Files:**
- Create: `src/stages/reserve.js`
- Test: `tests/stages/reserve.test.js`

- [ ] **Step 1: Écrire le test**

`tests/stages/reserve.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createReserveStage } from '../../src/stages/reserve.js';

describe('ReserveStage', () => {
  it('computes the distributed flow from the pump pressure', () => {
    const stage = createReserveStage();
    const water = stage.process(createWater(), { pumpPressure: 6 }, 10);
    expect(water.flow).toBe(24);
  });

  it('smooths incoming turbidity and chlorine changes over time', () => {
    const stage = createReserveStage();
    const water = createWater({ turbidity: 5, chlorineResidual: 1 });
    const afterOneTick = stage.process(water, { pumpPressure: 6 }, 10);
    expect(afterOneTick.turbidity).toBeGreaterThan(0);
    expect(afterOneTick.turbidity).toBeLessThan(5);
  });

  it('converges to the incoming water quality after enough time', () => {
    const stage = createReserveStage();
    const water = createWater({ turbidity: 5, chlorineResidual: 1 });
    let result = water;
    for (let i = 0; i < 100; i++) {
      result = stage.process(water, { pumpPressure: 6 }, 10);
    }
    expect(result.turbidity).toBeCloseTo(5, 2);
    expect(result.chlorineResidual).toBeCloseTo(1, 2);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/stages/reserve.test.js`
Expected: FAIL avec "Failed to resolve import ../../src/stages/reserve.js"

- [ ] **Step 3: Implémenter `src/stages/reserve.js`**

```js
import { cloneWater } from '../water.js';
import { applyLag } from '../lag.js';

const TIME_CONSTANT_MINUTES = 60; // mélange dans le volume de la réserve
const PUMP_COEFFICIENT = 4; // L/min de débit distribué par bar de pression

export function createReserveStage() {
  let currentTurbidity = 0;
  let currentChlorine = 0;

  return {
    process(waterIn, settings, dtMinutes) {
      const water = cloneWater(waterIn);

      currentTurbidity = applyLag(currentTurbidity, waterIn.turbidity, TIME_CONSTANT_MINUTES, dtMinutes);
      currentChlorine = applyLag(currentChlorine, waterIn.chlorineResidual, TIME_CONSTANT_MINUTES, dtMinutes);

      water.turbidity = currentTurbidity;
      water.chlorineResidual = currentChlorine;
      water.flow = settings.pumpPressure * PUMP_COEFFICIENT;
      return water;
    },
  };
}

export function defaultReserveSettings() {
  return { pumpPressure: 6 }; // bar
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/stages/reserve.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/stages/reserve.js tests/stages/reserve.test.js
git commit -m "feat: add reserve and high-pressure pumping stage"
```

---

### Task 11: Moteur de simulation (orchestration du pipeline)

**Files:**
- Create: `src/simulation.js`
- Test: `tests/simulation.test.js`

- [ ] **Step 1: Écrire le test**

`tests/simulation.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createSimulation } from '../src/simulation.js';

describe('createSimulation', () => {
  it('runs a full pipeline tick and returns a water object with all properties', () => {
    const sim = createSimulation();
    const water = sim.tick(10);
    expect(water).toHaveProperty('flow');
    expect(water).toHaveProperty('turbidity');
    expect(water).toHaveProperty('chlorineResidual');
  });

  it('tracks elapsed simulated time across ticks', () => {
    const sim = createSimulation();
    sim.tick(10);
    sim.tick(15);
    expect(sim.getElapsedMinutes()).toBe(25);
  });

  it('applies a raw water override so it flows through the whole pipeline', () => {
    const sim = createSimulation();
    sim.setRawWater({ turbidity: 30 });
    let water;
    for (let i = 0; i < 300; i++) {
      water = sim.tick(10);
    }
    expect(water.turbidity).toBeGreaterThan(0);
  });

  it('lets settings be updated for a given stage', () => {
    const sim = createSimulation();
    sim.updateSettings('chloration', { dose: 3 });
    expect(sim.settings.chloration.dose).toBe(3);
  });

  it('exposes the filtration stage so the UI can trigger a backwash', () => {
    const sim = createSimulation();
    expect(typeof sim.stages.filtration.backwash).toBe('function');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/simulation.test.js`
Expected: FAIL avec "Failed to resolve import ../src/simulation.js"

- [ ] **Step 3: Implémenter `src/simulation.js`**

```js
import { createPuitsStage, defaultRawWater, defaultPuitsSettings } from './stages/puits.js';
import { createOzonationStage, defaultOzonationSettings } from './stages/ozonation.js';
import { createDegazageStage } from './stages/degazage.js';
import { createDecanteurStage, defaultDecanteurSettings } from './stages/decanteur.js';
import { createFiltrationStage, defaultFiltrationSettings } from './stages/filtration.js';
import { createChlorationStage, defaultChlorationSettings } from './stages/chloration.js';
import { createReserveStage, defaultReserveSettings } from './stages/reserve.js';

export function createSimulation() {
  const stages = {
    puits: createPuitsStage(),
    ozonation: createOzonationStage(),
    degazage: createDegazageStage(),
    decanteur: createDecanteurStage(),
    filtration: createFiltrationStage(),
    chloration: createChlorationStage(),
    reserve: createReserveStage(),
  };

  const settings = {
    puits: defaultPuitsSettings(),
    ozonation: defaultOzonationSettings(),
    decanteur: defaultDecanteurSettings(),
    filtration: defaultFiltrationSettings(),
    chloration: defaultChlorationSettings(),
    reserve: defaultReserveSettings(),
  };

  let rawWater = defaultRawWater();
  let elapsedMinutes = 0;

  function tick(dtMinutes) {
    elapsedMinutes += dtMinutes;

    let water = stages.puits.process(settings.puits, rawWater);
    water = stages.ozonation.process(water, settings.ozonation, dtMinutes);
    water = stages.degazage.process(water, dtMinutes);
    water = stages.decanteur.process(water, settings.decanteur, dtMinutes);
    water = stages.filtration.process(water, settings.filtration, dtMinutes);
    water = stages.chloration.process(water, settings.chloration, dtMinutes);
    water = stages.reserve.process(water, settings.reserve, dtMinutes);

    return water;
  }

  return {
    tick,
    settings,
    stages,
    getElapsedMinutes: () => elapsedMinutes,
    setRawWater(patch) {
      rawWater = { ...rawWater, ...patch };
    },
    updateSettings(stageName, patch) {
      settings[stageName] = { ...settings[stageName], ...patch };
    },
  };
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/simulation.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/simulation.js tests/simulation.test.js
git commit -m "feat: wire all stages into a simulation pipeline"
```

---

### Task 12: Moteur de scénarios et données de scénarios

**Files:**
- Create: `src/scenarios.js`
- Create: `data/scenarios/journee-normale.json`
- Create: `data/scenarios/pluie-et-crue.json`
- Create: `data/scenarios/panne-equipement.json`
- Test: `tests/scenarios.test.js`

- [ ] **Step 1: Écrire le test**

`tests/scenarios.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createScenarioEngine } from '../src/scenarios.js';

describe('createScenarioEngine', () => {
  const events = [
    { t: 120, type: 'panne_pompe_puits', payload: {} },
    { t: 45, type: 'turbidite_brute', payload: { valeur: 15 } },
  ];

  it('sorts events by time regardless of input order', () => {
    const engine = createScenarioEngine(events);
    const due = engine.collectDueEvents(45);
    expect(due).toHaveLength(1);
    expect(due[0].type).toBe('turbidite_brute');
  });

  it('returns events only once each', () => {
    const engine = createScenarioEngine(events);
    engine.collectDueEvents(45);
    const due = engine.collectDueEvents(200);
    expect(due).toHaveLength(1);
    expect(due[0].type).toBe('panne_pompe_puits');
  });

  it('reports finished once all events have fired', () => {
    const engine = createScenarioEngine(events);
    engine.collectDueEvents(200);
    expect(engine.isFinished()).toBe(true);
  });

  it('can be reset to replay from the start', () => {
    const engine = createScenarioEngine(events);
    engine.collectDueEvents(200);
    engine.reset();
    expect(engine.isFinished()).toBe(false);
    expect(engine.collectDueEvents(45)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/scenarios.test.js`
Expected: FAIL avec "Failed to resolve import ../src/scenarios.js"

- [ ] **Step 3: Implémenter `src/scenarios.js`**

```js
/**
 * Moteur de scénarios : lit une liste d'événements horodatés (scriptés, pas
 * aléatoires) et les déclenche au bon moment de la simulation.
 * Format d'un événement : { t: minutes, type: string, payload: object }
 */
export function createScenarioEngine(events) {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  let nextIndex = 0;

  return {
    collectDueEvents(elapsedMinutes) {
      const due = [];
      while (nextIndex < sorted.length && sorted[nextIndex].t <= elapsedMinutes) {
        due.push(sorted[nextIndex]);
        nextIndex += 1;
      }
      return due;
    },

    reset() {
      nextIndex = 0;
    },

    isFinished() {
      return nextIndex >= sorted.length;
    },
  };
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/scenarios.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Créer les fichiers de données de scénarios**

`data/scenarios/journee-normale.json`:
```json
{
  "name": "Journée normale",
  "events": []
}
```

`data/scenarios/pluie-et-crue.json`:
```json
{
  "name": "Pluie et crue",
  "events": [
    { "t": 30, "type": "turbidite_brute", "payload": { "valeur": 25 } },
    { "t": 90, "type": "turbidite_brute", "payload": { "valeur": 40 } },
    { "t": 240, "type": "turbidite_brute", "payload": { "valeur": 8 } }
  ]
}
```

`data/scenarios/panne-equipement.json`:
```json
{
  "name": "Panne d'équipement",
  "events": [
    { "t": 60, "type": "panne_pompe_puits", "payload": {} },
    { "t": 75, "type": "panne_resolue", "payload": {} },
    { "t": 150, "type": "colmatage_accelere", "payload": { "amountKPa": 100 } }
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add src/scenarios.js tests/scenarios.test.js data/scenarios
git commit -m "feat: add scenario engine and scripted scenario data"
```

---

### Task 13: Interface utilisateur et intégration finale

**Files:**
- Modify: `index.html`
- Create: `src/style.css`
- Create: `src/ui.js`
- Create: `src/main.js`

- [ ] **Step 1: Mettre à jour `index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Simulateur d'usine d'eau potable</title>
  <link rel="stylesheet" href="./src/style.css" />
</head>
<body>
  <header>
    <h1>Simulateur d'usine d'eau potable</h1>
    <div id="clock">
      <span id="clock-display">0h00</span>
      <button id="speed-1">×1</button>
      <button id="speed-10">×10</button>
      <button id="speed-60">×60</button>
      <button id="pause">Pause</button>
    </div>
  </header>

  <select id="scenario-select">
    <option value="journee-normale">Journée normale</option>
    <option value="pluie-et-crue">Pluie et crue</option>
    <option value="panne-equipement">Panne d'équipement</option>
  </select>

  <div id="schematic"></div>
  <div id="controls"></div>
  <div id="readouts"></div>
  <ul id="event-log"></ul>

  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Créer `src/style.css`**

```css
body { font-family: sans-serif; margin: 1rem; }
#schematic { display: flex; gap: 0.5rem; margin: 1rem 0; }
.stage-box { border: 2px solid #333; padding: 0.5rem; cursor: pointer; flex: 1; text-align: center; }
.stage-box.active { border-color: #2266cc; background: #eef4ff; }
.readout { padding: 0.25rem 0.5rem; border-radius: 4px; margin-bottom: 0.25rem; }
.readout.conforme { background: #d4f5d4; }
.readout.non-conforme { background: #f8d4d4; }
```

- [ ] **Step 3: Créer `src/ui.js`**

```js
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

export function renderControls(container, stageKey, settings, onChange) {
  container.innerHTML = '';
  if (!stageKey || !settings[stageKey]) return;

  Object.entries(settings[stageKey]).forEach(([field, value]) => {
    const label = document.createElement('label');
    label.textContent = `${field} : `;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.1';
    input.value = value;
    input.addEventListener('input', () => {
      onChange(stageKey, { [field]: Number(input.value) });
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
    { label: 'Turbidité', value: water.turbidity.toFixed(2), unit: 'NTU', threshold: THRESHOLDS.turbidity },
    { label: 'Chlore résiduel', value: water.chlorineResidual.toFixed(2), unit: 'mg/L', threshold: THRESHOLDS.chlorineResidual },
    { label: 'Perte de charge filtre', value: filtrationHeadloss.toFixed(0), unit: 'kPa' },
    { label: 'CT chloration', value: chlorationCT.toFixed(1), unit: 'mg·min/L' },
  ];

  rows.forEach((row) => {
    const div = document.createElement('div');
    div.className = 'readout';
    if (row.threshold) {
      div.classList.add(conformity(Number(row.value), row.threshold));
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
```

- [ ] **Step 4: Créer `src/main.js`**

```js
import { createSimulation } from './simulation.js';
import { createScenarioEngine } from './scenarios.js';
import {
  renderSchematic,
  setActiveStage,
  renderControls,
  renderReadouts,
  logEvent,
  updateClock,
} from './ui.js';

const TICK_MINUTES = 1;
const TICK_INTERVAL_MS = 500;
const DEFAULT_PUMP_FLOW = 500;

const simulation = createSimulation();
let scenarioEngine = createScenarioEngine([]);
let speedMultiplier = 1;
let paused = false;

const schematicEl = document.getElementById('schematic');
const controlsEl = document.getElementById('controls');
const readoutsEl = document.getElementById('readouts');
const eventLogEl = document.getElementById('event-log');
const clockEl = document.getElementById('clock-display');
const scenarioSelect = document.getElementById('scenario-select');

function handleSelectStage(stageKey) {
  setActiveStage(schematicEl, stageKey);
  renderControls(controlsEl, stageKey, simulation.settings, handleSettingsChange);
}

function handleSettingsChange(stageKey, patch) {
  if (stageKey === 'filtration:backwash') {
    simulation.stages.filtration.backwash();
    logEvent(eventLogEl, 'Backwash du filtre effectué');
    return;
  }
  simulation.updateSettings(stageKey, patch);
}

function applyScenarioEvent(event) {
  switch (event.type) {
    case 'turbidite_brute':
      simulation.setRawWater({ turbidity: event.payload.valeur });
      logEvent(eventLogEl, `Turbidité brute changée à ${event.payload.valeur} NTU`);
      break;
    case 'panne_pompe_puits':
      simulation.updateSettings('puits', { pumpFlow: 0 });
      logEvent(eventLogEl, 'Panne de la pompe du puits');
      break;
    case 'panne_resolue':
      simulation.updateSettings('puits', { pumpFlow: DEFAULT_PUMP_FLOW });
      logEvent(eventLogEl, 'Panne résolue, pompe redémarrée');
      break;
    case 'colmatage_accelere':
      simulation.stages.filtration.addHeadloss(event.payload.amountKPa);
      logEvent(eventLogEl, `Colmatage accéléré : +${event.payload.amountKPa} kPa de perte de charge`);
      break;
    default:
      logEvent(eventLogEl, `Événement inconnu : ${event.type}`);
  }
}

async function loadScenario(name) {
  const response = await fetch(`./data/scenarios/${name}.json`);
  const scenario = await response.json();
  scenarioEngine = createScenarioEngine(scenario.events);
  eventLogEl.innerHTML = '';
  logEvent(eventLogEl, `Scénario chargé : ${scenario.name}`);
}

function tick() {
  if (paused) return;
  const dt = TICK_MINUTES * speedMultiplier;
  const water = simulation.tick(dt);

  scenarioEngine.collectDueEvents(simulation.getElapsedMinutes()).forEach(applyScenarioEvent);

  renderReadouts(
    readoutsEl,
    water,
    simulation.stages.filtration.getHeadloss(),
    simulation.stages.chloration.getCT(),
  );
  updateClock(clockEl, simulation.getElapsedMinutes());
}

document.getElementById('speed-1').addEventListener('click', () => { speedMultiplier = 1; });
document.getElementById('speed-10').addEventListener('click', () => { speedMultiplier = 10; });
document.getElementById('speed-60').addEventListener('click', () => { speedMultiplier = 60; });
document.getElementById('pause').addEventListener('click', () => { paused = !paused; });
scenarioSelect.addEventListener('change', () => loadScenario(scenarioSelect.value));

renderSchematic(schematicEl, handleSelectStage);
loadScenario(scenarioSelect.value);
setInterval(tick, TICK_INTERVAL_MS);
```

- [ ] **Step 5: Vérification manuelle**

Run: `npx serve .` (ou `python -m http.server 8000`), puis ouvrir `http://localhost:3000` (ou `:8000`) dans un navigateur.

Vérifier :
- Les 7 étapes s'affichent dans le schéma.
- Cliquer sur « Chloration » affiche un champ `dose` ; changer sa valeur fait évoluer progressivement le readout « Chlore résiduel » (couleur verte si conforme, rouge sinon).
- Sélectionner le scénario « Pluie et crue » à vitesse ×60 : le readout « Turbidité » augmente après ~30 minutes simulées, conformément au journal d'événements affiché.
- Cliquer sur « Filtration » puis « Backwash » ramène immédiatement le readout « Perte de charge filtre » à 0.
- Sélectionner « Panne d'équipement » : le débit chute à 0 après l'événement `panne_pompe_puits`, puis reprend après `panne_resolue`.

- [ ] **Step 6: Commit**

```bash
git add index.html src/style.css src/ui.js src/main.js
git commit -m "feat: add process schematic, controls, and scenario UI"
```

---

## Hors périmètre (rappel du design)

- Suivi/score enseignant intégré
- Persistance des sessions au-delà du navigateur courant
- Événements aléatoires (uniquement scénarios scriptés)
- Modélisation physique rigoureuse (EDO, ASM1/ASM2d)
