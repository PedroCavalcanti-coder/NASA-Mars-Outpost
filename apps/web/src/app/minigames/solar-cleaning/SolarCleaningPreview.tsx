import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import { SolarPanelIllustration } from './SolarPanelIllustration';
import './solarCleaning.css';
import { L } from '../../../lib/i18n';

/**
 * Limpeza do painel solar. Sozinho (rota de prévia) pode repetir; dentro da base, `onComplete`
 * avisa o jogo uma única vez e o botão vira "Voltar à base".
 */
export default function SolarCleaningPreview({
  onClose,
  onComplete,
  panels = 1,
}: {
  onClose?: () => void;
  onComplete?: () => void;
  /** quantos painéis lavar neste minigame (a missão lava 2 de uma vez) */
  panels?: number;
}) {
  const { closeButton, close } = usePreviewClose(onClose);
  const [complete, setComplete] = useState(false);
  const [round, setRound] = useState(0);
  const [cleaned, setCleaned] = useState(0);
  // um painel limpo: passa para o próximo; no último, a limpeza termina
  const cleanedRef = useRef(0);
  const finish = useCallback(() => {
    const next = cleanedRef.current + 1;
    cleanedRef.current = next;
    setCleaned(next);
    if (next >= panels) setComplete(true);
    else window.setTimeout(() => setRound((r) => r + 1), 700);
  }, [panels]);
  const reported = useRef(false);
  useEffect(() => {
    if (!complete || !onComplete || reported.current) return;
    reported.current = true;
    onComplete();
  }, [complete, onComplete]);
  return (
    <main
      className="solar-preview"
      aria-label={L('Prévia: limpeza do painel solar', 'Solar panel cleaning')}
      data-complete={complete}
    >
      <div className="solar-landscape" aria-hidden="true">
        <div className="solar-distant-ridge" />
        <div className="solar-near-ridge" />
        <div className="solar-ground" />
      </div>
      <SolarPanelIllustration key={round} onComplete={finish} />
      {!complete && panels > 1 && (
        <div className="solar-progress" role="status">
          ☀️ {L('Painel', 'Panel')} {Math.min(cleaned + 1, panels)} {L('de', 'of')} {panels}
          {cleaned > 0 && cleaned < panels ? L(' · o anterior já está limpo ✅', ' · the previous one is clean ✅') : ''}
        </div>
      )}
      <div className="solar-result" role="status" aria-live="polite">
        {complete && (
          <>
            <p>{panels > 1 ? `${panels} painéis limpos.` : L('Painel limpo.', 'Panel clean.')} Energia restaurada.</p>
            {onComplete ? (
              <button type="button" onClick={close}>
                {L('Voltar à base', 'Back to base')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setComplete(false);
                  cleanedRef.current = 0;
                  setCleaned(0);
                  setRound((value) => value + 1);
                }}
              >
                {L('Limpar novamente', 'Clean again')}
              </button>
            )}
          </>
        )}
      </div>
      <button
        ref={closeButton}
        className="solar-close"
        type="button"
        onClick={close}
        aria-label={L('Fechar prévia', 'Close')}
        title={L('Fechar prévia (Esc)', 'Close (Esc)')}
      >
        <X size={22} aria-hidden="true" />
      </button>
    </main>
  );
}
