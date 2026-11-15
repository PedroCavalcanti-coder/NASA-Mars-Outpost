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
  Fan,
  Footprints,
  Sprout,
  Sun,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { DailyTask, TaskKind } from '../../../../game/tasks/rules';
import { useBaseOps, useDailyTasks } from '../../../../game/tasks/store';
import { useHudContext } from '../HudContext';
import { MissionsSection } from './MissionsSection';

const ICONS: Record<TaskKind, ReactNode> = {
  repair: <Wrench size={16} />,
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
  const repairs = tasks.filter((t) => t.kind === 'repair');
  const required = tasks.filter((t) => t.required && t.kind !== 'repair');
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

      <MissionsSection />

      {tasks.length === 0 ? (
        <p className="hud-tasks__empty">Carregando a base…</p>
      ) : (
        <>
          {repairs.length > 0 && (
            <>
              <h4 className="hud-tasks__heading">Reparos pendentes</h4>
              <ul className="hud-tasks">
                {repairs.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            </>
          )}
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
              <h4 className="hud-tasks__heading">Hoje (clima)</h4>
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
