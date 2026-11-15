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
export function adjustBaseOxygen(delta: number): number {
  let applied = 0;
  useMission.setState((prev) => {
    const res = prev.state.resources.oxygen;
    if (!res) return prev;
    const nextVal = Math.max(0, Math.min(res.max, res.value + delta));
    applied = nextVal - res.value;
    if (applied === 0) return prev;
    return {
      state: {
        ...prev.state,
        resources: {
          ...prev.state.resources,
          oxygen: { ...res, value: nextVal },
        },
      },
    };
  });
  return applied;
}

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
  readonly id = 'survival-oxygen';

  private tank: number = OXYGEN_SETTINGS.INITIAL_TANK;
  private isFainting = false;

  constructor(initialTank?: number) {
    if (typeof initialTank === 'number') {
      this.tank = initialTank;
      useOxygen.getState().setTank(initialTank);
    }
  }

  getTank(): number {
    return this.tank;
  }

  setTank(val: number): void {
    this.tank = Math.max(0, Math.min(OXYGEN_SETTINGS.MAX_TANK, val));
    useOxygen.getState().setTank(this.tank);
  }

  update(dt: number, ctx: SystemContext): void {
    if (dt <= 0 || this.isFainting) return;
    // minigame aberto: o tempo de traje não corre (terminar a tarefa não pode custar o tanque)
    if (isGameOverlayOpenCached()) return;

    // Dirigir o rover conta como estar fora da base (no exterior)
    const insideSafe = (ctx.insideBase && !ctx.driving) || ctx.sheltered === true;
    const baseOxygenAvailable = useMission.getState().state.resources.oxygen?.value ?? 0;

    if (insideSafe) {
      // Recarrega tanque pessoal consumindo da base
      if (this.tank < OXYGEN_SETTINGS.MAX_TANK) {
        const { tankRefill, baseCost } = calculateRefill(dt, this.tank, baseOxygenAvailable);
        if (baseCost > 0) {
          adjustBaseOxygen(-baseCost);
        }
        this.tank = Math.min(OXYGEN_SETTINGS.MAX_TANK, this.tank + tankRefill);
      }
    } else {
      // Descarrega o tanque pessoal
      const drain = calculateDrain(dt, ctx.storm);
      this.tank = Math.max(0, this.tank - drain);

      if (this.tank <= 0) {
        this.triggerFaintSequence(ctx);
        return;
      }
    }

    const isLow = this.tank < OXYGEN_SETTINGS.LOW_ALERT_THRESHOLD;
    let status: OxygenStatus = 'safe';
    if (!insideSafe) {
      status = isLow ? 'critical' : 'consuming';
    } else if (this.tank <= 0) {
      status = 'depleted';
    }

    useOxygen.setState({
      tank: this.tank,
      isInside: insideSafe,
      isDriving: ctx.driving,
      isLow,
      storm: ctx.storm,
      baseOxygen: baseOxygenAvailable,
      status,
      isFainting: this.isFainting,
    });
  }

  private triggerFaintSequence(ctx: SystemContext): void {
    this.isFainting = true;
    this.tank = 0;

    useOxygen.setState({
      tank: 0,
      isLow: true,
      status: 'depleted',
      isFainting: true,
    });

    // 1. Escurece a tela suavemente
    ctx.fadeScreen(1.0, 600);

    // 2. Teleporta para a enfermaria central (sala de Medicina ou Habitação)
    ctx.teleportPlayerTo(ctx.getInfirmaryPoint());

    // 3. Tanque pessoal recebe oxigênio emergencial de reanimação (25%)
    this.tank = OXYGEN_SETTINGS.FAINT_RESPAWN_TANK;

    // 4. A base paga a taxa de oxigênio de suporte à vida do socorro
    adjustBaseOxygen(-OXYGEN_SETTINGS.FAINT_BASE_OXYGEN_COST);

    // 5. Notifica o jogador
    toast('Você desmaiou sem oxigênio e foi socorrido na enfermaria (-5 de O₂ da base).', 'error');

    // 6. Clareia a tela de volta após o socorro
    setTimeout(() => {
      ctx.fadeScreen(0.0, 1000);
      this.isFainting = false;
      useOxygen.setState({
        tank: this.tank,
        isLow: false,
        status: 'safe',
        isFainting: false,
      });
    }, 700);
  }

  dispose(): void {
    this.isFainting = false;
  }
}
