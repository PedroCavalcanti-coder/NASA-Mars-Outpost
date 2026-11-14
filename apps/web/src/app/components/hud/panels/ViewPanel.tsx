/**
 * Painel de Câmera e Visualização.
 *
 * Permite alternar os modos de perspectiva da câmera (seguir/livre)
 * e o comportamento de corte dos tetos dos módulos da base.
 */

import { Camera, Eye, EyeOff, Navigation, Video } from 'lucide-react';
import { useHudContext } from '../HudContext';

export function ViewPanel() {
  const { cameraMode, onToggleCamera, roofsHidden, onToggleRoofs, coords } = useHudContext();

  return (
    <div className="hud-panel-content hud-panel-view">
      <div className="hud-panel-intro">
        <Video size={18} className="hud-panel-intro-icon" />
        <p>Ajuste os parâmetros de visão e renderização da base marciana.</p>
      </div>

      <div className="hud-view-options">
        {/* Alternância de Câmera */}
        <div className="hud-option-card">
          <div className="hud-option-info">
            <span className="hud-option-title">Modo de Câmera</span>
            <span className="hud-option-desc">
              {cameraMode === 'follow'
                ? 'A câmera acompanha o astronauta ou rover automaticamente.'
                : 'Câmera livre: explore a base sem mover o astronauta.'}
            </span>
          </div>
          <button
            type="button"
            className={`hud-btn ${cameraMode === 'free' ? 'hud-btn--active' : 'hud-btn--secondary'}`}
            onClick={onToggleCamera}
            aria-pressed={cameraMode === 'free'}
          >
            <Camera size={16} />
            <span>{cameraMode === 'follow' ? 'Seguir' : 'Câmera Livre'}</span>
          </button>
        </div>

        {/* Alternância de Teto */}
        <div className="hud-option-card">
          <div className="hud-option-info">
            <span className="hud-option-title">Corte de Teto da Base</span>
            <span className="hud-option-desc">
              {roofsHidden
                ? 'Tetos sempre ocultos (visão de corte permanente para ver o interior).'
                : 'Teto automático: oculta suavemente quando você entra em um módulo.'}
            </span>
          </div>
          <button
            type="button"
            className={`hud-btn ${roofsHidden ? 'hud-btn--active' : 'hud-btn--secondary'}`}
            onClick={onToggleRoofs}
            aria-pressed={roofsHidden}
          >
            {roofsHidden ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>{roofsHidden ? 'Teto Oculto' : 'Teto Auto'}</span>
          </button>
        </div>
      </div>

      {coords && (
        <div className="hud-coords-card">
          <div className="hud-coords-header">
            <Navigation size={14} />
            <span>Posição Atual do Explorador</span>
          </div>
          <div className="hud-coords-body">
            <span>
              X: <strong>{coords.gx >= 0 ? `+${coords.gx}` : coords.gx}</strong> · Y:{' '}
              <strong>{coords.gy >= 0 ? `+${coords.gy}` : coords.gy}</strong>
            </span>
            <span className={`hud-coords-tag ${coords.inside ? 'is-inside' : 'is-outside'}`}>
              {coords.inside ? 'Interior da Base' : 'Superfície Externa'}
            </span>
          </div>
        </div>
      )}

      <div className="hud-view-hints">
        <h4>Controles de Navegação 3D:</h4>
        <ul>
          <li>
            <strong>Girar câmera:</strong> clique e arraste com o botão direito ou esquerdo do
            mouse.
          </li>
          <li>
            <strong>Zoom:</strong> use a roda do mouse ou gesto de pinça no trackpad.
          </li>
        </ul>
      </div>
    </div>
  );
}
