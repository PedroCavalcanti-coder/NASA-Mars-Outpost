import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSoilCoop } from '../../../game/missions/soilCoop';
import { usePreviewClose } from '../usePreviewClose';
import { soilQuality } from './scoring';
import './missions.css';
import { L } from '../../../lib/i18n';

const SAMPLES = 6;
/** em dupla cada jogador colhe a sua metade */
const COOP_SAMPLES = 4;
/** sem notícia do parceiro por tanto tempo (s), dá para concluir sozinho */
const WAIT_PARTNER_S = 20;

/**
 * Coleta de solo fora da base: seis pontos aparecem, um de cada vez, no terreno em volta do
 * rover. Basta clicar (ou Espaço/Enter) em cada um para encher o tubo de amostras. É mais longo
 * que os outros minigames, mas fácil: sem tempo limite nem como errar, só rende mais se for rápido.
 */
export default function SoilSamplingGame({
  coop = false,
  role = 'driver',
  onReady,
  onClose,
  onComplete,
}: {
  /** coleta em dupla: os dois jogadores abrem o minigame juntos e cada um colhe a sua parte */
  coop?: boolean;
  role?: 'driver' | 'passenger';
  /** minha parte terminou (a nota vai para o parceiro) */
  onReady?: (quality: number) => void;
  onClose?: () => void;
  onComplete?: (r: { quality: number }) => void;
}) {
  const total = coop ? COOP_SAMPLES : SAMPLES;
  const partnerDone = useSoilCoop((c) => c.partnerDone);
  const [waited, setWaited] = useState(0);
  const { close, closeButton } = usePreviewClose(onClose);
  const spots = useMemo(
    () =>
      Array.from({ length: total }, () => ({
        x: 12 + Math.random() * 76,
        y: 14 + Math.random() * 72,
      })),
    [total],
  );
  const [got, setGot] = useState(0);
  const times = useRef<number[]>([]);
  const shownAt = useRef(performance.now());
  const spot = useRef<HTMLButtonElement>(null);
  const reported = useRef(false);
  const done = got >= total;
  const quality = done ? soilQuality(times.current) : 0;

  // terminei a minha parte: avisa o parceiro e começa a contar a espera
  useEffect(() => {
    if (!done) return;
    onReady?.(quality);
    if (!coop) return;
    const id = window.setInterval(() => setWaited((w) => w + 1), 1000);
    return () => window.clearInterval(id);
    // biome-ignore lint/correctness/useExhaustiveDependencies: avisa uma única vez
  }, [done]);
  const canFinish = !coop || partnerDone || waited >= WAIT_PARTNER_S;

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
    <main className="msn-mg msn-mg--soil" aria-label={L('Coleta de amostras de solo', 'Soil sample collection')}>
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card">
        <div className="msn-mg__head">
          <div>
            <h2>{coop ? L('Coleta de solo em dupla', 'Soil collection for two') : L('Coleta de solo', 'Soil collection')}</h2>
            <p>
              {coop
                ? `Vocês chegaram ao ponto. ${role === 'driver' ? L('Você é o motorista', 'You are the driver') : L('Você é o passageiro', 'You are the passenger')}: colha as ${total} amostras da sua parte tocando em cada ponto. A nota final é a média dos dois.`
                : `Você chegou ao ponto de coleta. Colha as ${total} amostras tocando em cada ponto marcado.`}
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="msn-mg__close"
            onClick={close}
            aria-label={L('Cancelar a coleta (o rover volta sem amostras)', 'Cancel (the rover returns without samples)')}
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="msn-tube"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={got}
          aria-label={L('Tubo de amostras', 'Sample tube')}
        >
          <div className="msn-tube__fill" style={{ width: `${(got / total) * 100}%` }} />
        </div>

        {done ? (
          <div className="msn-mg__result">
            <strong>{L('Amostras lacradas!', 'Samples sealed!')}</strong>
            <span>
              {coop
                ? partnerDone
                  ? L('Seu parceiro também terminou!', 'Your partner finished too!')
                  : `Aguardando seu parceiro terminar… (${Math.max(0, WAIT_PARTNER_S - waited)} s para concluir sem ele)`
                : L('Volte dirigindo à base com o material.', 'Drive back to the base with the samples.')}
            </span>
            <button
              type="button"
              className="msn-mg__btn"
              disabled={!canFinish}
              onClick={() => {
                if (reported.current) return;
                reported.current = true;
                onComplete?.({ quality });
                close();
              }}
            >
              {role === 'passenger' ? 'Concluir' : L('Levar as amostras', 'Take the samples')}
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
                aria-label={`Colher amostra ${got + 1} de ${total}`}
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
