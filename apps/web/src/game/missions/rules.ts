/**
 * Missões de pesquisa (funções puras, sem Three.js nem React).
 *
 * Cada Sol sorteia poucas missões, conforme o número de jogadores na sala: sozinho são 2 por dia
 * (tarefa para uma pessoa só); com 4 astronautas, 5. Todas têm um custo em recursos da base:
 * sem recurso suficiente a missão não pode ser feita. O sorteio depende só da semente da sala e
 * do Sol, então todos os jogadores veem as mesmas missões.
 */

import { seeded } from '../tasks/rules';

export type CostKey = 'energy' | 'supplies' | 'oxygen';
export type MissionCost = Partial<Record<CostKey, number>>;

export type MissionId =
  | 'soil_robot'
  | 'drill'
  | 'lab_analysis'
  | 'antenna_calibration'
  | 'power_audit'
  | 'medical_checkup';

/** Onde a missão acontece no mundo. */
export type MissionSite =
  | 'rover'
  | 'soil'
  | 'drill'
  | 'lab'
  | 'comms'
  | 'power'
  | 'medical'
  | 'rest'
  | 'upload';

/** Pontos fixos com holograma na base (o rover e a sonda já são objetos do cenário). */
export type StationSite = Extract<
  MissionSite,
  'lab' | 'comms' | 'power' | 'medical' | 'rest' | 'upload'
>;

export interface MissionDef {
  id: MissionId;
  title: string;
  summary: string;
  site: MissionSite;
  cost: MissionCost;
  /** pontos de pesquisa (a sondagem varia com a camada coletada) */
  research: number;
  morale?: number;
  /** não pode ser iniciada à noite (frio, pouca luz) */
  daytimeOnly: boolean;
  /** peso no sorteio */
  weight: number;
  /** missão pesada: no máximo uma por dia */
  heavy?: boolean;
}

export const MISSIONS: Record<MissionId, MissionDef> = {
  soil_robot: {
    id: 'soil_robot',
    title: 'Coleta de solo com o rover',
    summary:
      'Entre no rover, dirija até o ponto marcado e colha as amostras num minigame. Depois leve-as a um computador da base. Em dupla (motorista e passageiro) custa o dobro, rende o triplo de pontos e o minigame é dos dois.',
    site: 'soil',
    cost: { energy: 20, supplies: 10, oxygen: 14 },
    research: 2,
    morale: 3,
    daytimeOnly: true,
    weight: 3,
    heavy: true,
  },
  drill: {
    id: 'drill',
    title: 'Sondagem do subsolo',
    summary: 'Use a sonda de perfuração para coletar a camada que a ciência pediu.',
    site: 'drill',
    cost: { energy: 6, supplies: 2 },
    research: 2,
    daytimeOnly: false,
    weight: 3,
  },
  lab_analysis: {
    id: 'lab_analysis',
    title: 'Análise de amostras no laboratório',
    summary: 'Rode as amostras da base na bancada do laboratório e registre os resultados.',
    site: 'lab',
    cost: { energy: 8, supplies: 3 },
    research: 2,
    daytimeOnly: false,
    weight: 2,
  },
  antenna_calibration: {
    id: 'antenna_calibration',
    title: 'Calibrar a antena de comunicações',
    summary: 'No console de comunicações, alinhe a antena e envie o pacote de dados à Terra.',
    site: 'comms',
    cost: { energy: 10 },
    research: 2,
    daytimeOnly: false,
    weight: 2,
  },
  power_audit: {
    id: 'power_audit',
    title: 'Auditoria da rede elétrica',
    summary: 'Confira o painel elétrico, troque fusíveis e registre o consumo da base.',
    site: 'power',
    cost: { energy: 5 },
    research: 1,
    daytimeOnly: false,
    weight: 2,
  },
  medical_checkup: {
    id: 'medical_checkup',
    title: 'Exame médico da tripulação',
    summary: 'Na enfermaria, faça exames de rotina: ajuda a moral e gera dados de saúde em Marte.',
    site: 'medical',
    cost: { supplies: 5 },
    research: 1,
    morale: 4,
    daytimeOnly: false,
    weight: 2,
  },
};

