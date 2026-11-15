/**
 * Painel de Câmera e Visualização.
 *
 * Permite alternar os modos de perspectiva da câmera (seguir/livre)
 * e o comportamento de corte dos tetos dos módulos da base.
 */

import { Camera, Eye, EyeOff, Navigation, Video } from 'lucide-react';
import { useHudContext } from '../HudContext';
import { L } from '../../../../lib/i18n';

export function ViewPanel() {
  const { cameraMode, onToggleCamera, roofsHidden, onToggleRoofs, coords } = useHudContext();

  return (
    <div className="hud-panel-content hud-panel-view">
      <div className="hud-panel-intro">
        <Video size={18} className="hud-panel-intro-icon" />
        <p>{L('Ajuste os parâmetros de visão e renderização da base marciana.', 'Adjust the view and rendering of the Mars base.')}</p>
      </div>

      <div className="hud-view-options">
        {/* Alternância de Câmera */}
        <div className="hud-option-card">
          <div className="hud-option-info">
            <span className="hud-option-title">{L('Modo de Câmera', 'Camera Mode')}</span>
            <span className="hud-option-desc">
              {cameraMode === 'follow'
                ? L('A câmera acompanha o astronauta ou rover automaticamente.', 'The camera follows the astronaut or rover automatically.')
                : L('Câmera livre: explore a base sem mover o astronauta.', 'Free camera: explore the base without moving the astronaut.')}
            </span>
          </div>
          <button
            type="button"
            className={`hud-btn ${cameraMode === 'free' ? 'hud-btn--active' : 'hud-btn--secondary'}`}
            onClick={onToggleCamera}
            aria-pressed={cameraMode === 'free'}
          >
            <Camera size={16} />
            <span>{cameraMode === 'follow' ? L('Seguir', 'Follow') : L('Câmera Livre', 'Free Camera')}</span>
          </button>
        </div>

        {/* Alternância de Teto */}
        <div className="hud-option-card">
          <div className="hud-option-info">
            <span className="hud-option-title">{L('Corte de Teto da Base', 'Base Roof Cutaway')}</span>
            <span className="hud-option-desc">
              {roofsHidden
                ? L('Tetos sempre ocultos (visão de corte permanente para ver o interior).', 'Roofs always hidden (permanent cutaway to see inside).')
                : L('Teto automático: oculta suavemente quando você entra em um módulo.', 'Automatic roof: fades out when you enter a module.')}
            </span>
          </div>
          <button
            type="button"
            className={`hud-btn ${roofsHidden ? 'hud-btn--active' : 'hud-btn--secondary'}`}
            onClick={onToggleRoofs}
            aria-pressed={roofsHidden}
          >
            {roofsHidden ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>{roofsHidden ? L('Teto Oculto', 'Roof Hidden') : L('Teto Auto', 'Roof Auto')}</span>
          </button>
        </div>
      </div>

      {coords && (
        <div className="hud-coords-card">
          <div className="hud-coords-header">
            <Navigation size={14} />
            <span>{L('Posição Atual do Explorador', 'Explorer\'s Current Position')}</span>
          </div>
          <div className="hud-coords-body">
            <span>
              X: <strong>{coords.gx >= 0 ? `+${coords.gx}` : coords.gx}</strong> · Y:{' '}
              <strong>{coords.gy >= 0 ? `+${coords.gy}` : coords.gy}</strong>
            </span>
            <span className={`hud-coords-tag ${coords.inside ? 'is-inside' : 'is-outside'}`}>
              {coords.inside ? L('Interior da Base', 'Inside the Base') : L('Superfície Externa', 'Outside Surface')}
            </span>
          </div>
        </div>
      )}

      <div className="hud-view-hints">
        <h4>{L('Controles de Navegação 3D:', '3D Navigation Controls:')}</h4>
        <ul>
          <li>
            <strong>{L('Girar câmera:', 'Rotate camera:')}</strong> {L('clique e arraste com o botão direito ou esquerdo do mouse.', 'click and drag with the left or right mouse button.')}
          </li>
          <li>
            <strong>{L('Zoom:', 'Zoom:')}</strong> {L('use a roda do mouse ou gesto de pinça no trackpad.', 'use the mouse wheel or pinch on the trackpad.')}
          </li>
        </ul>
      </div>
    </div>
  );
}
