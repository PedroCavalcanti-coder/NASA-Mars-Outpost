/**
 * Missões de pesquisa do Sol: cada uma diz ONDE fica (cômodo, distância e direção), quanto custa
 * em recursos da base e quantos pontos de pesquisa rende. Sem recurso (ou de noite, nas que não
 * podem), o botão fica desligado e o motivo aparece na linha.
 */

import {
  CheckCircle2,
  Circle,
  Drill,
  Droplets,
  Fan,
  FlaskConical,
  Footprints,
  Leaf,
  MapPin,
  Navigation,
  Radio,
  Sprout,
  Stethoscope,
  Sun,
  Truck,
  Wind,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  bearingTo,
  costText,
  describeDirection,
  GARDEN_OXYGEN_BONUS,
  MISSIONS,
  type MissionDef,
  type MissionId,
  type MissionSite,
  missionBlock,
  soilReward,
} from '../../../../game/missions/rules';
import { useMissionBoard } from '../../../../game/missions/store';
import { useMission } from '../../../../store/mission';
import { useHudContext } from '../HudContext';
import { L, t } from '../../../../lib/i18n';

const SITE_ICON: Record<MissionSite, ReactNode> = {
  rover: <Truck size={16} />,
  soil: <Truck size={16} />,
  upload: <Radio size={16} />,
  drill: <Drill size={16} />,
  lab: <FlaskConical size={16} />,
  comms: <Radio size={16} />,
  power: <Zap size={16} />,
  medical: <Stethoscope size={16} />,
  moxie: <Wind size={16} />,
  water: <Droplets size={16} />,
  filter: <Fan size={16} />,
  garden: <Sprout size={16} />,
  solar: <Sun size={16} />,
};

