/**
 * Contexto compartilhado para a HUD do jogo.
 *
 * Fornece dados em tempo real da sessão (sala, câmera, astronauta, base, callbacks)
 * para os painéis registrados consumirem sem prop drilling.
 */

import { createContext, useContext } from 'react';
import type { BaseViewer } from '../../../game/BaseViewer';
import type { BaseInfo } from '../../../lib/bases';

export interface HudContextValue {
  roomCode: string;
  players: { count: number; mode: 'online' | 'local' };
  onCopyInvite: () => void;
  cameraMode: 'follow' | 'free';
  onToggleCamera: () => void;
  roofsHidden: boolean;
  onToggleRoofs: () => void;
  chat: Array<{ id: number; name: string; emoji: string; local: boolean }>;
  onSendEmote: (index: number) => void;
  info: BaseInfo | null;
  astronautName: string;
  coords: { gx: number; gy: number; inside: boolean } | null;
  viewer: BaseViewer | null;
  onOpenSettings: () => void;
  onRequestLeave: () => void;
  rollBase: () => void;
}

export const HudContext = createContext<HudContextValue | null>(null);

export function useHudContext(): HudContextValue {
  const ctx = useContext(HudContext);
  if (!ctx) {
    throw new Error('useHudContext deve ser utilizado dentro de um HudProvider');
  }
  return ctx;
}
