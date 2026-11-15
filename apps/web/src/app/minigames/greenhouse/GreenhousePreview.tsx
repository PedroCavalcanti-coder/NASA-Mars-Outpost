import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import { GreenhouseIllustration } from './GreenhouseIllustration';
import { useGreenhouse } from './useGreenhouse';
import './greenhouse.css';

/** Cuidado de um canteiro (água e luz). Dentro da base, `onComplete` avisa o jogo uma única vez. */
export default function GreenhousePreview({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: (result: { waterUsed: number }) => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const game = useGreenhouse();
  const reported = useRef(false);
  useEffect(() => {
    if (!game.complete || !onComplete || reported.current) return;
    reported.current = true;
    onComplete({ waterUsed: game.poured });
  }, [game.complete, game.poured, onComplete]);
  return (
    <main
      className="greenhouse-preview"
      aria-label="Cuidados com a plantação"
      data-complete={game.complete}
      data-in-base={onComplete ? true : undefined}
    >
      <div className="greenhouse-backdrop" aria-hidden="true" />
      <GreenhouseIllustration game={game} />
      <div className="greenhouse-water-used" role="status">
        💧 Água usada: {(game.poured * 10).toFixed(1)} L
        {onComplete && <small>sai do estoque da base</small>}
      </div>
      <div className="greenhouse-announcement" role="status" aria-live="polite">
        {game.complete ? 'Plantação recuperada. Todos os canteiros estão saudáveis.' : ''}
      </div>
      {game.complete && onComplete && (
        <button type="button" className="greenhouse-back" onClick={close}>
          Voltar à base
        </button>
      )}
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
