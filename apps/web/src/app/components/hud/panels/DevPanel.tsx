/**
 * Painel Dev e Ferramentas de Teste.
 *
 * Lista todas as devActions registradas no sistema via registerDevAction().
 * Exibido exclusivamente em modo desenvolvedor (?dev na URL ou import.meta.env.DEV).
 */

import { EVENTS } from '@mars/sim';
import { Play, Terminal, Wrench } from 'lucide-react';
import { useMemo, useSyncExternalStore } from 'react';
import {
  getRegisteredDevActions,
  type ResolvedDevAction,
  refreshDevActions,
  subscribeDevActions,
} from '../../../../game/dev/devActions';
import { useMission } from '../../../../store/mission';
import { useHudContext } from '../HudContext';

function useDevActions(): readonly ResolvedDevAction[] {
  return useSyncExternalStore(
    subscribeDevActions,
    getRegisteredDevActions,
    getRegisteredDevActions,
  );
}

const EVENT_LABELS: Record<string, string> = {
  dust_storm: 'Tempestade de poeira',
  micrometeorite: 'Micrometeorito no laboratório',
  thermal_crack: 'Fratura térmica',
  discovery: 'Achado geológico',
  supply_drop: 'Cápsula de carga',
  cleaning_wind: 'Rajada de vento',
};

export function DevPanel() {
  const actions = useDevActions();
  const { viewer } = useHudContext();

  // Agrupa as ações por categoria/grupo
  const grouped = useMemo(() => {
    const map = new Map<string, ResolvedDevAction[]>();
    for (const a of actions) {
      const g = a.group ?? 'Comandos Gerais';
      const list = map.get(g) ?? [];
      list.push(a);
      map.set(g, list);
    }
    return Array.from(map.entries());
  }, [actions]);

  const handleRun = async (action: ResolvedDevAction) => {
    try {
      await action.run();
      // rótulos/estado dinâmicos (ex.: Pausar ↔ Retomar) mudam depois de executar
      refreshDevActions();
    } catch (err) {
      console.error(`Erro ao executar devAction [${action.id}]:`, err);
    }
  };

  return (
    <div className="hud-panel-content hud-panel-dev">
      <div className="hud-panel-intro hud-dev-banner">
        <Terminal size={18} className="hud-panel-intro-icon" />
        <div>
          <strong>Ambiente de Testes Ativo (?dev)</strong>
          <p>
            Comandos de depuração e simulação imediata de eventos marcianos para desenvolvimento.
          </p>
        </div>
      </div>

      <div className="hud-dev-group">
        <h4 className="hud-dev-group-title">Eventos aleatórios</h4>
        <div className="hud-dev-actions-grid">
          <button className="hud-dev-action-btn" onClick={() => void viewer?.repairEmergency()}>
            Simular emergência estrutural
          </button>
          {EVENTS.map((event) => (
            <button
              key={event.id}
              type="button"
              className="hud-dev-action-btn"
              onClick={() => useMission.getState().triggerEvent(event.id)}
            >
              <div className="hud-dev-action-head">
                <Play size={13} className="hud-dev-play-icon" />
                <span className="hud-dev-action-name">{EVENT_LABELS[event.id] ?? event.id}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      {actions.length === 0 ? (
        <div className="hud-dev-empty">
          <Wrench size={24} />
          <p>Nenhuma ação de desenvolvedor registrada no momento.</p>
        </div>
      ) : (
        <div className="hud-dev-groups">
          {grouped.map(([groupName, groupActions]) => (
            <div key={groupName} className="hud-dev-group">
              <h4 className="hud-dev-group-title">{groupName}</h4>
              <div className="hud-dev-actions-grid">
                {groupActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="hud-dev-action-btn"
                    onClick={() => void handleRun(action)}
                    title={action.description ?? action.label}
                    aria-pressed={action.isActive ? action.isActive() : undefined}
                  >
                    <div className="hud-dev-action-head">
                      <Play size={13} className="hud-dev-play-icon" />
                      <span className="hud-dev-action-name">{action.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
