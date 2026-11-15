/**
 * Componentes de slots padrão do grupo 'essencial'.
 *
 * Fornece a barra compacta de Oxigênio do astronauta, o Relógio Marciano
 * e o Mostrador de Alertas Ativos.
 */

import { GAME_SOL_SECONDS, MARS_SOL_LABEL } from '@mars/shared';
import { AlertTriangle, BatteryCharging, CloudSun, Fan, Moon, Sun, Wind } from 'lucide-react';
import { useBaseOps } from '../../../../game/tasks/store';
import { useMission } from '../../../../store/mission';

interface OxygenSlotProps {
  /** Nível de oxigênio (0..100). Caso não fornecido, busca fallback ou exibe nominal */
  oxygenLevel?: number;
}

/** Slot Essencial: Oxigênio do Astronauta (sempre visível no topo) */
export function DefaultOxygenSlot({ oxygenLevel }: OxygenSlotProps) {
  // Conversa 5 integrará com o recurso real. Aqui mantemos valor seguro ou nominal.
  const level = oxygenLevel ?? 100;
  const isCritical = level < 25;
  const isWarning = level >= 25 && level < 50;

  const colorClass = isCritical
    ? 'hud-essential-ox--critical'
    : isWarning
      ? 'hud-essential-ox--warning'
      : 'hud-essential-ox--ok';

  return (
    <div
      className={`hud-essential-slot hud-essential-ox ${colorClass}`}
      role="status"
      title={`Nível de Oxigênio do Traje: ${Math.round(level)}%`}
      aria-label={`Oxigênio do astronauta: ${Math.round(level)}%`}
    >
      <div className="hud-essential-ox__label">
        <span className="hud-essential-ox__icon" aria-hidden="true">
          O₂
        </span>
        <span className="hud-essential-ox__value">{Math.round(level)}%</span>
      </div>
      <div className="hud-essential-ox__bar" aria-hidden="true">
        <div
          className="hud-essential-ox__fill"
          style={{ width: `${Math.max(0, Math.min(100, level))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Slot Essencial: bateria da base. Painéis carregam de dia; o suporte à vida consome sempre.
 * A seta mostra se está carregando (▲) ou descarregando (▼).
 */
export function BatterySlot() {
  const battery = useMission((m) => m.state.resources.energy);
  const gen = useBaseOps((s) => s.generationPerSol);
  const load = useBaseOps((s) => s.loadPerSol);
  const active = useBaseOps((s) => s.active);
  const pct = Math.round((battery.value / Math.max(1, battery.max)) * 100);
  const charging = active && gen > load;
  const level = pct < 15 ? 'critical' : pct < 35 ? 'warning' : 'ok';
  const trend = !active ? '' : charging ? '▲' : '▼';
  return (
    <div
      className={`hud-essential-slot hud-essential-ox hud-essential-battery hud-essential-ox--${level}`}
      role="status"
      title={`Bateria da base: ${battery.value}/${battery.max}. Geração ${gen}/Sol, consumo ${load}/Sol.`}
      aria-label={`Bateria da base: ${pct}%, ${charging ? 'carregando' : 'descarregando'}`}
    >
      <div className="hud-essential-ox__label">
        <span className="hud-essential-ox__icon" aria-hidden="true">
          <BatteryCharging size={14} />
        </span>
        <span className="hud-essential-ox__value">
          {pct}%{' '}
          <small className={charging ? 'is-up' : 'is-down'} aria-hidden="true">
            {trend}
          </small>
        </span>
      </div>
      <div className="hud-essential-ox__bar" aria-hidden="true">
        <div className="hud-essential-ox__fill" style={{ width: `${pct}%` }} />
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
