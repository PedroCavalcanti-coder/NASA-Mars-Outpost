import { describe, expect, it } from 'vitest';
import {
  collectSample,
  DRILL,
  drillStep,
  initialDrill,
  layerAt,
  MAX_DEPTH,
  PROFILES,
  profileFor,
  targetLayer,
} from './drilling';
import {
  buildTasks,
  cropDead,
  drillDay,
  dustStage,
  dustStep,
  filterClogged,
  GRID,
  gridLoad,
  gridStep,
  panelDustRate,
  panelEfficiency,
  SOL_SECONDS,
  solarGeneration,
  type TaskInput,
} from './rules';

describe('painéis solares', () => {
  it('eficiência cai com a poeira até zero no painel coberto', () => {
    expect([0, 1, 2, 3, 4].map(panelEfficiency)).toEqual([1, 0.75, 0.5, 0.25, 0]);
  });

  it('cada painel tem o próprio ritmo de poeira, estável por semente', () => {
    const rates = [0, 1, 2, 3, 4, 5].map((i) => panelDustRate(123, i));
    expect(new Set(rates.map((r) => r.toFixed(4))).size).toBeGreaterThan(3);
    for (const r of rates) expect(r).toBeGreaterThanOrEqual(0.45);
    expect(panelDustRate(123, 2)).toBe(panelDustRate(123, 2));
  });

  it('tempestade acelera a poeira e ela para no painel coberto', () => {
    const calm = dustStep(0, 1, SOL_SECONDS / 2, 0);
    const storm = dustStep(0, 1, SOL_SECONDS / 2, 1);
    expect(calm).toBeCloseTo(0.5);
    expect(storm).toBeGreaterThan(calm * 5);
    expect(dustStep(3.9, 1, SOL_SECONDS * 10, 1)).toBe(4);
    expect(dustStage(2.99)).toBe(2);
  });
});

describe('rede elétrica e bateria', () => {
  it('painéis cobertos ou noite não geram nada', () => {
    expect(solarGeneration([4, 4, 4], 1, 0)).toBe(0);
    expect(solarGeneration([0, 0, 0], 0, 0)).toBe(0);
  });

  it('geração é proporcional à limpeza e independe do nº de painéis', () => {
    const full = solarGeneration([0, 0], 1, 0);
    expect(full).toBeCloseTo(gridLoad() * GRID.peakFactor);
    expect(solarGeneration([0, 0, 0, 0, 0, 0], 1, 0)).toBeCloseTo(full);
    expect(solarGeneration([0, 4], 1, 0)).toBeCloseTo(full / 2);
    expect(solarGeneration([0, 0], 1, 1)).toBeLessThan(full * 0.3);
  });

  it('sem geração a bateria segura a base; zerada vira apagão; com sol volta a carregar', () => {
    let r = gridStep(10, 120, 0, (10 / gridLoad()) * 0.5);
    expect(r.battery).toBeCloseTo(5);
    expect(r.blackout).toBe(false);
    r = gridStep(r.battery, 120, 0, 1000);
    expect(r.battery).toBe(0);
    expect(r.blackout).toBe(true);
    r = gridStep(0, 120, gridLoad() * 2, 10);
    expect(r.battery).toBeGreaterThan(0);
    expect(r.blackout).toBe(false);
    expect(gridStep(119, 120, 5, 100).battery).toBe(120);
  });
});

describe('horta e filtro', () => {
  it('canteiro sem cuidado no Sol anterior morre; plantar conta como cuidado', () => {
    expect(cropDead(2, 3, 4)).toBe(false); // cuidado ontem
    expect(cropDead(2, 2, 4)).toBe(true); // pulou o Sol 3
    expect(cropDead(0, 0, 9)).toBe(false); // vazio não morre
    expect(cropDead(1, 0, 1)).toBe(false); // canteiro inicial no Sol 1
    expect(cropDead(1, 0, 2)).toBe(true);
  });

  it('filtro sem troca no Sol anterior fica entupido', () => {
    expect(filterClogged(0, 1)).toBe(false);
    expect(filterClogged(1, 2)).toBe(false);
    expect(filterClogged(1, 3)).toBe(true);
  });
});

