/**
 * Componentes de slots padrão do grupo 'essencial'.
 *
 * Fornece a barra compacta de Oxigênio do astronauta, o Relógio Marciano
 * e o Mostrador de Alertas Ativos.
 */

import { GAME_SOL_SECONDS, MARS_SOL_LABEL } from '@mars/shared';
import { RESEARCH_GOAL } from '@mars/sim';
import {
  AlertTriangle,
  CloudSun,
  Droplet,
  Fan,
  FlaskConical,
  Moon,
  Shield,
  Sun,
  Wheat,
  Wind,
  Zap,
} from 'lucide-react';
import { useBaseOps } from '../../../../game/tasks/store';
import { useMission } from '../../../../store/mission';
import { OxygenOrb } from './OxygenOrb';

interface OxygenSlotProps {
  /** Nível de oxigênio (0..100). Caso não fornecido, busca fallback ou exibe nominal */
  oxygenLevel?: number;
}

/** Slot Essencial: Oxigênio do Astronauta (sempre visível no topo) */
export function DefaultOxygenSlot({ oxygenLevel }: OxygenSlotProps) {
  return <OxygenOrb level={oxygenLevel ?? 100} />;
}

/** Indicador semicircular compartilhado pelos recursos da base. */
function ResourceGauge({ kind }: { kind: 'energy' | 'supplies' | 'armor' }) {
  const resource = useMission((m) => m.state.resources[kind]);
  const labels = { energy: 'Energia', supplies: 'Mantimentos', armor: 'Blindagem' };
  const Icon = kind === 'energy' ? Zap : kind === 'supplies' ? Wheat : Shield;
  const pct = Math.max(
    0,
    Math.min(100, Math.round((resource.value / Math.max(1, resource.max)) * 100)),
  );
  const fractures = useBaseOps((s) => s.integrity?.fractures.length ?? 0);
  return (
    <div
      data-level={
        kind === 'armor'
          ? pct === 0
            ? 'emergency'
            : pct <= 25
              ? 'critical'
              : pct <= 50
                ? 'warning'
                : 'normal'
          : undefined
      }
      className={`hud-resource-gauge hud-resource-gauge--${kind}`}
      data-resource-gauge={kind}
      data-bit-target={kind}
      role="status"
      title={`${labels[kind]}: ${resource.value}/${resource.max}`}
      aria-label={`${labels[kind]}: ${resource.value} de ${resource.max}, ${pct}%${kind === 'armor' ? `, ${fractures} fraturas abertas` : ''}`}
    >
      <div className="hud-resource-gauge__dial" aria-hidden="true">
        <svg viewBox="0 0 100 90">
          <path
            className="hud-resource-gauge__track"
            d="M 18 70 A 39 39 0 1 1 82 70"
            pathLength="100"
          />
          <path
            className="hud-resource-gauge__fill"
            d="M 18 70 A 39 39 0 1 1 82 70"
            pathLength="100"
            strokeDasharray={`${pct} 100`}
          />
        </svg>
        {kind === 'supplies' ? (
          <span className="hud-resource-gauge__icon hud-resource-gauge__supplies-icon">
            <Wheat size={23} strokeWidth={2.5} />
            <Droplet size={15} strokeWidth={2.5} />
          </span>
        ) : (
          <Icon className="hud-resource-gauge__icon" size={24} strokeWidth={2.5} />
        )}
      </div>
      <span className="hud-resource-gauge__value">{pct}%</span>
    </div>
  );
}

export function BatterySlot() {
  return <ResourceGauge kind="energy" />;
}

export function ResourceSlot({ kind }: { kind: 'supplies' | 'armor' }) {
  return <ResourceGauge kind={kind} />;
}

