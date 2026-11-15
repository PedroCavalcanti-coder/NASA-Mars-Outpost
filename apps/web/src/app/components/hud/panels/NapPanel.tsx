import { Moon } from 'lucide-react';
import { useNap } from '../../../../game/survival/NapSystem';
import './survival.css';

/**
 * Painel de Sono: dormir (só à noite, dentro da base) faz a noite passar até o amanhecer.
 * Gasta oxigênio da base e uma refeição. Também funciona pelo atalho Z ou tocando a cama.
 */
export function NapPanel() {
  const isSleeping = useNap((s) => s.isSleeping);
  const canNap = useNap((s) => s.canNap);
  const reasonBlocked = useNap((s) => s.reasonBlocked);
  const toggleNap = useNap((s) => s.toggleNap);

  return (
    <section className="survival-panel nap-panel" aria-label="Painel de Sono">
      <button
        type="button"
        className={`nap-panel__button ${isSleeping ? 'nap-panel__button--sleeping' : ''}`}
        onClick={toggleNap}
        disabled={isSleeping || !canNap}
        title={!canNap ? (reasonBlocked ?? 'Indisponível no momento') : 'Atalho: Z'}
        aria-label="Dormir até o amanhecer"
      >
        <Moon size={15} />
        <span>{isSleeping ? 'Dormindo…' : 'Dormir até o amanhecer'}</span>
        <kbd className="nap-panel__kbd">Z</kbd>
      </button>

      <div className="nap-panel__hint">
        {isSleeping
          ? 'A noite está passando…'
          : canNap
            ? 'Pula a noite. Custa oxigênio da base e uma refeição.'
            : (reasonBlocked ?? 'Apenas dentro da base, à noite.')}
      </div>
    </section>
  );
}

export default NapPanel;
