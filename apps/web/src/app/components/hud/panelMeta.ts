import React from 'react';
import type { HudPanelDefinition } from './registry';

/**
 * Metadados complementares dos painéis conhecidos da HUD.
 *
 * Mapeia atalhos de teclado rápidos e ordem de exibição na doca
 * sem violar o contrato estrito de HudPanelDefinition da Conversa 0.
 */

export interface PanelMeta {
  shortcut?: string;
  order: number;
}

export const KNOWN_PANEL_META: Record<string, PanelMeta> = {
  recursos: { shortcut: 'R', order: 10 },
  missao: { shortcut: 'M', order: 20 },
  nap: { shortcut: 'Z', order: 25 },
  tarefas: { shortcut: 'T', order: 15 },
  sala: { shortcut: 'P', order: 30 },
  camera: { shortcut: 'C', order: 40 },
  chat: { shortcut: 'Y', order: 50 },
  sistema: { shortcut: 'O', order: 60 },
  dev: { shortcut: '0', order: 99 },
};

export function getPanelMeta(id: string): PanelMeta {
  return KNOWN_PANEL_META[id] ?? { order: 50 };
}

/**
 * Renderiza de forma segura qualquer ícone registrado no painel (Lucide Icon,
 * componente React, forwardRef ou elemento React pré-renderizado).
 */
export function renderHudIcon(
  icon: HudPanelDefinition['icon'],
  props: { size?: number; className?: string } = {},
): React.ReactNode {
  if (!icon) return null;
  if (React.isValidElement(icon)) {
    return icon;
  }
  const Comp = icon as React.ComponentType<{ size?: number; className?: string }>;
  return React.createElement(Comp, props);
}
