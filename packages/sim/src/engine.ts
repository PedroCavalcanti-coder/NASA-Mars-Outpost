import {
  ACTIONS,
  ACTIONS_PER_SOL,
  CRISIS_INFO,
  CRISIS_PENALTY,
  ECONOMY,
  EVENT_CHANCE,
  EXPEDITION,
  FACILITY_MAX,
  MAINTAIN_MORALE,
  MAX_SOLS,
  MINE_YIELD,
  RESEARCH_ACTION,
  RESEARCH_GOAL,
} from './balance';
import { rollEvent } from './events';
import { random, randomInt } from './rng';
import { change, cloneState, crises, isOperational, pushLog, RESOURCE_IDS } from './state';
import type {
  ActionId,
  CheckResult,
  Command,
  DeltaKey,
  Deltas,
  LogEntry,
  MissionState,
  ResourceId,
} from './types';

const RESOURCE_NAMES: Record<ResourceId, string> = {
  energy: 'energia',
  supplies: 'mantimentos',
  materials: 'materiais',
  oxygen: 'oxigênio',
};

/** A ação pode ser feita agora? Se não, devolve o motivo para a interface mostrar. */
export function checkAction(s: MissionState, id: ActionId): CheckResult {
  const def = ACTIONS[id];
  if (s.status !== 'playing') return { ok: false, reason: 'Missão encerrada' };
  if (s.actionsLeft <= 0) return { ok: false, reason: 'Sem ações neste sol: encerre o sol' };
  const blocked = def.blockedBy.find((c) => crises(s).includes(c));
  if (blocked) return { ok: false, reason: `Bloqueado: ${CRISIS_INFO[blocked].name}` };
  if (def.builds && s.facilities[def.builds] >= FACILITY_MAX[def.builds]) {
    return { ok: false, reason: 'Limite de instalações atingido' };
  }
  for (const r of RESOURCE_IDS) {
    const cost = def.cost[r] ?? 0;
    if (s.resources[r].value < cost) return { ok: false, reason: `Falta ${RESOURCE_NAMES[r]}` };
  }
  return { ok: true };
}

/** Energia e mantimentos que a base ganha (ou perde) ao fim do sol, antes de eventos. */
export function solForecast(s: MissionState): { energy: number; supplies: number } {
  const f = s.facilities;
  return {
    energy:
      Math.round(f.solar * ECONOMY.solarOutput * s.solarEfficiency) -
      ECONOMY.lifeSupport -
      f.lab * ECONOMY.labUpkeep,
    supplies: f.greenhouse * ECONOMY.greenhouseOutput - ECONOMY.crewFood,
  };
}

function performAction(s: MissionState, id: ActionId) {
  const def = ACTIONS[id];
  const deltas: Deltas = {};
  const cost: Deltas = {};
  for (const r of RESOURCE_IDS) if (def.cost[r]) cost[r] = -(def.cost[r] ?? 0);
  change(s, cost, deltas);
  s.actionsLeft -= 1;

  if (def.builds) {
    s.facilities[def.builds] += 1;
    pushLog(s, { tone: 'info', title: `${def.name} construído`, text: def.description, deltas });
    return;
  }

  switch (id) {
    case 'research': {
      const gain =
        RESEARCH_ACTION.base +
        RESEARCH_ACTION.perExtraLab * Math.max(0, s.facilities.lab - 1) -
        (s.morale < 30 ? RESEARCH_ACTION.lowMoralePenalty : 0);
      change(s, { research: gain }, deltas);
      pushLog(s, {
        tone: 'good',
        title: 'Pesquisa concluída',
        text: 'Amostras analisadas e dados enviados à Terra.',
        deltas,
      });
      return;
    }
    case 'expedition': {
      const chance = EXPEDITION.successChance - (s.morale < 40 ? EXPEDITION.lowMoralePenalty : 0);
      const roll = random(s);
      if (roll < chance) {
        const [r0, r1] = EXPEDITION.success.research;
        const [m0, m1] = EXPEDITION.success.materials;
        change(s, { research: randomInt(s, r0, r1), materials: randomInt(s, m0, m1) }, deltas);
        pushLog(s, {
          tone: 'good',
          title: 'Expedição bem-sucedida',
          text: 'O rover voltou com amostras inéditas e minerais úteis.',
          deltas,
        });
      } else if (roll >= 1 - EXPEDITION.criticalChance) {
        const c = EXPEDITION.critical;
        change(s, { research: -c.research, morale: -c.morale, energy: -c.energy }, deltas);
        pushLog(s, {
          tone: 'bad',
          title: 'Falha crítica na expedição',
          text: 'O rover atolou numa duna e o resgate corrompeu os registros da missão.',
          deltas,
        });
      } else {
        const f = EXPEDITION.failure;
        change(s, { research: -f.research, morale: -f.morale }, deltas);
        pushLog(s, {
          tone: 'bad',
          title: 'Expedição fracassada',
          text: 'Uma pane no rover perdeu parte das amostras coletadas.',
          deltas,
        });
      }
      return;
    }
    case 'mine': {
      change(s, { materials: randomInt(s, MINE_YIELD[0], MINE_YIELD[1]) }, deltas);
      pushLog(s, {
        tone: 'good',
        title: 'Escavação',
        text: 'Regolito processado em materiais de construção.',
        deltas,
      });
      return;
    }
    case 'maintain': {
      s.solarEfficiency = 1;
      change(s, { morale: MAINTAIN_MORALE }, deltas);
      pushLog(s, {
        tone: 'good',
        title: 'Manutenção',
        text: 'Painéis limpos (100% de eficiência) e sistemas revisados.',
        deltas,
      });
      return;
    }
  }
}

