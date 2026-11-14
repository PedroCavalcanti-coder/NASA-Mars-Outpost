import { Clock, Moon, Pause, Play, Sun } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { refreshDevActions, registerDevAction } from '../../../../game/dev/devActions';
import { type ClockScale, GameClock, useGameClock } from '../../../../game/sim/clock';
import { registerPanel } from '../registry';
import './timeControls.css';

/**
 * Registra as ações de depuração do painel Dev (Conversa 0 / Conversa 3).
 * Os rótulos/`isActive` dependem do relógio, então o catálogo é reavaliado a cada mudança dele.
 */
GameClock.subscribe(refreshDevActions);

registerDevAction({
  id: 'dev:time-skip-dawn',
  label: 'Pular para Amanhecer (06:00)',
  group: 'Tempo / Clima',
  description: 'Avança o ciclo marciano para 06:00 LMST (início do dia)',
  run: () => GameClock.skipToHour(6),
});

registerDevAction({
  id: 'dev:time-skip-dusk',
  label: 'Pular para Anoitecer (18:00)',
  group: 'Tempo / Clima',
  description: 'Avança o ciclo marciano para 18:00 LMST (início da noite)',
  run: () => GameClock.skipToHour(18),
});

registerDevAction({
  id: 'dev:time-skip-sol',
  label: 'Avançar 1 Sol Completo (+24h)',
  group: 'Tempo / Clima',
  description: 'Avança a simulação em exatamente 1 Sol marciano (24 horas)',
  run: () => GameClock.skipSol(),
});

registerDevAction({
  id: 'dev:time-toggle-pause',
  label: () => (GameClock.isPaused() ? '▶ Retomar Simulação' : '⏸ Pausar Simulação'),
  group: 'Tempo / Clima',
  description: 'Congela ou retoma a passagem do tempo da simulação',
  isActive: () => GameClock.isPaused(),
  run: () => GameClock.togglePaused(),
});

registerDevAction({
  id: 'dev:time-speed-1',
  label: 'Velocidade 1× (Normal)',
  group: 'Tempo / Clima',
  isActive: () => GameClock.getScale() === 1 && !GameClock.isPaused(),
  run: () => {
    GameClock.setScale(1);
    GameClock.setPaused(false);
  },
});

registerDevAction({
  id: 'dev:time-speed-2',
  label: 'Velocidade 2× (Rápida)',
  group: 'Tempo / Clima',
  isActive: () => GameClock.getScale() === 2 && !GameClock.isPaused(),
  run: () => {
    GameClock.setScale(2);
    GameClock.setPaused(false);
  },
});

registerDevAction({
  id: 'dev:time-speed-3',
  label: 'Velocidade 3× (Máxima)',
  group: 'Tempo / Clima',
  isActive: () => GameClock.getScale() === 3 && !GameClock.isPaused(),
  run: () => {
    GameClock.setScale(3);
    GameClock.setPaused(false);
  },
});

export interface TimeControlsProps {
  /** Permite passar o tempo atual de Marte (caso fornecido pelo BaseViewer) */
  marsTime?: {
    sol: number;
    hour?: number;
    formatted: string;
    isDay: boolean;
  };
}

/**
 * Componente oficial de Controle de Tempo e Pausa (Conversa 3).
 *
 * Oferece botões compactos de Pausar (⏸) / Retomar (▶), seleção de velocidade (1×, 2×, 3×),
 * selo visual evidente "PAUSADO", suporte a atalhos de teclado (Espaço, 1, 2, 3),
 * e validação de autoridade multiplayer (coordenador vs participante).
 */
