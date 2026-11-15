import { Fan, ShieldAlert, Moon, Snowflake, Sun, Wind, ZapOff } from 'lucide-react';
import { useCold } from '../../../../game/survival/ColdSystem';
import { useBaseOps } from '../../../../game/tasks/store';
import { useMission } from '../../../../store/mission';
import './eventOrb.css';

/** Evento atual, ao lado da esfera de oxigênio e do ciclo marciano. */
export function EventOrb({ stormActive, isDay }: { stormActive: boolean; isDay: boolean }) {
  const extremeCold = useCold((s) => s.overrideNight ?? s.isNight);
  const blackout = useMission((s) => s.state.resources.energy.value <= 0);
  const clogged = useBaseOps((s) => s.active && s.filterClogged);

  const integrity = useBaseOps((s) => s.integrity);
  const damage = integrity?.fractures.reduce((n, f) => n + f.damage, 0) ?? 0;
  const event =
    damage >= 100
      ? { kind: 'blackout', label: 'Emergência: repare a blindagem', Icon: ShieldAlert }
      : integrity?.event
        ? {
            kind: 'storm',
            label: {
              micrometeorite: 'Micrometeoritos',
              dust_storm: 'Tempestade de poeira',
              thermal_crack: 'Fratura térmica',
              discovery: 'Achado geológico',
              supply_drop: 'Cápsula de mantimentos',
              cleaning_wind: 'Vento de limpeza',
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
            ? { kind: 'storm', label: 'Tempestade de areia', Icon: Wind }
            : extremeCold
              ? { kind: 'cold', label: 'Frio extremo', Icon: Snowflake }
              : blackout
                ? { kind: 'blackout', label: 'Apagão na base', Icon: ZapOff }
                : clogged
                  ? { kind: 'filter', label: 'Filtro de ar entupido', Icon: Fan }
                  : {
                      kind: 'calm',
                      label: 'Sem eventos ativos',
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
