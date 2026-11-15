import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import '../missions/missions.css';
import { L, t } from '../../../lib/i18n';

/** As 5 ondas que a Terra pode mandar (ciclos na tela e altura da onda). */
export const WAVES = [
  { name: L('Onda lenta', 'Slow wave'), cycles: 1.5, amp: 0.7 },
  { name: L('Onda média', 'Medium wave'), cycles: 2.5, amp: 0.55 },
  { name: L('Onda rápida', 'Fast wave'), cycles: 3.5, amp: 0.45 },
  { name: L('Onda alta', 'Tall wave'), cycles: 2, amp: 0.85 },
  { name: L('Onda fina', 'Thin wave'), cycles: 4.5, amp: 0.35 },
] as const;
const ROUNDS = 3;
/** quanto tempo (s) a onda precisa ficar sincronizada para travar o sinal */
const LOCK_S = 1.2;
const MIN_DEG = 0;
const MAX_DEG = 180;

/** O ângulo da antena define a frequência que ela capta (1 a 5 ciclos na tela). */
const cyclesAt = (deg: number) => 1 + (deg / MAX_DEG) * 4;
/** Ângulo certo para cada onda. */
const degFor = (cycles: number) => ((cycles - 1) / 4) * MAX_DEG;

function wavePath(cycles: number, amp: number, phase: number, w = 300, h = 90) {
  let d = '';
  for (let x = 0; x <= w; x += 4) {
    const y = h / 2 - Math.sin((x / w) * cycles * Math.PI * 2 + phase) * amp * (h / 2 - 4);
    d += `${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`;
  }
  return d;
}

/**
 * Calibrar a antena: uma onda chega da Terra; gire a antena (botões, setas ou o controle) até a
 * sua onda ficar igual à do sinal. Segure sincronizado um instante para travar. 3 sinais.
 */
