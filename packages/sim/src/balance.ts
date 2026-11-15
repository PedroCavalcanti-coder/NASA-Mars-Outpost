import type { ActionId, Crisis, FacilityId, ResourceId } from './types';

/** Todos os números do balanceamento ficam aqui: mexa só neste arquivo para ajustar o jogo. */

export const RESEARCH_GOAL = 100;
export const MAX_SOLS = 15;
export const ACTIONS_PER_SOL = 3;
export const LOG_LIMIT = 30;

export const INITIAL = {
  resources: {
    oxygen: { value: 100, max: 100 },
    energy: { value: 70, max: 120 },
    supplies: { value: 60, max: 100 },
    materials: { value: 60, max: 150 },
  },
  facilities: { solar: 2, greenhouse: 1, lab: 1 },
  morale: 80,
} as const;

export const FACILITY_MAX: Record<FacilityId, number> = { solar: 6, greenhouse: 4, lab: 3 };

/** Produção e consumo ao fim de cada sol. */
export const ECONOMY = {
  solarOutput: 12, // energia por painel com eficiência 100%
  greenhouseOutput: 9, // mantimentos por estufa
  lifeSupport: 10, // energia gasta pelo suporte à vida
  labUpkeep: 2, // energia por laboratório
  crewFood: 10, // mantimentos consumidos pela tripulação
  dustPerSol: 0.08, // perda de eficiência dos painéis por sol
  minSolarEfficiency: 0.4,
  moraleRecovery: 2, // por sol sem crise
} as const;

/** Penalidades aplicadas ao fim do sol enquanto a crise durar. */
export const CRISIS_PENALTY: Record<Crisis, { research: number; morale: number }> = {
  blackout: { research: 6, morale: 8 },
  famine: { research: 4, morale: 12 },
  shortage: { research: 0, morale: 3 },
};

export const CRISIS_INFO: Record<Crisis, { name: string; effect: string }> = {
  blackout: {
    name: 'Apagão',
    effect: 'Sem energia: pesquisa e expedições paradas, dados se perdem a cada sol.',
  },
  famine: {
    name: 'Fome',
    effect: 'Sem mantimentos: a moral despenca, expedições suspensas e dados se perdem.',
  },
  shortage: {
    name: 'Sem materiais',
    effect: 'Nada pode ser construído ou reparado; avarias causam perdas maiores.',
  },
};

export interface ActionDef {
  name: string;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
  /** crises que impedem a ação */
  blockedBy: Crisis[];
  /** instalação construída pela ação */
  builds?: FacilityId;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  research: {
    name: 'Pesquisar',
    description: 'Analisa amostras no laboratório. +5 dados (+3 por laboratório extra).',
    cost: { energy: 12 },
    blockedBy: ['blackout'],
  },
  expedition: {
    name: 'Expedição',
    description: 'Envia o rover a uma região nova. Sucesso: +12–16 dados e materiais. Pode falhar.',
    cost: { energy: 15, supplies: 10 },
    blockedBy: ['blackout', 'famine'],
  },
  mine: {
    name: 'Escavar',
    description: 'Extrai regolito e metais. +18–24 materiais.',
    cost: { energy: 8 },
    blockedBy: ['blackout'],
  },
  maintain: {
    name: 'Manutenção',
    description: 'Limpa a poeira dos painéis (100% de eficiência) e anima a equipe (+4 moral).',
    cost: { materials: 15 },
    blockedBy: [],
  },
  build_solar: {
    name: 'Painel solar',
    description: `+${ECONOMY.solarOutput} de energia por sol (menos com poeira).`,
    cost: { materials: 30 },
    blockedBy: [],
    builds: 'solar',
  },
  build_greenhouse: {
    name: 'Estufa',
    description: `+${ECONOMY.greenhouseOutput} mantimentos por sol.`,
    cost: { materials: 35, energy: 10 },
    blockedBy: [],
    builds: 'greenhouse',
  },
  build_lab: {
    name: 'Laboratório',
    description: 'Cada pesquisa rende +3 dados a mais. Consome 2 de energia por sol.',
    cost: { materials: 50, energy: 15 },
    blockedBy: ['blackout'],
    builds: 'lab',
  },
};

export const EXPEDITION = {
  successChance: 0.75,
  lowMoralePenalty: 0.15, // chance a menos com moral < 40
  criticalChance: 0.08, // parte da falha que vira falha crítica
  success: { research: [12, 16], materials: [10, 20] },
  failure: { research: 6, morale: 6 },
  critical: { research: 12, morale: 10, energy: 10 },
} as const;

export const RESEARCH_ACTION = { base: 5, perExtraLab: 3, lowMoralePenalty: 2 } as const;
export const MINE_YIELD = [18, 24] as const;
export const MAINTAIN_MORALE = 4;

/** Chance de um evento ao fim de cada sol. */
export const EVENT_CHANCE = 0.55;
/** Nenhum evento acontece nos 3 primeiros sóis: só a partir do sol 4. */
export const EVENT_FIRST_SOL = 4;
