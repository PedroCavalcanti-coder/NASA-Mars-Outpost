/**
 * Gerenciador de estado e atalhos da HUD.
 *
 * Persiste a seleção do painel aberto e a aba ativa de cada subpainel no localStorage.
 * Controla os atalhos de teclado globais (R, M, P, C, Q, O, D, Escape) sem interferir
 * quando o usuário estiver digitando em campos de formulário.
 */

import { useCallback, useEffect, useState } from 'react';
import { isGameOverlayOpen } from '../../../lib/gameOverlay';
import { getPanelMeta } from './panelMeta';
import { useHudPanels } from './useHudPanels';

const STORAGE_KEY_PANEL = 'mo_hud_active_panel';
const STORAGE_KEY_TABS = 'mo_hud_tabs';

function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignora restrições de navegação anônima/cookies bloqueados
  }
}

export function useHudState(isDevMode: boolean) {
  const panels = useHudPanels();

  // Painel lateral atualmente expandido (null = todos recolhidos)
  const [activePanelId, setActivePanelId] = useState<string | null>(() => {
    const saved = safeGetStorage(STORAGE_KEY_PANEL);
    if (!saved) return null;
    // Se o painel salvo for 'dev' mas não estiver em modo dev, não abre
    if (saved === 'dev' && !isDevMode) return null;
    return saved;
  });

  // Mapa de abas/subpainéis selecionados por painel
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>(() => {
    try {
      const raw = safeGetStorage(STORAGE_KEY_TABS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Alterna abertura de um painel específico
  const togglePanel = useCallback((id: string) => {
    setActivePanelId((current) => {
      const next = current === id ? null : id;
      safeSetStorage(STORAGE_KEY_PANEL, next);
      return next;
    });
  }, []);

  // Força abertura de um painel
  const openPanel = useCallback((id: string) => {
    setActivePanelId(id);
    safeSetStorage(STORAGE_KEY_PANEL, id);
  }, []);

  // Fecha qualquer painel aberto
  const closePanel = useCallback(() => {
    setActivePanelId(null);
    safeSetStorage(STORAGE_KEY_PANEL, null);
  }, []);

  // Seleciona uma aba/subpainel dentro de um painel
  const setTab = useCallback((panelId: string, tabId: string) => {
    setActiveTabs((prev) => {
      const next = { ...prev, [panelId]: tabId };
      safeSetStorage(STORAGE_KEY_TABS, JSON.stringify(next));
      return next;
    });
  }, []);

  // Atalhos de teclado globais
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.getAttribute('role') === 'textbox')
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // minigame aberto: as teclas são dele
      if (isGameOverlayOpen()) return;

      const key = e.key.toUpperCase();

      if (e.key === 'Escape') {
        if (activePanelId) {
          e.preventDefault();
          closePanel();
        }
        return;
      }

      // Procura se alguma definição de painel registrada possui este atalho
      const matched = panels.find((p) => {
        const meta = getPanelMeta(p.id);
        return meta.shortcut && meta.shortcut.toUpperCase() === key;
      });

      if (matched) {
        // Se for painel dev mas o modo dev não está ativo, ignora
        if (matched.id === 'dev' && !isDevMode) return;
        e.preventDefault();
        togglePanel(matched.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panels, activePanelId, isDevMode, togglePanel, closePanel]);

  return {
    activePanelId,
    activeTabs,
    togglePanel,
    openPanel,
    closePanel,
    setTab,
  };
}
