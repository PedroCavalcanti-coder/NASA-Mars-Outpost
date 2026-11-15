import { useEffect, useState } from 'react';
import { GAME_EVENTS } from '../../game/events/events';
import { gameplayCommand } from '../../store/gameplay';
import './devPanel.css';

type Dev = 'complete' | 'event' | 'catastrophe' | 'storm' | 'refill' | 'next_sol' | 'critical' | 'radiation';

/** Painel provisório de testes: F2 abre/fecha, F4 esconde/mostra a HUD e a interface. */
export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'F4') {
        e.preventDefault();
        document.body.classList.toggle('ui-hidden');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('ui-hidden');
    };
  }, []);

  if (!open) return null;
  const run = async (action: Dev, id?: string) => {
    const r = await gameplayCommand({ type: 'dev', action, ...(id ? { id } : {}) });
    setMsg(r.ok ? `ok: ${action} ${id ?? ''}` : `erro: ${r.error}`);
  };
  return (
    <aside className="dev-panel">
      <header>
        DEV (F2 fecha · F4 esconde UI)
        <button type="button" onClick={() => setOpen(false)}>✕</button>
      </header>
      <h4>Eventos</h4>
      <div className="dev-panel__grid">
        {GAME_EVENTS.map((e) => (
          <button key={e.id} type="button" onClick={() => run('event', e.id)}>
            {e.icon} {e.title}
          </button>
        ))}
      </div>
      <h4>Mundo</h4>
      <div className="dev-panel__grid">
        <button type="button" onClick={() => run('radiation', '3')}>☢️ Radiação alta</button>
        <button type="button" onClick={() => run('storm')}>🌪️ Tempestade</button>
        <button type="button" onClick={() => run('critical', 'breach')}>⚠️ Crítico: rombo</button>
        <button type="button" onClick={() => run('critical', 'ducts')}>⚠️ Crítico: dutos</button>
        <button type="button" onClick={() => run('catastrophe', 'micrometeorite')}>☄️ Micrometeoritos</button>
        <button type="button" onClick={() => run('refill')}>🔋 Encher recursos</button>
        <button type="button" onClick={() => run('next_sol')}>⏭ Próximo Sol</button>
      </div>
      <p>{msg}</p>
    </aside>
  );
}
