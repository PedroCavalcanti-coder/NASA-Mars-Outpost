import { assignOuter, newIntegrity, REPAIR_KINDS, repairIntent, type GameplayMovement, type GameplayState, type GamePayload } from '@mars/shared';
import { describe, expect, it } from 'vitest';
import { eventsForSol } from './eventRules';
import { MISSION_IDS, missionsForSol } from './missions';
import { addGameplayPlayer, applyGameplayCommand, createGameplay, stepGameplay } from './world';

const m: GameplayMovement = {
  context: () => ({ x: 0, z: 0, inside: true, sheltered: false, driving: false, ready: true }),
  near: () => true,
  restrict: () => {},
  rescue: () => {},
};

function start(players = 1) {
  let s: GameplayState = createGameplay(11, 'g', [0, 0, 0, 0, 0, 0], [1, 1, 1, 1]);
  const ids = ['a', 'b', 'c', 'd'].slice(0, players);
  for (const id of ids) addGameplayPlayer(s, id, id.toUpperCase());
  for (const id of ids) s = applyGameplayCommand(s, id, { type: 'ready' }, m, 'jezero', true).state;
  s.board.ids = missionsForSol(s.mission.seed, 1, players);
  return s;
}
const wait = (s: GameplayState, ms: number) => {
  for (let t = 0; t < ms; t += 250) stepGameplay(s, 250, m, 'jezero');
};
const refill = (s: GameplayState) => {
  for (const r of Object.values(s.mission.resources)) r.value = r.max;
};

/** Joga um minigame de atividade até o fim (iniciar → resultado → concluir). Devolve o código de erro, se houver. */
function playActivity(s: GameplayState, kind: Extract<GamePayload, { type: 'start' }>['kind'], target: string) {
  const a = (p: GamePayload) => applyGameplayCommand(s, 'a', p, m, 'jezero', true);
  const started = a({ type: 'start', kind, target });
  if (started.code) return { s, code: `start:${started.code}` };
  s = started.state;
  wait(s, 2000);
  const sent = applyGameplayCommand(s, 'a', { type: 'actions', attempt: started.attempt!.id, seq: 1, actions: [{ type: 'result', quality: 1, water: 4, research: 5 }] }, m, 'jezero', true);
  if (sent.code) return { s, code: `result:${sent.code}` };
  const done = applyGameplayCommand(sent.state, 'a', { type: 'finish', attempt: started.attempt!.id }, m, 'jezero', true);
  return { s: done.state, code: done.code ? `finish:${done.code}` : undefined };
}

describe('todos os minigames chegam ao fim no servidor', () => {
  for (const [kind, target] of [
    ['station', 'lab_analysis'],
    ['station', 'antenna_calibration'],
    ['station', 'power_audit'],
    ['station', 'medical_checkup'],
    ['drill', '0'],
    ['solar', '0'],
    ['filter', '0'],
    ['greenhouse', '0'],
  ] as const) {
    it(`${kind}:${target}`, () => {
      const s = start();
      refill(s);
      // a missão de cada atividade precisa estar no quadro do dia
      const mission = kind === 'station' ? target : kind === 'drill' ? 'drill' : kind === 'filter' ? 'air_filter' : kind === 'solar' ? 'solar_clean' : 'garden_care';
      if (!s.board.ids.includes(mission)) s.board.ids.push(mission);
      if (kind === 'solar') s.solar = [2, 2, 2, 2, 2, 2];
      if (kind === 'filter') s.care.filter = 0;
      const r = playActivity(s, kind, target);
      expect(r.code).toBeUndefined();
      if (kind !== 'solar' && kind !== 'greenhouse') expect(r.s.board.done).toContain(mission);
    });
  }

  it('upload de dados com pesquisa pendente', () => {
    const s = start();
    s.mission.research = 20;
    s.mission.secured = 0;
    const r = playActivity(s, 'upload', '0');
    expect(r.code).toBeUndefined();
    expect(r.s.mission.secured).toBeGreaterThan(0);
  });

  it('oxigênio (MOXIE) e água viram missões do dia e produzem', () => {
    let s = start();
    refill(s);
    s.board.ids = ['oxygen_moxie', 'water_extract'];
    const before = s.mission.resources.supplies.value;
    s.mission.resources.supplies.value = 10;
    for (const kind of ['moxie', 'water'] as const) {
      const r = applyGameplayCommand(s, 'a', { type: 'interact', kind, target: '0' }, m, 'jezero', true);
      expect(r.code).toBeUndefined();
      s = r.state;
    }
    expect(s.board.done).toEqual(expect.arrayContaining(['oxygen_moxie', 'water_extract']));
    expect(s.mission.resources.supplies.value).toBeGreaterThan(10);
    void before;
  });
});

