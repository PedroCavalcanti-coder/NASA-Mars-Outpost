/**
 * Container Gaveta da HUD (Drawer Lateral / Bottom Sheet).
 *
 * Exibe o conteúdo do painel ativo em uma gaveta retrátil lateral (desktop)
 * ou inferior (telas <768px), garantindo que o centro da cena nunca seja obstruído.
 */

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { getPanelMeta, renderHudIcon } from './panelMeta';
import type { HudPanelDefinition } from './registry';

interface HudPanelContainerProps {
  panel: HudPanelDefinition | null;
  onClose: () => void;
}

export function HudPanelContainer({ panel, onClose }: HudPanelContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Foco acessível ao abrir
  useEffect(() => {
    if (panel) {
      closeBtnRef.current?.focus();
    }
  }, [panel]);

  if (!panel) return null;

  const PanelComponent = panel.component;
  const meta = getPanelMeta(panel.id);

  return (
    <aside ref={containerRef} className="hud-panel-container" aria-label={panel.title}>
      {/* Cabeçalho da Gaveta */}
      <header className="hud-panel-header">
        <div className="hud-panel-title-wrapper">
          {renderHudIcon(panel.icon, { size: 20, className: 'hud-panel-header-icon' })}
          <h2 className="hud-panel-title">{panel.title}</h2>
          {meta.shortcut && <kbd className="hud-panel-shortcut">{meta.shortcut}</kbd>}
        </div>

        <button
          ref={closeBtnRef}
          type="button"
          className="hud-panel-close-btn"
          onClick={onClose}
          title="Fechar painel [Esc]"
          aria-label="Fechar painel"
        >
          <X size={18} />
        </button>
      </header>

      {/* Corpo com scroll suave e renderização do componente do painel */}
      <div className="hud-panel-scroll">
        <PanelComponent />
      </div>
    </aside>
  );
}
