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
export function adjustBaseMorale(delta: number): number {
  let applied = 0;
  useMission.setState((prev) => {
    const cur = prev.state.morale;
    const nextVal = Math.max(0, Math.min(100, cur + delta));
    applied = nextVal - cur;
    if (applied === 0) return prev;
    return {
      state: {
        ...prev.state,
        morale: nextVal,
      },
    };
  });
  return applied;
}

/**
 * Sistema de Frio Extremo Noturno (ColdSystem).
 * - À noite (night > 0.6), a saída da base é bloqueada (`blockExitFromBase(true)`).
 * - Se o astronauta estiver fora ou sair da base à noite, sua velocidade é reduzida para ~0.25.
 * - Após ~6 segundos de exposição contínua ao frio, sofre hipotermia severa:
 *   a tela escurece, é teletransportado à enfermaria e sofre penalidade de moral.
 * - Ao amanhecer (night <= 0.6), a saída é liberada e a velocidade volta ao normal.
 * - Registra ações de desenvolvedor: "Forçar noite" e "Forçar dia".
 */
export class ColdSystem implements GameSystem {
  readonly id = 'survival-cold';

  private exposureTimer = 0;
  private isSlowed = false;
  private unregisterDevActions: Array<() => void> = [];

  constructor() {
    this.registerDevHooks();
  }

  getExposureTimer(): number {
    return this.exposureTimer;
  }

  setExposureTimer(val: number): void {
    this.exposureTimer = val;
  }

  update(dt: number, ctx: SystemContext): void {
    if (dt <= 0) return;
    // minigame aberto: o frio não conta enquanto o jogador resolve a tarefa
    if (isGameOverlayOpenCached()) return;

    const override = useCold.getState().overrideNight;
    const isNight = override !== null ? override : ctx.night > COLD_SETTINGS.NIGHT_THRESHOLD;

    if (isNight) {
      if (ctx.insideBase) {
        // Bloqueia a saída da base durante a noite gelada
        ctx.blockExitFromBase(true);

        // Dentro da base o astronauta se aquece imediatamente
        this.exposureTimer = 0;
        if (this.isSlowed) {
          ctx.setPlayerSpeedScale(1.0);
          this.isSlowed = false;
        }
      } else {
        // Fora da base à noite: sofre com o frio extremo
        if (!this.isSlowed) {
          ctx.setPlayerSpeedScale(COLD_SETTINGS.COLD_SPEED_SCALE);
          this.isSlowed = true;
        }

        this.exposureTimer += dt;

        if (this.exposureTimer >= COLD_SETTINGS.COLD_EXPOSURE_LIMIT) {
          this.handleHypothermiaFaint(ctx);
          return;
        }
      }
    } else {
      // De dia: saída livre e velocidade restaurada
      ctx.blockExitFromBase(false);
      this.exposureTimer = 0;
      if (this.isSlowed) {
        ctx.setPlayerSpeedScale(1.0);
        this.isSlowed = false;
      }
    }

    useCold.setState({
      isNight,
      isExposed: isNight && !ctx.insideBase,
      exposureTime: this.exposureTimer,
      maxExposure: COLD_SETTINGS.COLD_EXPOSURE_LIMIT,
      overrideNight: override,
    });
  }

  private handleHypothermiaFaint(ctx: SystemContext): void {
    this.exposureTimer = 0;

    // 1. Escurece a tela
    ctx.fadeScreen(1.0, 600);

    // 2. Sem teleporte: o astronauta fica onde está (o aquecedor do traje o reanima)

    // 3. Gasta um pouco do oxigênio da base no aquecimento de emergência
    adjustBaseOxygen(-COLD_SETTINGS.COLD_OXYGEN_COST);

    // 4. Restaura a velocidade normal do astronauta
    ctx.setPlayerSpeedScale(1.0);
    this.isSlowed = false;

    // 5. Notifica o jogador
    toast(
      'Hipotermia: o traje usou o aquecimento de emergência. Volte para dentro da base!',
      'error',
    );

    // 6. Clareia a tela de volta
    setTimeout(() => {
      ctx.fadeScreen(0.0, 1000);
      useCold.setState({
        isExposed: false,
        exposureTime: 0,
      });
    }, 700);
  }

  private registerDevHooks(): void {
    this.unregisterDevActions.push(
      registerDevAction({
        id: 'cold-force-night',
        label: 'Forçar noite (-80°C)',
        group: 'Sobrevivência',
        run: () => {
          useCold.getState().setOverrideNight(true);
          toast('Modo Dev: Noite forçada (frio extremo ativo).', 'info');
        },
      }),
    );

    this.unregisterDevActions.push(
      registerDevAction({
        id: 'cold-force-day',
        label: 'Forçar dia (Clima ameno)',
        group: 'Sobrevivência',
        run: () => {
          useCold.getState().setOverrideNight(false);
          toast('Modo Dev: Dia forçado (saída liberada).', 'ok');
        },
      }),
    );

    this.unregisterDevActions.push(
      registerDevAction({
        id: 'cold-reset-cycle',
        label: 'Restaurar ciclo solar',
        group: 'Sobrevivência',
        run: () => {
          useCold.getState().setOverrideNight(null);
          toast('Modo Dev: Ciclo solar normal restaurado.', 'info');
        },
      }),
    );
  }

  dispose(): void {
    for (const unregister of this.unregisterDevActions) {
      unregister();
    }
    this.unregisterDevActions = [];
    this.isSlowed = false;
    this.exposureTimer = 0;
  }
}
