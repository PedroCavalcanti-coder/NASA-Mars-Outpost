import type { DeltaKey } from '@mars/sim';
import { useMission } from '../../../store/mission';
import { t, L } from '../../../lib/i18n';

const LABEL: Record<DeltaKey, string> = {
  energy: L('energia', 'power'),
  supplies: L('mantimentos', 'supplies'),
  armor: L('blindagem', 'shielding'),
  oxygen: L('oxigênio', 'oxygen'),
  research: L('dados', 'data'),
  morale: L('moral', 'morale'),
};

const TONE_ICON = { good: '✅', bad: '⚠️', info: '📝' } as const;

/**
 * Diário da missão: tudo o que foi feito no mundo (tarefas, missões, eventos, colheitas, sono,
 * crises), do mais recente para o mais antigo, agrupado por Sol.
 */
export function MissionLog() {
  const log = useMission((m) => m.state.log);
  if (!log.length) {
    return (
      <div className="mission-log mission-log--empty">
        {L('Nada registrado ainda. Tudo o que você e a tripulação fizerem na base aparece aqui.', 'Nothing logged yet. Everything you and the crew do at the base shows up here.')}
      </div>
    );
  }
  return (
    <ol className="mission-log" aria-label={L('Diário da missão', 'Mission log')} aria-live="polite">
      {log.map((e, i) => (
        <li key={e.id} className={`mission-log__item is-${e.tone}`}>
          {log[i - 1]?.sol !== e.sol && <h4 className="mission-log__day">Sol {e.sol}</h4>}
          <div className="mission-log__head">
            <span aria-hidden="true">{TONE_ICON[e.tone]}</span>
            <strong>{t(e.title)}</strong>
          </div>
          <p>{t(e.text)}</p>
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
