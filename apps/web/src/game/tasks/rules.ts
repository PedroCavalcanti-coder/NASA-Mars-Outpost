/**
 * Regras das tarefas diárias da base (funções puras, sem Three.js nem React).
 *
 * - Painéis solares: cada painel junta poeira no próprio ritmo (sorteado por base e painel);
 *   tempestades aceleram muito. Quanto mais sujo, menos energia: coberto (estágio 4) = 0%.
 * - Rede elétrica: painéis carregam a bateria de dia; o suporte à vida consome sempre.
 *   Sem geração, a bateria segura a base; zerada e sem sol = apagão.
 * - Horta: todo canteiro plantado precisa de cuidado (minigame) a cada Sol. Sem cuidado num Sol,
 *   morre na virada do dia e precisa ser replantado (plantar conta como o cuidado daquele Sol).
 * - Filtro de ar: troca diária. Sem troca num Sol, entope: a base para de produzir O₂.
 * - Sondagem: em alguns Sóis a ciência pede uma amostra de uma camada do subsolo (pontos de pesquisa).
 */

/** Duração de um Sol em segundos de jogo a 1× (igual ao relógio da sala). */
export const SOL_SECONDS = 600;

/** Estágio máximo de poeira de um painel (coberto, não gera nada). */
export const MAX_DUST = 4;

/** A partir deste estágio o painel vira tarefa de limpeza (≤ 50% de eficiência). */
export const DIRTY_STAGE = 2;

export const GRID = {
  /** consumo do suporte à vida (unidades de bateria por Sol) */
  loadPerSol: 60,
  /** com todos os painéis limpos ao meio-dia, a geração é este múltiplo do consumo */
  peakFactor: 2.6,
  /** fração da luz que uma tempestade forte bloqueia */
  stormBlock: 0.8,
  /** quanto a tempestade acelera a poeira (1 + fator × intensidade) */
  stormDust: 8,
} as const;

export const OXYGEN_PLANT = {
  /** O₂ que a base produz por Sol com filtro limpo e energia */
  perSol: 24,
} as const;

