import { Heart, Moon, Sparkles, Sun } from 'lucide-react';
import { useNap } from '../../../../game/survival/NapSystem';
import './survival.css';

/**
 * Painel de Descanso e Moral do Astronauta.
 * Alocado na HUD conforme especificações.
 * Permite cochilar dentro da base para elevar a moral da equipe (+moral/s),
 * com consumo leve de oxigênio da base e despertar a qualquer instante por atalho ou clique.
 */
export function NapPanel() {
  const isSleeping = useNap((s) => s.isSleeping);
  const canNap = useNap((s) => s.canNap);
  const reasonBlocked = useNap((s) => s.reasonBlocked);
  const moraleLevel = useNap((s) => s.moraleLevel);
  const toggleNap = useNap((s) => s.toggleNap);

  return (
    <section className="survival-panel nap-panel" aria-label="Painel de Descanso e Moral">
      <div className="nap-panel__header">
        <div className="nap-panel__morale">
          <Heart size={14} color="#f43f5e" fill="#f43f5e" />
          <span className="nap-panel__morale-val">{Math.round(moraleLevel)}% Moral</span>
        </div>
        {isSleeping && (
          <span className="oxygen-panel__badge oxygen-panel__badge--inside">
            <Sparkles size={11} /> +Moral/s
          </span>
        )}
      </div>

      <button
        type="button"
        className={`nap-panel__button ${isSleeping ? 'nap-panel__button--sleeping' : ''}`}
        onClick={toggleNap}
        disabled={!isSleeping && !canNap}
        title={!isSleeping && !canNap ? (reasonBlocked ?? 'Indisponível no momento') : 'Atalho: Z'}
        aria-label={isSleeping ? 'Acordar astronauta' : 'Iniciar cochilo'}
      >
        {isSleeping ? <Sun size={15} /> : <Moon size={15} />}
        <span>{isSleeping ? 'Acordar' : 'Cochilar'}</span>
        <kbd className="nap-panel__kbd">Z</kbd>
      </button>

      <div className="nap-panel__hint">
        {isSleeping
          ? 'Descansando... Pressione Z, Esc ou clique para acordar.'
          : canNap
            ? 'Cochilar eleva a moral da missão.'
            : (reasonBlocked ?? 'Apenas dentro da base')}
      </div>
    </section>
  );
}

export default NapPanel;
