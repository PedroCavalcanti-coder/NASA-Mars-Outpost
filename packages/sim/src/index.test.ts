import { describe, expect, it } from 'vitest';
import {
  type ActionId,
  checkAction,
  createMission,
  describeSim,
  type MissionState,
  RESEARCH_GOAL,
  runCommand,
} from './index';

const act = (s: MissionState, action: ActionId) => runCommand(s, { type: 'action', action });
const endSol = (s: MissionState) => runCommand(s, { type: 'end_sol' });

describe('sim', () => {
  it('descreve a simulação', () => {
    expect(describeSim()).toContain('Mars Outpost');
  });

  it('é determinística: mesma semente e comandos dão o mesmo estado', () => {
    const play = () => {
      let s = createMission(42);
      for (let i = 0; i < 6; i++) {
        s = act(s, 'expedition').state;
        s = act(s, 'research').state;
        s = endSol(s).state;
      }
      return s;
    };
    expect(play()).toEqual(play());
  });

  it('não altera o estado recebido', () => {
    const s = createMission(1);
    const snapshot = JSON.parse(JSON.stringify(s));
    act(s, 'research');
    endSol(s);
    expect(s).toEqual(snapshot);
  });

  it('pesquisa gasta energia, rende dados e consome uma ação', () => {
    const s = createMission(1);
    const { state } = act(s, 'research');
    expect(state.resources.energy.value).toBe(s.resources.energy.value - 12);
    expect(state.research).toBe(5);
    expect(state.actionsLeft).toBe(s.actionsLeft - 1);
  });

  it('bloqueia ações sem recursos, sem ações restantes ou em apagão', () => {
    const s = createMission(1);

    s.actionsLeft = 0;
    expect(checkAction(s, 'research').ok).toBe(false);

    const dark = createMission(1);
    dark.resources.energy.value = 0;
    expect(checkAction(dark, 'research')).toEqual({ ok: false, reason: 'Bloqueado: Apagão' });
  });

  it('crises tiram dados e moral, sem deixar a pesquisa negativa', () => {
    const s = createMission(1);
    s.facilities.solar = 0;
    s.resources.energy.value = 0;
    s.research = 2;
    const { state, entries } = endSol(s);
    expect(entries.some((e) => e.title === 'Crise: Apagão')).toBe(true);
    expect(state.research).toBe(0);
    expect(state.morale).toBeLessThan(s.morale);
  });

  it('vence ao chegar a 100% de dados com a base operacional', () => {
    const s = createMission(1);
    s.research = RESEARCH_GOAL - 3;
    const { state } = act(s, 'research');
    expect(state.research).toBe(RESEARCH_GOAL);
    expect(state.status).toBe('won');
    expect(act(state, 'research').error).toBe('Missão encerrada');
  });

  it('não vence com a base em crise, mesmo com a barra cheia', () => {
    const s = createMission(1);
    s.research = RESEARCH_GOAL;
    s.resources.supplies.value = 0;
    s.resources.armor.value = 30;
    const { state } = act(s, 'research');
    expect(state.status).toBe('playing');
  });

  it('perde quando a moral zera ou os sóis acabam', () => {
    const s = createMission(1);
    s.morale = 5;
    s.resources.supplies.value = 0;
    s.facilities.greenhouse = 0;
    expect(endSol(s).state).toMatchObject({ status: 'lost', lossReason: 'morale' });

    let t = createMission(7);
    for (let i = 0; i < 15; i++) t = endSol(t).state;
    expect(t.status).toBe('lost');
  });

  it('fim de sol em tempo real não mexe na energia nem na poeira', () => {
    const s0 = createMission(7);
    const s1 = runCommand(s0, { type: 'end_sol', realtime: true }).state;
    expect(s1.sol).toBe(2);
    expect(s1.resources.energy.value).toBe(s0.resources.energy.value);
    expect(s1.solarEfficiency).toBe(1);
    // mantimentos continuam sendo consumidos
    expect(s1.resources.supplies.value).toBeLessThan(s0.resources.supplies.value);
  });

  it('recompensa de tarefa: aplica só chaves válidas e registra no diário', () => {
    const s0 = createMission(7);
    const r = runCommand(s0, {
      type: 'reward',
      tone: 'good',
      title: 'Sondagem',
      text: 'Amostra coletada',
      deltas: { research: 8, energy: -5, bogus: 99 } as never,
    });
    expect(r.state.research).toBe(8);
    expect(r.state.resources.energy.value).toBe(s0.resources.energy.value - 5);
    expect(r.entries[0]?.title).toBe('Sondagem');
    expect(r.state.actionsLeft).toBe(s0.actionsLeft); // não gasta ação do sol
  });
});

describe('oxigênio da base', () => {
  it('oxigênio zerado encerra a missão ("não pode ser concluída")', () => {
    const s = createMission(1);
    s.resources.oxygen.value = 0;
    const r = runCommand(s, { type: 'check' });
    expect(r.state.status).toBe('lost');
    expect(r.state.lossReason).toBe('oxygen');
  });

  it('com oxigênio sobrando, a checagem não muda nada', () => {
    const s = createMission(1);
    const r = runCommand(s, { type: 'check' });
    expect(r.state.status).toBe('playing');
    expect(r.entries).toHaveLength(0);
  });
});

describe('blindagem', () => {
  it('começa em 100 e vem das fraturas do casco (recompensas não a alteram)', () => {
    const s = createMission(1);
    expect(s.resources.armor.value).toBe(100);
    const r = runCommand(s, {
      type: 'reward',
      tone: 'bad',
      title: 'Impacto',
      text: 'x',
      deltas: { armor: -130 },
    });
    expect(r.state.resources.armor.value).toBe(100);
  });
});

describe('envio de dados à Terra', () => {
  it('dados enviados ficam protegidos: perdas de pesquisa não passam do que foi enviado', () => {
    let s = createMission(1);
    s = runCommand(s, {
      type: 'reward',
      tone: 'good',
      title: 'a',
      text: 'a',
      deltas: { research: 14 },
    }).state;
    s = runCommand(s, { type: 'upload' }).state;
    expect(s.secured).toBe(14);
    s = runCommand(s, {
      type: 'reward',
      tone: 'good',
      title: 'b',
      text: 'b',
      deltas: { research: 6 },
    }).state;
    s = runCommand(s, {
      type: 'reward',
      tone: 'bad',
      title: 'c',
      text: 'c',
      deltas: { research: -30 },
    }).state;
    expect(s.research).toBe(14);
  });

  it('sem envio, os dados da base podem ser perdidos', () => {
    let s = createMission(1);
    s = runCommand(s, {
      type: 'reward',
      tone: 'good',
      title: 'a',
      text: 'a',
      deltas: { research: 10 },
    }).state;
    s = runCommand(s, {
      type: 'reward',
      tone: 'bad',
      title: 'c',
      text: 'c',
      deltas: { research: -4 },
    }).state;
    expect(s.research).toBe(6);
  });
});
