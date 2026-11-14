/**
 * Painel de Atividades: abre os minigames da base (prévias jogáveis).
 *
 * Por enquanto a conclusão só mostra o resultado; ainda não altera os recursos da base.
 */

import { Fan, Sprout, Sun, Wrench } from 'lucide-react';
import { useHudContext } from '../HudContext';

const ACTIVITIES = [
  {
    id: 'solar',
    title: 'Limpar painel solar',
    desc: 'Escove a poeira marciana para o painel voltar a gerar energia.',
    icon: Sun,
  },
  {
    id: 'oxygen',
    title: 'Filtro de oxigênio',
    desc: 'Retire os detritos do cartucho do filtro e descarte-os.',
    icon: Fan,
  },
  {
    id: 'greenhouse',
    title: 'Cuidar da estufa',
    desc: 'Ajuste água e luz de cada canteiro até as plantas ficarem saudáveis.',
    icon: Sprout,
  },
] as const;

export function ActivitiesPanel() {
  const { onOpenMinigame } = useHudContext();

  return (
    <div className="hud-panel-content hud-panel-activities">
      <div className="hud-panel-intro">
        <Wrench size={18} className="hud-panel-intro-icon" />
        <p>Tarefas de manutenção da base. Feche com o botão ou Esc para voltar.</p>
      </div>

      <div className="hud-view-options">
        {ACTIVITIES.map(({ id, title, desc, icon: Icon }) => (
          <div key={id} className="hud-option-card">
            <div className="hud-option-info">
              <span className="hud-option-title">{title}</span>
              <span className="hud-option-desc">{desc}</span>
            </div>
            <button
              type="button"
              className="hud-btn hud-btn--secondary"
              onClick={() => onOpenMinigame?.(id)}
              disabled={!onOpenMinigame}
            >
              <Icon size={16} />
              <span>Abrir</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