function MissionRow({ id }: { id: MissionId }) {
  const { viewer } = useHudContext();
  const def: MissionDef = MISSIONS[id];
  const board = useMissionBoard();
  const res = useMission((s) => s.state.resources);
  const done = board.done.includes(id);
  const soilBusy = id === 'soil_robot' && board.soilPhase === 'sampling';
  const delivering = id === 'soil_robot' && board.soilPhase === 'deliver';
  const block = done
    ? null
    : missionBlock(def, {
        energy: res.energy.value,
        supplies: res.supplies.value,
        oxygen: res.oxygen.value,
        night: board.night,
        blackout: board.blackout,
      });
  const site = board.sites[def.site];
  const where = site ? describeDirection(board.player.x, board.player.z, site.x, site.z) : null;
  const angle = site ? bearingTo(board.player.x, board.player.z, site.x, site.z) : 0;
  const canGo = !done && !soilBusy && (delivering || !block);
  // só as missões de pesquisa dão pontos; as de manutenção devolvem recursos à base
  const reward =
    id === 'soil_robot'
      ? `🔬 +${soilReward(0)} a ${soilReward(1)}`
      : def.research > 0
        ? `🔬 +${def.research} a +${def.research + 1}`
        : `+${costText(def.reward ?? {})}`;

  return (
    <li className={`hud-task hud-mission ${done ? 'is-done' : ''} ${block ? 'is-blocked' : ''}`}>
      <span className="hud-task__check" aria-hidden="true">
        {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </span>
      <span className="hud-task__icon" aria-hidden="true">
        {SITE_ICON[def.site]}
      </span>
      <span className="hud-task__text">
        <span className="hud-task__title">
          {t(def.title)}
          <span className="sr-only">{done ? ' (concluída)' : ' (pendente)'}</span>
        </span>
        <span className="hud-task__detail">
          {delivering
            ? `Leve as ${board.carrying} amostras de solo a um computador da base (laboratório).`
            : soilBusy
              ? L('Coleta em andamento…', 'Run in progress…')
              : t(def.summary)}
        </span>
        {site && !done && (
          <span className="hud-mission__where">
            <MapPin size={12} aria-hidden="true" />
            <span>
              {t(delivering && board.sites.lab ? board.sites.lab.label : site.label)}
              {where ? ` · ${where.text}` : ''}
            </span>
            {where && where.meters >= 3 && (
              <Navigation
                size={12}
                aria-hidden="true"
                style={{ transform: `rotate(${angle - Math.PI / 4}rad)` }}
              />
            )}
          </span>
        )}
        <span className="hud-mission__chips">
          <span className="hud-chip" title={L('Custo em recursos da base', 'Cost in base resources')}>
            Custo {costText(def.cost)}
          </span>
          <span
            className="hud-chip hud-chip--good"
            title={def.research > 0 ? L('Pontos de pesquisa', 'Research points') : L('Recursos que a missão devolve à base', 'Resources the mission gives back to the base')}
          >
            {reward}
          </span>
          {def.daytimeOnly && (
            <span className="hud-chip" title={L('Não pode ser feita à noite', 'Cannot be done at night')}>
              {L('☀️ só de dia', '☀️ daytime only')}
            </span>
          )}
        </span>
        {block && !delivering && <span className="hud-mission__block">{block}</span>}
      </span>
      {!done && (
        <button
          type="button"
          className="hud-btn hud-btn--secondary hud-task__go"
          disabled={!canGo}
          onClick={() => viewer?.goToMission(id)}
          title={
            block && !delivering
              ? block
              : id === 'soil_robot'
                ? L('O astronauta vai ao rover e entra; dirija até o ponto marcado', 'The astronaut walks to the rover and gets in; drive to the yellow square')
                : L('O astronauta vai até lá e a missão começa ao chegar', 'The astronaut walks there and the mission starts on arrival')
          }
        >
          <Footprints size={14} />
          <span>{delivering ? L('Entregar', 'Deliver') : 'Ir'}</span>
        </button>
      )}
    </li>
  );
}

export function MissionsSection() {
  const ids = useMissionBoard((s) => s.ids);
  const doneCount = useMissionBoard((s) => s.ids.filter((id) => s.done.includes(id)).length);
  const garden = useMissionBoard((s) => s.garden);
  const beacons = useMissionBoard((s) => s.beacons);
  const { viewer } = useHudContext();
  if (!ids.length) return null;
  const gardenDone = garden.bonusDone;
  return (
    <>
      <h4 className="hud-tasks__heading">
        <span>{L('Missões de pesquisa', 'Research missions')}</span>
        <span className={doneCount === ids.length ? 'is-ok' : ''}>
          {doneCount}/{ids.length}
        </span>
      </h4>
      <ul className="hud-tasks">
        {ids.map((id) => (
          <MissionRow key={id} id={id} />
        ))}
        {garden.planted > 0 && (
          <li className={`hud-task ${gardenDone ? 'is-done' : ''}`}>
            <span className="hud-task__check" aria-hidden="true">
              {gardenDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </span>
            <span className="hud-task__icon" aria-hidden="true">
              <Leaf size={16} />
            </span>
            <span className="hud-task__text">
              <span className="hud-task__title">{L('Horta em dia', 'Garden up to date')}</span>
              <span className="hud-task__detail">
                Cuide de todos os canteiros plantados no mesmo Sol e a estufa devolve{' '}
                {GARDEN_OXYGEN_BONUS} de oxigênio à base. Cada cuidado gasta 1 🌾 de mantimento.
              </span>
              <span className="hud-mission__chips">
                <span className={`hud-chip ${gardenDone ? 'hud-chip--good' : ''}`}>
                  🌿 {garden.cared}/{garden.planted} canteiros
                </span>
              </span>
            </span>
          </li>
        )}
      </ul>
      <label className="hud-mission__beacons">
        <input
          type="checkbox"
          checked={beacons}
          onChange={(e) => viewer?.setMissionBeacons(e.target.checked)}
        />
        <span>{L('Mostrar marcadores das missões na base', 'Show mission markers on the base')}</span>
      </label>
    </>
  );
}
