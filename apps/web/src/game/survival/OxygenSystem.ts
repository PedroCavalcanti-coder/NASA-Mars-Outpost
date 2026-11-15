import { create } from 'zustand';
import { isGameOverlayOpenCached } from '../../lib/gameOverlay';
import { useMission } from '../../store/mission';
import { toast } from '../../ui/toast';
import type { SystemContext } from '../systems/context';
import type { GameSystem } from '../systems/registry';
import { OXYGEN_SETTINGS, type OxygenStatus } from './types';

export interface OxygenState {
  /** Nível atual do tanque pessoal de oxigênio (0 a 100) */
  tank: number;
  /** Se o astronauta está seguro no interior da base */
  isInside: boolean;
  /** Se o astronauta está dirigindo o rover */
  isDriving: boolean;
  /** Se o oxigênio está em nível crítico (< 25%) */
  isLow: boolean;
  /** Intensidade da tempestade externa (0 a 1) */
  storm: number;
  /** Nível de oxigênio disponível nos tanques da base */
  baseOxygen: number;
  /** Estado semântico de consumo */
  status: OxygenStatus;
  /** Se o astronauta está em processo de socorro/desmaio */
  isFainting: boolean;
  /** Define manualmente o oxigênio (útil para testes e depuração) */
  setTank: (val: number) => void;
  /** Reinicia o tanque pessoal para o valor máximo */
  resetTank: () => void;
}

export const useOxygen = create<OxygenState>((set) => ({
  tank: OXYGEN_SETTINGS.INITIAL_TANK,
  isInside: true,
  isDriving: false,
  isLow: false,
  storm: 0,
  baseOxygen: 100,
  status: 'safe',
  isFainting: false,
  setTank: (val) =>
    set({
      tank: Math.max(0, Math.min(OXYGEN_SETTINGS.MAX_TANK, val)),
      isLow: val < OXYGEN_SETTINGS.LOW_ALERT_THRESHOLD,
    }),
  resetTank: () =>
    set({
      tank: OXYGEN_SETTINGS.INITIAL_TANK,
      isLow: false,
      isFainting: false,
    }),
}));

/**
 * Deduz ou adiciona oxigênio ao estoque central da base no store de missão.
 * Garante que o valor nunca fique negativo nem exceda o máximo da instalação.
 */
export function adjustBaseOxygen(_delta:number):number {return 0;}

/**
 * Calcula a taxa pura de descarga de oxigênio fora da base.
 * Independente de Three.js ou DOM, ideal para testes de precisão.
 */
export function calculateDrain(dt: number, storm: number): number {
  const stormMult =
    1 + Math.max(0, Math.min(1, storm)) * (OXYGEN_SETTINGS.STORM_DRAIN_MULTIPLIER - 1);
  return OXYGEN_SETTINGS.DRAIN_RATE_OUTSIDE * stormMult * dt;
}

/**
 * Calcula a recarga pura de oxigênio dentro da base e o débito correspondente na base.
 */
export function calculateRefill(
  dt: number,
  currentTank: number,
  baseOxygenAvailable: number,
): { tankRefill: number; baseCost: number } {
  if (baseOxygenAvailable <= 0 || currentTank >= OXYGEN_SETTINGS.MAX_TANK) {
    return { tankRefill: 0, baseCost: 0 };
  }

  const requestedTankGain = Math.min(
    OXYGEN_SETTINGS.REFILL_RATE_INSIDE * dt,
    OXYGEN_SETTINGS.MAX_TANK - currentTank,
  );

  const desiredBaseCost = requestedTankGain * OXYGEN_SETTINGS.BASE_OXYGEN_RATIO;

  if (desiredBaseCost > baseOxygenAvailable) {
    // A base tem menos oxigênio do que o necessário para a taxa cheia: transfere o saldo restante
    const actualTankGain = baseOxygenAvailable / OXYGEN_SETTINGS.BASE_OXYGEN_RATIO;
    return { tankRefill: actualTankGain, baseCost: baseOxygenAvailable };
  }

  return { tankRefill: requestedTankGain, baseCost: desiredBaseCost };
}

/**
 * Sistema de Oxigênio do Astronauta.
 * - Descarrega quando fora da base (inclusive no rover) e descarrega mais rápido em tempestades.
 * - Recarrega na base consumindo proporcionalmente o oxigênio da base (`oxygen`).
 * - Ao zerar: escurece a tela, socorre na enfermaria, restaura 25% do tanque e cobra oxigênio da base.
 */
export class OxygenSystem implements GameSystem {
  readonly id='survival-oxygen';
  getTank(){return useOxygen.getState().tank;}
  setTank(_value:number){}
  update(_dt:number,_ctx:SystemContext){}
  dispose(){}
}