export function TimeControls({ marsTime }: TimeControlsProps) {
  const clock = useGameClock();
  const { paused, scale, canControl, isCoordinator, playerCount } = clock;

  // Atalhos de teclado: Espaço (pausa/retoma), 1, 2, 3 (velocidade)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em campos de texto
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      // atalhos do navegador/SO (Ctrl+1 troca de aba etc.) e tecla segurada não contam
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;

      if (e.code === 'Space') {
        e.preventDefault();
        GameClock.togglePaused();
      } else if (e.key === '1') {
        GameClock.setScale(1);
      } else if (e.key === '2') {
        GameClock.setScale(2);
      } else if (e.key === '3') {
        GameClock.setScale(3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleTogglePause = useCallback(() => {
    GameClock.togglePaused();
  }, []);

  const handleSetScale = useCallback((s: ClockScale) => {
    GameClock.setScale(s);
  }, []);

  // Informações de horário de Marte (se não fornecidas externamente, estima via simTime)
  const displaySol = marsTime?.sol ?? 1;
  const displayFormatted = marsTime?.formatted ?? '09:00';
  const displayIsDay = marsTime ? marsTime.isDay : true;

  const isMultiplayerRestricted = playerCount > 1 && !isCoordinator;

  return (
    <section
      className={`time-controls ${paused ? 'time-controls--paused' : ''}`}
      aria-label="Controle de tempo da simulação"
    >
      {/* Indicador de Sol e Horário Marciano */}
      <div
        className="time-controls__time-display"
        title={`Sol ${displaySol} · ${displayFormatted} LMST`}
      >
        {displayIsDay ? (
          <Sun size={15} className="time-controls__icon-sun" aria-hidden="true" />
        ) : (
          <Moon size={15} className="time-controls__icon-moon" aria-hidden="true" />
        )}
        <span className="time-controls__sol">SOL {displaySol}</span>
        <span className="time-controls__lmst">{displayFormatted}</span>
      </div>

      {/* Selo de Pausa */}
      {paused && (
        <div className="time-controls__paused-badge" role="status" aria-live="polite">
          <span className="time-controls__paused-dot" aria-hidden="true" />
          PAUSADO
        </div>
      )}

      {/* Botões de Ação */}
      <div className="time-controls__actions">
        {/* Botão Pausar / Retomar */}
        <button
          type="button"
          className={`time-controls__btn-pause ${paused ? 'time-controls__btn-pause--active' : ''}`}
          onClick={handleTogglePause}
          disabled={!canControl}
          title={
            !canControl
              ? 'Apenas o coordenador da sala pode pausar a partida'
              : paused
                ? 'Retomar simulação [Espaço]'
                : 'Pausar simulação [Espaço]'
          }
          aria-label={paused ? 'Retomar simulação marciana' : 'Pausar simulação marciana'}
        >
          {paused ? (
            <Play size={14} fill="currentColor" />
          ) : (
            <Pause size={14} fill="currentColor" />
          )}
        </button>

        {/* Seletores de Velocidade 1x, 2x, 3x */}
        <div className="time-controls__speed-group">
          {(['1', '2', '3'] as const).map((sStr) => {
            const sNum = Number(sStr) as ClockScale;
            const isActive = scale === sNum && !paused;
            return (
              <button
                key={sStr}
                type="button"
                className={`time-controls__speed-btn ${isActive ? 'time-controls__speed-btn--active' : ''}`}
                onClick={() => handleSetScale(sNum)}
                disabled={!canControl}
                title={
                  !canControl
                    ? 'Apenas o coordenador da sala pode alterar a velocidade'
                    : `Velocidade ${sNum}× [tecla ${sNum}]`
                }
                aria-pressed={isActive}
              >
                {sStr}×
              </button>
            );
          })}
        </div>
      </div>

      {/* Indicador de restrição multiplayer quando aplicável */}
      {isMultiplayerRestricted && (
        <span
          className="time-controls__role-tag time-controls__role-tag--restricted"
          title="Controle de tempo restrito ao coordenador (menor vaga na sala)"
        >
          Coordenado
        </span>
      )}

      {/* Banner flutuante no topo da tela quando pausado */}
      {paused &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="time-controls__screen-paused-banner" role="status" aria-live="assertive">
            <span className="time-controls__screen-paused-icon" aria-hidden="true">
              ⏸
            </span>
            <span>SIMULAÇÃO PAUSADA</span>
            <span className="time-controls__screen-paused-hint">
              (Pressione Espaço para retomar)
            </span>
          </div>,
          document.body,
        )}
    </section>
  );
}

// Registro automático da tomada de painel essencial na HUD
registerPanel({
  id: 'game-clock',
  group: 'essencial',
  title: 'Controle de Tempo',
  icon: Clock,
  component: TimeControls,
  defaultOpen: true,
  order: 20,
  shortcut: 'Espaço',
});
