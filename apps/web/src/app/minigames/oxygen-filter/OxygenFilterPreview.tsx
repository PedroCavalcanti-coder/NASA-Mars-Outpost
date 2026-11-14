import { ArrowDown, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import { OXYGEN_DEBRIS, OxygenDebris, OxygenFilterIllustration } from './OxygenFilterIllustration';
import { useOxygenCleaning } from './useOxygenCleaning';
import './oxygenFilter.css';

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
      aria-label="Limpeza do filtro de oxigênio"
      data-complete={complete}
    >
      <div className="oxygen-habitat" aria-hidden="true">
        <div className="oxygen-porthole" />
        <div className="oxygen-pipe" />
      </div>
      <section className="oxygen-machine" aria-label="Painel de suporte à vida aberto">
        <div className="oxygen-hinge oxygen-hinge--top" aria-hidden="true" />
        <div className="oxygen-hinge oxygen-hinge--bottom" aria-hidden="true" />
        <div className="oxygen-machine-interior">
          <section className="oxygen-cartridge" aria-label="Cartucho do filtro">
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
          <section className="oxygen-disposal" aria-label="Compartimento de descarte">
            <button
              ref={game.target}
              type="button"
              className="oxygen-disposal-opening"
              aria-label="Descartar detrito selecionado"
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
            <title>Detrito sendo arrastado</title>
            <OxygenDebris />
          </svg>
        </div>
      )}
      <div className="oxygen-result" role="status" aria-live="polite">
        {complete && (
          <>
            <p>Filtro limpo. Fluxo de ar restabelecido.</p>
            <button type="button" onClick={onComplete ? close : game.reset}>
              {onComplete ? 'Voltar à base' : 'Limpar novamente'}
            </button>
          </>
        )}
      </div>
      <button
        ref={closeButton}
        className="oxygen-close"
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
