/**
 * Painel de Recursos da Base Marciana.
 *
 * Integra o ResourceHud com monitoramento de energia, mantimentos,
 * materiais e moral da tripulação marciana.
 */

import { Zap } from 'lucide-react';
import { ResourceHud } from '../../mission/ResourceHud';

export function ResourcesPanel() {
  return (
    <div className="hud-panel-content hud-panel-resources">
      <div className="hud-panel-intro">
        <Zap size={18} className="hud-panel-intro-icon" />
        <p>
          Monitore as reservas críticas da base. A cada Sol, painéis solares e estufas geram e
          consomem suprimentos. Mantenha os níveis equilibrados para preservar a moral.
        </p>
      </div>

      <div className="hud-panel-body">
        <ResourceHud />
      </div>
    </div>
  );
}