export const MISSION_IDS = Object.keys(MISSIONS) as MissionId[];

/** Quantas missões de pesquisa aparecem por Sol, por número de jogadores na sala. */
export function missionCountFor(players: number): number {
  const p = Math.max(1, Math.min(4, Math.floor(players) || 1));
  return [0, 2, 3, 4, 5][p] ?? 2;
}

/**
 * Missões do Sol: sorteio ponderado SEM repetição e com no máximo uma missão pesada.
 * O número de jogadores só define quantas; as primeiras da fila são sempre as mesmas, então
 * quem entra na sala no meio do dia não troca as missões que já existiam.
 */
export function missionsForSol(seed: number, sol: number, players: number): MissionId[] {
  const pool = MISSION_IDS.map((id) => ({ id, w: MISSIONS[id].weight }));
  const order: MissionId[] = [];
  let heavy = false;
  let round = 0;
  while (pool.length) {
    const total = pool.reduce((n, m) => n + m.w, 0);
    let roll = seeded(seed, sol, 101 + round++) * total;
    let pick = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i]!.w;
      if (roll < 0) {
        pick = i;
        break;
      }
    }
    const [m] = pool.splice(pick, 1);
    if (!m) break;
    if (MISSIONS[m.id].heavy) {
      if (heavy) continue;
      heavy = true;
    }
    order.push(m.id);
  }
  return order.slice(0, missionCountFor(players));
}

export interface ResourceSnapshot {
  energy: number;
  supplies: number;
  oxygen: number;
}

export interface MissionContext extends ResourceSnapshot {
  /** 0 = dia pleno, 1 = noite fechada */
  night: number;
  blackout: boolean;
}

const NAMES: Record<CostKey, string> = {
  energy: 'energia',
  supplies: 'mantimentos',
  oxygen: 'oxigênio',
};
const ICONS: Record<CostKey, string> = {
  energy: '⚡',
  supplies: '🍞',
  oxygen: '🫁',
};

export const NIGHT_LIMIT = 0.55;

/** Motivo que impede a missão agora, ou `null` se pode começar. */
/** Coleta de solo em dupla (motorista e passageiro no rover): custa o dobro e rende o triplo. */
export const COOP_COST_MULT = 2;
export const COOP_POINTS_MULT = 3;

export function missionBlock(def: MissionDef, ctx: MissionContext, costMul = 1): string | null {
  if (def.daytimeOnly && ctx.night > NIGHT_LIMIT) {
    return 'Só de dia: à noite o frio e a falta de luz tornam a missão perigosa.';
  }
  if (ctx.blackout && def.cost.energy) return 'Apagão: sem energia na base.';
  for (const key of Object.keys(def.cost) as CostKey[]) {
    const need = (def.cost[key] ?? 0) * costMul;
    if (ctx[key] < need) {
      return `Faltam recursos: precisa de ${need} de ${NAMES[key]} (há ${Math.floor(ctx[key])}).`;
    }
  }
  return null;
}

/** "⚡20 · 🍞10 · 🫁14" */
export function costText(cost: MissionCost): string {
  return (Object.keys(cost) as CostKey[])
    .filter((k) => (cost[k] ?? 0) > 0)
    .map((k) => `${ICONS[k]}${cost[k]}`)
    .join(' · ');
}

// ------------------------------------------------------------------------- horta e solo

/** Cuidar de um canteiro gasta ao menos isto de mantimento (a água do cultivo). */
export const GARDEN_CARE_COST: MissionCost = { supplies: 2 };
/** Cada litro regado no minigame sai do estoque: 1 de mantimento a cada tantos litros. */
export const GARDEN_LITRES_PER_SUPPLY = 4;
/** Todos os canteiros plantados cuidados no mesmo Sol: a horta devolve oxigênio à base. */
export const GARDEN_OXYGEN_BONUS = 10;

/** Pontos da coleta de solo conforme o desempenho no minigame (0..1). */
export const soilReward = (quality: number) =>
  MISSIONS.soil_robot.research + Math.round(Math.max(0, Math.min(1, quality)) * 1);

