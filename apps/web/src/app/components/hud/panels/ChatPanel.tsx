/**
 * Painel de Comunicação e Emojis da Tripulação.
 *
 * Permite enviar reações expressivas rápidas em tempo real
 * para os astronautas conectados na mesma sala.
 */

import { DUO_GESTURE_IDS, DUO_GESTURES, EMOTE_ANIMATIONS, GAME_EMOTES } from '@mars/shared';
import { MessageSquare, Smile } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useHudContext } from '../HudContext';
import { L } from '../../../../lib/i18n';

export function ChatPanel() {
  const { chat, onSendEmote, viewer } = useHudContext();
  // astronautas a pé ao alcance de um gesto em dupla (só na sala online)
  const [nearby, setNearby] = useState<Array<{ id: string; name: string }>>([]);
  const [target, setTarget] = useState<string | null>(null);
  const duoAvailable = viewer?.canDuoGesture === true;
  useEffect(() => {
    if (!viewer || !duoAvailable) return;
    const tick = () =>
      setNearby((prev) => {
        const next = viewer.nearbyPlayers().map((p) => ({ id: p.id, name: p.name }));
        const same = prev.length === next.length && prev.every((p, i) => p.id === next[i]?.id);
        return same ? prev : next;
      });
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [viewer, duoAvailable]);
  const chosen = nearby.find((p) => p.id === target) ?? nearby[0];

  return (
    <div className="hud-panel-content hud-panel-chat">
      <div className="hud-panel-intro">
        <Smile size={18} className="hud-panel-intro-icon" />
        <p>{L('Envie reações expressivas e veja as mensagens recentes transmitidas pela tripulação.', 'Send quick reactions and see the crew\'s recent messages.')}</p>
      </div>

      <div className="hud-chat-section">
        <h4 className="hud-chat-heading">{L('Enviar Reação Rápida', 'Send a Quick Reaction')}</h4>
        <div className="hud-emote-grid">
          {GAME_EMOTES.map((emoji, index) => (
            <button
              key={emoji}
              type="button"
              className="hud-emote-item"
              onClick={() => onSendEmote(index)}
              title={EMOTE_ANIMATIONS[index]?.label ?? `Enviar ${emoji}`}
              aria-label={`Enviar ${EMOTE_ANIMATIONS[index]?.label ?? 'emoji'} ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {duoAvailable && (
        <div className="hud-chat-section">
          <h4 className="hud-chat-heading">{L('Gestos em Dupla', 'Two-Person Gestures')}</h4>
          {chosen ? (
            <>
              {nearby.length > 1 && (
                <select
                  className="hud-duo-target"
                  value={chosen.id}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-label={L('Astronauta convidado', 'Invited astronaut')}
                >
                  {nearby.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="hud-duo-grid">
                {DUO_GESTURE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="hud-duo-item"
                    onClick={() => viewer?.inviteGesture(id, chosen.id)}
                    title={`${DUO_GESTURES[id].label} com ${chosen.name}`}
                  >
                    <span aria-hidden="true">{DUO_GESTURES[id].emoji}</span>
                    {DUO_GESTURES[id].label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="hud-chat-empty">
              {L('Chegue perto de outro astronauta (a pé) para convidar para um gesto.', 'Walk close to another astronaut to invite them to a gesture.')}
            </div>
          )}
        </div>
      )}

      <div className="hud-chat-section">
        <div className="hud-chat-header">
          <MessageSquare size={14} />
          <h4>{L('Transmissões Recentes', 'Recent Messages')}</h4>
        </div>

        {chat.length === 0 ? (
          <div className="hud-chat-empty">
            {L('Nenhuma mensagem recente. Clique em um emoji acima para transmitir!', 'No recent messages. Click an emoji above to send one!')}
          </div>
        ) : (
          <ul className="hud-chat-list" aria-label={L('Lista de mensagens', 'Message list')}>
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
