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
  sala: { shortcut: 'P', order: 30 },
  camera: { shortcut: 'C', order: 40 },
  chat: { shortcut: 'Q', order: 50 },
  sistema: { shortcut: 'O', order: 60 },
  dev: { shortcut: 'D', order: 99 },
};

export function getPanelMeta(id: string): PanelMeta {
  return KNOWN_PANEL_META[id] ?? { order: 50 };
}
