/**
 * Painel de Missão e Diário da Base.
 *
 * Reúne em abas organizadas o progresso científico (ResearchBar),
 * e o diário da base (MissionLog). A antiga aba "Ações" (pesquisa/expedição locais) saiu:
 * o progresso agora vem só das missões e tarefas validadas pelo servidor.
 */

import { BookOpen, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { MissionLog } from '../../mission/MissionLog';
import { ResearchBar } from '../../mission/ResearchBar';
import { L } from '../../../../lib/i18n';

type MissionTab = 'pesquisa' | 'diario';
const STORAGE_TAB_KEY = 'mo_hud_mission_tab';

export function MissionPanel() {
  const [currentTab, setCurrentTab] = useState<MissionTab>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TAB_KEY);
      return saved === 'diario' ? 'diario' : 'pesquisa';
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
      <div className="hud-subtabs" role="tablist" aria-label={L('Seções da Missão', 'Mission sections')}>
        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'pesquisa'}
          aria-controls="mission-tab-pesquisa"
          className={`hud-subtab ${currentTab === 'pesquisa' ? 'is-active' : ''}`}
          onClick={() => handleTabClick('pesquisa')}
        >
          <FlaskConical size={14} />
          <span>{L('Pesquisa', 'Research')}</span>
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
          <span>{L('Diário', 'Log')}</span>
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

      </div>
    </div>
  );
}
