import { ArrowDown, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import { OXYGEN_DEBRIS, OxygenDebris, OxygenFilterIllustration } from './OxygenFilterIllustration';
import { useOxygenCleaning } from './useOxygenCleaning';
import './oxygenFilter.css';
import { L } from '../../../lib/i18n';

/** Troca do filtro de ar. Dentro da base, `onComplete` avisa o jogo uma única vez. */
export default function OxygenFilterPreview({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: () => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const game = useOxygenCleaning();
  const complete = game.removed.size === OXYGEN_DEBRIS.length;
  const reported = useRef(false);
  useEffect(() => {
    if (!complete || !onComplete || reported.current) return;
    reported.current = true;
    onComplete();
  }, [complete, onComplete]);
  const drag = game.active.current;
  return (
    <main
      className="oxygen-preview"
      aria-label={L('Limpeza do filtro de oxigênio', 'Oxygen filter cleaning')}
      data-complete={complete}
    >
      <div className="oxygen-habitat" aria-hidden="true">
        <div className="oxygen-porthole" />
        <div className="oxygen-pipe" />
      </div>
      <section className="oxygen-machine" aria-label={L('Painel de suporte à vida aberto', 'Open life support panel')}>
        <div className="oxygen-hinge oxygen-hinge--top" aria-hidden="true" />
        <div className="oxygen-hinge oxygen-hinge--bottom" aria-hidden="true" />
        <div className="oxygen-machine-interior">
          <section className="oxygen-cartridge" aria-label={L('Cartucho do filtro', 'Filter cartridge')}>
            <OxygenFilterIllustration
              removed={game.removed}
              selected={game.selected}
              dragging={game.dragging}
              onDown={game.down}
              onMove={game.move}
              onUp={game.up}
              onCancel={game.cancelPointer}
              onSelect={game.select}
            />
          </section>
          <section className="oxygen-disposal" aria-label={L('Compartimento de descarte', 'Disposal bin')}>
            <button
              ref={game.target}
              type="button"
              className="oxygen-disposal-opening"
              aria-label={L('Descartar detrito selecionado', 'Discard selected debris')}
              disabled={game.selected === null}
              onClick={() => {
                if (game.selected !== null) game.discard(game.selected);
              }}
            >
              <ArrowDown size={28} strokeWidth={1.5} />
              <Trash2 size={48} strokeWidth={1} />
              <span />
              <span />
            </button>
          </section>
        </div>
      </section>
      {game.dragging && drag && (
        <div
          ref={game.ghost}
          className="oxygen-drag-ghost"
          aria-hidden="true"
          style={{
            width: drag.size,
            height: drag.size,
            transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%)`,
          }}
        >
          <svg viewBox="-40 -40 80 80">
            <title>{L('Detrito sendo arrastado', 'Debris being dragged')}</title>
            <OxygenDebris />
          </svg>
        </div>
      )}
      <div className="oxygen-result" role="status" aria-live="polite">
        {complete && (
          <>
            <p>{L('Filtro limpo. Fluxo de ar restabelecido.', 'Filter clean. Airflow restored.')}</p>
            <button type="button" onClick={onComplete ? close : game.reset}>
              {onComplete ? L('Voltar à base', 'Back to base') : L('Limpar novamente', 'Clean again')}
            </button>
          </>
        )}
      </div>
      <button
        ref={closeButton}
        className="oxygen-close"
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
