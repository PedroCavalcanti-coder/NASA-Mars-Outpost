/**
 * Doca de Navegação da HUD (Dock de Botões de Ícone).
 *
 * Localizada na lateral direita em telas grandes e como barra inferior fixa
 * em dispositivos móveis (<768px). Permite alternar rapidamente entre os painéis.
 */

import { useMemo } from 'react';
import { getPanelMeta, renderHudIcon } from './panelMeta';
import type { HudPanelDefinition } from './registry';

interface HudDockProps {
  panels: readonly HudPanelDefinition[];
  activePanelId: string | null;
  onTogglePanel: (id: string) => void;
  isDevMode: boolean;
  badges?: Record<string, string | number | null>;
}

export function HudDock({
  panels,
  activePanelId,
  onTogglePanel,
  isDevMode,
  badges = {},
}: HudDockProps) {
  // Filtra e ordena painéis visíveis na doca
  const dockPanels = useMemo(() => {
    return panels
      .filter((p) => {
        if (p.group === 'essencial') return false;
        if (p.group === 'dev' && !isDevMode) return false;
        return true;
      })
      .sort((a, b) => getPanelMeta(a.id).order - getPanelMeta(b.id).order);
  }, [panels, isDevMode]);

  return (
    <nav className="hud-dock" aria-label="Navegação de painéis da base">
      <ul className="hud-dock__list">
        {dockPanels.map((panel) => {
          const isOpen = activePanelId === panel.id;
          const meta = getPanelMeta(panel.id);
          const badgeVal = badges[panel.id];

          return (
            <li key={panel.id} className="hud-dock__item">
              <button
                type="button"
                className={`hud-dock__btn ${isOpen ? 'is-active' : ''}`}
                onClick={() => onTogglePanel(panel.id)}
                title={`${panel.title}${meta.shortcut ? ` [${meta.shortcut}]` : ''}`}
                aria-expanded={isOpen}
                aria-label={`${panel.title}${meta.shortcut ? ` (atalho: ${meta.shortcut})` : ''}`}
              >
                <div className="hud-dock__icon-wrapper">
                  {renderHudIcon(panel.icon, { size: 20, className: 'hud-dock__icon' })}
                  {badgeVal != null && badgeVal !== '' && (
                    <span className="hud-dock__badge" aria-hidden="true">
                      {badgeVal}
                    </span>
                  )}
                </div>
                <span className="hud-dock__label">{panel.title}</span>
                {meta.shortcut && <kbd className="hud-dock__shortcut">{meta.shortcut}</kbd>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
