import type { GameplayMovement, GameplayState, GamePayload } from '@mars/shared';
import { describe, expect, it } from 'vitest';
import { GAME_EVENTS } from './eventRules';
import { addGameplayPlayer, applyGameplayCommand, createGameplay, stepGameplay } from './world';

const movement: GameplayMovement = {
  context: () => ({ x: 0, z: 0, inside: true, sheltered: false, driving: false, ready: true }),
  near: () => true,
  restrict: () => {},
  rescue: () => {},
};

function room(players: string[]) {
  let s: GameplayState = createGameplay(7, 'g', [2, 2, 2], [1]);
  // as tarefas da base só abrem como missão do dia: os testes ligam as que usam
  s.board.ids = ['solar_clean', 'air_filter', 'garden_care'];
  for (const id of players) addGameplayPlayer(s, id, id.toUpperCase());
  for (const id of players)
    s = applyGameplayCommand(s, id, { type: 'ready' }, movement, 'jezero', true).state;
  return s;
}
const run = (s: GameplayState, actor: string, payload: GamePayload) =>
  applyGameplayCommand(s, actor, payload, movement, 'jezero', actor === 'a');
const wait = (s: GameplayState, ms: number) => {
  for (let t = 0; t < ms; t += 100) stepGameplay(s, 100, movement, 'jezero');
};

describe('atividades com os minigames originais', () => {
  it('o resultado do minigame conclui a tarefa para a sala inteira', () => {
    let s = room(['a', 'b']);
    const start = run(s, 'a', { type: 'start', kind: 'solar', target: '0' });
    expect(start.code).toBeUndefined();
    s = start.state;
    const id = start.attempt!.id;
    wait(s, 2000);
    s = run(s, 'a', {
      type: 'actions',
      attempt: id,
      seq: 1,
      actions: [{ type: 'result', quality: 1 }],
    }).state;
    const done = run(s, 'a', { type: 'finish', attempt: id });
    expect(done.code).toBeUndefined();
    expect(done.state.solar[0]).toBe(0);
    expect(done.state.attempts[id]).toBeUndefined();
  });

  it('recusa resultado instantâneo (sem jogar)', () => {
    let s = room(['a']);
    const start = run(s, 'a', { type: 'start', kind: 'solar', target: '1' });
    s = start.state;
    const r = run(s, 'a', {
      type: 'actions',
      attempt: start.attempt!.id,
      seq: 1,
      actions: [{ type: 'result', quality: 1 }],
    });
    expect(r.code).toBe('INVALID_SEQUENCE');
  });

  it('reabrir o próprio minigame não acusa "alguém já está fazendo"', () => {
    let s = room(['a', 'b']);
    s = run(s, 'a', { type: 'start', kind: 'solar', target: '0' }).state;
    const again = run(s, 'a', { type: 'start', kind: 'solar', target: '0' });
    expect(again.code).toBeUndefined();
    expect(Object.keys(again.state.attempts)).toHaveLength(1);
  });

  it('outro jogador na mesma tarefa recebe BUSY e ela volta quando o primeiro desiste', () => {
    let s = room(['a', 'b']);
    const first = run(s, 'a', { type: 'start', kind: 'solar', target: '0' });
    s = first.state;
    expect(run(s, 'b', { type: 'start', kind: 'solar', target: '0' }).code).toBe('BUSY');
    s = run(s, 'a', { type: 'cancel', attempt: first.attempt!.id }).state;
    expect(run(s, 'b', { type: 'start', kind: 'solar', target: '0' }).code).toBeUndefined();
  });
});

describe('votação dos eventos', () => {
  const open = (s: GameplayState) => {
    const def = GAME_EVENTS[0]!;
    s.eventQueue.push({ id: def.id, eid: `1:${def.id}`, sol: 1 });
    return run(s, 'a', { type: 'event:open', eid: `1:${def.id}` }).state;
  };

  it('com 2 jogadores todos votam e o resultado sai quando os dois votam', () => {
    let s = open(room(['a', 'b']));
    expect(s.event?.mode).toBe('vote');
    s = run(s, 'a', { type: 'event:choose', eid: s.event!.eid, choice: 1 }).state;
    expect(s.event?.result).toBeNull();
    s = run(s, 'b', { type: 'event:choose', eid: s.event!.eid, choice: 1 }).state;
    expect(s.event?.result?.choice).toBe(1);
  });

  it('quem entra no meio da votação não vota', () => {
    let s = open(room(['a', 'b']));
    addGameplayPlayer(s, 'c', 'C');
    s = run(s, 'c', { type: 'ready' }).state;
    const r = run(s, 'c', { type: 'event:choose', eid: s.event!.eid, choice: 0 });
    expect(r.code).toBe('FORBIDDEN');
  });

  it('sem votos até o fim do tempo, o jogo sorteia uma opção válida', () => {
    const s = open(room(['a', 'b']));
    const choices = GAME_EVENTS.find((e) => e.id === s.event!.id)!.choices.length;
    wait(s, 31_000);
    expect(s.event?.result).not.toBeNull();
    expect(s.event!.result!.choice).toBeGreaterThanOrEqual(0);
    expect(s.event!.result!.choice).toBeLessThan(choices);
  });
});

