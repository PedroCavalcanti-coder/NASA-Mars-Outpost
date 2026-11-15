import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import { soilQuality } from './scoring';
import './missions.css';

const SAMPLES = 6;

/**
 * Coleta de solo fora da base: seis pontos aparecem, um de cada vez, no terreno em volta do
 * rover. Basta clicar (ou Espaço/Enter) em cada um para encher o tubo de amostras. É mais longo
 * que os outros minigames, mas fácil: sem tempo limite nem como errar, só rende mais se for rápido.
 */
export default function SoilSamplingGame({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: (r: { quality: number }) => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const spots = useMemo(
    () =>
      Array.from({ length: SAMPLES }, () => ({
        x: 12 + Math.random() * 76,
        y: 14 + Math.random() * 72,
      })),
    [],
  );
  const [got, setGot] = useState(0);
  const times = useRef<number[]>([]);
  const shownAt = useRef(performance.now());
  const spot = useRef<HTMLButtonElement>(null);
  const reported = useRef(false);
  const done = got >= SAMPLES;

  // foco no ponto atual: Espaço/Enter também coletam
  // biome-ignore lint/correctness/useExhaustiveDependencies: refaz o foco a cada amostra
  useEffect(() => {
    shownAt.current = performance.now();
    spot.current?.focus({ preventScroll: true });
  }, [got]);

  const collect = () => {
    times.current.push(performance.now() - shownAt.current);
    setGot((g) => g + 1);
  };

  const current = spots[got];
  return (
    <main className="msn-mg msn-mg--soil" aria-label="Coleta de amostras de solo">
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card">
        <div className="msn-mg__head">
          <div>
            <h2>Coleta de solo</h2>
            <p>
              O rover parou em meio à poeira. Colha as {SAMPLES} amostras tocando em cada ponto
              marcado.
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="msn-mg__close"
            onClick={close}
            aria-label="Cancelar a coleta (o rover volta sem amostras)"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="msn-tube"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={SAMPLES}
          aria-valuenow={got}
          aria-label="Tubo de amostras"
        >
          <div className="msn-tube__fill" style={{ width: `${(got / SAMPLES) * 100}%` }} />
        </div>

        {done ? (
          <div className="msn-mg__result">
            <strong>Amostras lacradas!</strong>
            <span>O rover vai voltar à base com o material.</span>
            <button
              type="button"
              className="msn-mg__btn"
              onClick={() => {
                if (reported.current) return;
                reported.current = true;
                onComplete?.({ quality: soilQuality(times.current) });
                close();
              }}
            >
              Voltar para a base
            </button>
          </div>
        ) : (
          <div className="msn-field">
            {current && (
              <button
                ref={spot}
                // biome-ignore lint/suspicious/noArrayIndexKey: um ponto por amostra
                key={got}
                type="button"
                className="msn-spot"
                style={{ left: `${current.x}%`, top: `${current.y}%` }}
                onClick={collect}
                aria-label={`Colher amostra ${got + 1} de ${SAMPLES}`}
              >
                ⛏
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