describe('tarefas do Sol', () => {
  const base: TaskInput = {
    sol: 3,
    seed: 99,
    panelStages: [0, 2, 4, 1],
    panelsCleanedToday: [],
    cropStages: [1, 0, 3],
    cropNames: ['Batata', 'Alface', 'Tomate'],
    cropCare: [3, 0, 2],
    filterSol: 2,
    drillDoneSol: 0,
  };

  it('filtro e canteiros plantados todo dia; painéis só quando sujos', () => {
    const tasks = buildTasks(base);
    const kinds = tasks.map((t) => t.kind);
    expect(kinds[0]).toBe('filter');
    expect(tasks.filter((t) => t.kind === 'crop')).toHaveLength(1);
    expect(tasks.find((t) => t.kind === 'crop')?.done).toBe(false);
    expect(tasks.find((t) => t.kind === 'crop')?.title).toBe('Irrigar a estufa');
    expect(tasks.filter((t) => t.kind === 'solar').map((t) => t.index)).toEqual([1, 2]);
    expect(kinds).toContain('plant');
  });

  it('painel limpo hoje aparece como concluído', () => {
    const tasks = buildTasks({ ...base, panelStages: [0, 0, 4, 1], panelsCleanedToday: [1] });
    expect(tasks.find((t) => t.id.startsWith('solar-1'))?.done).toBe(true);
  });

  it('sondagem acontece no Sol 1 e em parte dos outros Sóis', () => {
    expect(drillDay(5, 1)).toBe(true);
    const days = Array.from({ length: 200 }, (_, i) => drillDay(5, i + 2)).filter(Boolean).length;
    expect(days).toBeGreaterThan(80);
    expect(days).toBeLessThan(140);
  });
});

describe('sondagem', () => {
  it('todos os perfis cobrem 0..200 cm sem buracos', () => {
    for (const profile of Object.values(PROFILES)) {
      expect(profile[0]?.from).toBe(0);
      expect(profile[profile.length - 1]?.to).toBe(MAX_DEPTH);
      for (let i = 1; i < profile.length; i++) expect(profile[i]?.from).toBe(profile[i - 1]?.to);
    }
  });

  it('alvo do dia nunca é o regolito da superfície', () => {
    for (let sol = 1; sol < 40; sol++)
      expect(targetLayer('utopia', 7, sol).id).not.toBe('regolito');
  });

  it('perfurar sem parar superaquece e trava; parado esfria e destrava', () => {
    const profile = profileFor('olympus');
    let s = initialDrill();
    for (let i = 0; i < 400 && !s.jammed; i++) s = drillStep(s, profile, true, 0.05);
    expect(s.jammed).toBe(true);
    const stuck = s.depth;
    s = drillStep(s, profile, true, 0.05);
    expect(s.depth).toBe(stuck);
    for (let i = 0; i < 100 && s.jammed; i++) s = drillStep(s, profile, false, 0.1);
    expect(s.jammed).toBe(false);
    expect(s.heat).toBeLessThanOrEqual(DRILL.resume);
  });

  it('amostra na camada certa rende mais, com bônus no meio da camada', () => {
    const profile = profileFor('jezero');
    const target = profile.find((l) => l.id === 'argila')!;
    const mid = collectSample((target.from + target.to) / 2, profile, target);
    const edge = collectSample(target.from + 1, profile, target);
    const miss = collectSample(5, profile, target);
    expect(mid.hit).toBe(true);
    expect(mid.research).toBeGreaterThan(edge.research);
    expect(miss.hit).toBe(false);
    expect(miss.research).toBeLessThan(edge.research);
    expect(layerAt(profile, 5).id).toBe('regolito');
  });
});
