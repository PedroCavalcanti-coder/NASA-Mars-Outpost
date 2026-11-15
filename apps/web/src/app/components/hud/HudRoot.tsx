/**
 * Componente Raiz da HUD do Jogo (HudRoot).
 *
 * Registra os painéis modulares padrão do Mars Outpost via tomada registerPanel,
 * gerencia a persistência de abas e estado aberto no localStorage,
 * renderiza a EssentialBar no topo, o HudDock e a gaveta lateral HudPanelContainer.
 */

import {
  Camera,
  ClipboardList,
  Compass,
  MessageSquare,
  Settings,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useDailyTasks } from '../../../game/tasks/store';
import { EssentialBar } from './EssentialBar';
import { HudBottom } from './HudBottom';
import { HudContext, type HudContextValue } from './HudContext';
import { HudDock } from './HudDock';
import { HudPanelContainer } from './HudPanelContainer';
import { ResourceRewardFx } from './ResourceRewardFx';
import { ChatPanel } from './panels/ChatPanel';
import { DevPanel } from './panels/DevPanel';
import { MissionPanel } from './panels/MissionPanel';
import { ResourcesPanel } from './panels/ResourcesPanel';
import { SystemPanel } from './panels/SystemPanel';
import { TasksPanel } from './panels/TasksPanel';
// registra o relógio com pausa/velocidade no slot essencial (e as ações de tempo do painel Dev)
import './panels/TimeControls';
import { ViewPanel } from './panels/ViewPanel';
import { registerPanel } from './registry';
import { useHudPanels } from './useHudPanels';
import { useHudState } from './useHudState';
import './hud.css';

interface HudRootProps extends HudContextValue {
  marsTime: {
    hour: number;
    sol: number;
    isDay: boolean;
    formatted: string;
  };
  stormActive: boolean;
  driving: boolean;
  onExitRover: () => void;
  showHints: boolean;
  showCoords: boolean;
}

export function HudRoot(props: HudRootProps) {
  const {
    marsTime,
    stormActive,
    roomCode,
    players,
    onCopyInvite,
    cameraMode,
    onToggleCamera,
    roofsHidden,
    onToggleRoofs,
    chat,
    onSendEmote,
    onSendChat,
    info,
    astronautName,
    coords,
    viewer,
    onOpenSettings,
    onRequestLeave,
    rollBase,
    onGoToTask,
    driving,
    onExitRover,
  } = props;

  // Detecta se a URL possui ?dev ou se está em ambiente de desenvolvimento Vite
  const isDevMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('dev') || Boolean(import.meta.env.DEV);
  }, []);

  // Registra os painéis essenciais e padrão do jogo no registro de tomadas
  useEffect(() => {
    const unregs: Array<() => void> = [
      registerPanel({
        id: 'recursos',
        group: 'recursos',
        title: 'Recursos',
        icon: Zap,
        component: ResourcesPanel,
      }),

      registerPanel({
        id: 'missao',
        group: 'missao',
        title: 'Missão',
        icon: Compass,
        component: MissionPanel,
      }),

      registerPanel({
        id: 'tarefas',
        group: 'missao',
        title: 'Tarefas do Sol',
        icon: ClipboardList,
        component: TasksPanel,
      }),

      registerPanel({
        id: 'camera',
        group: 'sistema',
        title: 'Câmera',
        icon: Camera,
        component: ViewPanel,
      }),

      registerPanel({
        id: 'chat',
        group: 'sistema',
        title: 'Comunicação',
        icon: MessageSquare,
        component: ChatPanel,
      }),

      registerPanel({
        id: 'sistema',
        group: 'sistema',
        title: 'Sistema',
        icon: Settings,
        component: SystemPanel,
      }),
    ];

    // Registra painel Dev se modo dev estiver habilitado
    if (isDevMode) {
      unregs.push(
        registerPanel({
          id: 'dev',
          group: 'dev',
          title: 'Dev',
          icon: Wrench,
          component: DevPanel,
        }),
      );
    }

    return () => {
      for (const unreg of unregs) {
        unreg();
      }
    };
  }, [isDevMode]);

  // Hook gerenciador de abertura de painéis e persistência
  const { activePanelId, togglePanel, openPanel, closePanel } = useHudState(isDevMode);

  const panels = useHudPanels();
  const activePanel = panels.find((p) => p.id === activePanelId) ?? null;

  // Badges dinâmicos para a Doca
  // tarefas obrigatórias pendentes do Sol (o número some quando tudo está feito)
  const tasks = useDailyTasks();
  const pendingRequired = tasks.filter((t) => t.required && !t.done).length;
  const dockBadges = useMemo<Record<string, string | number | null>>(() => {
    return {
      tarefas: pendingRequired > 0 ? pendingRequired : null,
      chat: chat.length > 0 ? chat.length : null,
      dev: 'DEV',
    };
  }, [chat.length, pendingRequired]);

  // Contexto compartilhado para alimentar os painéis
  const contextValue: HudContextValue = useMemo(
    () => ({
      roomCode,
      players,
      onCopyInvite,
      cameraMode,
      onToggleCamera,
      roofsHidden,
      onToggleRoofs,
      chat,
      onSendEmote,
    onSendChat,
      info,
      astronautName,
      coords,
      viewer,
      onOpenSettings,
      onRequestLeave,
      rollBase,
      onGoToTask,
    }),
    [
      roomCode,
      players,
      onCopyInvite,
      cameraMode,
      onToggleCamera,
      roofsHidden,
      onToggleRoofs,
      chat,
      onSendEmote,
    onSendChat,
      info,
      astronautName,
      coords,
      viewer,
      onOpenSettings,
      onRequestLeave,
      rollBase,
      onGoToTask,
    ],
  );

  return (
    <HudContext.Provider value={contextValue}>
      <ResourceRewardFx viewer={viewer} />
      <div className="hud-root">
        <div className="hud-room-status" data-bit-target="crew" aria-label={`Sala ${roomCode}, ${players.count} de 4 jogadores`}>
          <span>{roomCode}</span>
          <Users size={20} aria-hidden="true" />
          <span>{players.count}/4</span>
        </div>
        {/* Barra Essencial Fixa no Topo */}
        <EssentialBar
          marsTime={marsTime}
          stormActive={stormActive}
          onOpenSystemMenu={() => openPanel('sistema')}
        />

        {/* Doca de Botões de Ícones (lateral direita / bottom bar em mobile) */}
        <HudDock
          panels={panels}
          activePanelId={activePanelId}
          onTogglePanel={togglePanel}
          isDevMode={isDevMode}
          badges={dockBadges}
        />

        {/* Gaveta Retrátil do Painel Ativo */}
        <HudPanelContainer panel={activePanel} onClose={closePanel} />

        {/* Faixa inferior: mensagens, coordenadas, sair do rover e dicas (sem invadir a doca) */}
        <HudBottom driving={driving} onExitRover={onExitRover} chatOpen={activePanelId === 'chat'} onToggleChat={() => togglePanel('chat')} />
      </div>
    </HudContext.Provider>
  );
}
