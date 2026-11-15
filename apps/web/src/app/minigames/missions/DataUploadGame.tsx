import { Satellite, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import './missions.css';
import { L } from '../../../lib/i18n';

/** Quanto tempo (s) a animação leva para o sinal "atravessar o espaço" até a Terra. */
const TRAVEL_SECONDS = 4;

interface Card {
  icon: string;
  name: string;
  science: boolean;
}

/** Três dados de ciência (instrumentos de verdade) e três que não são pesquisa. */
const CARDS: Card[] = [
  { icon: '🪨', name: L('Foto da rocha (ChemCam)', 'Rock photo (ChemCam)'), science: true },
  { icon: '🌪️', name: L('Medição de poeira', 'Dust measurement'), science: true },
  { icon: '🫁', name: L('Oxigênio do MOXIE', 'MOXIE oxygen'), science: true },
  { icon: '🎮', name: L('Jogo do computador', 'Computer game'), science: false },
  { icon: '🎵', name: L('Música da tripulação', 'Crew music'), science: false },
  { icon: '🍝', name: L('Foto do almoço', 'Lunch photo'), science: false },
];
const TOTAL = CARDS.filter((c) => c.science).length;

/**
 * Enlace com a Terra, versão para crianças: escolha os 3 cartões de ciência, aperte "Enviar" e
 * veja o sinal viajar de Marte até a antena na Terra. Escolher um que não é ciência só mostra uma
 * dica (sem punição).
 */
export default function DataUploadGame({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: () => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const cards = useMemo(() => [...CARDS].sort(() => Math.random() - 0.5), []);
  const [chosen, setChosen] = useState<string[]>([]);
  const [hint, setHint] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const reported = useRef(false);
  const ready = chosen.length === TOTAL;
  const done = progress !== null && progress >= 1;

  useEffect(() => {
    if (progress === null || progress >= 1) return;
    const started = performance.now() - progress * TRAVEL_SECONDS * 1000;
    const id = window.setInterval(() => {
      setProgress(Math.min(1, (performance.now() - started) / 1000 / TRAVEL_SECONDS));
    }, 60);
    return () => window.clearInterval(id);
    // biome-ignore lint/correctness/useExhaustiveDependencies: só começa uma vez
  }, [progress === null]);

  const toggle = (c: Card) => {
    if (progress !== null) return;
    if (!c.science) {
      setHint(`${c.icon} ${c.name} não é pesquisa: não precisa ir para a Terra.`);
      return;
    }
    setHint('');
    setChosen((list) =>
      list.includes(c.name) ? list.filter((n) => n !== c.name) : [...list, c.name],
    );
  };

  return (
    <main className="msn-mg msn-mg--upload" aria-label={L('Enviar dados de pesquisa à Terra', 'Send research data to Earth')}>
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card">
        <div className="msn-mg__head">
          <div>
            <h2>
              <Satellite size={18} aria-hidden="true" /> {L('Enviar ciência para a Terra', 'Send science to Earth')}
            </h2>
            <p>
              {L('Toque nos', 'Tap the')} <b>{TOTAL} {L('cartões de ciência', 'science cards')}</b> {L('e aperte “Enviar”.', 'and press “Send”.')}
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="msn-mg__close"
            onClick={close}
            aria-label={L('Fechar', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        {progress === null ? (
          <>
            <div className="sci-grid">
              {cards.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`sci-card msn-up__file ${chosen.includes(c.name) ? 'is-on' : ''}`}
                  aria-pressed={chosen.includes(c.name)}
                  onClick={() => toggle(c)}
                >
                  <span aria-hidden="true">{c.icon}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
            {hint && (
              <p className="msn-up__error" role="status">
                {hint}
              </p>
            )}
            <button
              type="button"
              className="msn-mg__btn"
              disabled={!ready}
              onClick={() => setProgress(0)}
            >
              📡 Enviar ({chosen.length}/{TOTAL})
            </button>
          </>
        ) : (
          <>
            <div className="sci-row" aria-hidden="true">
              <span>{L('🔴 Marte', '🔴 Mars')}</span>
              <span>{L('🌍 Terra', '🌍 Earth')}</span>
            </div>
            <div className="sci-meter" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
              <i style={{ width: `${progress * 100}%` }} />
            </div>
            {done ? (
              <div className="msn-mg__result">
                <strong>{L('A Terra recebeu os dados! 🎉', 'Earth got the data! 🎉')}</strong>
                <button
                  type="button"
                  className="msn-mg__btn"
                  onClick={() => {
                    if (reported.current) return;
                    reported.current = true;
                    onComplete?.();
                    close();
                  }}
                >
                  {L('Concluir envio', 'Finish upload')}
                </button>
              </div>
            ) : (
              <p>{L('📶 O sinal de rádio está viajando pelo espaço…', '📶 The radio signal is traveling through space…')}</p>
            )}
          </>
        )}

        <p className="sci-fact">
          <b>{L('CIÊNCIA DE VERDADE', 'REAL SCIENCE')}</b>{L('O sinal de rádio viaja na velocidade da luz, mas Marte está tão longe que ele leva de 4 a 24 minutos para chegar à Terra. Quem recebe são as antenas gigantes da Deep Space Network, da NASA.', 'Radio signals travel at the speed of light, but Mars is so far away that they take 4 to 24 minutes to reach Earth. NASA\'s giant Deep Space Network antennas receive them.')}
        </p>
      </section>
    </main>
  );
}
