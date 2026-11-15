import { MAX_SOLS, RESEARCH_GOAL } from '@mars/sim';
import { FlaskConical } from 'lucide-react';
import { useMission } from '../../../store/mission';
import { DeltaChip } from './DeltaChip';
import { L } from '../../../lib/i18n';

/** Barra de dados científicos coletados: o objetivo da missão (100% = vitória). */
export function ResearchBar() {
  const research = useMission((m) => m.state.research);
  const sol = useMission((m) => m.state.sol);
  const feedback = useMission((m) => m.feedback);
  const pct = Math.round((research / RESEARCH_GOAL) * 100);
  const change = feedback?.deltas.research ?? 0;
  const pulse = change > 0 ? 'is-gain' : change < 0 ? 'is-loss' : '';

  return (
    <div className="mission-research">
      <div className="mission-research__head">
        <FlaskConical size={16} aria-hidden="true" />
        <span>{L('Dados coletados', 'Data collected')}</span>
        <strong>{pct}%</strong>
        {change !== 0 && feedback && <DeltaChip key={feedback.key} value={change} />}
        <span className="mission-research__sol">
          Sol {sol}/{MAX_SOLS}
        </span>
      </div>
      <div
        key={feedback?.key}
        className={`mission-research__track ${pulse}`}
        role="progressbar"
        aria-label={L('Dados científicos coletados', 'Science data collected')}
        aria-valuemin={0}
        aria-valuemax={RESEARCH_GOAL}
        aria-valuenow={research}
        aria-valuetext={`${research} de ${RESEARCH_GOAL} pontos de dados`}
      >
        <div className="mission-research__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
