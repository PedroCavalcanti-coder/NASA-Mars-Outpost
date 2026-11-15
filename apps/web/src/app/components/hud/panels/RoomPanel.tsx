/**
 * Painel de Sala e Jogadores (Multiplayer).
 *
 * Permite gerenciar a sala marciana, visualizar colegas conectados,
 * verificar o modo de rede e copiar o código de convite.
 */

import { Check, Copy, Globe, Monitor, Share2, Users } from 'lucide-react';
import { useState } from 'react';
import { useHudContext } from '../HudContext';
import { L } from '../../../../lib/i18n';

export function RoomPanel() {
  const { roomCode, players, onCopyInvite } = useHudContext();
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  const handleCopy = async () => {
    const ok = (await onCopyInvite()) !== false;
    setCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCopied(null), 2500);
  };

  return (
    <div className="hud-panel-content hud-panel-room">
      <div className="hud-panel-intro">
        <Users size={18} className="hud-panel-intro-icon" />
        <p>{L('Compartilhe sua expedição com até 4 astronautas na mesma base marciana.', 'Share your expedition with up to 4 astronauts on the same Mars base.')}</p>
      </div>

      <div className="hud-room-card">
        <span className="hud-room-kicker">{L('CÓDIGO DA SALA', 'ROOM CODE')}</span>
        <div className="hud-room-code-row">
          <code className="hud-room-code" style={{ userSelect: 'all' }}>
            {roomCode}
          </code>
          <button
            type="button"
            className="hud-btn hud-btn--primary"
            onClick={handleCopy}
            title={L('Copiar código de convite da sala', 'Copy the room invite code')}
            aria-label={L('Copiar código de convite', 'Copy invite code')}
          >
            {copied === 'ok' ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied === 'ok' ? 'Copiado!' : copied === 'fail' ? 'Falhou' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      <div className="hud-room-details">
        <div className="hud-room-stat">
          <div className="hud-room-stat-head">
            <Users size={15} />
            <span>{L('Tripulação Presente', 'Crew Online')}</span>
          </div>
          <span className="hud-room-stat-value">
            <strong>{players.count}</strong> {L('/ 4 astronautas', '/ 4 astronauts')}
          </span>
        </div>

        <div className="hud-room-stat">
          <div className="hud-room-stat-head">
            {players.mode === 'online' ? <Globe size={15} /> : <Monitor size={15} />}
            <span>{L('Modo de Conexão', 'Connection Mode')}</span>
          </div>
          <span className="hud-room-stat-value">
            {players.mode === 'online' ? (
              <span className="hud-badge-online" role="status">
                {players.status === 'reconnecting'
                  ? 'Reconectando…'
                  : players.status === 'failed'
                    ? 'Conexão encerrada'
                    : 'Online (servidor ativo)'}
              </span>
            ) : (
              <span className="hud-badge-local">{L('Local (abas deste navegador)', 'Local (tabs in this browser)')}</span>
            )}
          </span>
        </div>
      </div>

      <div className="hud-room-instructions">
        <h4>{L('Como jogar com amigos:', 'How to play with friends:')}</h4>
        <ol>
          <li>{L('Copie o código acima e envie para seu amigo.', 'Copy the code above and send it to your friend.')}</li>
          <li>{L('Ele deve abrir o Mars Outpost e colar o código em "Entrar com Código".', 'They open Mars Outpost and paste the code in “Join a World”.')}</li>
          <li>{L('Ambos estarão na mesma base e poderão explorar e trabalhar juntos!', 'You will both be on the same base and can explore and work together!')}</li>
        </ol>
      </div>

      <button
        type="button"
        className="hud-btn hud-btn--secondary hud-room-share-btn"
        onClick={handleCopy}
      >
        <Share2 size={16} />
        <span>{L('Convidar Colegas', 'Invite Friends')}</span>
      </button>
    </div>
  );
}
