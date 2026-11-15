import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BaseViewer } from '../../game/BaseViewer';
import { useBaseOps } from '../../game/tasks/store';
import { L } from '../../lib/i18n';
import { useGameplay } from '../../store/gameplay';
import './repair.css';
import { REPAIR_META, REPAIR_STEPS, RepairGame } from './repair/RepairGames';

/** Pausa mínima entre dois passos: o servidor só aceita um a cada ~0,9 s. */
const STEP_GAP_MS = 1000;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Reparo da blindagem, feito do LADO DE FORA da base. Cada rachadura tem um dos 5 tipos de
 * minigame (chapa, solda, selante, fios ou aquecedores). Para o servidor, todos são: reservar a
 * rachadura, 1 preparo e 4 passos, com a posição e o horário conferidos lá.
 */
export default function RepairMinigame({
  id,
  viewer,
  onClose,
}: {
  id: number;
  viewer: BaseViewer | null;
  onClose: () => void;
}) {
  const integrity = useBaseOps((s) => s.integrity);
  const radiation = useGameplay((s) => s.state?.radiation);
  const f = integrity?.fractures.find((f) => f.id === id);
  const kindRef = useRef(f?.kind ?? 0);
  if (f) kindRef.current = f.kind ?? 0;
  const kind = kindRef.current;
  const meta = REPAIR_META[kind] ?? REPAIR_META[0]!;

  const [reserved, setReserved] = useState(false);
  const [error, setError] = useState('');
  const [prepSent, setPrepSent] = useState(false);
  const [sent, setSent] = useState(0);
  const done = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const lastOp = useRef(0);
  const progress = Math.min(REPAIR_STEPS, Math.max(sent, f?.screws.length ?? 0));
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    let active = true;
    // React StrictMode replays setup/cleanup in development. Every setup must
    // acquire its own lease because the preceding cleanup has released it.
    const reserve = async () => {
      const ok = await viewer?.repairAction({ op: 'reserve', fracture: id });
      if (!active) return;
      setReserved(Boolean(ok));
      if (ok) setError('');
      else
        setError(
          L(
            'Não foi possível reservar a rachadura. Fique do lado de fora, perto dela, e tente de novo.',
            'Could not reserve the crack. Stay outside, close to it, and try again.',
          ),
        );
    };
    void reserve();
    const timer = setInterval(async () => {
      const ok = await viewer?.repairAction({ op: 'heartbeat', fracture: id });
      if (active && !ok) await reserve();
    }, 2500);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('keydown', close);
      void viewer?.repairAction({ op: 'release', fracture: id });
    };
  }, [id, viewer, onClose]);

  useEffect(() => {
    if (!f && !done.current) {
      done.current = true;
      viewer?.repairFinished();
    }
  }, [f, viewer]);

  /** Envia os passos em fila, respeitando o intervalo mínimo do servidor. */
  const send = useCallback(
    (intent: Parameters<BaseViewer['repairAction']>[0]) => {
      queue.current = queue.current.then(async () => {
        const wait = STEP_GAP_MS - (Date.now() - lastOp.current);
        if (wait > 0) await sleep(wait);
        lastOp.current = Date.now();
        const ok = await viewer?.repairAction(intent);
        setError(ok ? '' : L('Não deu certo. Tente de novo.', 'That did not work. Try again.'));
      });
    },
    [viewer],
  );
  const onPrep = useCallback(() => {
    setPrepSent(true);
    send({ op: 'plate', fracture: id });
  }, [id, send]);
  const onStep = useCallback(() => {
    const index = progressRef.current;
    if (index >= REPAIR_STEPS) return;
    progressRef.current = index + 1;
    setSent(index + 1);
    send({ op: 'screw', fracture: id, screw: index });
  }, [id, send]);

  const prepared = Boolean(f?.plate) || prepSent;
  return (
    <main className="repair-mg" role="dialog" aria-modal="true" aria-labelledby="repair-title">
      <button type="button" className="repair-close" onClick={onClose} aria-label={L('Fechar reparo', 'Close repair')}>
        <X />
      </button>
      <h1 id="repair-title">
        <span aria-hidden="true">{f ? meta.icon : '🛡️'}</span>{' '}
        {f ? L(meta.title[0], meta.title[1]) : L('Base selada!', 'Base sealed!')}
      </h1>
      <p className="repair-sub">
        {f ? `🧑‍🚀 ${L('Reparo do lado de fora', 'Repair outside the base')}` : L('A estrutura foi recuperada. 🎉', 'The structure is fixed. 🎉')}
      </p>
      {radiation && f && (
        <p className="repair-warn" role="alert">
          ☢️ {L('Radiação alta! Termine rápido ou volte para a base.', 'High radiation! Finish fast or go back to the base.')}
        </p>
      )}
      {f && <p className="repair-how">{L(meta.how[0], meta.how[1])}</p>}
      {f && (
        <div className="rg-board">
          <RepairGame
            kind={kind}
            prepared={prepared}
            progress={progress}
            ready={reserved}
            onPrep={onPrep}
            onStep={onStep}
            damage={f.damage}
          />
        </div>
      )}
      {f && (
        <div className="repair-dots" role="img" aria-label={`${progress}/${REPAIR_STEPS}`}>
          {Array.from({ length: REPAIR_STEPS }, (_, i) => (
            <i key={`dot-${i}`} className={i < progress ? 'is-on' : ''} />
          ))}
        </div>
      )}
      <p className="repair-fact">
        💡 {L('Você sabia?', 'Did you know?')} {L(meta.fact[0], meta.fact[1])}
      </p>
      {error && (
        <p className="repair-error" role="alert">
          {error}
        </p>
      )}
      {!f && (
        <button type="button" className="repair-piece" onClick={onClose}>
          {L('Voltar à base', 'Back to base')}
        </button>
      )}
    </main>
  );
}
