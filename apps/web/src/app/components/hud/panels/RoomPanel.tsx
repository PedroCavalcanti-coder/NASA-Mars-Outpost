/**
 * Painel de Sala e Jogadores (Multiplayer).
 *
 * Permite gerenciar a sala marciana, visualizar colegas conectados,
 * verificar o modo de rede e copiar o código de convite.
 */

import { Check, Copy, Globe, Monitor, Share2, Users } from 'lucide-react';
import { useState } from 'react';
import { useHudContext } from '../HudContext';

export function RoomPanel() {
  const { roomCode, players, onCopyInvite } = useHudContext();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyInvite();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="hud-panel-content hud-panel-room">
      <div className="hud-panel-intro">
        <Users size={18} className="hud-panel-intro-icon" />
        <p>Compartilhe sua expedição com até 4 astronautas na mesma base marciana.</p>
      </div>

      <div className="hud-room-card">
        <span className="hud-room-kicker">CÓDIGO DA SALA</span>
        <div className="hud-room-code-row">
          <code className="hud-room-code">{roomCode}</code>
          <button
            type="button"
            className="hud-btn hud-btn--primary"
            onClick={handleCopy}
            title="Copiar código de convite da sala"
            aria-label="Copiar código de convite"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      <div className="hud-room-details">
        <div className="hud-room-stat">
          <div className="hud-room-stat-head">
            <Users size={15} />
            <span>Tripulação Presente</span>
          </div>
          <span className="hud-room-stat-value">
            <strong>{players.count}</strong> / 4 astronautas
          </span>
        </div>

        <div className="hud-room-stat">
          <div className="hud-room-stat-head">
            {players.mode === 'online' ? <Globe size={15} /> : <Monitor size={15} />}
            <span>Modo de Conexão</span>
          </div>
          <span className="hud-room-stat-value">
            {players.mode === 'online' ? (
              <span className="hud-badge-online">Online (servidor ativo)</span>
            ) : (
              <span className="hud-badge-local">Local (abas deste navegador)</span>
            )}
          </span>
        </div>
      </div>

      <div className="hud-room-instructions">
        <h4>Como jogar com amigos:</h4>
        <ol>
          <li>Copie o código acima e envie para seu amigo.</li>
          <li>Ele deve abrir o Mars Outpost e colar o código em "Entrar com Código".</li>
          <li>Ambos estarão na mesma base e poderão explorar e trabalhar juntos!</li>
        </ol>
      </div>

      <button
        type="button"
        className="hud-btn hud-btn--secondary hud-room-share-btn"
        onClick={handleCopy}
      >
        <Share2 size={16} />
        <span>Convidar Colegas</span>
      </button>
    </div>
  );
}
