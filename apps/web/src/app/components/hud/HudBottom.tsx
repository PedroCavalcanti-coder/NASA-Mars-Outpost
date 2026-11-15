/**
 * Faixa inferior da HUD: mensagens da sala e botão de sair do rover.
 *
 * Antes eram elementos soltos do `Game` (centralizados na tela inteira, passando por baixo
 * da doca). Agora ficam dentro da HUD, alinhados à esquerda e sem invadir a doca da direita.
 */

import { Car, MessageCircle, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import './crewChat.css';
import { EmoteWheel } from './EmoteWheel';
import { useHudContext } from './HudContext';
import { L } from '../../../lib/i18n';

interface HudBottomProps {
  chatOpen: boolean;
  onToggleChat: () => void;
  driving: boolean;
  onExitRover: () => void;
}

export function HudBottom({ driving, onExitRover, chatOpen }: HudBottomProps) {
  const { chat, onSendChat, onSendEmote } = useHudContext();
  const [draft, setDraft] = useState('');
  const [showMessages, setShowMessages] = useState(false);
  /** o campo de texto só abre quando a pessoa quer escrever (economiza tela, sobretudo no celular) */
  const [typing, setTyping] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (typing) input.current?.focus();
  }, [typing]);
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
        className={`crew-chat crew-chat--always ${typing ? 'is-typing' : 'is-compact'}`}
        data-bit-target="chat"
        aria-label={L('Chat da tripulação', 'Crew chat')}
      >
        <ul
          ref={messages}
          className={`crew-chat__messages ${showMessages ? '' : 'is-hidden'}`}
          aria-live="polite"
          aria-label={L('Mensagens recentes', 'Recent messages')}
        >
          {chat.map((m) => (
            <li key={m.id} className="crew-chat__line">
              <strong>{m.local ? L('Você', 'You') : m.name}</strong>
              <span>{m.emoji}</span>
            </li>
          ))}
        </ul>
        <div className="crew-chat__bar">
          <EmoteWheel onPick={onSendEmote} />
          {typing ? (
            <form
              className="crew-chat__input-row"
              onSubmit={(event) => {
                event.preventDefault();
                if (onSendChat(draft)) {
                  setDraft('');
                  setTyping(false);
                }
              }}
            >
              <input
                ref={input}
                aria-label={L('Mensagem para a tripulação', 'Message to the crew')}
                placeholder={L('Mensagem…', 'Message…')}
                maxLength={240}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setTyping(false);
                }}
              />
              <button type="submit" aria-label={L('Enviar mensagem', 'Send message')} disabled={!draft.trim()}>
                <Send size={17} />
              </button>
              <button
                type="button"
                className="crew-chat__close"
                aria-label={L('Fechar mensagem', 'Close message')}
                onClick={() => setTyping(false)}
              >
                <X size={17} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="crew-chat__open"
              aria-label={L('Escrever mensagem para a tripulação', 'Write a message to the crew')}
              title={L('Escrever mensagem', 'Write a message')}
              onClick={() => setTyping(true)}
            >
              <MessageCircle size={20} />
            </button>
          )}
        </div>
      </section>

      <div className="hud-bottom__row">
        {driving && (
          <button type="button" className="hud-bottom__exit" onClick={onExitRover}>
            <Car size={18} />
            <span>{L('Sair do rover', 'Leave the rover')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
