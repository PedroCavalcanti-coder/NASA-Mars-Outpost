import { create } from 'zustand';
import { useMission } from '../../store/mission';
import { toast } from '../../ui/toast';
import type { SystemContext } from '../systems/context';
import type { GameSystem } from '../systems/registry';
import { adjustBaseOxygen } from './OxygenSystem';
import { NAP_SETTINGS } from './types';

export interface NapState {
  /** O astronauta está dormindo (a tela escurece enquanto a noite passa) */
  isSleeping: boolean;
  /** As condições atuais permitem dormir (noite, dentro da base, sem tempestade forte) */
  canNap: boolean;
  /** Motivo descritivo quando dormir estiver bloqueado */
  reasonBlocked: string | null;
  /** Dorme agora, se permitido */
  startNap: () => boolean;
  /** Dorme agora, se permitido (acordar é automático ao amanhecer) */
  toggleNap: () => void;
  /** dorme já, sem pedir o consenso da sala (usado quando todos apertaram) */
  forceStart: () => boolean;
  /** a sala exige que todos apertem para dormir: quem registra a porta cuida disso */
  setGate: (gate: (() => void) | null) => void;
}

// Referência ao sistema ativo para comandos disparados pela interface React ou atalhos
let activeNapSystem: NapSystem | null = null;
let sleepGate: (() => void) | null = null;

export const useNap = create<NapState>(() => ({
  isSleeping: false,
  canNap: false,
  reasonBlocked: null,
  startNap: () => activeNapSystem?.requestStartNap() ?? false,
  toggleNap: () => {
    activeNapSystem?.requestStartNap();
  },
  forceStart: () => activeNapSystem?.startNow() ?? false,
  setGate: (gate) => {
    sleepGate = gate;
  },
}));

const FADE_OUT_MS = 800;
const BLACK_MS = 700;
const FADE_IN_MS = 1000;

/**
 * Sistema de Sono (NapSystem).
 * - Só se dorme à noite, DENTRO da base e sem tempestade forte (botão do painel, cama ou tecla Z).
 * - Dormir faz a noite passar: a tela escurece, o relógio vai até o amanhecer e o astronauta acorda.
 * - Custo: a base continua respirando (oxigênio por hora dormida) e há uma refeição (mantimentos).
 * - Não mexe na moral.
 */
export class NapSystem implements GameSystem {
  readonly id = 'survival-nap';

  private isSleeping = false;
  private canNapCurrent = false;
  private reasonBlockedCurrent: string | null = null;
  private lastContext: SystemContext | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

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

  /** Pedido de dormir (botão, tecla Z, cama, ícone): se há porta de consenso, ela decide. */
  requestStartNap(): boolean {
    if (this.isSleeping) return true;
    if (sleepGate && this.canNapCurrent) {
      sleepGate();
      return true;
    }
    return this.startNow();
  }

  startNow(): boolean {
    if (this.isSleeping) return true;
    const ctx = this.lastContext;
    if (!this.canNapCurrent || !ctx) {
      if (this.reasonBlockedCurrent) toast(this.reasonBlockedCurrent, 'error');
      return false;
    }

    this.isSleeping = true;
    ctx.setPlayerSleeping(true);
    ctx.fadeScreen(1.0, FADE_OUT_MS);
    this.syncState();

    this.later(FADE_OUT_MS, () => {
      const hours = ctx.sleepUntil(NAP_SETTINGS.WAKE_HOUR);
      if (hours <= 0) {
        // sem permissão para mexer no relógio (outro jogador coordena a sala)
        this.finish(ctx, 0);
        return;
      }
      adjustBaseOxygen(-Math.round(hours * NAP_SETTINGS.OXYGEN_PER_HOUR));
      useMission.getState().run({
        type: 'reward',
        tone: 'info',
        title: 'Noite de sono',
        text: `Você dormiu ${Math.round(hours)} h. A base gastou oxigênio e uma refeição.`,
        deltas: { supplies: -NAP_SETTINGS.SUPPLIES_COST },
      });
      this.later(BLACK_MS, () => this.finish(ctx, hours));
    });
    return true;
  }

  private finish(ctx: SystemContext, hours: number) {
    ctx.fadeScreen(0.0, FADE_IN_MS);
    ctx.setPlayerSleeping(false);
    this.isSleeping = false;
    if (hours > 0) {
      toast(`☀️ Você dormiu ${Math.round(hours)} h e acordou ao amanhecer.`, 'ok');
    }
    this.syncState();
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  update(_dt: number, ctx: SystemContext): void {
    this.lastContext = ctx;

    if (!ctx.insideBase || ctx.driving) {
      this.canNapCurrent = false;
      this.reasonBlockedCurrent = 'Dormir requer estar protegido no interior da base.';
    } else if (ctx.night < NAP_SETTINGS.MIN_NIGHT_TO_SLEEP) {
      this.canNapCurrent = false;
      this.reasonBlockedCurrent = 'Ainda não é noite: só dá para dormir depois que o sol se põe.';
    } else if (ctx.storm >= NAP_SETTINGS.MAX_STORM_FOR_NAP) {
      this.canNapCurrent = false;
      this.reasonBlockedCurrent = 'A tempestade de areia está muito forte e ruidosa para dormir.';
    } else if ((useMission.getState().state.resources.supplies?.value ?? 0) < 1) {
      this.canNapCurrent = false;
      this.reasonBlockedCurrent = 'Sem mantimentos para a refeição da noite.';
    } else {
      this.canNapCurrent = true;
      this.reasonBlockedCurrent = null;
    }

    if (this.isSleeping) ctx.setPlayerSleeping(true);
    this.syncState();
  }

  private syncState(): void {
    const cur = useNap.getState();
    if (
      cur.isSleeping === this.isSleeping &&
      cur.canNap === this.canNapCurrent &&
      cur.reasonBlocked === this.reasonBlockedCurrent
    )
      return;
    useNap.setState({
      isSleeping: this.isSleeping,
      canNap: this.canNapCurrent,
      reasonBlocked: this.reasonBlockedCurrent,
    });
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Ignora se estiver digitando em campo de texto
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if ((e.key === 'z' || e.key === 'Z') && !e.repeat) {
      e.preventDefault();
      this.requestStartNap();
    }
  };

  private setupListeners(): void {
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.handleKeyDown);
  }

  private removeListeners(): void {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.handleKeyDown);
  }

  dispose(): void {
    this.removeListeners();
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.isSleeping && this.lastContext) {
      this.lastContext.setPlayerSleeping(false);
      this.lastContext.fadeScreen(0.0, 200);
    }
    this.isSleeping = false;
    if (activeNapSystem === this) activeNapSystem = null;
  }
}