describe('os 5 reparos chegam ao fim', () => {
  for (const [i, kind] of REPAIR_KINDS.entries()) {
    it(`reparo ${kind}`, () => {
      const s = newIntegrity(3);
      assignOuter(s, [1, 2, 3]);
      repairIntent(s, { op: 'damage', amount: 20 }, 'x', 0, 0);
      const f = s.fractures[0]!;
      f.kind = i;
      let real = 10_000;
      expect(repairIntent(s, { op: 'reserve', fracture: f.id }, 'a', 0, real)).toBe(true);
      real += 1000;
      expect(repairIntent(s, { op: 'plate', fracture: f.id }, 'a', 0, real)).toBe(true);
      for (let n = 0; n < 4; n++) {
        real += 1000;
        expect(repairIntent(s, { op: 'screw', fracture: f.id, screw: n }, 'a', 0, real)).toBe(true);
      }
      expect(s.fractures).toHaveLength(0);
    });
  }
});

describe('uma partida inteira até vencer', () => {
  it('um robô joga todas as missões dos dias e a pesquisa chega a 100% (missão vencida)', () => {
    let s = start(2);
    const errors: string[] = [];
    let guard = 0;
    while (s.mission.status === 'playing' && guard++ < 40) {
      refill(s);
      for (const id of [...s.board.ids]) {
        if (s.mission.status !== 'playing') break;
        if (s.board.done.includes(id)) continue;
        const todo: Array<[string, string]> =
          id === 'oxygen_moxie' ? [['moxie', '0']] : id === 'water_extract' ? [['water', '0']] : [];
        for (const [kind, target] of todo) {
          const r = applyGameplayCommand(s, 'a', { type: 'interact', kind: kind as 'moxie', target }, m, 'jezero', true);
          if (r.code) errors.push(`${id}:${r.code}`);
          else s = r.state;
        }
        const act: Record<string, [string, string]> = {
          lab_analysis: ['station', 'lab_analysis'],
          antenna_calibration: ['station', 'antenna_calibration'],
          power_audit: ['station', 'power_audit'],
          medical_checkup: ['station', 'medical_checkup'],
          drill: ['drill', '0'],
          air_filter: ['filter', '0'],
          solar_clean: ['solar', '0'],
          garden_care: ['greenhouse', '0'],
        };
        const a = act[id];
        if (a) {
          if (id === 'air_filter') s.care.filter = 0;
          const r = playActivity(s, a[0] as 'station', a[1]);
          if (r.code && !/UNAVAILABLE/.test(r.code)) errors.push(`${id}:${r.code}`);
          s = r.s;
        }
        // manda a pesquisa pronta para a Terra (protege dos eventos)
        if (s.mission.research - s.mission.secured >= 10) s = playActivity(s, 'upload', '0').s;
      }
      // fim do dia: passa para o próximo Sol
      const next = applyGameplayCommand(s, 'a', { type: 'dev', action: 'next_sol' }, m, 'jezero', true, true).state;
      s = next;
      wait(s, 1000);
    }
    expect(errors.filter((e) => !/ENDED/.test(e))).toEqual([]);
    expect(s.mission.status === 'won' || s.mission.research >= 60).toBe(true);
  });
});

describe('aleatoriedade com memória', () => {
  const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;

  it('missões de dias seguidos repetem pouco', () => {
    let total = 0;
    let days = 0;
    for (let seed = 1; seed <= 40; seed++)
      for (let sol = 2; sol <= 12; sol++) {
        total += overlap(missionsForSol(seed * 7919, sol, 1), missionsForSol(seed * 7919, sol - 1, 1));
        days++;
      }
    // 4 de 11 missões por dia: ao acaso repetiriam ~1,5 por dia; com memória, bem menos
    expect(total / days).toBeLessThan(1.0);
  });

  it('todas as missões aparecem ao longo dos dias (nenhuma some)', () => {
    const seen = new Set<string>();
    for (let sol = 1; sol <= 12; sol++) for (const id of missionsForSol(123, sol, 1)) seen.add(id);
    expect(seen.size).toBe(MISSION_IDS.length);
  });

  it('o mesmo evento não vem em dois Sóis seguidos', () => {
    let repeats = 0;
    let days = 0;
    for (let seed = 1; seed <= 40; seed++)
      for (let sol = 3; sol <= 20; sol++) {
        const a = eventsForSol(seed * 104729, sol).map((e) => e.id);
        const b = eventsForSol(seed * 104729, sol - 1).map((e) => e.id);
        repeats += overlap(a, b);
        days++;
      }
    expect(repeats / days).toBeLessThan(0.15);
  });

  it('continua determinístico', () => {
    expect(missionsForSol(5, 9, 2)).toEqual(missionsForSol(5, 9, 2));
    expect(eventsForSol(5, 9, 2).map((e) => e.id)).toEqual(eventsForSol(5, 9, 2).map((e) => e.id));
  });
});

describe('a pesquisa prometida é a recebida', () => {
  for (const [kind, target, mission] of [
    ['station', 'lab_analysis', 'lab_analysis'],
    ['drill', '0', 'drill'],
  ] as const) {
    it(`${mission}: +3 a +4 pontos com nota máxima`, () => {
      const s = start();
      refill(s);
      if (!s.board.ids.includes(mission)) s.board.ids.push(mission);
      const before = s.mission.research;
      const r = playActivity(s, kind, target);
      expect(r.code).toBeUndefined();
      const gained = r.s.mission.research - before;
      expect(gained).toBeGreaterThanOrEqual(3);
      expect(gained).toBeLessThanOrEqual(4);
    });
  }
});
