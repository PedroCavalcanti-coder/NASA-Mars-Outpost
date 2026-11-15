import { BookOpen, ExternalLink, Info } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { LORE } from '../../../game/lore/lore';
import { useLore } from '../../../game/lore/store';
import { GameClock } from '../../../game/sim/clock';

/**
 * Curiosidade da base: mesma janela dos eventos, com a história real do objeto, foto de arquivo e
 * as fontes. O relógio fica pausado enquanto ela está aberta (se você puder mexer nele).
 */
export function LoreCard() {
  const id = useLore((s) => s.queue[0]);
  const close = useLore((s) => s.close);
  const ok = useRef<HTMLButtonElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    if (!id) return;
    ok.current?.focus();
    if (!GameClock.isPaused() && GameClock.canControl()) {
      paused.current = GameClock.setPaused(true) !== false;
    }
    return () => {
      if (paused.current) {
        GameClock.setPaused(false);
        paused.current = false;
      }
    };
  }, [id]);

  if (!id) return null;
  const lore = LORE[id];
  return (
    <div className="event-tablet__backdrop" role="presentation">
      <section
        className="event-tablet event-tablet--lore"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lore-title"
      >
        <header className="event-tablet__head">
          <span className="event-tablet__alert" aria-hidden="true">
            <BookOpen size={24} />
          </span>
          <h2 id="lore-title">
            <small>CURIOSIDADE: </small>
            {lore.title.toUpperCase()}
          </h2>
        </header>
        <div className="event-tablet__screen">
          <figure className="event-tablet__photo">
            <img src={lore.image} alt={lore.title} loading="eager" />
            <figcaption>{lore.credit}</figcaption>
          </figure>
          <p className="event-tablet__body">{lore.body}</p>
          <aside className="event-tablet__fact">
            <span className="event-tablet__fact-tag">
              <Info size={12} aria-hidden="true" /> VOCÊ SABIA?
            </span>
            <p>{lore.fact}</p>
          </aside>
          <ul className="event-tablet__links">
            {lore.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer noopener">
                  <ExternalLink size={13} aria-hidden="true" /> {l.label}
                </a>
              </li>
            ))}
          </ul>
          <button ref={ok} type="button" className="event-tablet__ok" onClick={close}>
            Entendido
          </button>
        </div>
      </section>
    </div>
  );
}
