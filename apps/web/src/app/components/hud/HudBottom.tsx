/**
 * Faixa inferior da HUD: mensagens da sala, coordenadas, botão de sair do rover e dicas.
 *
 * Antes eram elementos soltos do `Game` (centralizados na tela inteira, passando por baixo
 * da doca). Agora ficam dentro da HUD, alinhados à esquerda e sem invadir a doca da direita.
 */

import { Car, MapPin } from 'lucide-react';
import { useHudContext } from './HudContext';

interface HudBottomProps {
  driving: boolean;
  onExitRover: () => void;
  showHints: boolean;
  showCoords: boolean;
}

export function HudBottom({ driving, onExitRover, showHints, showCoords }: HudBottomProps) {
  const { chat, coords } = useHudContext();
  const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));

  return (
    <div className="hud-bottom">
      {chat.length > 0 && (
        <ul className="hud-bottom__chat" aria-live="polite" aria-label="Mensagens da sala">
          {chat.map((m) => (
            <li key={m.id} className={m.local ? 'is-me' : ''}>
              <strong>{m.name}</strong>
              <span className="hud-bottom__emoji">{m.emoji}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="hud-bottom__row">
        {driving && (
          <button type="button" className="hud-bottom__exit" onClick={onExitRover}>
            <Car size={18} />
            <span>Sair do rover</span>
          </button>
        )}
        {showCoords && coords && (
          <span className="hud-bottom__coords">
            <MapPin size={13} aria-hidden="true" />X {signed(coords.gx)} · Y {signed(coords.gy)} ·{' '}
            <strong className={coords.inside ? 'is-inside' : 'is-outside'}>
              {coords.inside ? 'interior' : 'exterior'}
            </strong>
          </span>
        )}
      </div>

      {showHints && (
        <p className="hud-bottom__hints" role="note">
          <span>
            <kbd>WASD</kbd> ou clique para andar
          </span>
          <span>Clique em painéis, canteiros, filtros e na sonda para trabalhar</span>
          <span>
            <kbd>T</kbd> tarefas do Sol
          </span>
          <span>Clique no rover para dirigir · duplo clique nele para sair</span>
          <span>Arraste para girar a câmera</span>
        </p>
      )}
    </div>
  );
}
