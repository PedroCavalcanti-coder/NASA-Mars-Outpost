/**
 * Tarefas do Sol: o que a base precisa hoje (minigames), com atalho para ir até cada uma.
 *
 * Obrigatórias (filtro de ar, canteiros plantados) trazem consequência na virada do Sol;
 * as demais aparecem conforme o clima (painéis sujos) ou a ciência (sondagem).
 */

import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Drill,
  Fan,
  Footprints,
  Sprout,
  Sun,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { DailyTask, TaskKind } from '../../../../game/tasks/rules';
import { useBaseOps, useDailyTasks } from '../../../../game/tasks/store';
import { useHudContext } from '../HudContext';

const ICONS: Record<TaskKind, ReactNode> = {
  filter: <Fan size={16} />,
  crop: <Sprout size={16} />,
  plant: <Sprout size={16} />,
  solar: <Sun size={16} />,
  drill: <Drill size={16} />,
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
          title="O astronauta vai até lá e a tarefa abre ao chegar"
        >
          <Footprints size={14} />
          <span>Ir</span>
        </button>
      )}
    </li>
  );
}

export function TasksPanel() {
  const tasks = useDailyTasks();
  const sol = useBaseOps((s) => s.sol);
  const required = tasks.filter((t) => t.required);
  const optional = tasks.filter((t) => !t.required);
  const doneRequired = required.filter((t) => t.done).length;

  return (
    <div className="hud-panel-content hud-panel-tasks">
      <div className="hud-panel-intro">
        <ClipboardList size={18} className="hud-panel-intro-icon" />
        <p>
          <strong>Sol {sol}.</strong> Clique numa máquina da base ou em “Ir” para fazer a tarefa.
          Canteiros e filtro sem cuidado hoje sofrem na virada do Sol.
        </p>
      </div>

      {tasks.length === 0 ? (
        <p className="hud-tasks__empty">Carregando a base…</p>
      ) : (
        <>
          <h4 className="hud-tasks__heading">
            Todo dia{' '}
            <span className={doneRequired === required.length ? 'is-ok' : ''}>
              {doneRequired}/{required.length}
            </span>
          </h4>
          <ul className="hud-tasks">
            {required.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>

          {optional.length > 0 && (
            <>
              <h4 className="hud-tasks__heading">Hoje (clima e ciência)</h4>
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