export default function AntennaGame({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: (r: { quality: number }) => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  // 3 ondas diferentes das 5, em ordem aleatória
  const targets = useMemo(() => [...WAVES].sort(() => Math.random() - 0.5).slice(0, ROUNDS), []);
  const [round, setRound] = useState(0);
  const [deg, setDeg] = useState(90);
  const [lock, setLock] = useState(0);
  const [phase, setPhase] = useState(0);
  const [startedAt] = useState(() => performance.now());
  const reported = useRef(false);
  const done = round >= ROUNDS;
  const target = targets[Math.min(round, ROUNDS - 1)]!;
  const error = Math.abs(deg - degFor(target.cycles));
  const synced = error <= 6;

  // as ondas correm na tela; sincronizada, a trava enche
  useEffect(() => {
    if (done) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPhase((p) => p + dt * 3);
      setLock((l) => (synced ? Math.min(LOCK_S, l + dt) : Math.max(0, l - dt * 2)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [done, synced]);

  useEffect(() => {
    if (lock < LOCK_S || done) return;
    setLock(0);
    setRound((r) => r + 1);
  }, [lock, done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') setDeg((d) => Math.max(MIN_DEG, d - 3));
      if (e.key === 'ArrowRight' || e.key === 'd') setDeg((d) => Math.min(MAX_DEG, d + 3));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const turn = (delta: number) => setDeg((d) => Math.max(MIN_DEG, Math.min(MAX_DEG, d + delta)));
  const seconds = (performance.now() - startedAt) / 1000;

  return (
    <main className="msn-mg" aria-label={L('Calibrar a antena', 'Calibrate the antenna')}>
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card">
        <div className="msn-mg__head">
          <div>
            <h2>{L('📡 Calibrar a antena', '📡 Calibrate the antenna')}</h2>
            <p>{L('Gire a antena até a sua onda (verde) ficar igual ao sinal da Terra (amarelo).', 'Turn the antenna until your wave (green) matches Earth\'s signal (yellow).')}</p>
          </div>
          <button ref={closeButton} type="button" className="msn-mg__close" onClick={close} aria-label={L('Fechar', 'Close')}>
            <X size={18} />
          </button>
        </div>

        <div className="msn-mg__rounds" aria-hidden="true">
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: posições fixas
              key={i}
              className={`msn-mg__pip ${i < round ? 'is-hit' : ''}`}
            />
          ))}
        </div>

        {done ? (
          <div className="msn-mg__result">
            <strong>{L('Antena sincronizada com a Terra! 📶', 'Antenna synced with Earth! 📶')}</strong>
            <span>{L('Os dados da base agora chegam limpos ao centro de controle.', 'The base data now reaches mission control clearly.')}</span>
            <button
              type="button"
              className="msn-mg__btn"
              onClick={() => {
                if (reported.current) return;
                reported.current = true;
                // mais rápido rende uma calibragem melhor
                onComplete?.({ quality: Math.max(0.5, Math.min(1, 1.3 - seconds / 60)) });
                close();
              }}
            >
              {L('Enviar calibragem', 'Send calibration')}
            </button>
          </div>
        ) : (
          <>
            <div className="sci-row">
              <span>
                {L('Sinal', 'Signal')} {round + 1}/{ROUNDS}: <b>{t(target.name)}</b>
              </span>
              <span>{synced ? L('🟢 Sincronizando…', '🟢 Syncing…') : L('🔍 Procurando', '🔍 Searching')}</span>
            </div>
            <svg viewBox="0 0 300 90" className="sci-stage" style={{ height: 'auto', width: '100%' }} role="img" aria-label={L('Ondas do sinal e da antena', 'Signal and antenna waves')}>
              <path d={wavePath(target.cycles, target.amp, phase)} fill="none" stroke="#edce70" strokeWidth="3" />
              <path
                d={wavePath(cyclesAt(deg), target.amp, phase)}
                fill="none"
                stroke={synced ? '#5df2c0' : '#8fd3ff'}
                strokeWidth="2.5"
                strokeDasharray={synced ? undefined : '6 4'}
              />
            </svg>
            <div className="sci-meter" aria-label={L('Trava do sinal', 'Signal lock')}>
              <i style={{ width: `${(lock / LOCK_S) * 100}%` }} />
            </div>
            <div className="sci-row">
              <button type="button" className="msn-mg__btn" onClick={() => turn(-6)} aria-label={L('Girar para a esquerda', 'Turn left')}>
                ⟲
              </button>
              <input
                type="range"
                min={MIN_DEG}
                max={MAX_DEG}
                value={deg}
                onChange={(e) => setDeg(Number(e.target.value))}
                aria-label={L('Ângulo da antena', 'Antenna angle')}
                style={{ flex: 1 }}
              />
              <button type="button" className="msn-mg__btn" onClick={() => turn(6)} aria-label={L('Girar para a direita', 'Turn right')}>
                ⟳
              </button>
            </div>
            <p className="msn-mg__hint">{L('Ângulo da antena:', 'Antenna angle:')} {Math.round(deg)}° · {L('setas ⬅️ ➡️ também giram', 'arrow keys ⬅️ ➡️ also turn')}</p>
          </>
        )}

        <p className="sci-fact">
          <b>{L('CIÊNCIA DE VERDADE', 'REAL SCIENCE')}</b>{L('Rovers e bases falam com a Terra por ondas de rádio. A antena precisa estar apontada e sintonizada na frequência certa (a NASA usa a “banda X”, perto de 8,4 GHz), senão o sinal chega fraco. As antenas gigantes da Deep Space Network ficam nos EUA, na Espanha e na Austrália para nunca perder Marte de vista.', 'Rovers and bases talk to Earth with radio waves. The antenna must point the right way and be tuned to the right frequency (NASA uses the “X band”, near 8.4 GHz), or the signal arrives weak. The giant Deep Space Network antennas are in the USA, Spain and Australia so they never lose sight of Mars.')}
        </p>
      </section>
    </main>
  );
}