/** Quantas amostras de solo o minigame rende (3 a 5). */
export const soilSamples = (quality: number) =>
  3 + Math.round(Math.max(0, Math.min(1, quality)) * 2);

/** Todos os canteiros plantados receberam cuidado neste Sol? (e há ao menos um plantado) */
export function gardenComplete(
  stages: readonly number[],
  care: readonly number[],
  sol: number,
): boolean {
  let planted = 0;
  for (let i = 0; i < stages.length; i++) {
    if ((stages[i] ?? 0) <= 0) continue;
    planted++;
    if ((care[i] ?? 0) < sol) return false;
  }
  return planted > 0;
}

/** Dias extras de tolerância de um canteiro sem cuidado quando há poucos jogadores. */
export const cropGraceDays = (players: number) => (players >= 3 ? 0 : 1);

// ------------------------------------------------------------------------------------ onde fica

/** Cômodos (campo `kind` do layout) preferidos para cada estação, em ordem. */
export const STATION_ROOMS: Record<StationSite, string[]> = {
  lab: ['laboratorio', 'pesquisa', 'oficina', 'armazem'],
  comms: ['comunicacoes', 'pesquisa', 'laboratorio'],
  power: ['centralenergia', 'suportevida', 'armazem'],
  medical: ['medicina', 'habitacao', 'refeitorio'],
  /** dormitório / enfermaria: onde todos apertam para pular a noite */
  rest: ['habitacao', 'medicina', 'refeitorio'],
  /** computador de envio dos dados à Terra */
  upload: ['comunicacoes', 'pesquisa', 'laboratorio'],
};

export const STATION_LABEL: Record<MissionSite, string> = {
  rover: 'Garagem do rover',
  soil: 'Ponto de coleta de solo',
  rest: 'Dormitório',
  upload: 'Enlace com a Terra',
  drill: 'Sonda de perfuração',
  lab: 'Laboratório',
  comms: 'Comunicações',
  power: 'Central de energia',
  medical: 'Enfermaria',
};

const norm = (kind: string) => kind.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Cômodo de uma estação: o primeiro tipo preferido que a base tem; se nenhum existir, o primeiro
 * cômodo ainda sem estação (assim duas estações não caem no mesmo lugar sem necessidade).
 */
export function stationRoomIndex(
  rooms: readonly { kind: string }[],
  site: StationSite,
  taken: readonly number[] = [],
): number {
  for (const want of STATION_ROOMS[site]) {
    const i = rooms.findIndex((r) => norm(r.kind) === want);
    if (i >= 0) return i;
  }
  const free = rooms.findIndex((_, i) => !taken.includes(i));
  return free >= 0 ? free : 0;
}

/** Nome do cômodo do layout em português ("CentralEnergia" → "Central de energia"). */
export function roomLabel(kind: string): string {
  const k = norm(kind);
  const names: Record<string, string> = {
    laboratorio: 'Laboratório',
    pesquisa: 'Sala de pesquisa',
    comunicacoes: 'Comunicações',
    centralenergia: 'Central de energia',
    suportevida: 'Suporte à vida',
    medicina: 'Enfermaria',
    habitacao: 'Alojamento',
    refeitorio: 'Refeitório',
    estufa: 'Estufa',
    armazem: 'Armazém',
    oficina: 'Oficina',
    garagem: 'Garagem',
  };
  return names[k] ?? kind;
}

const COMPASS = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];

/**
 * "12 m a nordeste": distância e direção do jogador até o alvo. No mundo o norte aponta para -z
 * e o leste para +x (como no mapa da base).
 */
export function describeDirection(fromX: number, fromZ: number, toX: number, toZ: number) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const meters = Math.round(Math.hypot(dx, dz));
  if (meters < 3) return { meters, text: 'aqui' };
  const angle = Math.atan2(dx, -dz); // 0 = norte, cresce para o leste
  const idx = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return { meters, text: `${meters} m a ${COMPASS[idx]}` };
}

/** Ângulo (rad) para girar uma seta de bússola apontando o alvo, com o norte da tela para cima. */
export const bearingTo = (fromX: number, fromZ: number, toX: number, toZ: number) =>
  Math.atan2(toX - fromX, -(toZ - fromZ));