function endSol(s: MissionState, realtime = false) {
  // 1) produção e consumo (em tempo real, a energia já entrou/saiu da bateria ao longo do sol)
  const forecast = solForecast(s);
  const economy = change(s, realtime ? { supplies: forecast.supplies } : forecast);
  pushLog(s, {
    tone: 'info',
    title: `Fim do sol ${s.sol}`,
    text: realtime
      ? 'Relatório diário: consumo de mantimentos da tripulação.'
      : `Painéis a ${Math.round(s.solarEfficiency * 100)}% de eficiência.`,
    deltas: economy,
  });

  // 2) poeira se acumula (em tempo real, cada painel tem a própria sujeira)
  if (!realtime)
    s.solarEfficiency = Math.max(
      ECONOMY.minSolarEfficiency,
      s.solarEfficiency - ECONOMY.dustPerSol,
    );

  // 3) evento do sol
  if (s.sol >= 2 && random(s) < EVENT_CHANCE) pushLog(s, rollEvent(s));

  // 4) crises de recursos
  const active = crises(s);
  for (const c of active) {
    const p = CRISIS_PENALTY[c];
    pushLog(s, {
      tone: 'bad',
      title: `Crise: ${CRISIS_INFO[c].name}`,
      text: CRISIS_INFO[c].effect,
      deltas: change(s, { research: -p.research, morale: -p.morale }),
    });
  }
  if (!active.length) change(s, { morale: ECONOMY.moraleRecovery });

  s.sol += 1;
  s.actionsLeft = ACTIONS_PER_SOL;
}

function checkOutcome(s: MissionState) {
  if (s.status !== 'playing') return;
  if (s.research >= RESEARCH_GOAL && isOperational(s)) {
    s.status = 'won';
    pushLog(s, {
      tone: 'good',
      title: 'Missão cumprida!',
      text: 'A base coletou todos os dados científicos da campanha.',
      deltas: {},
    });
  } else if (s.morale <= 0) {
    s.status = 'lost';
    s.lossReason = 'morale';
    pushLog(s, {
      tone: 'bad',
      title: 'Base evacuada',
      text: 'A moral da tripulação chegou a zero e a missão foi abortada.',
      deltas: {},
    });
  } else if (s.sol > MAX_SOLS) {
    s.status = 'lost';
    s.lossReason = 'deadline';
    s.sol = MAX_SOLS;
    pushLog(s, {
      tone: 'bad',
      title: 'Janela de retorno',
      text: `Os ${MAX_SOLS} sóis da campanha acabaram antes de a pesquisa ser concluída.`,
      deltas: {},
    });
  }
}

const REWARD_KEYS = new Set<DeltaKey>([...RESOURCE_IDS, 'research', 'morale']);

/** Recompensa de tarefa: só chaves conhecidas e números finitos (limitados a ±100). */
function applyReward(s: MissionState, cmd: Extract<Command, { type: 'reward' }>) {
  const clean: Deltas = {};
  for (const [k, v] of Object.entries(cmd.deltas ?? {}) as [DeltaKey, number][]) {
    if (REWARD_KEYS.has(k) && Number.isFinite(v)) clean[k] = Math.max(-100, Math.min(100, v));
  }
  const deltas = change(s, clean);
  pushLog(s, {
    tone: cmd.tone === 'bad' || cmd.tone === 'good' ? cmd.tone : 'info',
    title: String(cmd.title).slice(0, 80),
    text: String(cmd.text).slice(0, 240),
    deltas,
  });
}

export interface CommandResult {
  state: MissionState;
  /** registros criados por este comando (mais antigo primeiro) */
  entries: LogEntry[];
  error?: string;
}

/** Executa um comando sem alterar o estado recebido (função pura e determinística). */
export function runCommand(prev: MissionState, cmd: Command): CommandResult {
  if (cmd.type === 'action') {
    const check = checkAction(prev, cmd.action);
    if (!check.ok) return { state: prev, entries: [], error: check.reason };
  } else if (prev.status !== 'playing') {
    return { state: prev, entries: [], error: 'Missão encerrada' };
  }

  const s = cloneState(prev);
  if (cmd.type === 'action') performAction(s, cmd.action);
  else if (cmd.type === 'reward') applyReward(s, cmd);
  else endSol(s, cmd.realtime === true);
  checkOutcome(s);

  const entries = s.log.slice(0, s.nextLogId - prev.nextLogId).reverse();
  return { state: s, entries };
}

/** Diferença total entre dois estados (para animar a HUD). */
export function diffState(a: MissionState, b: MissionState): Deltas {
  const d: Deltas = {};
  for (const r of RESOURCE_IDS) {
    const v = b.resources[r].value - a.resources[r].value;
    if (v) d[r] = v;
  }
  if (b.research !== a.research) d.research = b.research - a.research;
  if (b.morale !== a.morale) d.morale = b.morale - a.morale;
  return d;
}
