/**
 * Missões de pesquisa (funções puras, sem Three.js nem React).
 *
 * Cada Sol sorteia poucas missões, conforme o número de jogadores na sala: sozinho são 2 por dia
 * (tarefa para uma pessoa só); com 4 astronautas, 5. Todas têm um custo em recursos da base:
 * sem recurso suficiente a missão não pode ser feita. O sorteio depende só da semente da sala e
 * do Sol, então todos os jogadores veem as mesmas missões.
 */

import { seeded } from './operations';

export type CostKey = 'energy' | 'supplies' | 'oxygen';
export type MissionCost = Partial<Record<CostKey, number>>;

export type MissionId =
  | 'soil_robot'
  | 'drill'
  | 'lab_analysis'
  | 'antenna_calibration'
  | 'power_audit'
  | 'medical_checkup'
  // manutenção da base (entram no sorteio do dia junto com as de pesquisa)
  | 'oxygen_moxie'
  | 'water_extract'
  | 'air_filter'
  | 'garden_care'
  | 'solar_clean';

/** Onde a missão acontece no mundo. */
export type MissionSite =
  | 'rover'
  | 'soil'
  | 'drill'
  | 'lab'
  | 'comms'
  | 'power'
  | 'medical'
  | 'upload'
  | 'moxie'
  | 'water'
  | 'filter'
  | 'garden'
  | 'solar';

/** Pontos fixos com holograma na base (o rover e a sonda já são objetos do cenário). */
export type StationSite = Extract<
  MissionSite,
  'lab' | 'comms' | 'power' | 'medical' | 'upload'
>;

export interface MissionDef {
  id: MissionId;
  title: string;
  summary: string;
  site: MissionSite;
  cost: MissionCost;
  /** pontos de pesquisa: SÓ as missões de pesquisa dão (a sondagem varia com a camada coletada) */
  research: number;
  /** missões de manutenção não dão pesquisa: devolvem recursos para a base */
  reward?: MissionCost;
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
    title: 'Reconhecimento com o rover',
    summary:
      'Das 2h às 16h: dirija o rover (sozinho ou com um amigo) até o quadrado amarelo. Você e o rover vão para um mapa coberto de neblina: ache 3 pedras com o radar, pegue cada uma a pé e leve ao rover. Rende pesquisa e a previsão do tempo de amanhã. Se o tempo acabar, vocês voltam sem perder nada.',
    site: 'soil',
    cost: { energy: 20, supplies: 10, oxygen: 14 },
    research: 3,
    morale: 3,
    // a janela do rover (2h às 16h) é conferida à parte: ele pode sair antes de amanhecer
    daytimeOnly: false,
    weight: 3,
    heavy: true,
  },
  drill: {
    id: 'drill',
    title: 'Sondagem do subsolo',
    summary: 'Use a sonda de perfuração para coletar a camada que a ciência pediu.',
    site: 'drill',
    cost: { energy: 6, supplies: 2 },
    research: 3,
    daytimeOnly: false,
    weight: 3,
  },
  lab_analysis: {
    id: 'lab_analysis',
    title: 'Análise de amostras no laboratório',
    summary: 'Rode as amostras da base na bancada do laboratório e registre os resultados.',
    site: 'lab',
    cost: { energy: 8, supplies: 3 },
    research: 3,
    daytimeOnly: false,
    weight: 2,
  },
  antenna_calibration: {
    id: 'antenna_calibration',
    title: 'Calibrar a antena de comunicações',
    summary: 'No console de comunicações, alinhe a antena e envie o pacote de dados à Terra.',
    site: 'comms',
    cost: { energy: 10 },
    research: 3,
    daytimeOnly: false,
    weight: 2,
  },
  power_audit: {
    id: 'power_audit',
    title: 'Auditoria da rede elétrica',
    summary: 'Confira o painel elétrico, troque fusíveis e registre o consumo da base.',
    site: 'power',
    cost: { supplies: 2 },
    research: 0,
    reward: { energy: 20 },
    daytimeOnly: false,
    weight: 2,
  },
  medical_checkup: {
    id: 'medical_checkup',
    title: 'Exame médico da tripulação',
    summary: 'Na enfermaria, faça exames de rotina: ajuda a moral e gera dados de saúde em Marte.',
    site: 'medical',
    cost: { energy: 4 },
    research: 0,
    reward: { oxygen: 8, supplies: 4 },
    morale: 4,
    daytimeOnly: false,
    weight: 2,
  },
  oxygen_moxie: {
    id: 'oxygen_moxie',
    title: 'Produzir oxigênio no MOXIE',
    summary: 'Na usina de suporte à vida, aqueça o forno e quebre o CO₂ do ar de Marte em oxigênio.',
    site: 'moxie',
    cost: {},
    research: 0,
    reward: { oxygen: 6 },
    daytimeOnly: false,
    weight: 3,
  },
  water_extract: {
    id: 'water_extract',
    title: 'Extrair água do subsolo',
    summary: 'No extrator, escolha o solo com gelo e transforme o vapor em água para a base.',
    site: 'water',
    cost: {},
    research: 0,
    reward: { supplies: 6 },
    daytimeOnly: false,
    weight: 3,
  },
  air_filter: {
    id: 'air_filter',
    title: 'Limpar a ventilação (filtro de ar)',
    summary: 'Tire a poeira do filtro de ar. Filtro entupido para a produção de oxigênio da base.',
    site: 'filter',
    cost: {},
    research: 0,
    daytimeOnly: false,
    weight: 3,
  },
  garden_care: {
    id: 'garden_care',
    title: 'Cuidar da horta',
    summary: 'Vá de canteiro em canteiro na estufa e regue um por vez. Horta em dia devolve oxigênio.',
    site: 'garden',
    cost: {},
    research: 0,
    reward: { oxygen: 10, supplies: 4 },
    daytimeOnly: false,
    weight: 3,
  },
  solar_clean: {
    id: 'solar_clean',
    title: 'Limpar os painéis solares',
    summary: 'Lave 2 painéis, um de cada vez: poeira nos painéis derruba a energia da base.',
    site: 'solar',
    cost: {},
    research: 0,
    daytimeOnly: true,
    weight: 3,
  },
};

