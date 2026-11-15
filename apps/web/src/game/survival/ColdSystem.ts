import { create } from 'zustand';
import { isGameOverlayOpenCached } from '../../lib/gameOverlay';
import { useMission } from '../../store/mission';
import { toast } from '../../ui/toast';
import { registerDevAction } from '../dev/devActions';
import type { SystemContext } from '../systems/context';
import type { GameSystem } from '../systems/registry';
import { adjustBaseOxygen } from './OxygenSystem';
import { COLD_SETTINGS } from './types';

export interface ColdState {
  /** Se o ambiente está em período noturno (temperaturas extremamente baixas) */
  isNight: boolean;
  /** Se o astronauta está exposto ao frio do lado de fora à noite */
  isExposed: boolean;
  /** Tempo acumulado de exposição ao frio (segundos) */
  exposureTime: number;
  /** Limite de exposição suportado antes do colapso térmico */
  maxExposure: number;
  /** Se a noite foi forçada manualmente via painel dev */
  overrideNight: boolean | null;
  /** Função de override para dev/testes */
  setOverrideNight: (val: boolean | null) => void;
}

export const useCold = create<ColdState>((set) => ({
  isNight: false,
  isExposed: false,
  exposureTime: 0,
  maxExposure: COLD_SETTINGS.COLD_EXPOSURE_LIMIT,
  overrideNight: null,
  setOverrideNight: (val) => set({ overrideNight: val }),
}));

/**
 * Deduz ou acrescenta pontos de moral à tripulação no store de missão.
 * Limita entre 0 e 100.
 */
export function adjustBaseMorale(_delta:number):number{return 0;}
export class ColdSystem implements GameSystem {
  readonly id='survival-cold';
  getExposureTimer(){return useCold.getState().exposureTime;}
  setExposureTimer(_value:number){}
  update(_dt:number,_ctx:SystemContext){}
  dispose(){}
}
