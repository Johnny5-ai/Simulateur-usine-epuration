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
