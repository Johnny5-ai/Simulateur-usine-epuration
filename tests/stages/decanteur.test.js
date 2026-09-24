import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createDecanteurStage } from '../../src/stages/decanteur.js';

const NOMINAL_FLOW = 500; // vitesse ascensionnelle nominale de 2,5 m/h

const doses = (patch = {}) => ({ alunDose: 10, polymerDose: 0.3, limeDose: 0, purgeDuty: 3.5, ...patch });
const raw = (patch = {}) => createWater({ flow: NOMINAL_FLOW, temperature: 12, ...patch });

// L'eau brute entrante reste constante d'un tick à l'autre (conditions amont
// inchangées) ; seul l'état interne de lissage de l'étape évolue. Ne pas
// rechaîner la sortie comme entrée : ça simulerait un recyclage de l'eau sur
// elle-même, pas des conditions amont stables.
// La purge suit la consigne d'équilibre à chaque tick, comme le ferait un
// exploitant attentif : sans ça le voile dérive et on ne mesure plus la chimie
// mais l'accumulation de boue.
function runToSteadyState(stage, water, settings, ticks = 200, dt = 10) {
  let result;
  let purgeDuty = settings.purgeDuty;
  for (let i = 0; i < ticks; i++) {
    result = stage.process(water, { ...settings, purgeDuty }, dt);
    purgeDuty = stage.getBalancedPurgeDuty();
  }
  return result;
}

