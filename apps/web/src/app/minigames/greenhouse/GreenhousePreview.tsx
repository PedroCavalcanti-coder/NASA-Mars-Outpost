import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import { GreenhouseIllustration } from './GreenhouseIllustration';
import { useGreenhouse } from './useGreenhouse';
import './greenhouse.css';
import { L } from '../../../lib/i18n';

/** Cada minigame irriga uma bancada dupla (2 canteiros); o jogador vai de bancada em bancada. */
export const GREENHOUSE_ROUNDS = 1;

/** Uma rodada: irrigar um par de canteiros. */
function GreenhouseRound({ onDone }: { onDone: (poured: number) => void }) {
  const game = useGreenhouse();
  const reported = useRef(false);
  useEffect(() => {
    if (!game.complete || reported.current) return;
    reported.current = true;
    onDone(game.poured);
  }, [game.complete, game.poured, onDone]);
  return <GreenhouseIllustration game={game} />;
}

/**
 * Irrigação da cúpula: 4 rodadas (canteiros 1–2, 3–4, 5–6 e 7–8). Dentro da base, `onComplete`
 * avisa o jogo uma única vez, com a água somada das 4 rodadas.
 */
export default function GreenhousePreview({
  onClose,
  onComplete,
  rounds = GREENHOUSE_ROUNDS,
}: {
  onClose?: () => void;
  onComplete?: (result: { waterUsed: number }) => void;
  rounds?: number;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const [round, setRound] = useState(0);
  const [poured, setPoured] = useState(0);
  const [between, setBetween] = useState(false);
  const complete = round >= rounds;
  const reported = useRef(false);

  const done = (water: number) => {
    setPoured((p) => p + water);
    setBetween(true);
    // um respiro para ver os canteiros verdes antes do próximo par
    window.setTimeout(() => {
      setBetween(false);
      setRound((r) => r + 1);
    }, 900);
  };

  useEffect(() => {
    if (!complete || !onComplete || reported.current) return;
    reported.current = true;
    onComplete({ waterUsed: poured });
  }, [complete, poured, onComplete]);

  const first = Math.min(round, rounds - 1) * 2 + 1;
  return (
    <main
      className="greenhouse-preview"
      aria-label={L('Cuidados com a plantação', 'Garden care')}
      data-complete={complete}
      data-in-base={onComplete ? true : undefined}
    >
      <div className="greenhouse-backdrop" aria-hidden="true" />
      {!complete && <GreenhouseRound key={round} onDone={done} />}
      <div className="greenhouse-water-used" role="status">
        🌱 {rounds > 1 ? L(`Canteiros ${first}–${first + 1} · rodada ${Math.min(round + 1, rounds)}/${rounds}`, `Beds ${first}–${first + 1} · round ${Math.min(round + 1, rounds)}/${rounds}`) : L('Um canteiro por vez', 'One bed at a time')}
        {between ? ' ✅' : ''}
        <br />💧 {L('Água usada:', 'Water used:')} {(poured * 10).toFixed(1)} L
        {onComplete && <small>{L('sai do estoque da base', 'comes from the base supply')}</small>}
      </div>
      <div className="greenhouse-announcement" role="status" aria-live="polite">
        {complete ? L('Canteiro irrigado.', 'Bed watered.') : ''}
      </div>
      {complete && (
        <button type="button" className="greenhouse-back" onClick={close}>
          {onComplete ? L('Voltar à base', 'Back to base') : L('Fechar', 'Close')}
        </button>
      )}
      <button
        ref={closeButton}
        className="greenhouse-close"
        type="button"
        onClick={close}
        aria-label={L('Fechar', 'Close')}
        title={L('Fechar (Esc)', 'Close (Esc)')}
      >
        <X size={22} aria-hidden="true" />
      </button>
    </main>
  );
}
