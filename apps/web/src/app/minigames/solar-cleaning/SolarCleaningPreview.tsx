import { X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import { SolarPanelIllustration } from './SolarPanelIllustration';
import './solarCleaning.css';

/** Playable preview, isolated from the base's simulation. */
export default function SolarCleaningPreview({ onClose }: { onClose?: () => void }) {
  const { closeButton, close } = usePreviewClose(onClose);
  const [complete, setComplete] = useState(false);
  const [round, setRound] = useState(0);
  const finish = useCallback(() => setComplete(true), []);
  return (
    <main
      className="solar-preview"
      aria-label="Prévia: limpeza do painel solar"
      data-complete={complete}
    >
      <div className="solar-landscape" aria-hidden="true">
        <div className="solar-distant-ridge" />
        <div className="solar-near-ridge" />
        <div className="solar-ground" />
      </div>
      <SolarPanelIllustration key={round} onComplete={finish} />
      <div className="solar-result" role="status" aria-live="polite">
        {complete && (
          <>
            <p>Painel limpo. Energia restaurada.</p>
            <button
              type="button"
              onClick={() => {
                setComplete(false);
                setRound((value) => value + 1);
              }}
            >
              Limpar novamente
            </button>
          </>
        )}
      </div>
      <button
        ref={closeButton}
        className="solar-close"
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
