import { ACTIONS, type ActionId, checkAction, type ResourceId } from '@mars/sim';
import { FlaskConical, Hammer, Microscope, Moon, Pickaxe, Sprout, Sun, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMission } from '../../../store/mission';

const ICONS: Record<ActionId, ReactNode> = {
  research: <FlaskConical size={18} />,
  expedition: <Truck size={18} />,
  mine: <Pickaxe size={18} />,
  maintain: <Hammer size={18} />,
  build_solar: <Sun size={18} />,
  build_greenhouse: <Sprout size={18} />,
  build_lab: <Microscope size={18} />,
};

const GROUPS: { title: string; actions: ActionId[] }[] = [
  { title: 'Operações', actions: ['research', 'expedition', 'mine', 'maintain'] },
  { title: 'Construir', actions: ['build_solar', 'build_greenhouse', 'build_lab'] },
];

const COST_LABEL: Record<ResourceId, string> = { energy: 'E', supplies: 'M', materials: 'Mt', oxygen: 'O₂' };

/** Ações do sol (cada uma gasta 1 das 3 ações) e o botão de encerrar o sol. */
export function ActionPanel() {
  const s = useMission((m) => m.state);
  const run = useMission((m) => m.run);
  const playing = s.status === 'playing';

  return (
    <section className="mission-actions" aria-label="Ações da base">
      {GROUPS.map((g) => (
        <div key={g.title} className="mission-actions__group">
          <span className="mission-actions__title">{g.title}</span>
          <div className="mission-actions__row">
            {g.actions.map((id) => {
              const def = ACTIONS[id];
              const check = checkAction(s, id);
              const reason = check.ok ? null : check.reason;
              const count = def.builds ? s.facilities[def.builds] : null;
              return (
                <button
                  key={id}
                  type="button"
                  className="mission-action"
                  disabled={!check.ok}
                  onClick={() => run({ type: 'action', action: id })}
                  title={`${def.description}${reason ? `\n${reason}` : ''}`}
                >
                  <span className="mission-action__icon" aria-hidden="true">
                    {ICONS[id]}
                  </span>
                  <span className="mission-action__name">
                    {def.name}
                    {count !== null && <small> ×{count}</small>}
                  </span>
                  <span className="mission-action__cost">
                    {(Object.entries(def.cost) as [ResourceId, number][]).map(([r, v]) => (
                      <span key={r} className={`cost cost--${r}`}>
                        −{v} {COST_LABEL[r]}
                      </span>
                    ))}
                  </span>
                  {reason && playing && s.actionsLeft > 0 && (
                    <span className="mission-action__reason">{reason}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="mission-endsol"
        disabled={!playing}
        onClick={() => run({ type: 'end_sol' })}
      >
        <Moon size={18} aria-hidden="true" />
        <span>
          Encerrar sol
          <small>
            {s.actionsLeft} {s.actionsLeft === 1 ? 'ação restante' : 'ações restantes'}
          </small>
        </span>
      </button>
    </section>
  );
}