describe('DecanteurStage', () => {
  // Un décanteur ne fait pas de l'eau potable, il fait de l'eau filtrable : 1 à
  // 3 NTU en sortie de Pulsator est un bon fonctionnement. C'est le filtre en
  // aval qui doit descendre sous 0,3 NTU, et il ne le peut que si on lui livre
  // ça. Attendre mieux du décanteur reviendrait à lui demander le travail du filtre.
  it('removes most turbidity at the optimal alun dose', () => {
    const stage = createDecanteurStage();
    const result = runToSteadyState(stage, raw({ turbidity: 20 }), doses());
    expect(result.turbidity).toBeLessThan(3);
    expect(result.turbidity).toBeLessThan(0.2 * 20);
  });

  it('removes little turbidity when severely under-dosed', () => {
    const stage = createDecanteurStage();
    const result = runToSteadyState(stage, raw({ turbidity: 20 }), doses({ alunDose: 0, polymerDose: 0 }));
    expect(result.turbidity).toBeCloseTo(20, 0);
  });

  it('removes little turbidity when severely over-dosed (restabilisation)', () => {
    const stage = createDecanteurStage();
    const result = runToSteadyState(stage, raw({ turbidity: 20 }), doses({ alunDose: 20 }));
    expect(result.turbidity).toBeCloseTo(20, 0);
  });

  it('consumes alkalinity and lowers the pH in proportion to the alun dose', () => {
    const stage = createDecanteurStage();
    const result = stage.process(raw({ turbidity: 20, pH: 7.2, alkalinity: 40 }), doses(), 10);
    // 0,5 mg CaCO3 detruit par mg d'alun : 40 - 0,5 x 10 = 35
    expect(result.alkalinity).toBeCloseTo(35, 5);
    expect(result.pH).toBeLessThan(7.2);
    expect(result.pH).toBeGreaterThan(6.5);
  });

  it('drops the pH much further on a soft water than on a buffered one', () => {
    const soft = createDecanteurStage();
    const buffered = createDecanteurStage();
    const settings = doses({ alunDose: 20, polymerDose: 0.6 });
    const softResult = soft.process(raw({ turbidity: 40, alkalinity: 20 }), settings, 10);
    const bufferedResult = buffered.process(raw({ turbidity: 40, alkalinity: 150 }), settings, 10);
    expect(softResult.pH).toBeLessThan(bufferedResult.pH - 0.5);
  });

  it('coagulates poorly once the alun has driven the pH out of its window', () => {
    const soft = createDecanteurStage();
    const buffered = createDecanteurStage();
    // dose optimale pour 80 NTU dans les deux cas : seule l'alcalinité diffère
    const settings = doses({ alunDose: 40, polymerDose: 1.2 });
    const softResult = runToSteadyState(soft, raw({ turbidity: 80, alkalinity: 10 }), settings);
    const bufferedResult = runToSteadyState(buffered, raw({ turbidity: 80, alkalinity: 150 }), settings);
    expect(softResult.pH).toBeLessThan(6);
    expect(softResult.turbidity).toBeGreaterThan(5 * bufferedResult.turbidity);
  });

  it('restores alkalinity and raises the pH when lime is dosed', () => {
    const stage = createDecanteurStage();
    const result = stage.process(raw({ turbidity: 20, pH: 7.2, alkalinity: 40 }), doses({ limeDose: 4 }), 10);
    // 40 - 0,5 x 10 + 1,35 x 4 = 40,4
    expect(result.alkalinity).toBeCloseTo(40.4, 5);
    expect(result.pH).toBeGreaterThan(7.2);
  });

  it('lets lime rescue the coagulation pH of a soft water', () => {
    const withoutLime = createDecanteurStage();
    const withLime = createDecanteurStage();
    const soft = () => raw({ turbidity: 20, pH: 7.2, alkalinity: 10 });
    const bare = withoutLime.process(soft(), doses(), 10);
    const limed = withLime.process(soft(), doses({ limeDose: 2 }), 10);
    expect(bare.pH).toBeLessThan(6.5);
    expect(limed.pH).toBeGreaterThan(6.5);
  });

  it('pushes the pH above the aesthetic limit when lime is over-dosed', () => {
    const stage = createDecanteurStage();
    const result = stage.process(raw({ turbidity: 20, pH: 7.2, alkalinity: 40 }), doses({ limeDose: 10 }), 10);
    expect(result.pH).toBeGreaterThan(8.5);
  });

  // Coagulation renforcée : c'est ici qu'on gagne la bataille des sous-produits
  // chlorés, en enlevant le précurseur avant d'ajouter le chlore.
  it('removes more TOC as the alun dose rises', () => {
    const low = createDecanteurStage();
    const high = createDecanteurStage();
    const source = () => raw({ turbidity: 20, toc: 8 });
    const lowDose = low.process(source(), doses(), 10);
    const highDose = high.process(source(), doses({ alunDose: 30, polymerDose: 0.9 }), 10);
    expect(lowDose.toc).toBeLessThan(8);
    expect(highDose.toc).toBeLessThan(lowDose.toc);
  });

  it('removes less TOC once lime has raised the coagulation pH', () => {
    const bare = createDecanteurStage();
    const limed = createDecanteurStage();
    const source = () => raw({ turbidity: 20, toc: 8 });
    const without = bare.process(source(), doses({ alunDose: 20, polymerDose: 0.6 }), 10);
    const with5 = limed.process(source(), doses({ alunDose: 20, polymerDose: 0.6, limeDose: 5 }), 10);
    expect(with5.toc).toBeGreaterThan(without.toc);
  });

  // La coagulation emporte d'abord la fraction aromatique du COT : ce qui
  // reste est moins abondant ET moins réactif. C'est pour ça qu'on mesure
  // toujours un abattement de THM supérieur à l'abattement de COT.
  it('leaves behind a TOC that is less reactive than the one it received', () => {
    const stage = createDecanteurStage();
    const result = stage.process(raw({ turbidity: 20, toc: 8 }), doses({ alunDose: 30, polymerDose: 0.9 }), 10);
    expect(result.precursorFraction).toBeLessThan(1);
    expect(result.precursorFraction * result.toc).toBeLessThan(0.5 * 8);
  });

  it('changes gradually when the dose improves mid-run (delai de transit)', () => {
    const stage = createDecanteurStage();
    const water = raw({ turbidity: 20 });
    // dosage sous-optimal en régime établi : la turbidité en sortie reste ~20
    const steady = runToSteadyState(stage, water, doses({ alunDose: 0, polymerDose: 0 }), 50, 10);
    expect(steady.turbidity).toBeCloseTo(20, 0);

    // le dosage passe à l'optimal (eau brute toujours à 20 NTU) : la
    // turbidité ne chute pas instantanément
    const afterOneTick = stage.process(water, doses(), 10);
    expect(afterOneTick.turbidity).toBeLessThan(20);
    expect(afterOneTick.turbidity).toBeGreaterThan(2);
  });
});

