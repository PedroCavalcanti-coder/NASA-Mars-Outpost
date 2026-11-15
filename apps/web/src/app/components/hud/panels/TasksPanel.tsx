/**
 * Tarefas do Sol: o que a base precisa hoje (minigames), com atalho para ir até cada uma.
 *
 * Obrigatórias (filtro de ar, canteiros plantados) trazem consequência na virada do Sol;
 * as demais aparecem conforme o clima (painéis sujos). As missões de pesquisa (sondagem, coleta
 * de solo, estações) vêm de `MissionsSection`.
 */

import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Drill,
  Droplets,
  Fan,
  Footprints,
  Sprout,
  Sun,
  Wind,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { DailyTask, TaskKind } from '../../../../game/tasks/rules';
import { useBaseOps, useDailyTasks } from '../../../../game/tasks/store';
import { useHudContext } from '../HudContext';
import { MissionsSection } from './MissionsSection';
import { L } from '../../../../lib/i18n';

const ICONS: Record<TaskKind, ReactNode> = {
  repair: <Wrench size={16} />,
  filter: <Fan size={16} />,
  crop: <Sprout size={16} />,
  plant: <Sprout size={16} />,
  solar: <Sun size={16} />,
  drill: <Drill size={16} />,
  moxie: <Wind size={16} />,
  water: <Droplets size={16} />,
  mission: <ClipboardList size={16} />,
};

function TaskRow({ task }: { task: DailyTask }) {
  const { onGoToTask } = useHudContext();
  return (
    <li className={`hud-task ${task.done ? 'is-done' : ''} ${task.required ? 'is-required' : ''}`}>
      <span className="hud-task__check" aria-hidden="true">
        {task.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </span>
      <span className="hud-task__icon" aria-hidden="true">
        {ICONS[task.kind]}
      </span>
      <span className="hud-task__text">
        <span className="hud-task__title">
          {task.title}
          <span className="sr-only">{task.done ? ' (concluída)' : ' (pendente)'}</span>
        </span>
        <span className="hud-task__detail">{task.detail}</span>
      </span>
      {!task.done && onGoToTask && (
        <button
          type="button"
          className="hud-btn hud-btn--secondary hud-task__go"
          onClick={() => onGoToTask(task.kind, task.index)}
          title={L('O astronauta vai até lá e a tarefa abre ao chegar', 'The astronaut walks there and the task opens on arrival')}
        >
          <Footprints size={14} />
          <span>{L('Ir', 'Go')}</span>
        </button>
      )}
    </li>
  );
}

export function TasksPanel() {
  const tasks = useDailyTasks();
  const sol = useBaseOps((s) => s.sol);
  const repairs = tasks.filter((t) => t.kind === 'repair');
  // filtro, horta, painéis, MOXIE e água agora são missões do dia (sorteadas em MissionsSection)
  const optional = tasks.filter((t) => t.kind === 'plant');

  return (
    <div className="hud-panel-content hud-panel-tasks">
      <div className="hud-panel-intro">
        <ClipboardList size={18} className="hud-panel-intro-icon" />
        <p>
          <strong>Sol {sol}.</strong> {L('Missões novas a cada dia: o que não for feito hoje some na virada do Sol. Clique em “Ir” ou no equipamento da base.', 'New missions every day: whatever is not done today disappears when the sol ends. Click “Go” or the base equipment.')}
        </p>
      </div>

      <MissionsSection />

      {tasks.length === 0 ? (
        <p className="hud-tasks__empty">{L('Carregando a base…', 'Loading the base…')}</p>
      ) : (
        <>
          {repairs.length > 0 && (
            <>
              <h4 className="hud-tasks__heading">{L('Reparos pendentes', 'Pending repairs')}</h4>
              <ul className="hud-tasks">
                {repairs.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            </>
          )}

          {optional.length > 0 && (
            <>
              <h4 className="hud-tasks__heading">{L('Opcional', 'Optional')}</h4>
              <ul className="hud-tasks">
                {optional.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
