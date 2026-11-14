import { create } from 'zustand';
import { useMission } from '../../store/mission';
import { toast } from '../../ui/toast';
import type { SystemContext } from '../systems/context';
import type { GameSystem } from '../systems/registry';
import { adjustBaseMorale } from './ColdSystem';
import { adjustBaseOxygen } from './OxygenSystem';
import { NAP_SETTINGS } from './types';

export interface NapState {
  /** Se o astronauta está cochilando no momento */
  isSleeping: boolean;
  /** Se as condições ambientais atuais permitem iniciar um cochilo */
  canNap: boolean;
  /** Motivo descritivo quando o cochilo estiver bloqueado */
  reasonBlocked: string | null;
  /** Nível de moral atual da tripulação da missão (0 a 100) */
  moraleLevel: number;
  /** Inicia o cochilo caso permitido */
  startNap: () => boolean;
  /** Acorda o astronauta imediatamente */
  wakeUp: () => void;
  /** Alterna entre dormir e acordar */
  toggleNap: () => void;
}

// Referência ao sistema ativo para comandos disparados pela interface React ou atalhos
let activeNapSystem: NapSystem | null = null;

export const useNap = create<NapState>(() => ({
  isSleeping: false,
  canNap: false,
  reasonBlocked: null,
  moraleLevel: 80,
  startNap: () => activeNapSystem?.requestStartNap() ?? false,
  wakeUp: () => activeNapSystem?.wakeUp(),
  toggleNap: () => {
    if (activeNapSystem?.isSleepingNow()) {
      activeNapSystem.wakeUp();
    } else {
      activeNapSystem?.requestStartNap();
    }
  },
}));

/**
 * Sistema de Descanso, Cochilo e Moral (NapSystem).
 * - Permite ao astronauta cochilar (botão no painel de ações ou atalho 'Z') apenas DENTRO da base e sem tempestade forte.
 * - Durante o cochilo: `setPlayerSleeping(true)`, a moral geral (`morale`) sobe até o teto (100) e consome pouco oxigênio da base.
 * - Acorda a qualquer instante (Z, clique ou Esc) restaurando `setPlayerSleeping(false)`.
 * - Expõe continuamente `moraleLevel` para a HUD.
 */
export class NapSystem implements GameSystem {
  readonly id = 'survival-nap';

  private isSleeping = false;
  private canNapCurrent = false;
  private reasonBlockedCurrent: string | null = null;
  private lastContext: SystemContext | null = null;

  constructor() {
    activeNapSystem = this;
    this.setupListeners();
  }

  isSleepingNow(): boolean {
    return this.isSleeping;
  }

  canNap(): boolean {
    return this.canNapCurrent;
  }

  getReasonBlocked(): string | null {
    return this.reasonBlockedCurrent;
  }

  requestStartNap(): boolean {
    if (this.isSleeping) return true;

    if (!this.canNapCurrent) {
      if (this.reasonBlockedCurrent) {
        toast(this.reasonBlockedCurrent, 'error');
      }
      return false;
    }

    this.isSleeping = true;
    if (this.lastContext) {
      this.lastContext.setPlayerSleeping(true);
    }
    toast('💤 Você começou a cochilar. A moral da equipe está se recuperando.', 'ok');
    this.syncState();
    return true;
  }

  wakeUp(): void {
    if (!this.isSleeping) return;

    this.isSleeping = false;
    if (this.lastContext) {
      this.lastContext.setPlayerSleeping(false);
    }
    toast('☀️ Você acordou descansado e pronto para o trabalho.', 'ok');
    this.syncState();
  }

  update(dt: number, ctx: SystemContext): void {
    this.lastContext = ctx;

    // Avalia restrições para cochilar
    if (!ctx.insideBase || ctx.driving) {
      this.canNapCurrent = false;
      this.reasonBlockedCurrent = 'Cochilar requer estar protegido no interior da base.';
    } else if (ctx.storm >= NAP_SETTINGS.MAX_STORM_FOR_NAP) {
      this.canNapCurrent = false;
      this.reasonBlockedCurrent = 'A tempestade de areia está muito forte e ruidosa para dormir.';
    } else {
      this.canNapCurrent = true;
      this.reasonBlockedCurrent = null;
    }

    if (this.isSleeping) {
      // Se as condições mínimas de segurança foram violadas, acorda o astronauta
      if (!ctx.insideBase || ctx.driving || ctx.storm >= 0.85) {
        this.wakeUp();
        toast('⚠️ Condições adversas acordaram você abruptamente!', 'error');
        return;
      }

      ctx.setPlayerSleeping(true);

      if (dt > 0) {
        // 1. Moral sobe progressivamente com o descanso até o teto de 100
        const moraleDelta = NAP_SETTINGS.MORALE_RECOVERY_RATE * dt;
        adjustBaseMorale(moraleDelta);

        // 2. Cochilo consome suavemente o oxigênio da base
        const o2Cost = NAP_SETTINGS.BASE_OXYGEN_NAP_DRAIN * dt;
        adjustBaseOxygen(-o2Cost);
      }
    }

    this.syncState();
  }

  private syncState(): void {
    const currentMorale = useMission.getState().state.morale;
    useNap.setState({
      isSleeping: this.isSleeping,
      canNap: this.canNapCurrent,
      reasonBlocked: this.reasonBlockedCurrent,
      moraleLevel: currentMorale,
    });
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Ignora se estiver digitando em campo de texto
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      if (this.isSleeping) {
        this.wakeUp();
      } else {
        this.requestStartNap();
      }
    } else if (e.key === 'Escape' && this.isSleeping) {
      e.preventDefault();
      this.wakeUp();
    }
  };

  private handlePointerDown = (): void => {
    // Clique do mouse ou toque na tela desperta o astronauta se estiver dormindo
    if (this.isSleeping) {
      this.wakeUp();
    }
  };

  private setupListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('pointerdown', this.handlePointerDown);
    }
  }

  private removeListeners(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('pointerdown', this.handlePointerDown);
    }
  }

  dispose(): void {
    this.removeListeners();
    if (this.isSleeping && this.lastContext) {
      this.lastContext.setPlayerSleeping(false);
    }
    this.isSleeping = false;
    if (activeNapSystem === this) {
      activeNapSystem = null;
    }
  }
}
