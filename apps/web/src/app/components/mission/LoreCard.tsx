import { BookOpen, ExternalLink, Info } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { LORE } from '../../../game/lore/lore';
import { useLore } from '../../../game/lore/store';
import { useGameSettings } from '../../../lib/gameSettings';
import { t, L } from '../../../lib/i18n';

/**
 * Curiosidade da base: mesma janela dos eventos, com a história real do objeto, foto de arquivo e
 * as fontes. O tempo da sala continua correndo (outros jogadores seguem jogando).
 */
export function LoreCard() {
  const id = useLore((s) => s.queue[0]);
  const close = useLore((s) => s.close);
  const ok = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!id) return;
    ok.current?.focus();
    const { audio } = useGameSettings.getState();
    if (!audio.muted && audio.masterVolume > 0 && audio.sfxVolume > 0) {
      const sound = new Audio('/assets/audio/card-info.mp3');
      sound.volume = (audio.masterVolume * audio.sfxVolume) / 10000;
      void sound.play().catch(() => {});
    }
    // a curiosidade NÃO pausa a sala: num jogo em grupo, ler um card não para todo mundo
  }, [id]);

  if (!id) return null;
  const lore = LORE[id];
  return (
    <div className="event-tablet__backdrop" role="presentation">
      <section
        className="event-tablet event-tablet--lore lore-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lore-title"
      >
        <header className="event-tablet__head">
          <span className="event-tablet__alert" aria-hidden="true">
            <BookOpen size={24} />
          </span>
          <h2 id="lore-title">
            <small>{L('CURIOSIDADE:', 'DID YOU KNOW:')} </small>
            {t(lore.title).toUpperCase()}
          </h2>
        </header>
        <div className="event-tablet__screen lore-card__screen">
          <figure className="event-tablet__photo lore-card__photo">
            <img src={lore.image} alt={t(lore.title)} loading="eager" />
            <figcaption>{lore.credit}</figcaption>
          </figure>
          <div className="lore-card__text">
            <p className="event-tablet__body">{t(lore.body)}</p>
            <aside className="event-tablet__fact">
              <span className="event-tablet__fact-tag">
                <Info size={12} aria-hidden="true" /> {L('VOCÊ SABIA?', 'DID YOU KNOW?')}
              </span>
              <p>{t(lore.fact)}</p>
            </aside>
            <ul className="event-tablet__links">
              {lore.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer noopener">
                    <ExternalLink size={13} aria-hidden="true" /> {t(l.label)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <button ref={ok} type="button" className="event-tablet__ok lore-card__ok" onClick={close}>
            {L('Entendido', 'Got it')}
          </button>
        </div>
      </section>
    </div>
  );
}
