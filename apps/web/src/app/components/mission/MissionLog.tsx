import type { DeltaKey } from '@mars/sim';
import { useMission } from '../../../store/mission';

const LABEL: Record<DeltaKey, string> = {
  energy: 'energia',
  supplies: 'mantimentos',
  materials: 'materiais',
  oxygen: 'oxigênio',
  research: 'dados',
  morale: 'moral',
};

/** Diário da missão: ações, fim de sol, eventos e crises (mais recente primeiro). */
export function MissionLog() {
  const log = useMission((m) => m.state.log);
  if (!log.length) {
    return (
      <div className="mission-log mission-log--empty">
        Sol 1: escolha até 3 ações e depois encerre o sol. Junte 100% de dados para vencer.
      </div>
    );
  }
  return (
    <ol className="mission-log" aria-label="Diário da missão" aria-live="polite">
      {log.slice(0, 6).map((e) => (
        <li key={e.id} className={`mission-log__item is-${e.tone}`}>
          <div className="mission-log__head">
            <span className="mission-log__sol">S{e.sol}</span>
            <strong>{e.title}</strong>
          </div>
          <p>{e.text}</p>
          {Object.keys(e.deltas).length > 0 && (
            <div className="mission-log__deltas">
              {(Object.entries(e.deltas) as [DeltaKey, number][]).map(([k, v]) => (
                <span key={k} className={v > 0 ? 'is-up' : 'is-down'}>
                  {v > 0 ? '+' : '−'}
                  {Math.abs(v)} {LABEL[k]}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
