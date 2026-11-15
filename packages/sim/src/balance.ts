import type { ActionId, Crisis, FacilityId, ResourceId } from './types';

/** Todos os números do balanceamento ficam aqui: mexa só neste arquivo para ajustar o jogo. */

export const RESEARCH_GOAL = 100;
/** pontos de pesquisa ainda não enviados necessários para liberar o envio à Terra */
export const UPLOAD_THRESHOLD = 10;
export const MAX_SOLS = 15;
export const ACTIONS_PER_SOL = 3;
/** o diário guarda tudo o que aconteceu no mundo (mais recente primeiro) */
export const LOG_LIMIT = 300;

export const INITIAL = {
  resources: {
    oxygen: { value: 100, max: 100 },
    energy: { value: 70, max: 120 },
    supplies: { value: 60, max: 100 },
    armor: { value: 100, max: 100 },
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
  structural: { research: 0, morale: 0 },
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
  structural: {
    name: 'Emergência estrutural',
    effect: 'Repare a blindagem para retomar a pesquisa.',
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
    blockedBy: ['blackout', 'structural'],
  },
  expedition: {
    name: 'Expedição',
    description: 'Envia o rover a uma região nova. Sucesso: +12–16 dados. Pode falhar.',
    cost: { energy: 15, supplies: 10 },
    blockedBy: ['blackout', 'famine', 'structural'],
  },
};

export const EXPEDITION = {
  successChance: 0.75,
  lowMoralePenalty: 0.15, // chance a menos com moral < 40
  criticalChance: 0.08, // parte da falha que vira falha crítica
  success: { research: [12, 16] },
  failure: { research: 6, morale: 6 },
  critical: { research: 12, morale: 10, energy: 10 },
} as const;

export const RESEARCH_ACTION = { base: 5, perExtraLab: 3, lowMoralePenalty: 2 } as const;
