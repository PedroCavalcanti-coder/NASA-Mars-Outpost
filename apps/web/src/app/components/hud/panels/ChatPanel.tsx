/**
 * Painel de Comunicação e Emojis da Tripulação.
 *
 * Permite enviar reações expressivas rápidas em tempo real
 * para os astronautas conectados na mesma sala.
 */

import { GAME_EMOTES } from '@mars/shared';
import { MessageSquare, Smile } from 'lucide-react';
import { useHudContext } from '../HudContext';

export function ChatPanel() {
  const { chat, onSendEmote } = useHudContext();

  return (
    <div className="hud-panel-content hud-panel-chat">
      <div className="hud-panel-intro">
        <Smile size={18} className="hud-panel-intro-icon" />
        <p>Envie reações expressivas e veja as mensagens recentes transmitidas pela tripulação.</p>
      </div>

      <div className="hud-chat-section">
        <h4 className="hud-chat-heading">Enviar Reação Rápida</h4>
        <div className="hud-emote-grid">
          {GAME_EMOTES.map((emoji, index) => (
            <button
              key={emoji}
              type="button"
              className="hud-emote-item"
              onClick={() => onSendEmote(index)}
              title={`Enviar ${emoji}`}
              aria-label={`Enviar emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="hud-chat-section">
        <div className="hud-chat-header">
          <MessageSquare size={14} />
          <h4>Transmissões Recentes</h4>
        </div>

        {chat.length === 0 ? (
          <div className="hud-chat-empty">
            Nenhuma mensagem recente. Clique em um emoji acima para transmitir!
          </div>
        ) : (
          <ul className="hud-chat-list" aria-label="Lista de mensagens">
            {chat.map((msg) => (
              <li
                key={msg.id}
                className={`hud-chat-bubble ${msg.local ? 'is-local' : 'is-remote'}`}
              >
                <span className="hud-chat-author">{msg.name}:</span>
                <span className="hud-chat-msg-emoji">{msg.emoji}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
