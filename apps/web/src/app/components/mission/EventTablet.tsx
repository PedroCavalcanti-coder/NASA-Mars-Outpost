import { Tablet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  type EventChoice,
  type EventDeltas,
  type EventOutcome,
  type GameEventDef,
  resolveChoice,
} from '../../../game/events/events';
import { useGameEvents } from '../../../game/events/store';

const NAMES: Record<keyof EventDeltas, string> = {
  energy: '⚡ Energia',
  supplies: '🍞 Mantimentos',
  materials: '🔩 Materiais',
  oxygen: '🫁 Oxigênio',
  research: '🔬 Pesquisa',
};

interface Props {
  /** aplica o resultado no mundo e na missão */
  onResolve: (event: GameEventDef, outcome: EventOutcome) => void;
}

/**
 * Tablet de eventos: aparece sempre que algo acontece na base. O jogador precisa escolher uma
 * das opções; cada uma tem um resultado (mostrado logo depois). Funciona só com toque.
 */
export function EventTablet({ onResolve }: Props) {
  const event = useGameEvents((s) => s.queue[0]);
  const shift = useGameEvents((s) => s.shift);
  const [outcome, setOutcome] = useState<{ choice: EventChoice; result: EventOutcome } | null>(
    null,
  );
  const first = useRef<HTMLButtonElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: foco ao trocar de evento
  useEffect(() => {
    setOutcome(null);
    first.current?.focus();
  }, [event?.id]);

  if (!event) return null;

  const choose = (choice: EventChoice) => {
    if (outcome) return;
    const result = resolveChoice(choice, Math.random());
    setOutcome({ choice, result });
    onResolve(event, result);
  };

  return (
    <div className="event-tablet__backdrop" role="presentation">
      <section
        className={`event-tablet event-tablet--${event.kind}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="event-title"
      >
        <header className="event-tablet__bar">
          <Tablet size={16} aria-hidden="true" />
          <span>{event.kind === 'major' ? 'ALERTA DA BASE' : 'AVISO DO DIA'}</span>
        </header>
        <div className="event-tablet__screen">
          <div className="event-tablet__icon" aria-hidden="true">
            {event.icon}
          </div>
          <h2 id="event-title">{event.title}</h2>
          <p className="event-tablet__body">{event.body}</p>

          {!outcome ? (
            <ul className="event-tablet__choices">
              {event.choices.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    ref={i === 0 ? first : undefined}
                    className="event-tablet__choice"
                    onClick={() => choose(c)}
                  >
                    <strong>{c.label}</strong>
                    <small>{c.hint}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={`event-tablet__result is-${outcome.result.tone}`}>
              <small>Você escolheu: {outcome.choice.label}</small>
              <p>{outcome.result.text}</p>
              {outcome.result.deltas && (
                <ul className="event-tablet__deltas">
                  {(Object.keys(outcome.result.deltas) as (keyof EventDeltas)[])
                    .filter((k) => outcome.result.deltas?.[k])
                    .map((k) => {
                      const v = outcome.result.deltas?.[k] ?? 0;
                      return (
                        <li key={k} className={v > 0 ? 'is-up' : 'is-down'}>
                          {NAMES[k]} {v > 0 ? `+${v}` : `−${Math.abs(v)}`}
                        </li>
                      );
                    })}
                </ul>
              )}
              <button type="button" className="event-tablet__ok" onClick={shift}>
                Entendido
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
