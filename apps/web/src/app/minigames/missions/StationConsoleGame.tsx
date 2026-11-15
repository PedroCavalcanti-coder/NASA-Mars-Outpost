import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import { inZone, pingPong, stationQuality, zoneFor } from './scoring';
import './missions.css';

const ROUNDS = 3;
const PERIOD_S = 1.25;
/** Atraso do sinal da antena (s): a telemetria chega atrasada, então é preciso antecipar o alvo. */
const SIGNAL_DELAY_S = 0.45;

/**
 * Console de uma estação da base (laboratório, comunicações, energia, enfermaria): três
 * calibrações em que se para o cursor na faixa verde (Espaço, Enter ou o botão). A missão
 * sempre termina; acertar mais rende mais pontos de pesquisa.
 */
export default function StationConsoleGame({
  title,
  hint,
  signalDelay = false,
  onClose,
  onComplete,
}: {
  title: string;
  hint: string;
  /** comunicações com a Terra: o cursor mostrado atrasa em relação ao real */
  signalDelay?: boolean;
  onClose?: () => void;
  onComplete?: (r: { quality: number }) => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const [round, setRound] = useState(0);
  const [marks, setMarks] = useState<boolean[]>([]);
  /** posição mostrada na tela (com atraso de sinal, é a de alguns instantes atrás) */
  const [shown, setShown] = useState(0);
  const rolls = useMemo(() => Array.from({ length: ROUNDS }, () => Math.random()), []);
  const zone = zoneFor(round, rolls[round] ?? 0.5);
  const start = useRef(performance.now());
  const posRef = useRef(0);
  const done = marks.length >= ROUNDS;
  const reported = useRef(false);

  useEffect(() => {
    if (done) return;
    start.current = performance.now();
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - start.current) / 1000;
      const p = pingPong(t, PERIOD_S);
      posRef.current = p;
      setShown(signalDelay ? pingPong(Math.max(0, t - SIGNAL_DELAY_S), PERIOD_S) : p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [done, signalDelay]);

  const stop = useCallback(() => {
    if (done) return;
    const hit = inZone(posRef.current, zone);
    setMarks((m) => [...m, hit]);
    setRound((r) => r + 1);
  }, [done, zone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stop]);

  const hits = marks.filter(Boolean).length;
  const quality = stationQuality(hits, ROUNDS);

  return (
    <main className="msn-mg" aria-label={title}>
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card">
        <div className="msn-mg__head">
          <div>
            <h2>{title}</h2>
            <p>{hint}</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="msn-mg__close"
            onClick={close}
            aria-label="Fechar (a missão não é concluída)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="msn-mg__rounds" aria-hidden="true">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: posições fixas
              key={i}
              className={`msn-mg__pip ${marks[i] === undefined ? '' : marks[i] ? 'is-hit' : 'is-miss'}`}
            />
          ))}
        </div>

        {done ? (
          <div className="msn-mg__result">
            <strong>
              {hits === ROUNDS
                ? 'Calibragem perfeita!'
                : hits > 0
                  ? 'Calibragem concluída.'
                  : 'Calibragem imprecisa, mas concluída.'}
            </strong>
            <span>
              {hits} de {ROUNDS} no alvo
            </span>
            <button
              type="button"
              className="msn-mg__btn"
              onClick={() => {
                if (reported.current) return;
                reported.current = true;
                onComplete?.({ quality });
                close();
              }}
            >
              Enviar resultados
            </button>
          </div>
        ) : (
          <>
            <div className="msn-bar" aria-hidden="true">
              <div
                className="msn-bar__zone"
                style={{
                  left: `${(zone.center - zone.half) * 100}%`,
                  width: `${zone.half * 200}%`,
                }}
              />
              <div className="msn-bar__cursor" style={{ left: `${shown * 100}%` }} />
            </div>
            {signalDelay && (
              <p className="msn-mg__delay">
                📡 Atraso do sinal: {SIGNAL_DELAY_S.toFixed(2).replace('.', ',')} s. O cursor chega
                atrasado da Terra: trave um pouco antes de ele alcançar a faixa verde.
              </p>
            )}
            <button type="button" className="msn-mg__btn" onClick={stop}>
              Travar ({round + 1}/{ROUNDS}) — Espaço
            </button>
          </>
        )}
      </section>
    </main>
  );
}
