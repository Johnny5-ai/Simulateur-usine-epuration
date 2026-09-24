import { describe, it, expect } from 'vitest';
import { createWater } from '../../src/water.js';
import { createFiltrationStage } from '../../src/stages/filtration.js';

describe('FiltrationStage', () => {
  it('reduces turbidity at the reference filtration rate', () => {
    const stage = createFiltrationStage();
    let water = createWater({ turbidity: 2, flow: 500 });
    for (let i = 0; i < 20; i++) {
      water = stage.process(water, { filtersInService: 3 }, 5);
    }
    expect(water.turbidity).toBeLessThan(0.5);
  });

  it('derives the filtration rate from the flow and the filters in service', () => {
    const stage = createFiltrationStage();

    stage.process(createWater({ turbidity: 1, flow: 500 }), { filtersInService: 3 }, 1);
    expect(stage.getFiltrationRate()).toBeCloseTo(6.67, 1);

    // doubler le débit double la vitesse de filtration à surface constante
    stage.process(createWater({ turbidity: 1, flow: 1000 }), { filtersInService: 3 }, 1);
    expect(stage.getFiltrationRate()).toBeCloseTo(13.33, 1);

    // sortir une cuve du service augmente aussi la vitesse
    stage.process(createWater({ turbidity: 1, flow: 500 }), { filtersInService: 2 }, 1);
    expect(stage.getFiltrationRate()).toBeCloseTo(10, 1);
  });

  it('accumulates headloss over time proportional to rate and turbidity', () => {
    const stage = createFiltrationStage();
    const water = createWater({ turbidity: 5, flow: 500 });
    stage.process(water, { filtersInService: 3 }, 60);
    const first = stage.getHeadloss();
    stage.process(water, { filtersInService: 3 }, 60);
    const second = stage.getHeadloss();
    expect(second).toBeGreaterThan(first);
  });

  it('drops flow to zero once headloss reaches the clogging threshold', () => {
    const stage = createFiltrationStage();
    // eau décantée constante en amont : rechaîner la sortie ferait chuter la
    // charge en solides à chaque tick et la perte de charge plafonnerait.
    const influent = createWater({ turbidity: 20, flow: 500 });
    let water;
    for (let i = 0; i < 200; i++) {
      water = stage.process(influent, { filtersInService: 2 }, 60);
    }
    expect(stage.getHeadloss()).toBeGreaterThanOrEqual(2.5);
    expect(water.flow).toBe(0);

    // Un filtre fermé ne se colmate plus : rien ne le traverse. Sa perte de
    // charge et sa vitesse restent où elles se sont arrêtées.
    const figee = stage.getHeadloss();
    stage.process(influent, { filtersInService: 2 }, 60);
    expect(stage.getHeadloss()).toBe(figee);
    expect(stage.getFiltrationRate()).toBe(0);
  });

  // Colmatage et percée sont deux fins de cycle distinctes : le colmatage est
  // hydraulique (le débit tombe, l'eau qui sort reste filtrée), la percée est
  // qualitative (le débit ne bouge pas, la turbidité monte).
  it('is still filtering at the moment it clogs, having not yet broken through', () => {
    const stage = createFiltrationStage();
    // 6,7 m/h : à cette vitesse le colmatage arrive bien avant la percée
    const influent = createWater({ turbidity: 2, flow: 500 });
    let water;
    for (let i = 0; i < 4000; i++) {
      water = stage.process(influent, { filtersInService: 3 }, 1);
      if (water.flow === 0) break;
    }
    expect(water.flow).toBe(0);
    expect(stage.getBedLoading()).toBeLessThan(1);
    expect(water.turbidity).toBeLessThan(0.5);
  });

  it('passes full flow while the turbidity climbs once the media breaks through', () => {
    const stage = createFiltrationStage();
    // 1 cuve à 500 L/min = 20 m/h : le lit ne retient plus rien à cette vitesse
    const influent = createWater({ turbidity: 5, flow: 500 });
    let water;
    for (let i = 0; i < 60; i++) {
      water = stage.process(influent, { filtersInService: 1 }, 1);
    }
    expect(stage.getBedLoading()).toBeGreaterThanOrEqual(1);
    expect(stage.getHeadloss()).toBeLessThan(25);
    expect(water.flow).toBe(500);
    expect(water.turbidity).toBeCloseTo(5, 1);
  });

  it('breaks through before clogging when pushed fast, and clogs first when slow', () => {
    const cycle = (flow, filters) => {
      const stage = createFiltrationStage();
      const influent = createWater({ turbidity: 2, flow });
      let clogAt = null;
      let breakAt = null;
      for (let t = 1; t <= 4000 && !(clogAt && breakAt); t++) {
        const out = stage.process(influent, { filtersInService: filters }, 1);
        if (!breakAt && stage.getBedLoading() >= 1) breakAt = t;
        if (!clogAt && out.flow === 0) clogAt = t;
      }
      return { clogAt, breakAt };
    };

    // Mené doucement, il se ferme avant d'avoir saturé son média : la percée
    // n'arrive jamais, le débit tombe et l'exploitant est prévenu.
    const slow = cycle(500, 3); // 6,7 m/h
    expect(slow.clogAt).not.toBeNull();
    expect(slow.breakAt).toBeNull();

    // Poussé vite, il perce d'abord : le débit ne bouge pas, rien n'avertit,
    // et c'est la turbidité qui part. C'est le cas dangereux.
    const fast = cycle(1000, 3); // 13,3 m/h
    expect(fast.breakAt).not.toBeNull();
    expect(fast.breakAt).toBeLessThan(fast.clogAt ?? Infinity);
  });

  it('resets the media loading as well as the headloss after a backwash', () => {
    const stage = createFiltrationStage();
    const influent = createWater({ turbidity: 20, flow: 500 });
    for (let i = 0; i < 50; i++) {
      stage.process(influent, { filtersInService: 2 }, 10);
    }
    expect(stage.getBedLoading()).toBeGreaterThan(0);
    stage.backwash();
    expect(stage.getBedLoading()).toBe(0);
  });

  it('resets headloss to zero after a backwash', () => {
    const stage = createFiltrationStage();
    const influent = createWater({ turbidity: 20, flow: 500 });
    for (let i = 0; i < 200; i++) {
      stage.process(influent, { filtersInService: 2 }, 60);
    }
    stage.backwash();
    expect(stage.getHeadloss()).toBe(0);
  });

  it('lets an external event add headloss directly', () => {
    const stage = createFiltrationStage();
    stage.addHeadloss(10);
    expect(stage.getHeadloss()).toBe(10);
  });

  it('keeps a full compliance record while the effluent stays under 0,3 NTU', () => {
    const stage = createFiltrationStage();
    const influent = createWater({ turbidity: 2, flow: 500 });
    for (let i = 0; i < 600; i++) {
      stage.process(influent, { filtersInService: 3 }, 1);
    }
    expect(stage.getEffluentTurbidity()).toBeLessThan(0.3);
    expect(stage.getTurbidityCompliance()).toBe(100);
  });

  // Une percée se voit tout de suite au turbidimètre de filtre, alors que la
  // réserve la lisserait sur une heure.
  it('drops the compliance record when the media breaks through', () => {
    const stage = createFiltrationStage();
    const influent = createWater({ turbidity: 5, flow: 500 });
    for (let i = 0; i < 200; i++) {
      stage.process(influent, { filtersInService: 1 }, 1);
    }
    expect(stage.getPeakTurbidity()).toBeGreaterThan(1);
    expect(stage.getTurbidityCompliance()).toBeLessThan(95);
  });

  // Le registre couvre le mois : laver le filtre ne réécrit pas l'historique.
  it('does not clear the compliance record on a backwash', () => {
    const stage = createFiltrationStage();
    const influent = createWater({ turbidity: 5, flow: 500 });
    for (let i = 0; i < 200; i++) {
      stage.process(influent, { filtersInService: 1 }, 1);
    }
    const before = stage.getTurbidityCompliance();
    stage.backwash();
    expect(stage.getTurbidityCompliance()).toBe(before);
    expect(stage.getPeakTurbidity()).toBeGreaterThan(1);
  });

  // Un filtre colmaté ne produit pas d'eau, donc pas de mesure : sinon une usine
  // à l'arrêt accumulerait une conformité parfaite.
  it('stops recording measurements once the filter has clogged', () => {
    const stage = createFiltrationStage();
    const influent = createWater({ turbidity: 20, flow: 500 });
    let water;
    for (let i = 0; i < 200; i++) {
      water = stage.process(influent, { filtersInService: 2 }, 60);
      if (water.flow === 0) break;
    }
    expect(water.flow).toBe(0);
    const stalled = stage.getTurbidityCompliance();
    for (let i = 0; i < 100; i++) {
      stage.process(influent, { filtersInService: 2 }, 60);
    }
    expect(stage.getTurbidityCompliance()).toBe(stalled);
  });
});
