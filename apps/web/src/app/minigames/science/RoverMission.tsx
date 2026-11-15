import { eventsForSol, soilReward } from '@mars/sim';
import { X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useGameplay } from '../../../store/gameplay';
import { usePreviewClose } from '../usePreviewClose';
import { RoverRunGame, type RunResult } from './RoverRunGame';
import { TorchRepairGame } from './TorchRepairGame';
import '../missions/missions.css';
import { L } from '../../../lib/i18n';

/** Próximo evento climático previsto pelos dados do reconhecimento (até 6 Sóis à frente). */
export function forecast(seed: number, sol: number) {
  for (let s = sol + 1; s <= sol + 6; s++) {
    const event = eventsForSol(seed, s).find((e) => e.kind === 'major') ?? null;
    if (event) return { title: event.title, icon: event.icon, sol: s };
  }
  return null;
}

/**
 * Missão do rover: reconhecimento na névoa → relatório (pesquisa e previsão do próximo evento
 * climático) → reparo com o maçarico. Só ao terminar o reparo os dados são registrados na base.
 */
export default function RoverMission({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: (r: { quality: number }) => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const [phase, setPhase] = useState<'run' | 'report' | 'repair' | 'done'>('run');
  const [run, setRun] = useState<RunResult | null>(null);
  const reported = useRef(false);
  const state = useGameplay((s) => s.state);
  const prediction = useMemo(
    () => (state ? forecast(state.mission.seed, state.mission.sol) : null),
    [state?.mission.seed, state?.mission.sol],
  );

  const ended = useCallback((r: RunResult) => {
    setRun(r);
    setPhase('report');
  }, []);
  const repaired = useCallback(() => {
    setPhase('done');
    if (reported.current || !run) return;
    reported.current = true;
    onComplete?.({ quality: run.quality });
  }, [onComplete, run]);

  return (
    <main className="msn-mg msn-mg--soil" aria-label={L('Reconhecimento com o rover', 'Rover scouting run')}>
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card">
        <div className="msn-mg__head">
          <div>
            <h2>
              {phase === 'repair' ? L('🔧 Consertar o rover', '🔧 Repair the rover') : L('🚙 Reconhecimento com o rover', '🚙 Rover scouting run')}
            </h2>
            <p>
              {phase === 'run'
                ? L('Chegue aos 300 m desviando de pedras e buracos e pegue os pontos amarelos flutuando.', 'Reach 300 m dodging rocks and holes and grab the floating yellow points.')
                : phase === 'repair'
                  ? L('As rochas amassaram a lataria. Solde as placas para o rover sair amanhã.', 'The rocks dented the body. Weld the plates so the rover can go out tomorrow.')
                  : L('O rover voltou para a base.', 'The rover is back at the base.')}
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="msn-mg__close"
            onClick={close}
            aria-label={L('Fechar (a missão não é concluída)', 'Close (the mission is not completed)')}
          >
            <X size={18} />
          </button>
        </div>

        {phase === 'run' && <RoverRunGame onEnd={ended} />}

        {phase === 'report' && run && (
          <div className="msn-mg__result">
            <strong>
              {run.completed ? `🏁 Chegou aos ${run.meters} m!` : `💥 Avariado aos ${run.meters} m: o rover voltou mais cedo.`}
            </strong>
            <span>
              ⭐ {run.samples} pontos · 💥 {run.hits} batidas · Pesquisa: +{soilReward(run.quality)}
            </span>
            <div className="sci-fact">
              <b>{L('PREVISÃO DO TEMPO (dados do reconhecimento)', 'WEATHER FORECAST (from the scouting data)')}</b>
              {prediction
                ? `${prediction.icon} ${prediction.title} — previsto para o amanhecer do Sol ${prediction.sol}. Prepare a base!`
                : L('Nenhum evento climático forte nos próximos 6 Sóis. Céu tranquilo! ☀️', 'No strong weather event in the next 6 sols. Calm skies! ☀️')}
            </div>
            <button type="button" className="msn-mg__btn" onClick={() => setPhase('repair')}>
              {L('🔧 Consertar o rover para guardar os dados', '🔧 Repair the rover to save the data')}
            </button>
          </div>
        )}

        {phase === 'repair' && <TorchRepairGame onDone={repaired} />}

        {phase === 'done' && (
          <div className="msn-mg__result">
            <strong>{L('Rover consertado e dados guardados! 🎉', 'Rover repaired and data saved! 🎉')}</strong>
            <button type="button" className="msn-mg__btn" onClick={close}>
              {L('Voltar para a base', 'Back to base')}
            </button>
          </div>
        )}

        <p className="sci-fact">
          <b>{L('CIÊNCIA DE VERDADE', 'REAL SCIENCE')}</b>
          {phase === 'repair' || phase === 'done'
            ? L('O maçarico derrete o metal a mais de 1.500 °C e une as peças. Em Marte o ar é tão fino (1% da pressão da Terra) que os engenheiros estudam soldar dentro de cabines fechadas.', 'The welding torch melts metal at over 1,500 °C to join the parts. On Mars the air is so thin (1% of Earth\'s pressure) that engineers study welding inside closed cabins.')
            : L('As crateras de Marte foram abertas por meteoritos ao longo de bilhões de anos. Os rovers de verdade andam devagar (o Perseverance faz uns 150 metros por dia) e voltam a carregar com o Sol, por isso trabalham de manhã.', 'Mars craters were made by meteorites over billions of years. Real rovers drive slowly (Perseverance does about 150 meters a day) and recharge with sunlight.')}
        </p>
      </section>
    </main>
  );
}