export function ResearchSlot() {
  const research = useMission((m) => m.state.research);
  const secured = useMission((m) => m.state.secured ?? 0);
  const pct = Math.max(0, Math.min(100, (research / RESEARCH_GOAL) * 100));
  const securedPct = Math.max(0, Math.min(100, (secured / RESEARCH_GOAL) * 100));
  const pending = Math.max(0, research - secured);
  return (
    <div className="hud-research" data-bit-target="research" aria-label="Progresso da pesquisa">
      <div className="hud-research__heading">
        <span>
          <FlaskConical size={15} aria-hidden="true" /> Pesquisa
        </span>
        <span>
          {research} / {RESEARCH_GOAL}
        </span>
        <span
          className="hud-research__pending"
          title="Pontos ainda na base: envie à Terra no computador para protegê-los"
        >
          {pending >= 10 ? '📡 enviar' : `${pending} na base`}
        </span>
      </div>
      <div
        className="hud-research__track"
        role="progressbar"
        aria-label="Pesquisa"
        aria-valuemin={0}
        aria-valuemax={RESEARCH_GOAL}
        aria-valuenow={research}
      >
        <div
          className="hud-research__fill hud-research__fill--pending"
          style={{ width: `${pct}%` }}
        />
        <div
          className="hud-research__fill hud-research__fill--secured"
          style={{ width: `${securedPct}%` }}
        />
      </div>
    </div>
  );
}

interface ClockSlotProps {
  marsTime: {
    sol: number;
    formatted: string;
    isDay: boolean;
  };
}

/** Slot Essencial: Relógio Marciano e Ciclo Sol (Conversa 3 acopla controles aqui) */
export function DefaultClockSlot({ marsTime }: ClockSlotProps) {
  return (
    <div
      className="hud-essential-slot hud-essential-clock"
      role="status"
      title={`Um Sol marciano dura ${MARS_SOL_LABEL} (mais que o dia terrestre). No jogo, cada ${Math.round(GAME_SOL_SECONDS / 60)} minutos reais = 1 Sol.`}
      aria-label={`Relógio Marciano: Sol ${marsTime.sol}, ${marsTime.formatted} LMST, ${
        marsTime.isDay ? 'Dia' : 'Noite'
      }`}
    >
      <span className="hud-essential-clock__icon" aria-hidden="true">
        {marsTime.isDay ? (
          <Sun size={15} className="hud-icon-sun" />
        ) : (
          <Moon size={15} className="hud-icon-moon" />
        )}
      </span>
      <span className="hud-essential-clock__sol">SOL {marsTime.sol}</span>
      <span className="hud-essential-clock__divider" aria-hidden="true">
        ·
      </span>
      <span className="hud-essential-clock__time">{marsTime.formatted} LMST</span>
      <span className="hud-essential-clock__badge">{marsTime.isDay ? 'DIA' : 'NOITE'}</span>
    </div>
  );
}

interface AlertSlotProps {
  stormActive: boolean;
  marsTime: { isDay: boolean };
}

/** Slot Essencial: Alerta Ativo Compacto (tempestade, frio noturno, apagão) */
export function DefaultAlertSlot({ stormActive, marsTime }: AlertSlotProps) {
  const energy = useMission((m) => m.state.resources.energy.value);
  const blackout = energy <= 0;
  const clogged = useBaseOps((s) => s.active && s.filterClogged);

  if (blackout) {
    return (
      <div
        className="hud-essential-slot hud-essential-alert hud-essential-alert--danger"
        role="alert"
      >
        <AlertTriangle size={15} />
        <span>APAGÃO NA BASE</span>
      </div>
    );
  }

  if (clogged) {
    return (
      <div
        className="hud-essential-slot hud-essential-alert hud-essential-alert--danger"
        role="alert"
      >
        <Fan size={15} />
        <span>FILTRO DE AR ENTUPIDO</span>
      </div>
    );
  }

  if (stormActive) {
    return (
      <div
        className="hud-essential-slot hud-essential-alert hud-essential-alert--storm"
        role="alert"
      >
        <Wind size={15} />
        <span>TEMPESTADE DE AREIA</span>
      </div>
    );
  }

  if (!marsTime.isDay) {
    return (
      <div
        className="hud-essential-slot hud-essential-alert hud-essential-alert--night"
        role="status"
      >
        <Moon size={15} />
        <span>FRIO NOTURNO (-60°C)</span>
      </div>
    );
  }

  return (
    <div
      className="hud-essential-slot hud-essential-alert hud-essential-alert--nominal"
      role="status"
    >
      <CloudSun size={15} />
      <span>SISTEMAS NOMINAIS</span>
    </div>
  );
}
