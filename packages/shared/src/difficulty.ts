/**
 * Dificuldade do mundo, escolhida ao clicar em "Jogar agora" e gravada no save. Cada nível mexe em
 * regras reais do servidor (consumo, estrago dos eventos, chance de eventos grandes, radiação e
 * tempo da expedição).
 */
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface DifficultyRules {
  /** multiplica o consumo diário de oxigênio e mantimentos da tripulação */
  use: number;
  /** multiplica o que os eventos tiram dos recursos (o que eles dão não muda) */
  harm: number;
  /** pontos somados à chance de evento grande por Sol */
  majorBonus: number;
  /** multiplica a duração da radiação alta */
  radiationHours: number;
  /** multiplica a dose de radiação recebida lá fora */
  dose: number;
  /** tempo da expedição com o rover (ms) */
  expeditionMs: number;
  /** multiplica o oxigênio gasto no traje fora da base */
  suitDrain: number;
  /** alvos da expedição (pedras + poços de escavação) e quantos deles são poços */
  expeditionTargets: number;
  expeditionPits: number;
  /** multiplica os pontos de pesquisa necessários para vencer (os pontos ganhos não mudam) */
  researchGoal: number;
  /** multiplica o número de sóis até o prazo acabar (senão a meta maior seria impossível) */
  maxSols: number;
}

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRules> = {
  easy: { use: 0.7, harm: 0.6, majorBonus: -0.15, radiationHours: 0.7, dose: 0.6, expeditionMs: 300000, suitDrain: 0.7, researchGoal: 1, maxSols: 1, expeditionTargets: 3, expeditionPits: 0 },
  normal: { use: 1, harm: 1, majorBonus: 0, radiationHours: 1, dose: 1, expeditionMs: 240000, suitDrain: 1, researchGoal: 1, maxSols: 1, expeditionTargets: 3, expeditionPits: 0 },
  hard: { use: 1.3, harm: 1.4, majorBonus: 0.15, radiationHours: 1.4, dose: 1.5, expeditionMs: 180000, suitDrain: 1.3, researchGoal: 3, maxSols: 3, expeditionTargets: 6, expeditionPits: 2 },
};

export const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);
export const rulesFor = (d: Difficulty | undefined): DifficultyRules => DIFFICULTY_RULES[d ?? 'normal'];