describe('reconhecimento com o rover', () => {
  it('sai entre 2h e 16h e rende pesquisa na volta', () => {
    let s = room(['a']);
    s.board.ids = ['soil_robot'];
    const before = s.mission.research;
    const start = run(s, 'a', { type: 'start', kind: 'soil', target: '0' });
    expect(start.code).toBeUndefined();
    s = start.state;
    wait(s, 2000);
    s = run(s, 'a', {
      type: 'actions',
      attempt: start.attempt!.id,
      seq: 1,
      actions: [{ type: 'result', quality: 1 }],
    }).state;
    const done = run(s, 'a', { type: 'finish', attempt: start.attempt!.id });
    expect(done.code).toBeUndefined();
    expect(done.state.board.done).toContain('soil_robot');
    expect(done.state.mission.research).toBeGreaterThan(before);
    expect(done.state.players.a!.carrying).toBe(0);
  });

  it('fora da janela da manhã o rover não sai', () => {
    const s = room(['a']);
    s.board.ids = ['soil_robot'];
    s.elapsedMs = 600_000 * (8 / 24); // 9h + 8h = 17h (depois das 16h)
    expect(run(s, 'a', { type: 'start', kind: 'soil', target: '0' }).code).toBe('UNAVAILABLE');
  });
});

describe('recursos, pesquisa e consumo', () => {
  const finishStation = (s: GameplayState, id: string) => {
    s.board.ids = [id];
    const start = run(s, 'a', { type: 'start', kind: 'station', target: id });
    expect(start.code).toBeUndefined();
    s = start.state;
    wait(s, 2000);
    s = run(s, 'a', { type: 'actions', attempt: start.attempt!.id, seq: 1, actions: [{ type: 'result', quality: 1 }] }).state;
    const done = run(s, 'a', { type: 'finish', attempt: start.attempt!.id });
    expect(done.code).toBeUndefined();
    return done.state;
  };

  it('missão de manutenção devolve recursos e não dá pesquisa', () => {
    const s = room(['a']);
    s.mission.resources.energy.value = 50;
    const after = finishStation(s, 'power_audit');
    expect(after.mission.research).toBe(s.mission.research);
    expect(after.mission.resources.energy.value).toBeGreaterThan(50);
    expect(after.board.done).toContain('power_audit');
  });

  it('missão de pesquisa dá pesquisa e não pode ser repetida no mesmo Sol', () => {
    const s = room(['a']);
    const after = finishStation(s, 'lab_analysis');
    expect(after.mission.research).toBeGreaterThan(s.mission.research);
    expect(run(after, 'a', { type: 'start', kind: 'station', target: 'lab_analysis' }).code).toBe('UNAVAILABLE');
  });

  it('o consumo diário de mantimentos cresce com cada astronauta', () => {
    const spend = (players: string[]) => {
      const s = room(players);
      const before = s.mission.resources.supplies.value;
      wait(s, 60_000);
      return before - s.mission.resources.supplies.value;
    };
    const one = spend(['a']);
    const three = spend(['a', 'b', 'c']);
    expect(one).toBeGreaterThan(0);
    expect(three).toBeGreaterThan(one * 2.5);
  });

  it('eventos não dão pesquisa (viram suprimento)', () => {
    let s = room(['a']);
    const def = GAME_EVENTS.find((e) => e.choices.some((c) => (c.outcome.deltas?.research ?? 0) > 0 && !c.risk))!;
    const choice = def.choices.findIndex((c) => (c.outcome.deltas?.research ?? 0) > 0 && !c.risk);
    s.eventQueue.push({ id: def.id, eid: 'x', sol: 1 });
    s = run(s, 'a', { type: 'event:open', eid: 'x' }).state;
    const before = s.mission.research;
    s = run(s, 'a', { type: 'event:choose', eid: 'x', choice }).state;
    expect(s.mission.research).toBe(before);
    expect(s.event?.result?.outcome.deltas?.research).toBeUndefined();
  });

  it('comandos de dev só com permissão', () => {
    const s = room(['a']);
    expect(run(s, 'a', { type: 'dev', action: 'refill' }).code).toBe('FORBIDDEN');
    const ok = applyGameplayCommand(s, 'a', { type: 'dev', action: 'complete', id: 'drill' }, movement, 'jezero', true, true);
    expect(ok.code).toBeUndefined();
    expect(ok.state.board.done).toContain('drill');
  });
});