// Le voile de boue est l'organe du Pulsator : sans lui le bassin ne fait que
// laisser passer l'eau, et trop épais il part aux goulottes avec toute sa boue.
describe('DecanteurStage — voile de boue', () => {
  it('starts at the working height rather than empty', () => {
    const stage = createDecanteurStage();
    expect(stage.getBlanketHeight()).toBeCloseTo(1.5, 2);
  });

  // Pompe du puits en panne : le bassin ne reçoit plus rien. Le voile n'est
  // alors ni trop bas ni trop haut, il est simplement décanté — l'annoncer
  // hors consigne serait une fausse alarme sur un organe à l'arrêt.
  it('reports no effective height while the clarifier is not being fed', () => {
    const stage = createDecanteurStage();
    stage.process(raw({ flow: 0 }), doses(), 10);
    expect(stage.getEffectiveBlanketHeight()).toBeNull();
    expect(stage.getBlanketHeight()).toBeGreaterThan(0);

    stage.process(raw(), doses(), 10);
    expect(stage.getEffectiveBlanketHeight()).toBeGreaterThan(0);
  });

  it('grows when the purge is too small and shrinks when it is too large', () => {
    const grows = createDecanteurStage();
    const shrinks = createDecanteurStage();
    const water = raw({ turbidity: 20 });
    for (let i = 0; i < 100; i += 1) {
      grows.process(water, doses({ purgeDuty: 0 }), 10);
      shrinks.process(water, doses({ purgeDuty: 100 }), 10);
    }
    expect(grows.getBlanketHeight()).toBeGreaterThan(1.5);
    expect(shrinks.getBlanketHeight()).toBeLessThan(1.5);
  });

  it('holds the blanket steady at the balanced purge duty', () => {
    const stage = createDecanteurStage();
    const water = raw({ turbidity: 20 });
    let purgeDuty = 3.5;
    for (let i = 0; i < 200; i += 1) {
      stage.process(water, doses({ purgeDuty }), 10);
      purgeDuty = stage.getBalancedPurgeDuty();
    }
    expect(stage.getBlanketHeight()).toBeGreaterThan(1.4);
    expect(stage.getBlanketHeight()).toBeLessThan(1.7);
  });

  // Une eau claire fortement coagulée fabrique quand même de la boue : c'est
  // l'hydroxyde d'aluminium de l'alun lui-même.
  it('still produces sludge on a clear water because the alun makes its own', () => {
    const stage = createDecanteurStage();
    stage.process(raw({ turbidity: 0 }), doses({ alunDose: 30, polymerDose: 0.9 }), 10);
    expect(stage.getBalancedPurgeDuty()).toBeGreaterThan(0);
  });

  it('loses the blanket entirely when purged flat out, and stops clarifying', () => {
    const stage = createDecanteurStage();
    const water = raw({ turbidity: 20 });
    let result;
    for (let i = 0; i < 400; i += 1) {
      result = stage.process(water, doses({ purgeDuty: 100 }), 10);
    }
    expect(stage.getBlanketHeight()).toBe(0);
    expect(result.turbidity).toBeCloseTo(20, 0);
  });

  // Pousser la production dilate le voile : le forcer pour remplir la réserve
  // se paie au décanteur avant de se payer au filtre.
  it('expands the blanket when the flow is pushed above nominal', () => {
    const stage = createDecanteurStage();
    stage.process(raw({ turbidity: 20, flow: 1000 }), doses(), 1);
    expect(stage.getUpflowVelocity()).toBeCloseTo(5, 2);
    expect(stage.getEffectiveBlanketHeight()).toBeGreaterThan(stage.getBlanketHeight());
  });

  it('carries the blanket over to the filters once it reaches the launders', () => {
    const tidy = createDecanteurStage();
    const overgrown = createDecanteurStage();
    const water = raw({ turbidity: 20 });
    for (let i = 0; i < 400; i += 1) overgrown.process(water, doses({ purgeDuty: 0 }), 10);
    const clean = runToSteadyState(tidy, water, doses(), 60, 10);
    const dirty = overgrown.process(water, doses({ purgeDuty: 0 }), 10);
    expect(overgrown.getEffectiveBlanketHeight()).toBeGreaterThan(2.1);
    expect(dirty.turbidity).toBeGreaterThan(clean.turbidity);
  });
});

// Le froid est la contrainte saisonnière que tout exploitant connaît : même
// eau, même dose, moins bon résultat — et la parade est de doser plus.
describe('DecanteurStage — eau froide', () => {
  it('clarifies less well in cold water at an unchanged dose', () => {
    const warm = createDecanteurStage();
    const cold = createDecanteurStage();
    const warmResult = runToSteadyState(warm, raw({ turbidity: 20, temperature: 12 }), doses());
    const coldResult = runToSteadyState(cold, raw({ turbidity: 20, temperature: 2 }), doses());
    expect(coldResult.turbidity).toBeGreaterThan(warmResult.turbidity);
  });

  it('is largely rescued by raising the alun dose, as a plant does in winter', () => {
    const asIs = createDecanteurStage();
    const rescued = createDecanteurStage();
    const water = raw({ turbidity: 20, temperature: 2 });
    const before = runToSteadyState(asIs, water, doses());
    const after = runToSteadyState(rescued, water, doses({ alunDose: 14, polymerDose: 0.42 }));
    expect(after.turbidity).toBeLessThan(before.turbidity);
  });
});
