/**
 * Constantes e tipos dos subsistemas de sobrevivência marciana.
 * Valores balanceados para jogabilidade educativa e envolvente.
 */

export const OXYGEN_SETTINGS = {
  /** Capacidade máxima do tanque pessoal de oxigênio */
  MAX_TANK: 100,
  /** Nível inicial do tanque */
  INITIAL_TANK: 100,
  /** Taxa de consumo de oxigênio fora da base (% por segundo em tempo normal). ~2 min de autonomia */
  DRAIN_RATE_OUTSIDE: 0.8,
  /** Fator multiplicador de consumo sob tempestade de poeira marciana (até 1.8x) */
  STORM_DRAIN_MULTIPLIER: 1.5,
  /** Taxa de recarga do tanque pessoal dentro da base (% por segundo). ~10s de 0 a 100 */
  REFILL_RATE_INSIDE: 10.0,
  /**
   * Custo no recurso de oxigênio da base por cada ponto recarregado no tanque pessoal.
   * Ex: 0.05 significa que encher 100% consome 5 unidades de oxigênio da base.
   */
  BASE_OXYGEN_RATIO: 0.05,
  /** Nível mínimo restaurado no tanque após socorro por desmaio */
  FAINT_RESPAWN_TANK: 25,
  /** Custo de oxigênio debitado da base pelo atendimento médico de emergência */
  FAINT_BASE_OXYGEN_COST: 5,
  /** Limite percentual para disparar o alerta visual de oxigênio crítico */
  LOW_ALERT_THRESHOLD: 25,
} as const;

export const COLD_SETTINGS = {
  /** Limiar de noite marciana para incidência de frio extremo (nightFactor > 0.6) */
  NIGHT_THRESHOLD: 0.6,
  /** Escala de velocidade ao sofrer hipotermia severa fora da base (~0.25 da velocidade normal) */
  COLD_SPEED_SCALE: 0.25,
  /** Tempo limite de exposição ao frio extremo até o desmaio (segundos em dt de simulação) */
  COLD_EXPOSURE_LIMIT: 6.0,
  /** Penalidade de moral sofrida pela tripulação após resgate por congelamento */
  COLD_MORALE_PENALTY: 6,
  /** Oxigênio da base gasto no aquecimento de emergência do traje */
  COLD_OXYGEN_COST: 4,
} as const;

export const NAP_SETTINGS = {
  /** Só dá para dormir quando já é noite (fator de noite acima disto) */
  MIN_NIGHT_TO_SLEEP: 0.5,
  /** Hora do dia (0..24) em que o astronauta acorda */
  WAKE_HOUR: 6.5,
  /** Oxigênio da base gasto por hora de sono (a base segue respirando) */
  OXYGEN_PER_HOUR: 1.2,
  /** Mantimentos gastos pela refeição da noite, uma vez por sono */
  SUPPLIES_COST: 2,
  /** Limite de intensidade de tempestade que ainda permite adormecer */
  MAX_STORM_FOR_NAP: 0.5,
} as const;

export type OxygenStatus = 'safe' | 'consuming' | 'critical' | 'depleted';
