/**
 * Painel de Sistema e Configurações da Base.
 *
 * Oferece acesso às configurações gerais (vídeo, áudio, acessibilidade),
 * dados científicos do sítio de pouso e procedimentos de salvamento/saída.
 */

import { Compass, Info, LogOut, Sliders } from 'lucide-react';
import { useHudContext } from '../HudContext';

export function SystemPanel() {
  const { info, astronautName, onOpenSettings, onRequestLeave } = useHudContext();

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
            <strong>Ajustes do Jogo</strong>
            <small>Gráficos, volumes de áudio, sensibilidade e controles</small>
          </div>
        </button>

        {/* Procedimento de Saída / Salvamento */}
        <button
          type="button"
          className="hud-system-btn hud-system-btn--leave"
          onClick={onRequestLeave}
        >
          <LogOut size={18} />
          <div className="hud-system-btn-text">
            <strong>Sair da Missão</strong>
            <small>Salva o estado do mundo e retorna ao menu inicial</small>
          </div>
        </button>
      </div>

      <div className="hud-system-about">
        <div className="hud-system-about-head">
          <Info size={14} />
          <span>Sobre o Mars Outpost</span>
        </div>
        <p>
          Simulação educativa interativa desenvolvida com three.js e React. Explore Marte, cultive
          plantas, gerencie energia solar e coopere em equipe.
        </p>
      </div>
    </div>
  );
}
