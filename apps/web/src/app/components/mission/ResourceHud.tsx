import { crises, type DeltaKey, type ResourceId, solForecast } from '@mars/sim';
import { HeartPulse, Shield, Wheat, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBaseOps } from '../../../game/tasks/store';
import { useMission } from '../../../store/mission';
import { DeltaChip } from './DeltaChip';

const RESOURCES: { id: ResourceId; name: string; icon: ReactNode }[] = [
  { id: 'energy', name: 'Bateria', icon: <Zap size={16} /> },
  { id: 'supplies', name: 'Mantimentos', icon: <Wheat size={16} /> },
  { id: 'armor', name: 'Blindagem', icon: <Shield size={16} /> },
];

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Energia, mantimentos e blindagem (e a moral da equipe), com alerta de nível baixo e crise. */
export function ResourceHud() {
  const s = useMission((m) => m.state);
  const feedback = useMission((m) => m.feedback);
  const forecast = solForecast(s);
  // na base 3D a energia é tempo real: geração dos painéis menos o consumo, por Sol
  const ops = useBaseOps();
  const energyRate = ops.active ? ops.generationPerSol - ops.loadPerSol : forecast.energy;
  const active = crises(s);

  const delta = (key: DeltaKey) =>
    feedback?.deltas[key] ? (
      <DeltaChip key={feedback.key} value={feedback.deltas[key] ?? 0} />
    ) : null;

  return (
    <div className="mission-resources">
      {RESOURCES.map(({ id, name, icon }) => {
        const { value, max } = s.resources[id];
        const pct = (value / max) * 100;
        const level = value <= 0 ? 'empty' : pct < 25 ? 'low' : 'ok';
        const perSol = id === 'energy' ? energyRate : id === 'supplies' ? forecast.supplies : 0;
        return (
          <div key={id} className={`mission-res mission-res--${id} is-${level}`}>
            <div className="mission-res__head">
              <span className="mission-res__icon" aria-hidden="true">
                {icon}
              </span>
              <span className="mission-res__name">{name}</span>
              <span className="mission-res__value">
                {value}
                <small>/{max}</small>
              </span>
              {delta(id)}
            </div>
            <div className="mission-res__track" aria-hidden="true">
              <div className="mission-res__fill" style={{ width: `${pct}%` }} />
            </div>
            {id !== 'armor' && (
              <span className={`mission-res__rate ${perSol < 0 ? 'is-neg' : ''}`}>
                {signed(perSol)} por sol
              </span>
            )}
          </div>
        );
      })}

      <div className="mission-morale">
        <HeartPulse size={14} aria-hidden="true" />
        <span>Moral</span>
        <strong className={s.morale < 30 ? 'is-low' : ''}>{s.morale}%</strong>
        {delta('morale')}
        <span className="mission-morale__solar">
          Painéis {Math.round(s.solarEfficiency * 100)}%
        </span>
      </div>

      {active.length > 0 && (
        <div className="mission-crisis" role="alert">
          {active.map((c) => (
            <span key={c}>
              {c === 'blackout' ? 'APAGÃO' : c === 'famine' ? 'FOME' : 'EMERGÊNCIA ESTRUTURAL'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
