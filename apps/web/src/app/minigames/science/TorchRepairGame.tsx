import { useCallback, useEffect, useRef, useState } from 'react';
import { L } from '../../../lib/i18n';

const SPOTS = 10;
/** Erros permitidos antes de recomeçar a solda. */
export const MAX_MISSES = 3;
/** Tempo (ms) do anel fechando até o ponto ideal; tocar perto disso é acerto. */
const APPROACH_MS = 1300;
const WINDOW_MS = 330;

interface Spot {
  id: number;
  x: number;
  y: number;
  born: number;
}

/**
 * Reparo do rover com o maçarico: pontos de solda aparecem na placa de ferro com um anel que vai
 * fechando. Toque quando o anel encostar no ponto. Errar muitas vezes estraga a solda e é preciso
 * recomeçar.
 */
export function TorchRepairGame({ onDone }: { onDone: () => void }) {
  const [attempt, setAttempt] = useState(1);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [welded, setWelded] = useState<{ x: number; y: number }[]>([]);
  const [misses, setMisses] = useState(0);
  const [now, setNow] = useState(() => performance.now());
  const [message, setMessage] = useState('');
  const next = useRef(1);
  const finished = welded.length >= SPOTS;

  const spawn = useCallback(() => {
    setSpot({ id: next.current++, x: 12 + Math.random() * 76, y: 14 + Math.random() * 72, born: performance.now() });
  }, []);

  useEffect(() => {
    if (finished) return;
    spawn();
    // biome-ignore lint/correctness/useExhaustiveDependencies: recomeça a cada tentativa
  }, [attempt]);

  // relógio do anel; passou da janela sem tocar = erro
  useEffect(() => {
    if (finished || !spot) return;
    let raf = 0;
    const loop = () => {
      const t = performance.now();
      setNow(t);
      if (t - spot.born > APPROACH_MS + WINDOW_MS) {
        miss(L('⏱️ Atrasou!', '⏱️ Too late!'));
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // biome-ignore lint/correctness/useExhaustiveDependencies: segue o ponto atual
  }, [spot, finished]);

  const missRef = useRef(0);
  const miss = (text: string) => {
    const n = missRef.current + 1;
    missRef.current = n;
    setMisses(n);
    setMessage(text);
    if (n < MAX_MISSES) {
      spawn();
      return;
    }
    // solda estragada: limpa a placa e começa de novo
    setWelded([]);
    setSpot(null);
    setMessage(L('💥 A solda ficou fraca. Lixe a placa e tente de novo!', '💥 The weld is weak. Sand the plate and try again!'));
    window.setTimeout(() => {
      missRef.current = 0;
      setMisses(0);
      setAttempt((x) => x + 1);
    }, 1200);
  };

  const hit = () => {
    if (!spot || finished) return;
    const age = performance.now() - spot.born;
    const off = Math.abs(age - APPROACH_MS);
    if (off > WINDOW_MS) return miss(age < APPROACH_MS ? L('⚡ Cedo demais!', '⚡ Too early!') : L('⏱️ Atrasou!', '⏱️ Too late!'));
    setMessage(off < WINDOW_MS / 2 ? L('✨ Perfeito!', '✨ Perfect!') : L('👍 Boa!', '👍 Nice!'));
    const count = welded.length + 1;
    setWelded([...welded, { x: spot.x, y: spot.y }]);
    if (count < SPOTS) spawn();
    else setSpot(null);
  };

  useEffect(() => {
    if (finished) onDone();
  }, [finished, onDone]);

  const ring = spot ? Math.max(0, 1 - (now - spot.born) / APPROACH_MS) : 0;
  return (
    <>
      <div className="sci-row">
        <span>
          {L('🔥 Soldas:', '🔥 Welds:')} <b>{welded.length}</b>/{SPOTS}
        </span>
        <span>
          {L('Erros:', 'Misses:')} {misses}/{MAX_MISSES} {attempt > 1 ? L(`· tentativa ${attempt}`, `· try ${attempt}`) : ''}
        </span>
      </div>
      <div
        className="sci-stage"
        style={{
          background:
            'repeating-linear-gradient(135deg,#6d7680 0 6px,#636b74 6px 12px), #6d7680',
        }}
      >
        {welded.map((w, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: soldas na ordem feita
            key={i}
            className="sci-weld"
            style={{ left: `${w.x}%`, top: `${w.y}%` }}
          />
        ))}
        {spot && (
          <button
            type="button"
            className="sci-target"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            onPointerDown={hit}
            aria-label={L('Ponto de solda', 'Weld spot')}
          >
            <span className="sci-target__ring" style={{ transform: `scale(${1 + ring * 1.8})` }} />
          </button>
        )}
      </div>
      <p className="msn-mg__hint" role="status">
        {message || L('Toque no ponto quando o anel encostar nele.', 'Tap the spot when the ring touches it.')}
      </p>
    </>
  );
}
