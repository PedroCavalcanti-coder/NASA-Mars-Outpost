import { DONKI_SOURCE, RADIATION, rulesFor } from '@mars/shared';
import { useGameplay } from '../../../store/gameplay';
import { appliedEventDeltas } from '@mars/sim';
import { AlertTriangle, Info, Tablet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EventChoice, EventDeltas, GameEventDef } from '../../../game/events/events';
import { beginEvent, chooseOption, closeEvent, tickEvent } from '../../../game/events/flow';
import { useGameEvents } from '../../../game/events/store';
import { L, t } from '../../../lib/i18n';

const ICON: Record<keyof EventDeltas, string> = {
  energy: '⚡',
  supplies: '🌾',
  oxygen: '🫁',
  armor: '🛡️',
  research: '🔬',
};

const NAMES: Record<keyof EventDeltas, string> = {
  energy: L('Energia', 'Power'),
  supplies: L('Mantimentos', 'Supplies'),
  oxygen: L('Oxigênio', 'Oxygen'),
  armor: L('Blindagem', 'Shielding'),
  research: L('Pesquisa', 'Research'),
};

const KEYS = Object.keys(ICON) as (keyof EventDeltas)[];
const signed = (v: number) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`);

/** Resumo do que a opção custa/rende (a opção arriscada mostra o ganho e o aviso de risco). */
function Chips({ choice, kind }: { choice: EventChoice; kind: 'easy' | 'major' }) {
  // os mesmos números que o servidor aplica (multiplicados; pesquisa vira mantimento)
  const harm = rulesFor(useGameplay((s) => s.state?.difficulty)).harm;
  const d = appliedEventDeltas(kind, choice.outcome.deltas, harm) as EventDeltas;
  const effects = choice.outcome.effects ?? [];
  return (
    <span className="event-tablet__chips">
      {KEYS.filter((k) => d[k]).map((k) => (
        <span key={k} className={(d[k] ?? 0) > 0 ? 'is-up' : 'is-down'}>
          {signed(d[k] ?? 0)} {ICON[k]}
        </span>
      ))}
      {effects.some((f) => f.type === 'dose') && <span className="is-down">{L('☢ radiação', '☢ radiation')}</span>}
      {effects.some((f) => f.type === 'dust' || f.type === 'storm') && <span className="is-down">{L('🌫️ poeira', '🌫️ dust')}</span>}
      {effects.some((f) => f.type === 'clean_panels') && <span className="is-up">{L('✨ painéis limpos', '✨ clean panels')}</span>}
      {choice.risk && (
        <span className="is-risk">
          {L('Risco', 'Risk')} <AlertTriangle size={12} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

const mmss = (s: number) => `00:${String(Math.max(0, s)).padStart(2, '0')}`;

/**
 * Tablet de eventos: foto real da NASA, o que o satélite detectou, "Você sabia?" e as opções.
 * Sozinho você decide; com 2 a 4 jogadores há votação de 30 s (sem votos, o jogo sorteia).
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

  // decidido (por votos ou por tempo): o resultado fica alguns segundos e sai da tela de todos
  const decided = session?.result ? session.eid : null;
  useEffect(() => {
    if (!decided) return;
    const id = window.setTimeout(closeEvent, 5000);
    return () => window.clearTimeout(id);
  }, [decided]);

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
      (mode === 'vote' && myVote === undefined && session.voters.some((v) => v.id === selfId)));
  const spectator = mode === 'vote' && !session.voters.some((v) => v.id === selfId);
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
            <small>{major ? L('ALERTA CLIMÁTICO: ', 'WEATHER ALERT: ') : L('AVISO DO DIA: ', 'NOTICE OF THE DAY: ')}</small>
            {t(event.title).toUpperCase()}
          </h2>
        </header>

        <div className="event-tablet__screen">
          {event.image ? (
            <figure className="event-tablet__photo">
              <img src={event.image} alt={t(event.title)} loading="eager" />
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
                <b>{L('DETECÇÃO ORBITAL:', 'ORBITAL DETECTION:')}</b> {t(event.orbital)}
              </>
            ) : (
              t(event.body)
            )}
          </p>

          {session.flare && (
            <aside className="event-tablet__fact event-tablet__flare">
              <span className="event-tablet__fact-tag">
                {L('☀️ DADO REAL DA NASA · ARQUIVO DO DONKI', '☀️ REAL NASA DATA · DONKI ARCHIVE')}
              </span>
              <p>
                {L('Explosão solar', 'Solar flare')} <b>classe {session.flare.classType}</b> em{' '}
                {new Date(session.flare.peak.replace('Z', ':00Z')).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: 'UTC',
                })}{' '}
                UTC, região ativa {session.flare.region}. {session.flare.note}{' '}
                <a href={DONKI_SOURCE.url} target="_blank" rel="noreferrer noopener">
                  {L('Fonte', 'Source')}
                </a>
              </p>
              <p>
                Quanto mais forte a classe (C &lt; M &lt; X), mais radiação. Em Marte a tripulação
                já recebe {RADIATION.marsSurfacePerDay} mSv por dia só de estar lá.
              </p>
            </aside>
          )}

          {event.history && (
            <aside className="event-tablet__fact">
              <span className="event-tablet__fact-tag">
                <Info size={12} aria-hidden="true" /> {L('VOCÊ SABIA? · DADOS NASA', 'DID YOU KNOW? · NASA DATA')}
              </span>
              <p>
                {t(event.history)}{' '}
                {event.sourceUrl && (
                  <a href={event.sourceUrl} target="_blank" rel="noreferrer noopener">
                    {L('Saiba mais…', 'Learn more…')}
                  </a>
                )}
                {event.credit && (
                  <small style={{ display: 'block', opacity: 0.8 }}>
                    📎 {L('Fonte', 'Source')}: {event.credit}
                  </small>
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
                      <strong>{t(c.label)}</strong>
                      <Chips choice={c} kind={event.kind} />
                    </button>
                  </li>
                ))}
              </ul>

              <footer className="event-tablet__vote">
                {spectator ? (
                  <span>
                    👀 A tripulação está votando. Você chegou no meio e acompanha o resultado
                    ({mmss(left)}s).
                  </span>
                ) : mode === 'vote' ? (
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
                      {L('VOTAÇÃO:', 'VOTE:')} <b>{mmss(left)}s</b>
                    </span>
                  </>
                ) : mode === 'decider' && session.deciderId !== selfId ? (
                  <span>🎲 {session.deciderName} foi sorteado(a) para decidir. Aguarde…</span>
                ) : mode === 'decider' ? (
                  <span>{L('🎲 Você foi sorteado(a): a decisão é sua e vale para todos.', '🎲 You were picked: your decision counts for everyone.')}</span>
                ) : (
                  <span>{L('⏸ O jogo está pausado enquanto você decide.', '⏸ The game is paused while you decide.')}</span>
                )}
              </footer>
            </>
          ) : (
            <div className={`event-tablet__result is-${result.outcome.tone}`}>
              <small>{L('Decisão:', 'Decision:')} {t(event.choices[result.choice]?.label)}</small>
              <p>{t(result.outcome.text)}</p>
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
                {L('Entendido', 'Got it')}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
