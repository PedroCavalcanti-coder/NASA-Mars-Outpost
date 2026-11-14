import { X } from 'lucide-react';
import { usePreviewClose } from '../usePreviewClose';
import { GreenhouseIllustration } from './GreenhouseIllustration';
import { useGreenhouse } from './useGreenhouse';
import './greenhouse.css';

/** Playable preview, isolated from the base simulation. */
export default function GreenhousePreview({ onClose }: { onClose?: () => void }) {
  const { close, closeButton } = usePreviewClose(onClose);
  const game = useGreenhouse();
  return (
    <main
      className="greenhouse-preview"
      aria-label="Cuidados com a plantação"
      data-complete={game.complete}
    >
      <div className="greenhouse-backdrop" aria-hidden="true" />
      <GreenhouseIllustration game={game} />
      <div className="greenhouse-announcement" role="status" aria-live="polite">
        {game.complete ? 'Plantação recuperada. Todos os canteiros estão saudáveis.' : ''}
      </div>
      <button
        ref={closeButton}
        className="greenhouse-close"
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
