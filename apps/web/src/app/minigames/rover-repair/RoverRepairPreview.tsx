import { RotateCcw, X } from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import { RoverRepairIllustration } from './RoverRepairIllustration';
import { initialRepair, type RepairAction, repairInstructions, repairReducer } from './repairState';
import './roverRepair.css';

/** Standalone preview; onComplete lets a future equipment interaction report the repair. */
export default function RoverRepairPreview({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: () => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const [state, dispatch] = useReducer(repairReducer, initialRepair);
  const [activeBolt, setActiveBolt] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const pending = useRef(false);
  const complete = state.phase === 'complete' && mounted;
  // Finish a turn only after the wrench has visibly rotated. Cleanup cancels on close.
  useEffect(() => {
    if (activeBolt === null) return;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'bolt', index: activeBolt });
      pending.current = false;
      setActiveBolt(null);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeBolt]);
  useEffect(() => {
    if (state.phase !== 'complete') return;
    const timer = window.setTimeout(() => setMounted(true), 1600);
    return () => window.clearTimeout(timer);
  }, [state.phase]);
  const interact = (action: RepairAction) => {
    if (pending.current) return;
    if (action.type === 'bolt') {
      pending.current = true;
      setActiveBolt(action.index);
    } else dispatch(action);
  };
  const reported = useRef(false);
  useEffect(() => {
    if (complete && !reported.current) {
      reported.current = true;
      onComplete?.();
    }
  }, [complete, onComplete]);
  return (
    <main className="rover-repair-preview" aria-label="Reparo do rover" data-complete={complete}>
      <RoverRepairIllustration state={state} dispatch={interact} activeBolt={activeBolt} />
      <div className="rover-repair-instruction" role="status" aria-live="polite">
        <p>
          {state.phase === 'complete' && !mounted
            ? 'Recolocando a roda no rover…'
            : repairInstructions[state.phase]}
        </p>
        {complete && (
          <button
            type="button"
            onClick={
              onComplete
                ? close
                : () => {
                    reported.current = false;
                    setMounted(false);
                    dispatch({ type: 'reset' });
                  }
            }
          >
            <RotateCcw size={18} aria-hidden="true" />
            {onComplete ? 'Voltar à base' : 'Reparar novamente'}
          </button>
        )}
      </div>
      <button
        ref={closeButton}
        className="rover-repair-close"
        type="button"
        onClick={close}
        aria-label="Fechar prévia"
        title="Fechar prévia (Esc)"
      >
        <X size={22} aria-hidden="true" />
      </button>
    </main>
  );
}
