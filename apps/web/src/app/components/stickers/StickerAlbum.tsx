import { useEffect } from 'react';
import { chime } from '../../../lib/chime';
import { L } from '../../../lib/i18n';
import { STICKERS, useStickers, WEEK_MISSIONS, weekProgress } from '../../../game/stickers';
import './stickers.css';

/** Aviso de figurinha nova + álbum (abre pelo aviso, pela barra de pesquisa ou pelas configurações). */
export function StickerLayer() {
  const latest = useStickers((s) => s.latest);
  const open = useStickers((s) => s.albumOpen);
  const unlocked = useStickers((s) => s.unlocked);
  const week = useStickers((s) => s.week);
  const counts = useStickers((s) => s.counts);

  useEffect(() => {
    if (!latest) return;
    chime([784, 988, 1175, 1568], 0.1, 'triangle', 0.07);
    const id = window.setTimeout(() => useStickers.setState({ latest: null }), 6000);
    return () => window.clearTimeout(id);
  }, [latest]);

  const { mission, done, total } = weekProgress(week, counts);
  const have = STICKERS.filter((s) => unlocked[s.id]).length;
  return (
    <>
      {latest && (
        <button
          type="button"
          className="sticker-toast"
          onClick={() => useStickers.setState({ latest: null, albumOpen: true })}
        >
          <span className="sticker-toast__icon" aria-hidden="true">{latest.icon}</span>
          <span>
            <small>{L('Nova figurinha!', 'New sticker!')}</small>
            <strong>{L(latest.title[0], latest.title[1])}</strong>
          </span>
        </button>
      )}
      {open && (
        <div className="sticker-album" role="dialog" aria-modal="true" aria-label={L('Álbum de figurinhas', 'Sticker album')}>
          <div className="sticker-album__card">
            <header>
              <h2>🏅 {L('Meu álbum', 'My album')} <small>{have}/{STICKERS.length}</small></h2>
              <button type="button" onClick={() => useStickers.setState({ albumOpen: false })} aria-label={L('Fechar', 'Close')}>✕</button>
            </header>
            <section className="sticker-week">
              <h3>
                {mission.icon} {L(mission.title[0], mission.title[1])} · {L('Semana', 'Week')} {week + 1}
              </h3>
              <ul>
                {mission.steps.map((st) => {
                  const n = Math.min(st.target, counts[st.counter] ?? 0);
                  return (
                    <li key={st.counter + st.target} className={n >= st.target ? 'is-done' : ''}>
                      {n >= st.target ? '✅' : '⬜'} {L(st.label[0], st.label[1])} ({n}/{st.target})
                    </li>
                  );
                })}
              </ul>
              <p>
                {done === total
                  ? L('🎉 Missão da semana cumprida! A figurinha é sua.', '🎉 Mission of the week complete! The sticker is yours.')
                  : L(`Faltam ${total - done} passo(s). A cada 7 dias muda a missão.`, `${total - done} step(s) to go. The mission changes every 7 sols.`)}
              </p>
            </section>
            <ul className="sticker-grid">
              {STICKERS.map((s) => {
                const got = Boolean(unlocked[s.id]);
                return (
                  <li key={s.id} className={got ? 'is-got' : ''}>
                    <span aria-hidden="true">{got ? s.icon : '❔'}</span>
                    <strong>{got ? L(s.title[0], s.title[1]) : '???'}</strong>
                    <small>{L(s.how[0], s.how[1])}</small>
                  </li>
                );
              })}
            </ul>
            <p className="sticker-album__note">{L('As figurinhas ficam só neste aparelho.', 'Stickers are kept only on this device.')}</p>
          </div>
        </div>
      )}
    </>
  );
}

export const openAlbum = () => useStickers.setState({ albumOpen: true });
export const WEEK_COUNT = WEEK_MISSIONS.length;
