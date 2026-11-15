import { AlertTriangle, Info, Tablet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EventChoice, EventDeltas, GameEventDef } from '../../../game/events/events';
import { beginEvent, chooseOption, closeEvent, tickEvent } from '../../../game/events/flow';
import { useGameEvents } from '../../../game/events/store';

const ICON: Record<keyof EventDeltas, string> = {
  energy: '⚡',
  supplies: '🍞',
  materials: '🔩',
  oxygen: '🫁',
  shielding: '🛡️',
  research: '🔬',
};

const NAMES: Record<keyof EventDeltas, string> = {
  energy: 'Energia',
  supplies: 'Mantimentos',
  materials: 'Materiais',
  oxygen: 'Oxigênio',
  shielding: 'Blindagem',
  research: 'Pesquisa',
};

const KEYS = Object.keys(ICON) as (keyof EventDeltas)[];
const signed = (v: number) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`);

/** Resumo do que a opção custa/rende (a opção arriscada mostra o ganho e o aviso de risco). */
function Chips({ choice }: { choice: EventChoice }) {
  const d = choice.outcome.deltas ?? {};
  return (
    <span className="event-tablet__chips">
      {KEYS.filter((k) => d[k]).map((k) => (
        <span key={k} className={(d[k] ?? 0) > 0 ? 'is-up' : 'is-down'}>
          {signed(d[k] ?? 0)} {ICON[k]}
        </span>
      ))}
      {choice.outcome.effects?.length ? <span className="is-up">✨</span> : null}
      {choice.risk && (
        <span className="is-risk">
          Risco <AlertTriangle size={12} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

const mmss = (s: number) => `00:${String(Math.max(0, s)).padStart(2, '0')}`;

/**
 * Tablet de eventos: foto real da NASA, o que o satélite detectou, "Você sabia?" e as opções.
 * Sozinho você decide; com 2 jogadores um é sorteado; com 3 ou 4 há votação de 30 s.
 * O jogo fica pausado enquanto o tablet está aberto. Funciona só com toque.
 */
export function EventTablet() {
  const event = useGameEvents((s) => s.queue[0]);
  const session = useGameEvents((s) => s.session);
  const first = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());

  // novo evento na frente da fila: monta a sessão (pausa o relógio e define quem decide)
  useEffect(() => {
    if (event) beginEvent(event);
  }, [event]);

  // relógio da votação (e fechamento por tempo)
  useEffect(() => {
    if (!event) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      tickEvent(event);
    }, 1000);
    return () => window.clearInterval(id);
  }, [event]);

  useEffect(() => {
    if (session && !session.result) first.current?.focus();
  }, [session]);

  if (!event || !session) return null;
  return <TabletBody event={event} now={now} first={first} />;
}

function TabletBody({
  event,
  now,
  first,
}: {
  event: GameEventDef;
  now: number;
  first: React.RefObject<HTMLButtonElement | null>;
}) {
  const session = useGameEvents((s) => s.session);
  if (!session) return null;
  const { mode, selfId, result } = session;
  const myVote = session.votes[selfId];
  const canChoose =
    !result &&
    (mode === 'solo' ||
      (mode === 'decider' && session.deciderId === selfId) ||
      (mode === 'vote' && myVote === undefined));
  const voted = Object.keys(session.votes).length;
  const left = Math.ceil((session.deadline - now) / 1000);
  const major = event.kind === 'major';
  const COLORS = ['is-amber', 'is-cyan', 'is-slate'];

  return (
    <div className="event-tablet__backdrop" role="presentation">
      <section
        className={`event-tablet event-tablet--${event.kind}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="event-title"
      >
        <header className="event-tablet__head">
          <span className="event-tablet__alert" aria-hidden="true">
            {major ? <AlertTriangle size={26} /> : <Tablet size={24} />}
          </span>
          <h2 id="event-title">
            <small>{major ? 'ALERTA CLIMÁTICO: ' : 'AVISO DO DIA: '}</small>
            {event.title.toUpperCase()}
          </h2>
        </header>

        <div className="event-tablet__screen">
          {event.image ? (
            <figure className="event-tablet__photo">
              <img src={event.image} alt={event.title} loading="eager" />
              {event.credit && <figcaption>{event.credit}</figcaption>}
            </figure>
          ) : (
            <div className="event-tablet__icon" aria-hidden="true">
              {event.icon}
            </div>
          )}

          <p className="event-tablet__body">
            {event.orbital ? (
              <>
                <b>DETECÇÃO ORBITAL:</b> {event.orbital}
              </>
            ) : (
              event.body
            )}
          </p>

          {event.history && (
            <aside className="event-tablet__fact">
              <span className="event-tablet__fact-tag">
                <Info size={12} aria-hidden="true" /> VOCÊ SABIA? · DADOS NASA
              </span>
              <p>
                {event.history}{' '}
                {event.sourceUrl && (
                  <a href={event.sourceUrl} target="_blank" rel="noreferrer noopener">
                    Saiba mais…
                  </a>
                )}
              </p>
            </aside>
          )}

          {!result ? (
            <>
              <ul className="event-tablet__choices">
                {event.choices.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      ref={i === 0 ? first : undefined}
                      className={`event-tablet__choice ${COLORS[i % 3]} ${myVote === i ? 'is-voted' : ''}`}
                      disabled={!canChoose}
                      onClick={() => chooseOption(event, i)}
                    >
                      <strong>{c.label}</strong>
                      <Chips choice={c} />
                    </button>
                  </li>
                ))}
              </ul>

              <footer className="event-tablet__vote">
                {mode === 'vote' ? (
                  <>
                    <span>
                      <b>
                        {voted}/{session.voters.length}
                      </b>{' '}
                      Tripulantes votaram
                    </span>
                    <span className="event-tablet__vote-bar" aria-hidden="true">
                      <i
                        style={{ width: `${(voted / Math.max(1, session.voters.length)) * 100}%` }}
                      />
                    </span>
                    <span className="event-tablet__timer">
                      VOTAÇÃO: <b>{mmss(left)}s</b>
                    </span>
                  </>
                ) : mode === 'decider' && session.deciderId !== selfId ? (
                  <span>🎲 {session.deciderName} foi sorteado(a) para decidir. Aguarde…</span>
                ) : mode === 'decider' ? (
                  <span>🎲 Você foi sorteado(a): a decisão é sua e vale para todos.</span>
                ) : (
                  <span>⏸ O jogo está pausado enquanto você decide.</span>
                )}
              </footer>
            </>
          ) : (
            <div className={`event-tablet__result is-${result.outcome.tone}`}>
              <small>Decisão: {event.choices[result.choice]?.label}</small>
              <p>{result.outcome.text}</p>
              {result.outcome.deltas && (
                <ul className="event-tablet__deltas">
                  {KEYS.filter((k) => result.outcome.deltas?.[k]).map((k) => {
                    const v = result.outcome.deltas?.[k] ?? 0;
                    return (
                      <li key={k} className={v > 0 ? 'is-up' : 'is-down'}>
                        {ICON[k]} {NAMES[k]} {signed(v)}
                      </li>
                    );
                  })}
                </ul>
              )}
              <button type="button" className="event-tablet__ok" onClick={closeEvent}>
                Entendido
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
