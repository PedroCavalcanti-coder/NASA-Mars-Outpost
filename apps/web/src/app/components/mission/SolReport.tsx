import { RADIATION } from '@mars/shared';
import { DAILY_SUPPLIES_PER_PLAYER, filterClogged } from '@mars/sim';
import { ClipboardCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useGameplay } from '../../../store/gameplay';
import { L } from '../../../lib/i18n';

type Key = 'energy' | 'supplies' | 'oxygen' | 'armor';
const NAMES: Record<Key, string> = {
  energy: L('⚡ Energia', '⚡ Power'),
  supplies: L('🌾 Mantimentos', '🌾 Supplies'),
  oxygen: L('🫁 Oxigênio', '🫁 Oxygen'),
  armor: L('🛡️ Blindagem', '🛡️ Shielding'),
};

interface Report {
  sol: number;
  changes: { key: Key; delta: number }[];
  dose: number;
  /** missões do dia que ficaram feitas e o total */
  missions: { done: number; total: number };
  research: number;
  goal: number;
  /** o que mais pesou no dia (entradas do diário com perdas) */
  causes: { title: string; text: string }[];
  /** lições de causa e efeito do dia */
  lessons: string[];
}

/**
 * Relatório do fim do Sol: quanto cada recurso mudou e POR QUÊ. É aqui que a criança liga a
 * escolha de ontem ao resultado de hoje ("o filtro sujo cortou o oxigênio").
 */
export function SolReport({ hidden }: { hidden: boolean }) {
  const state = useGameplay((s) => s.state);
  const [report, setReport] = useState<Report | null>(null);
  const start = useRef<{ sol: number; res: Record<Key, number>; dose: number; clogged: boolean; missions: { done: number; total: number }; research: number } | null>(null);

  useEffect(() => {
    if (!state) return;
    const sol = state.mission.sol;
    const res = Object.fromEntries(
      (Object.keys(NAMES) as Key[]).map((k) => [k, state.mission.resources[k].value]),
    ) as Record<Key, number>;
    const dose = state.dose ?? 0;
    const prev = start.current;
    // durante o dia: lembra se o filtro chegou a entupir (causa de perda de oxigênio)
    if (prev && prev.sol === sol) {
      if (filterClogged(state.care.filter, sol)) prev.clogged = true;
      prev.missions = { done: state.board.done.length, total: state.board.ids.length };
      prev.research = state.mission.research;
      return;
    }
    if (prev && sol === prev.sol + 1) {
      const entries = state.mission.log.filter((e) => e.sol === prev.sol);
      const crew = Math.max(1, Object.keys(state.players).length);
      const lessons: string[] = [
        L(
          `A tripulação de ${crew} ${crew > 1 ? 'astronautas comeu e bebeu' : 'astronauta comeu e bebeu'} ${DAILY_SUPPLIES_PER_PLAYER * crew} de mantimentos. Mais gente, mais consumo!`,
          `The crew of ${crew} ate and drank ${DAILY_SUPPLIES_PER_PLAYER * crew} supplies. More people, more consumption!`,
        ),
        L(
          `Só por estar em Marte, cada um recebeu ${RADIATION.marsSurfacePerDay} mSv de radiação (medido pelo RAD do Curiosity). Na Terra isso leva uns 3 meses.`,
          `Just by being on Mars, each one got ${RADIATION.marsSurfacePerDay} mSv of radiation (measured by Curiosity's RAD). On Earth that takes about 3 months.`,
        ),
      ];
      if (prev.clogged)
        lessons.push(L('O filtro de ar entupiu: sem ele, a base parou de fazer oxigênio. Limpar o filtro no dia certo evita isso.', 'The air filter clogged: without it, the base stopped making oxygen. Cleaning the filter on the right day prevents this.'));
      if (res.energy <= 0)
        lessons.push(L('A bateria acabou: sem energia, a usina de oxigênio também para. Painéis limpos e economia à noite ajudam.', 'The battery ran out: without power, the oxygen plant stops too. Clean panels and saving power at night help.'));
      if (dose - prev.dose > RADIATION.marsSurfacePerDay * 2)
        lessons.push(L('A tempestade solar deu uma dose extra: reforçar a blindagem gasta energia, mas protege a tripulação.', 'The solar storm gave an extra dose: reinforcing the shielding uses power, but protects the crew.'));
      setReport({
        sol: prev.sol,
        changes: (Object.keys(NAMES) as Key[])
          .map((key) => ({ key, delta: Math.round(res[key] - prev.res[key]) }))
          .filter((c) => c.delta !== 0),
        dose: dose - prev.dose,
        missions: prev.missions,
        research: prev.research,
        goal: state.mission.researchGoal ?? 100,
        causes: entries
          .filter((e) => Object.values(e.deltas ?? {}).some((v) => (v ?? 0) < 0) || e.tone === 'bad')
          .slice(0, 4)
          .map((e) => ({ title: e.title, text: e.text })),
        lessons,
      });
    }
    start.current = { sol, res, dose, clogged: filterClogged(state.care.filter, sol), missions: { done: state.board.done.length, total: state.board.ids.length }, research: state.mission.research };
  }, [state]);

  if (!report || hidden) return null;
  return (
    <div className="event-tablet__backdrop" role="presentation">
      <section className="event-tablet event-tablet--lore" role="dialog" aria-modal="true" aria-labelledby="sol-report-title">
        <header className="event-tablet__head">
          <span className="event-tablet__alert" aria-hidden="true">
            <ClipboardCheck size={24} />
          </span>
          <h2 id="sol-report-title">
            <small>{L('RELATÓRIO:', 'REPORT:')} </small>{L('FIM DO SOL', 'END OF SOL')} {report.sol}
          </h2>
        </header>
        <div className="event-tablet__screen">
          <p className="event-tablet__body">
            <b>{L('Sol', 'A sol')}</b> {L('é o dia de Marte: dura 24 horas e 40 minutos. Veja o que mudou na base e por quê:', 'is a day on Mars: it lasts 24 hours and 40 minutes. See what changed at the base and why:')}
          </p>
          <ul className="event-tablet__deltas">
            {report.changes.map((c) => (
              <li key={c.key} className={c.delta > 0 ? 'is-up' : 'is-down'}>
                {NAMES[c.key]} {c.delta > 0 ? `+${c.delta}` : `−${Math.abs(c.delta)}`}
              </li>
            ))}
            <li className={report.missions.done >= report.missions.total ? 'is-up' : 'is-down'}>📋 {L('Missões', 'Missions')} {report.missions.done}/{report.missions.total}</li>
            <li className="is-up">🔬 {L('Pesquisa', 'Research')} {report.research}/{report.goal}</li>
            <li className="is-down">☢ {L('Radiação', 'Radiation')} +{report.dose.toFixed(1)} mSv</li>
          </ul>
          {report.causes.length > 0 && (
            <aside className="event-tablet__fact">
              <span className="event-tablet__fact-tag">{L('O QUE MAIS PESOU', 'WHAT MATTERED MOST')}</span>
              {report.causes.map((c) => (
                <p key={c.title}>
                  <b>{c.title}:</b> {c.text}
                </p>
              ))}
            </aside>
          )}
          <aside className="event-tablet__fact">
            <span className="event-tablet__fact-tag">{L('CAUSA E EFEITO', 'CAUSE AND EFFECT')}</span>
            {report.lessons.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </aside>
          <button type="button" className="event-tablet__ok" onClick={() => setReport(null)} autoFocus>
            {L('Começar o Sol', 'Start sol')} {report.sol + 1}
          </button>
        </div>
      </section>
    </div>
  );
}