export const MISSION_IDS = Object.keys(MISSIONS) as MissionId[];

/** Missões cumpridas por uma tarefa da base (minigame próprio, não um console de estação). */
export const TASK_MISSIONS: Partial<Record<MissionId, true>> = {
  oxygen_moxie: true,
  water_extract: true,
  air_filter: true,
  garden_care: true,
  solar_clean: true,
};

/** Missão de pesquisa (rende pontos) ou de manutenção (rende recursos)? */
export const isResearchMission = (id: MissionId) => MISSIONS[id].research > 0;

/**
 * Consumo diário da tripulação: cada astronauta na sala come e bebe isto por Sol. Mais gente,
 * mais consumo: a tripulação precisa fazer as missões e tarefas para não ficar sem suprimento.
 */
export const DAILY_SUPPLIES_PER_PLAYER = 7;
/** Oxigênio que cada astronauta respira por Sol (a usina e a horta repõem). */
export const DAILY_OXYGEN_PER_PLAYER = 9;

/** Quantas missões aparecem por Sol: 4 com um astronauta, uma a mais por astronauta extra. */
export function missionCountFor(players: number): number {
  const p = Math.max(1, Math.min(4, Math.floor(players) || 1));
  return 3 + p;
}

/**
 * Missões do Sol: sorteio ponderado SEM repetição e com no máximo uma missão pesada.
 * O número de jogadores só define quantas; as primeiras da fila são sempre as mesmas, então
 * quem entra na sala no meio do dia não troca as missões que já existiam.
 */
export function missionsForSol(seed: number, sol: number, players: number): MissionId[] {
  return orderForSol(seed, sol).slice(0, missionCountFor(players));
}

/** Quantas missões de cada dia contam como "já vistas" para evitar repetir no dia seguinte. */
const SEEN_TOP = missionCountFor(1);
const orderMemo = new Map<string, MissionId[]>();

/**
 * Ordem completa de missões de um Sol, com memória: o que apareceu ontem pesa 85% menos hoje e o
 * que apareceu anteontem, 50% menos. Assim as missões se revezam em vez de repetir (o sorteio
 * continua determinístico: depende só da semente e do Sol).
 */
function orderForSol(seed: number, sol: number): MissionId[] {
  const key = `${seed}:${sol}`;
  const hit = orderMemo.get(key);
  if (hit) return hit;
  const recent = new Map<MissionId, number>();
  for (const [back, factor] of [[1, 0.15], [2, 0.5]] as const) {
    if (sol - back < 1) continue;
    for (const id of orderForSol(seed, sol - back).slice(0, SEEN_TOP))
      recent.set(id, Math.min(recent.get(id) ?? 1, factor));
  }
  const pool = MISSION_IDS.map((id) => ({ id, w: MISSIONS[id].weight * (recent.get(id) ?? 1) }));
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
  // pesquisa só vem das missões de pesquisa: todo dia entram pelo menos 2 (3 com 3+ jogadores),
  // intercaladas com as de manutenção. Sem isso, a conta de chegar a 100% pontos não fechava.
  const research = order.filter((id) => MISSIONS[id].research > 0);
  const upkeep = order.filter((id) => MISSIONS[id].research <= 0);
  const mixed: MissionId[] = [];
  for (let i = 0; i < 6; i++) {
    const r = research.shift();
    if (r) mixed.push(r);
    const u = upkeep.shift();
    if (u) mixed.push(u);
  }
  const final = [...mixed, ...order.filter((id) => !mixed.includes(id))];
  if (orderMemo.size > 5000) orderMemo.clear();
  orderMemo.set(key, final);
  return final;
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
  supplies: '🌾',
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

/** "⚡20 · 🌾10 · 🫁14" (mesmos ícones da HUD) */
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

/** O rover sai para reconhecimento das 2h às 16h (precisa voltar antes de anoitecer). */
export const ROVER_WINDOW = { from: 2, to: 16 } as const;
export const roverWindowOpen = (hour: number) => hour >= ROVER_WINDOW.from && hour < ROVER_WINDOW.to;

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
  /** computador de envio dos dados à Terra */
  upload: ['comunicacoes', 'pesquisa', 'laboratorio'],
};

export const STATION_LABEL: Record<MissionSite, string> = {
  rover: 'Garagem do rover',
  soil: 'Ponto de coleta de solo',
  upload: 'Enlace com a Terra',
  drill: 'Sonda de perfuração',
  lab: 'Laboratório',
  comms: 'Comunicações',
  power: 'Central de energia',
  medical: 'Enfermaria',
  moxie: 'Usina MOXIE',
  water: 'Extrator de água',
  filter: 'Filtro de ar',
  garden: 'Estufa',
  solar: 'Campo solar',
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
