/**
 * Faixa inferior da HUD: mensagens da sala e botão de sair do rover.
 *
 * Antes eram elementos soltos do `Game` (centralizados na tela inteira, passando por baixo
 * da doca). Agora ficam dentro da HUD, alinhados à esquerda e sem invadir a doca da direita.
 */

import { Car, MessageCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import './crewChat.css';
import { useHudContext } from './HudContext';

interface HudBottomProps {
  chatOpen: boolean;
  onToggleChat: () => void;
  driving: boolean;
  onExitRover: () => void;
}

export function HudBottom({ driving, onExitRover, chatOpen }: HudBottomProps) {
  const { chat, onSendChat } = useHudContext();
  const [draft, setDraft] = useState('');
  const [showMessages, setShowMessages] = useState(false);
  const lastMessageId = chat.at(-1)?.id;
  const messages = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (messages.current) messages.current.scrollTop = messages.current.scrollHeight;
  }, [chat, chatOpen]);

  useEffect(() => {
    if (!lastMessageId) return;
    setShowMessages(true);
    const timer = window.setTimeout(() => setShowMessages(false), 10_000);
    return () => window.clearTimeout(timer);
  }, [lastMessageId]);

  return (
    <div className="hud-bottom">
      <section
        className="crew-chat crew-chat--always"
        data-bit-target="chat"
        aria-label="Chat da tripulação"
      >
        <ul
          ref={messages}
          className={`crew-chat__messages ${showMessages ? '' : 'is-hidden'}`}
          aria-live="polite"
          aria-label="Mensagens recentes"
        >
          {chat.map((m) => (
            <li key={m.id} className="crew-chat__line">
              <strong>{m.local ? 'Você' : m.name}</strong>
              <span>{m.emoji}</span>
            </li>
          ))}
        </ul>
        <form
          className="crew-chat__input-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (onSendChat(draft)) setDraft('');
          }}
        >
          <MessageCircle size={19} aria-hidden="true" />
          <input
            aria-label="Mensagem para a tripulação"
            placeholder="Escreva uma mensagem..."
            maxLength={240}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" aria-label="Enviar mensagem" disabled={!draft.trim()}>
            <Send size={19} />
          </button>
        </form>
      </section>

      <div className="hud-bottom__row">
        {driving && (
          <button type="button" className="hud-bottom__exit" onClick={onExitRover}>
            <Car size={18} />
            <span>Sair do rover</span>
          </button>
        )}
      </div>
    </div>
  );
}
