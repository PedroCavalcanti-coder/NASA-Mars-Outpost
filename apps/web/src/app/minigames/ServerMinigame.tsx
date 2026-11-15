import type { ActivityKind } from '@mars/shared';
import { lazy, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { BaseViewer, MinigameRequest, MinigameResult } from '../../game/BaseViewer';
import { gameplayCommand } from '../../store/gameplay';
import './missions/missions.css';
import { L } from '../../lib/i18n';
import { showMinigameResult } from '../../game/minigameResult';
import { chime } from '../../lib/chime';
import '../components/feedback/feedback.css';

const SolarCleaningPreview = lazy(() => import('./solar-cleaning/SolarCleaningPreview'));
const OxygenFilterPreview = lazy(() => import('./oxygen-filter/OxygenFilterPreview'));
const GreenhousePreview = lazy(() => import('./greenhouse/GreenhousePreview'));
const DrillingMinigame = lazy(() => import('./drilling/DrillingMinigame'));
const StationConsoleGame = lazy(() => import('./missions/StationConsoleGame'));
const DataUploadGame = lazy(() => import('./missions/DataUploadGame'));
const RoverMission = lazy(() => import('./science/RoverMission'));
const MoxieGame = lazy(() => import('./science/MoxieGame'));
const AntennaGame = lazy(() => import('./science/AntennaGame'));
const DuctsGame = lazy(() => import('./science/DuctsGame'));
const WaterGame = lazy(() => import('./science/WaterGame'));

type Request = Exclude<MinigameRequest, { kind: 'repair' }>;

/** Qual atividade oficial do servidor corresponde a cada minigame. */
function activity(req: Request): { kind: ActivityKind; target: string } {
  if (req.kind === 'moxie' || req.kind === 'water') return { kind: 'station', target: req.kind };
  if (req.kind === 'ducts') return { kind: 'ducts', target: 'ducts' };
  if (req.kind === 'station') return { kind: 'station', target: req.mission };
  if (req.kind === 'oxygen') return { kind: 'filter', target: String(req.index) };
  if (req.kind === 'solar') return { kind: 'solar', target: String(req.index) };
  if (req.kind === 'greenhouse') return { kind: 'greenhouse', target: String(req.index) };
  if (req.kind === 'drill') return { kind: 'drill', target: '0' };
  if (req.kind === 'soil') return { kind: 'soil', target: '0' };
  return { kind: 'upload', target: '0' };
}

/**
 * Minigame original, jogado no navegador, ligado ao servidor: abrir reserva a tarefa (os outros
 * jogadores deixam de ver o marcador), concluir manda o resultado e o servidor aplica o efeito para
 * a sala toda; fechar no meio libera a tarefa de novo.
 */
export default function ServerMinigame({
  request,
  viewer,
  onClose,
  onComplete,
  onError,
}: {
  request: Request;
  viewer: BaseViewer | null;
  onClose: () => void;
  onComplete: (result?: MinigameResult) => void;
  /** a conclusão falhou depois que o minigame já tinha fechado (aviso fora do minigame) */
  onError?: (message: string) => void;
}) {
  // suporte à vida: o minigame é a parte didática; a produção é pedida ao servidor na conclusão
  // prévia do painel de dev também não fala com o servidor
  const serverless = request.kind === 'moxie' || request.kind === 'water' || (request as { preview?: boolean }).preview === true;
  const [error, setError] = useState('');
  const [ready, setReady] = useState(serverless);
  const attempt = useRef('');
  const done = useRef(false);
  /** o resultado já foi para o servidor: fechar agora NÃO cancela a tarefa */
  const finishing = useRef(false);
  const mounted = useRef(true);
  const { kind, target } = activity(request);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (serverless) return;
    let live = true;
    void gameplayCommand({ type: 'start', kind, target }).then((r) => {
      if (!r.ok || !r.attempt) {
        if (live) setError(r.ok ? L('Não foi possível começar.', 'Could not start.') : r.error);
        return;
      }
      if (!live) {
        void gameplayCommand({ type: 'cancel', attempt: r.attempt.id });
        return;
      }
      attempt.current = r.attempt.id;
      setReady(true);
    });
    return () => {
      live = false;
      // saiu sem terminar: a tarefa volta a aparecer para a tripulação
      // (vários minigames fecham logo depois de concluir: aí a conclusão segue em segundo plano)
      if (attempt.current && !done.current && !finishing.current)
        void gameplayCommand({ type: 'cancel', attempt: attempt.current });
    };
  }, [kind, target, serverless]);

  const complete = useCallback(
    async (result: MinigameResult & { quality?: number } = {}) => {
      if (done.current || finishing.current) return;
      if (serverless) {
        done.current = true;
        showMinigameResult(request.kind, (result as { quality?: number }).quality ?? 1);
        onComplete(result);
        return;
      }
      const id = attempt.current;
      if (!id) return;
      finishing.current = true;
      const quality = Math.max(0, Math.min(1, result.quality ?? 1));
      const sent = await gameplayCommand({
        type: 'actions',
        attempt: id,
        seq: 1,
        actions: [
          {
            type: 'result',
            quality,
            water: Math.max(0, Math.min(20, result.waterUsed ?? 0)),
            research: Math.max(0, Math.min(40, result.research ?? 0)),
          },
        ],
      });
      const finished = sent.ok ? await gameplayCommand({ type: 'finish', attempt: id }) : sent;
      if (!finished.ok) {
        finishing.current = false;
        if (mounted.current) setError(finished.error);
        else {
          // o minigame já fechou: libera a tarefa e avisa na base
          void gameplayCommand({ type: 'cancel', attempt: id });
          onError?.(finished.error);
        }
        return;
      }
      done.current = true;
      showMinigameResult(request.kind, result.quality ?? 1);
      onComplete(result);
    },
    [onComplete, onError, serverless, request.kind],
  );

  if (error)
    return (
      <div className="event-tablet__backdrop" role="presentation" style={{ position: 'fixed' }}>
        <section className="msn-mg__card" role="alertdialog" aria-label={L('Tarefa indisponível', 'Task unavailable')}>
          <p role="alert">{error}</p>
          <button type="button" className="msn-mg__btn" onClick={onClose} autoFocus>
            {L('Voltar', 'Back')}
          </button>
        </section>
      </div>
    );
  if (!ready) return null;

  let game: ReactNode;
  if (request.kind === 'solar')
    game = <SolarCleaningPreview onClose={onClose} onComplete={() => void complete()} />;
  else if (request.kind === 'oxygen')
    game = <OxygenFilterPreview onClose={onClose} onComplete={() => void complete()} />;
  else if (request.kind === 'greenhouse')
    game = <GreenhousePreview onClose={onClose} onComplete={(r) => void complete(r)} />;
  else if (request.kind === 'station' && request.mission === 'antenna_calibration')
    game = <AntennaGame onClose={onClose} onComplete={(r) => void complete(r)} />;
  else if (request.kind === 'station')
    game = (
      <StationConsoleGame
        title={request.title}
        hint={request.hint}
        onClose={onClose}
        onComplete={(r) => void complete(r)}
      />
    );
  else if (request.kind === 'upload')
    game = <DataUploadGame onClose={onClose} onComplete={() => void complete()} />;
  else if (request.kind === 'soil')
    game = <RoverMission onClose={onClose} onComplete={(r) => void complete(r)} />;
  else if (request.kind === 'ducts')
    game = <DuctsGame onClose={onClose} onComplete={(r) => void complete(r)} />;
  else if (request.kind === 'moxie')
    game = <MoxieGame onClose={onClose} onComplete={(r) => void complete(r)} />;
  else if (request.kind === 'water')
    game = <WaterGame onClose={onClose} onComplete={(r) => void complete(r)} />;
  else
    game = (
      <DrillingMinigame
        baseId={request.baseId}
        target={request.target}
        onClose={onClose}
        onComplete={(r) => void complete({ ...r, quality: r.hit ? 1 : 0.5 })}
      />
    );
  return (
    <>
      {game}
      <FirstTimeHand kind={request.kind} />
    </>
  );
}

/** Mãozinha que mostra onde tocar, só nos primeiros segundos da primeira vez de cada minigame. */
function FirstTimeHand({ kind }: { kind: string }) {
  const key = `mo_hand:${kind}`;
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(key) !== '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!show) return;
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* opcional */
    }
    chime([660], 0, 'sine', 0.03);
    const hide = () => setShow(false);
    const id = window.setTimeout(hide, 6000);
    window.addEventListener('pointerdown', hide, { once: true, capture: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', hide, true);
    };
  }, [show, key]);
  if (!show) return null;
  return (
    <div className="mg-hand" aria-hidden="true">
      👆
      <small>{L('Toque aqui!', 'Tap here!')}</small>
    </div>
  );
}
