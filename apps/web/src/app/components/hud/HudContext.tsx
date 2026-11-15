/**
 * Contexto compartilhado para a HUD do jogo.
 *
 * Fornece dados em tempo real da sessão (sala, câmera, astronauta, base, callbacks)
 * para os painéis registrados consumirem sem prop drilling.
 */

import { createContext, useContext } from 'react';
import type { BaseViewer } from '../../../game/BaseViewer';
import type { TaskKind } from '../../../game/tasks/rules';
import type { BaseInfo } from '../../../lib/bases';

export interface HudContextValue {
  roomCode: string;
  players: {
    count: number;
    mode: 'online' | 'local';
    status?: 'connected' | 'reconnecting' | 'failed';
  };
  /** copia o código da sala; devolve se conseguiu */
  onCopyInvite: () => void | Promise<boolean>;
  cameraMode: 'follow' | 'free';
  onToggleCamera: () => void;
  roofsHidden: boolean;
  onToggleRoofs: () => void;
  chat: Array<{ id: number; name: string; emoji: string; local: boolean }>;
  onSendEmote: (index: number) => void;
  onSendChat: (message: string) => boolean;
  info: BaseInfo | null;
  astronautName: string;
  coords: { gx: number; gy: number; inside: boolean } | null;
  viewer: BaseViewer | null;
  onOpenSettings: () => void;
  onRequestLeave: () => void;
  rollBase: () => void;
  /** leva o astronauta até uma tarefa do Sol (abre o minigame ao chegar) */
  onGoToTask?: (kind: TaskKind, index: number) => void;
}

export const HudContext = createContext<HudContextValue | null>(null);

export function useHudContext(): HudContextValue {
  const ctx = useContext(HudContext);
  if (!ctx) {
    throw new Error('useHudContext deve ser utilizado dentro de um HudProvider');
  }
  return ctx;
}
