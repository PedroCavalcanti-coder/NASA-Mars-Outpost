/**
 * Painel de Sistema e Configurações da Base.
 *
 * Oferece acesso às configurações gerais (vídeo, áudio, acessibilidade),
 * dados científicos do sítio de pouso e procedimentos de salvamento/saída.
 */

import { MARS_SITES, MARS_TREK_URL } from '@mars/shared';
import { Compass, Info, LogOut, Save, Sliders } from 'lucide-react';
import { useHudContext } from '../HudContext';
import { L } from '../../../../lib/i18n';

export function SystemPanel() {
  const { info, astronautName, onOpenSettings, onRequestLeave, onSaveWorld } = useHudContext();

  return (
    <div className="hud-panel-content hud-panel-system">
      {/* Informações da Base Atual */}
      <div className="hud-base-card">
        <div className="hud-base-eyebrow">
          <Compass size={14} />
          <span>ASTRONAUTA {astronautName.toUpperCase()}</span>
        </div>
        <h3 className="hud-base-title">{info?.name ?? 'Base Marciana'}</h3>
        {info?.description && <p className="hud-base-desc">{info.description}</p>}
        {info && MARS_SITES[info.id] && (
          <p className="hud-base-desc">
            {L('📍 Local real:', '📍 Real place:')} <b>{MARS_SITES[info.id]!.name}</b> ({MARS_SITES[info.id]!.lat.toFixed(1)}°,{' '}
            {MARS_SITES[info.id]!.lon.toFixed(1)}°). {MARS_SITES[info.id]!.why}{' '}
            <a href={MARS_TREK_URL} target="_blank" rel="noreferrer noopener">
              {L('Ver no Mars Trek', 'See on Mars Trek')}
            </a>
          </p>
        )}
      </div>

      <div className="hud-system-actions">
        {/* Abrir Modal Completo de Ajustes */}
        <button
          type="button"
          className="hud-system-btn hud-system-btn--settings"
          onClick={onOpenSettings}
        >
          <Sliders size={18} />
          <div className="hud-system-btn-text">
            <strong>{L('Ajustes do Jogo', 'Game Settings')}</strong>
            <small>{L('Gráficos, volumes de áudio, sensibilidade e controles', 'Graphics, audio volume, sensitivity and controls')}</small>
          </div>
        </button>

        {onSaveWorld && (
          <button type="button" className="hud-system-btn hud-system-btn--save" onClick={onSaveWorld}>
            <Save size={18} />
            <div className="hud-system-btn-text">
              <strong>{L('Salvar o Mundo', 'Save the World')}</strong>
              <small>{L('Guarda agora o progresso da base (o jogo também salva sozinho)', 'Saves the base progress now (the game also saves on its own)')}</small>
            </div>
          </button>
        )}

        {/* Procedimento de Saída / Salvamento */}
        <button
          type="button"
          className="hud-system-btn hud-system-btn--leave"
          onClick={onRequestLeave}
        >
          <LogOut size={18} />
          <div className="hud-system-btn-text">
            <strong>{L('Sair da Missão', 'Leave the Mission')}</strong>
            <small>{L('Salva o estado do mundo e retorna ao menu inicial', 'Saves the world and returns to the main menu')}</small>
          </div>
        </button>
      </div>

      <div className="hud-system-about">
        <div className="hud-system-about-head">
          <Info size={14} />
          <span>{L('Sobre o Mars Outpost', 'About Mars Outpost')}</span>
        </div>
        <p>
          {L('Simulação educativa interativa desenvolvida com three.js e React. Explore Marte, cultive plantas, gerencie energia solar e coopere em equipe.', 'An interactive educational simulation built with three.js and React. Explore Mars, grow plants, manage solar power and work as a team.')}
        </p>
      </div>
    </div>
  );
}