describe('missões do dia, horta, painéis e crítico', () => {
  it('cada tarefa marca a missão do dia correspondente', () => {
    let s = room(['a']);
    s.board.ids = ['air_filter', 'solar_clean'];
    const doTask = (kind: 'filter' | 'solar', target: string) => {
      const start = run(s, 'a', { type: 'start', kind, target });
      expect(start.code).toBeUndefined();
      s = start.state;
      wait(s, 2000);
      s = run(s, 'a', { type: 'actions', attempt: start.attempt!.id, seq: 1, actions: [{ type: 'result', quality: 1 }] }).state;
      s = run(s, 'a', { type: 'finish', attempt: start.attempt!.id }).state;
    };
    doTask('filter', '0');
    expect(s.board.done).toContain('air_filter');
    s.solar = [3, 2, 4];
    doTask('solar', '0');
    // um painel por minigame: a missão só fecha no segundo painel diferente
    expect(s.solar[0]).toBe(0);
    expect(s.solar[2]).toBeGreaterThan(3.9);
    expect(s.board.done).not.toContain('solar_clean');
    expect(run(s, 'a', { type: 'start', kind: 'solar', target: '0' }).code).toBe('UNAVAILABLE');
    doTask('solar', '2');
    expect(s.board.done).toContain('solar_clean');
  });

  it('cada irrigação cuida de um canteiro só', () => {
    let s = createGameplay(7, 'g', [0], Array.from({ length: 16 }, () => 1));
    addGameplayPlayer(s, 'a', 'A');
    s = applyGameplayCommand(s, 'a', { type: 'ready' }, movement, 'valles', true).state;
    s.board.ids = ['garden_care'];
    s.care.crops = s.crops.map(() => 0);
    const start = applyGameplayCommand(s, 'a', { type: 'start', kind: 'greenhouse', target: '9' }, movement, 'valles', true);
    expect(start.code).toBeUndefined();
    s = start.state;
    wait(s, 2000);
    s = applyGameplayCommand(s, 'a', { type: 'actions', attempt: start.attempt!.id, seq: 1, actions: [{ type: 'result', quality: 1, water: 4 }] }, movement, 'valles', true).state;
    s = applyGameplayCommand(s, 'a', { type: 'finish', attempt: start.attempt!.id }, movement, 'valles', true).state;
    // só o canteiro 9 foi regado; os outros continuam esperando
    expect(s.care.crops.filter((c) => c === 1)).toHaveLength(1);
    expect(s.care.crops[9]).toBe(1);
  });

  it('crítico de dutos: alerta, cobra oxigênio até ser limpo e o minigame resolve', () => {
    let s = room(['a']);
    s = applyGameplayCommand(s, 'a', { type: 'dev', action: 'critical', id: 'ducts' }, movement, 'jezero', true, true).state;
    wait(s, 500);
    expect(s.critical?.active).toBe(true);
    expect(s.mission.log[0]?.title).toContain('CRÍTICO');
    const start = run(s, 'a', { type: 'start', kind: 'ducts', target: 'ducts' });
    expect(start.code).toBeUndefined();
    s = start.state;
    wait(s, 2000);
    s = run(s, 'a', { type: 'actions', attempt: start.attempt!.id, seq: 1, actions: [{ type: 'result', quality: 1 }] }).state;
    s = run(s, 'a', { type: 'finish', attempt: start.attempt!.id }).state;
    expect(s.critical).toBeNull();
  });

  it('o crítico aparece em cerca de 30% dos Sóis', () => {
    let hits = 0;
    for (let sol = 2; sol < 302; sol++) if (seededChance(sol)) hits++;
    expect(hits / 300).toBeGreaterThan(0.2);
    expect(hits / 300).toBeLessThan(0.4);
  });
});

import { seeded } from './operations';
import { CRITICAL_CHANCE } from './world';
const seededChance = (sol: number) => seeded(7, sol, 777) < CRITICAL_CHANCE;

