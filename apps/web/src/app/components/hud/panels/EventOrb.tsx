import {
  Cloud,
  Fan,
  type LucideIcon,
  Moon,
  Radiation,
  ShieldAlert,
  Snowflake,
  Sun,
  Tablet,
  Tornado,
  Wind,
  ZapOff,
} from 'lucide-react';
import { useGameEvents } from '../../../../game/events/store';
import { useCold } from '../../../../game/survival/ColdSystem';
import { useBaseOps } from '../../../../game/tasks/store';
import { useMission } from '../../../../store/mission';
import './eventOrb.css';
import { L } from '../../../../lib/i18n';

const FX_ICON: Record<string, LucideIcon> = {
  blizzard: Snowflake,
  meteor: Wind,
  radiation: Radiation,
  dust_devil: Tornado,
  ice_clouds: Cloud,
};

/** Evento atual, ao lado da esfera de oxigênio e do ciclo marciano. */
export function EventOrb({ stormActive, isDay }: { stormActive: boolean; isDay: boolean }) {
  const extremeCold = useCold((s) => s.overrideNight ?? s.isNight);
  const blackout = useMission((s) => s.state.resources.energy.value <= 0);
  const clogged = useBaseOps((s) => s.active && s.filterClogged);

  const integrity = useBaseOps((s) => s.integrity);
  const damage = integrity?.fractures.reduce((n, f) => n + f.damage, 0) ?? 0;
  const pending = useGameEvents((s) => s.queue[0]);
  const event = pending
    ? { kind: 'tablet', label: pending.title, Icon: FX_ICON[pending.fx ?? ''] ?? Tablet }
    : damage >= 100
      ? { kind: 'blackout', label: L('Emergência: repare a blindagem', 'Emergency: repair the shielding'), Icon: ShieldAlert }
      : integrity?.event
        ? {
            kind: 'storm',
            label: {
              micrometeorite: L('Micrometeoritos', 'Micrometeorites'),
              dust_storm: L('Tempestade de poeira', 'Dust storm'),
              thermal_crack: L('Fratura térmica', 'Thermal crack'),
              discovery: L('Achado geológico', 'Geological find'),
              supply_drop: L('Cápsula de mantimentos', 'Supply capsule'),
              cleaning_wind: L('Vento de limpeza', 'Cleaning wind'),
            }[integrity.event.id],
            Icon: ShieldAlert,
          }
        : damage > 0
          ? {
              kind: 'filter',
              label: `${integrity!.fractures.length} fratura(s) — repare a blindagem`,
              Icon: ShieldAlert,
            }
          : stormActive
            ? { kind: 'storm', label: L('Tempestade de areia', 'Sandstorm'), Icon: Wind }
            : extremeCold
              ? { kind: 'cold', label: L('Frio extremo', 'Extreme cold'), Icon: Snowflake }
              : blackout
                ? { kind: 'blackout', label: L('Apagão na base', 'Base blackout'), Icon: ZapOff }
                : clogged
                  ? { kind: 'filter', label: L('Filtro de ar entupido', 'Air filter clogged'), Icon: Fan }
                  : {
                      kind: 'calm',
                      label: L('Sem eventos ativos', 'No active events'),
                      Icon: isDay ? Sun : Moon,
                    };
  const Icon = event.Icon;

  return (
    <div
      className="event-orb"
      data-bit-target="events"
      data-event={event.kind}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={0}
    >
      <Icon className="event-orb__icon" strokeWidth={2.5} aria-hidden="true" />
      <span className="event-orb__label">
        {event.label}
        {integrity?.event && damage > 0 ? ` · ${integrity.fractures.length} fratura(s)` : ''}
      </span>
    </div>
  );
}
