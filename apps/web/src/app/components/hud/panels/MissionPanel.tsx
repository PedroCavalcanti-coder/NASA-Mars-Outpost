/**
 * Painel de Missão e Diário da Base.
 *
 * Reúne em abas organizadas o progresso científico (ResearchBar),
 * o diário de eventos históricos (MissionLog) e as ações diárias (ActionPanel).
 */

import { BookOpen, FlaskConical, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ActionPanel } from '../../mission/ActionPanel';
import { MissionLog } from '../../mission/MissionLog';
import { ResearchBar } from '../../mission/ResearchBar';

type MissionTab = 'pesquisa' | 'diario' | 'acoes';
const STORAGE_TAB_KEY = 'mo_hud_mission_tab';

export function MissionPanel() {
  const [currentTab, setCurrentTab] = useState<MissionTab>(() => {
    try {
      return (localStorage.getItem(STORAGE_TAB_KEY) as MissionTab) || 'pesquisa';
    } catch {
      return 'pesquisa';
    }
  });

  const handleTabClick = (tab: MissionTab) => {
    setCurrentTab(tab);
    try {
      localStorage.setItem(STORAGE_TAB_KEY, tab);
    } catch {
      /* ignore storage errors */
    }
  };

  return (
    <div className="hud-panel-content hud-panel-mission">
      {/* Barra de Subpainéis (Abas) */}
      <div className="hud-subtabs" role="tablist" aria-label="Seções da Missão">
        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'pesquisa'}
          aria-controls="mission-tab-pesquisa"
          className={`hud-subtab ${currentTab === 'pesquisa' ? 'is-active' : ''}`}
          onClick={() => handleTabClick('pesquisa')}
        >
          <FlaskConical size={14} />
          <span>Pesquisa</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'diario'}
          aria-controls="mission-tab-diario"
          className={`hud-subtab ${currentTab === 'diario' ? 'is-active' : ''}`}
          onClick={() => handleTabClick('diario')}
        >
          <BookOpen size={14} />
          <span>Diário</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'acoes'}
          aria-controls="mission-tab-acoes"
          className={`hud-subtab ${currentTab === 'acoes' ? 'is-active' : ''}`}
          onClick={() => handleTabClick('acoes')}
        >
          <Wrench size={14} />
          <span>Ações</span>
        </button>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div className="hud-panel-body">
        {currentTab === 'pesquisa' && (
          <div id="mission-tab-pesquisa" role="tabpanel" className="hud-tabpanel">
            <ResearchBar />
          </div>
        )}

        {currentTab === 'diario' && (
          <div id="mission-tab-diario" role="tabpanel" className="hud-tabpanel">
            <MissionLog />
          </div>
        )}

        {currentTab === 'acoes' && (
          <div id="mission-tab-acoes" role="tabpanel" className="hud-tabpanel">
            <ActionPanel />
          </div>
        )}
      </div>
    </div>
  );
}