/** Energia gasta pela sonda numa perfuração. */
export const DRILL_ENERGY_COST = 6;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Hash FNV-1a de um texto (semente estável por sala/base). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Número em [0, 1) determinístico para (semente, chaves): igual em todos os jogadores. */
export function seeded(seed: number, ...keys: number[]): number {
  let h = seed >>> 0;
  for (const k of keys) {
    h ^= Math.imul((k | 0) + 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 2 ** 32;
}

// ---------------------------------------------------------------------------------------- painéis

/** Eficiência de um painel pelo estágio de poeira: 0 → 100%, 4 → 0%. */
export function panelEfficiency(stage: number): number {
  return clamp(1 - stage / MAX_DUST, 0, 1);
}

/** Ritmo de poeira do painel (estágios por Sol): entre 0,45 e 1,65, fixo por base e painel. */
export function panelDustRate(seed: number, index: number): number {
  return 0.45 + seeded(seed, index, 11) * 1.2;
}

/** Poeira acumulada após `dt` segundos de jogo (limitada ao painel coberto). */
export function dustStep(dust: number, rate: number, dt: number, storm: number): number {
  const factor = 1 + GRID.stormDust * clamp(storm, 0, 1);
  return clamp(dust + (rate * factor * Math.max(0, dt)) / SOL_SECONDS, 0, MAX_DUST);
}

/** Estágio visível (inteiro) de uma poeira contínua. */
export const dustStage = (dust: number) => clamp(Math.floor(dust), 0, MAX_DUST);

// ------------------------------------------------------------------------------- rede elétrica

/** Consumo extra à noite (fração do consumo base): iluminação de todas as salas e aquecedores. */
export const NIGHT_LOAD_EXTRA = { lighting: 0.3, heating: 0.5 } as const;

/**
 * Consumo da base em unidades por segundo de jogo. `night` (0..1) soma a iluminação e os
 * aquecedores: de noite a base gasta bem mais energia.
 */
export const gridLoad = (night = 0) =>
  (GRID.loadPerSol / SOL_SECONDS) *
  (1 + clamp(night, 0, 1) * (NIGHT_LOAD_EXTRA.lighting + NIGHT_LOAD_EXTRA.heating));

/**
 * Geração instantânea (unidades por segundo de jogo).
 * `sun` 0..1 (0 = noite); a geração é normalizada pelo nº de painéis, então bases com mais ou
 * menos painéis rendem o mesmo quando tudo está limpo.
 */
export function solarGeneration(stages: readonly number[], sun: number, storm: number): number {
  if (!stages.length) return 0;
  const light = clamp(sun, 0, 1) * (1 - GRID.stormBlock * clamp(storm, 0, 1));
  const clean = stages.reduce((sum, s) => sum + panelEfficiency(s), 0) / stages.length;
  return gridLoad() * GRID.peakFactor * clean * light;
}

export interface GridResult {
  battery: number;
  /** sem energia nenhuma: bateria vazia e geração abaixo do consumo */
  blackout: boolean;
}

/** Carrega/descarrega a bateria em `dt` segundos de jogo. */
export function gridStep(
  battery: number,
  capacity: number,
  generation: number,
  dt: number,
  night = 0,
): GridResult {
  const load = gridLoad(night);
  const next = clamp(battery + (generation - load) * Math.max(0, dt), 0, capacity);
  return { battery: next, blackout: next <= 0 && generation < load };
}

// ------------------------------------------------------------------------------ horta e filtro

/** O canteiro morreu? (plantado e sem cuidado no Sol anterior ao atual) */
export function cropDead(stage: number, careSol: number, sol: number): boolean {
  return stage > 0 && careSol < sol - 1;
}

/** Já recebeu o cuidado deste Sol? */
export const caredToday = (careSol: number, sol: number) => careSol >= sol;

/** Filtro sem troca no Sol anterior: entupido (a base não produz O₂). */
export const filterClogged = (filterSol: number, sol: number) => filterSol < sol - 1;

/** Qual dos dois filtros de ar da base precisa de troca hoje. */
export const filterOfDay = (seed: number, sol: number) => (seeded(seed, sol, 3) < 0.5 ? 0 : 1);

// ------------------------------------------------------------------------------------ sondagem

/** Há pedido de sondagem hoje? (sempre no Sol 1, depois em ~55% dos Sóis) */
export const drillDay = (seed: number, sol: number) => sol === 1 || seeded(seed, sol, 5) < 0.55;

// -------------------------------------------------------------------------------------- tarefas

export type TaskKind = 'solar' | 'crop' | 'plant' | 'filter' | 'drill';

export interface DailyTask {
  id: string;
  kind: TaskKind;
  title: string;
  detail: string;
  /** objeto do mundo onde a tarefa acontece (índice do painel/canteiro/filtro) */
  index: number;
  done: boolean;
  /** obrigatória: ignorar traz consequência na virada do Sol */
  required: boolean;
}

export interface TaskInput {
  sol: number;
  seed: number;
  panelStages: readonly number[];
  /** painéis limpos hoje por este jogador (aparecem como concluídos) */
  panelsCleanedToday: readonly number[];
  cropStages: readonly number[];
  cropNames: readonly string[];
  cropCare: readonly number[];
  filterSol: number;
  drillDoneSol: number;
  drillTarget?: string;
}

/** Lista de tarefas do Sol, na ordem em que aparecem no painel. */
export function buildTasks(t: TaskInput): DailyTask[] {
  const tasks: DailyTask[] = [];
  const filter = filterOfDay(t.seed, t.sol);
  tasks.push({
    id: `filter-${t.sol}`,
    kind: 'filter',
    title: `Trocar o filtro de ar ${filter + 1}`,
    detail: filterClogged(t.filterSol, t.sol)
      ? 'Entupido: a base parou de produzir oxigênio.'
      : 'Suporte à vida: troca diária do cartucho.',
    index: filter,
    done: caredToday(t.filterSol, t.sol),
    required: true,
  });

  t.cropStages.forEach((stage, i) => {
    if (stage <= 0) return;
    const care = t.cropCare[i] ?? 0;
    const name = t.cropNames[i] ?? 'horta';
    const ripe = stage >= 3;
    tasks.push({
      id: `crop-${i}-${t.sol}`,
      kind: 'crop',
      // pronto para colher: clicar colhe (e o canteiro sai da lista); senão, minigame de cuidado
      title: ripe
        ? `Colher o canteiro ${i + 1} (${name})`
        : `Cuidar do canteiro ${i + 1} (${name})`,
      detail: ripe
        ? 'Pronto! Colha (ou cuide) hoje, senão estraga na virada do Sol.'
        : 'Água (1 🍞) e luz certas hoje: sem cuidado por muito tempo, a planta morre.',
      index: i,
      done: caredToday(care, t.sol),
      required: true,
    });
  });

  const empty = t.cropStages.filter((s) => s <= 0).length;
  if (empty > 0) {
    const first = t.cropStages.findIndex((s) => s <= 0);
    tasks.push({
      id: `plant-${t.sol}`,
      kind: 'plant',
      title: `Plantar nos canteiros vazios (${empty})`,
      detail: 'Opcional: mudas novas viram mantimentos na colheita.',
      index: first,
      done: false,
      required: false,
    });
  }

  const cleaned = new Set(t.panelsCleanedToday);
  t.panelStages.forEach((stage, i) => {
    if (stage < DIRTY_STAGE && !cleaned.has(i)) return;
    const eff = Math.round(panelEfficiency(stage) * 100);
    tasks.push({
      id: `solar-${i}-${t.sol}`,
      kind: 'solar',
      title: `Limpar o painel solar ${i + 1}`,
      detail:
        cleaned.has(i) && stage < DIRTY_STAGE ? 'Limpo hoje.' : `Gerando só ${eff}% da energia.`,
      index: i,
      done: cleaned.has(i) && stage < DIRTY_STAGE,
      required: false,
    });
  });

  // a sondagem do subsolo agora é uma missão de pesquisa (ver `game/missions`)
  return tasks;
}