describe('água e oxigênio são missões', () => {
  it('só funcionam quando sorteadas e uma vez por dia', () => {
    let s = room(['a']);
    s.board.ids = ['lab_analysis'];
    expect(run(s, 'a', { type: 'interact', kind: 'moxie', target: '0' }).code).toBe('UNAVAILABLE');
    s.board.ids = ['oxygen_moxie', 'water_extract'];
    s = run(s, 'a', { type: 'interact', kind: 'moxie', target: '0' }).state;
    expect(s.board.done).toContain('oxygen_moxie');
    expect(run(s, 'a', { type: 'interact', kind: 'moxie', target: '0' }).code).toBe('UNAVAILABLE');
    s = run(s, 'a', { type: 'interact', kind: 'water', target: '0' }).state;
    expect(s.board.done).toContain('water_extract');
    expect(run(s, 'a', { type: 'interact', kind: 'water', target: '0' }).code).toBe('UNAVAILABLE');
  });
});

describe('reconhecimento exige chegar ao ponto amarelo', () => {
  it('longe do ponto o servidor recusa', () => {
    const s = room(['a']);
    s.board.ids = ['soil_robot'];
    const far = { ...movement, near: (_id: string, target: string) => target !== 'soil' };
    expect(applyGameplayCommand(s, 'a', { type: 'start', kind: 'soil', target: '0' }, far, 'jezero', true).code).toBe('TOO_FAR');
  });
});

describe('tarefas só como missão do dia', () => {
  it('filtro, horta e painéis fora do sorteio não abrem', () => {
    const s = room(['a']);
    s.board.ids = ['lab_analysis'];
    expect(run(s, 'a', { type: 'start', kind: 'filter', target: '0' }).code).toBe('UNAVAILABLE');
    expect(run(s, 'a', { type: 'start', kind: 'solar', target: '0' }).code).toBe('UNAVAILABLE');
  });
});

describe('nenhuma escolha grátis e radiação real', () => {
  it('toda opção segura de evento custa algo (a página do desafio pede isso)', () => {
    for (const e of GAME_EVENTS)
      for (const c of e.choices) {
        if (c.risk) continue;
        const cost =
          Object.values(c.outcome.deltas ?? {}).some((v) => (v ?? 0) < 0) ||
          (c.outcome.effects ?? []).some((f) => ['dose', 'dust', 'storm', 'clog_filter', 'wilt_crop'].includes(f.type));
        expect(cost, `${e.id} / ${c.id}`).toBe(true);
      }
  });

  it('a tempestade de radiação usa uma explosão solar real e "continuar trabalhando" dá mais dose', () => {
    const dose = (choice: number) => {
      let s = room(['a']);
      s.eventQueue.push({ id: 'radiation_storm', eid: '5:radiation_storm', sol: 1 });
      s = run(s, 'a', { type: 'event:open', eid: '5:radiation_storm' }).state;
      expect(s.event?.flare?.classType).toMatch(/^X/);
      const before = s.dose ?? 0;
      s = run(s, 'a', { type: 'event:choose', eid: '5:radiation_storm', choice }).state;
      return (s.dose ?? 0) - before;
    };
    expect(dose(2)).toBeGreaterThan(dose(0) * 5);
  });

  it('a radiação de fundo de Marte soma 0,64 mSv por Sol (RAD/Curiosity)', () => {
    const s = room(['a']);
    wait(s, 600_000);
    expect(s.dose).toBeCloseTo(0.64, 1);
  });
});

describe('horta como missão do dia', () => {
  it('no 1º Sol os canteiros plantados abrem, a missão pede todos e fecha no último', () => {
    let s = createGameplay(7, 'g', [0], Array.from({ length: 4 }, () => 1));
    addGameplayPlayer(s, 'a', 'A');
    s = applyGameplayCommand(s, 'a', { type: 'ready' }, movement, 'jezero', true).state;
    s.board.ids = ['garden_care'];
    for (let i = 0; i < 4 && !s.board.done.includes('garden_care'); i++) {
      const start = applyGameplayCommand(s, 'a', { type: 'start', kind: 'greenhouse', target: String(i) }, movement, 'jezero', true);
      if (start.code === 'UNAVAILABLE') continue; // já regado como par
      expect(start.code).toBeUndefined();
      s = start.state;
      wait(s, 2000);
      s = applyGameplayCommand(s, 'a', { type: 'actions', attempt: start.attempt!.id, seq: 1, actions: [{ type: 'result', quality: 1, water: 4 }] }, movement, 'jezero', true).state;
      s = applyGameplayCommand(s, 'a', { type: 'finish', attempt: start.attempt!.id }, movement, 'jezero', true).state;
    }
    expect(s.board.done).toContain('garden_care');
    expect(s.board.watered?.length).toBe(4);
  });
});
