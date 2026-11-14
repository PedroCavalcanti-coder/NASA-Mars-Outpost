/**
 * Painel de Recursos da Base Marciana.
 *
 * Rede elétrica em tempo real (painéis → bateria → suporte à vida) e as reservas da missão:
 * mantimentos, materiais e moral da tripulação.
 */

import { BatteryCharging, Fan, Sun, Zap } from 'lucide-react';
import { panelEfficiency } from '../../../../game/tasks/rules';
import { useBaseOps } from '../../../../game/tasks/store';
import { useMission } from '../../../../store/mission';
import { ResourceHud } from '../../mission/ResourceHud';

function PowerGrid() {
  const ops = useBaseOps();
  const battery = useMission((m) => m.state.resources.energy);
  if (!ops.active) return null;
  const net = ops.generationPerSol - ops.loadPerSol;
  const avg = ops.panelStages.length
    ? Math.round(
        (ops.panelStages.reduce((s, st) => s + panelEfficiency(st), 0) / ops.panelStages.length) *
          100,
      )
    : 0;
  const status = ops.blackout
    ? 'Apagão: sem bateria e sem geração'
    : net >= 0
      ? 'Carregando a bateria'
      : 'Usando a bateria';

  return (
    <section className="hud-grid" aria-label="Rede elétrica da base">
      <h4 className="hud-grid__title">
        <Zap size={15} /> Rede elétrica
        <span
          className={`hud-grid__status ${ops.blackout ? 'is-bad' : net >= 0 ? 'is-ok' : 'is-warn'}`}
        >
          {status}
        </span>
      </h4>

      <div className="hud-grid__flows">
        <span>
          <Sun size={14} /> Geração <strong>{ops.generationPerSol}</strong>/Sol
        </span>
        <span>
          Consumo <strong>{ops.loadPerSol}</strong>/Sol
        </span>
        <span>
          <BatteryCharging size={14} /> Bateria{' '}
          <strong>
            {battery.value}/{battery.max}
          </strong>
        </span>
      </div>

      <div className="hud-grid__panels">
        <span className="hud-grid__label">
          Painéis solares · {avg}% limpos em média (sem sol à noite)
        </span>
        <ul className="hud-grid__panel-list">
          {ops.panelStages.map((stage, i) => {
            const eff = Math.round(panelEfficiency(stage) * 100);
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: painéis fixos da base, na ordem
                key={i}
                className={`hud-grid__panel ${eff <= 50 ? 'is-dirty' : ''}`}
                title={`Painel ${i + 1}: ${eff}% de eficiência`}
              >
                <span className="hud-grid__panel-fill" style={{ height: `${eff}%` }} />
                <span className="sr-only">
                  Painel {i + 1}: {eff}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className={`hud-grid__oxygen ${ops.oxygenProducing ? 'is-ok' : 'is-bad'}`}>
        <Fan size={14} />
        {ops.oxygenProducing
          ? 'Suporte à vida produzindo oxigênio.'
          : ops.filterClogged
            ? 'Filtro de ar entupido: sem produção de oxigênio. Troque o filtro.'
            : 'Sem energia: a produção de oxigênio parou.'}
      </p>
    </section>
  );
}

export function ResourcesPanel() {
  return (
    <div className="hud-panel-content hud-panel-resources">
      <div className="hud-panel-intro">
        <Zap size={18} className="hud-panel-intro-icon" />
        <p>
          Painéis carregam a bateria de dia; o suporte à vida consome sempre. Painel sujo gera menos
          e, coberto de poeira, não gera nada. Sem geração, a base vive da bateria.
        </p>
      </div>

      <div className="hud-panel-body">
        <PowerGrid />
        <ResourceHud />
      </div>
    </div>
  );
}
