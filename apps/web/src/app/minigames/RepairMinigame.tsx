import { ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { BaseViewer } from '../../game/BaseViewer';
import { useBaseOps } from '../../game/tasks/store';
import './repair.css';
import { L } from '../../lib/i18n';
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
  const f = integrity?.fractures.find((f) => f.id === id);
  const [reserved, setReserved] = useState(false);
  const [selected, setSelected] = useState(false);
  const [hold, setHold] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const done = useRef(false);
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
      else setError(L('Não foi possível reservar a fratura. Feche e aproxime-se novamente.', 'Could not reserve the crack. Close and walk closer again.'));
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
  useEffect(() => {
    if (hold === null) return;
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / 1000);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
      else {
        setHold(null);
        void viewer?.repairAction({ op: 'screw', fracture: id, screw: hold }).then((ok) => {
          setError(ok ? '' : L('Não foi possível apertar. Tente novamente.', 'Could not tighten it. Try again.'));
        });
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hold, id, viewer]);
  const plate = () =>
    void viewer?.repairAction({ op: 'plate', fracture: id }).then((ok) => {
      setError(ok ? '' : L('Reparo indisponível. Feche e tente novamente.', 'Repair unavailable. Close and try again.'));
    });
  const stop = () => {
    setHold(null);
    setProgress(0);
  };
  useEffect(() => {
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);
  return (
    <main className="repair-mg" role="dialog" aria-modal="true" aria-labelledby="repair-title">
      <button className="repair-close" onClick={onClose} aria-label={L('Fechar reparo', 'Close repair')}>
        <X />
      </button>
      <h1 id="repair-title">{f ? L('Reparar a blindagem', 'Repair the shielding') : L('Base selada!', 'Base sealed!')}</h1>
      <p>
        {!f
          ? L('A estrutura foi recuperada.', 'The structure is fixed.')
          : !f.plate
            ? L('Encaixe a chapa sobre a fratura.', 'Fit the plate over the crack.')
            : L('Segure cada parafuso para apertar.', 'Hold each screw to tighten it.')}
      </p>
      <div
        className="repair-wall"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (reserved && !f?.plate) plate();
        }}
      >
        <svg viewBox="0 0 400 300" aria-hidden="true">
          <path
            d="m200 10 -30 65 55 35 -60 70 40 25 -20 85"
            fill="none"
            stroke="#182c36"
            strokeWidth="18"
          />
        </svg>
        {!f || f.plate ? (
          <div className="repair-plate">
            {f ? (
              [0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  className={`repair-screw screw-${n} ${f.screws.includes(n) ? 'done' : ''}`}
                  aria-label={`Parafuso ${n + 1}${f.screws.includes(n) ? ' apertado' : ': segure um segundo'}`}
                  disabled={!reserved || f.screws.includes(n)}
                  style={
                    {
                      '--turn': hold === n ? `${progress * 720}deg` : '0deg',
                    } as React.CSSProperties
                  }
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setHold(n);
                    setProgress(0);
                  }}
                  onPointerUp={stop}
                  onPointerCancel={stop}
                  onLostPointerCapture={stop}
                  onKeyDown={(e) => {
                    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                      e.preventDefault();
                      setHold(n);
                      setProgress(0);
                    }
                  }}
                  onKeyUp={stop}
                >
                  ✚
                </button>
              ))
            ) : (
              <ShieldCheck size={100} />
            )}
            <strong>{f ? `${f.screws.length}/4` : '100% selado'}</strong>
          </div>
        ) : (
          <button
            className="repair-target"
            disabled={!reserved}
            onClick={() => {
              if (selected) plate();
              else setSelected(true);
            }}
          >
            {L('Encaixar chapa', 'Fit the plate')}
          </button>
        )}
      </div>
      {f && !f.plate && (
        <button
          draggable
          className={`repair-piece ${selected ? 'selected' : ''}`}
          onDragStart={() => setSelected(true)}
          onClick={() => {
            setSelected(true);
          }}
          aria-pressed={selected}
        >
          {L('Chapa de aço', 'Steel plate')}
        </button>
      )}
      {hold !== null && <progress value={progress} max={1} aria-label={L('Apertando parafuso', 'Tightening screw')} />}
      {error && <p role="alert">{error}</p>}
      {!f && (
        <button className="repair-piece" autoFocus onClick={onClose}>
          {L('Voltar à base', 'Back to base')}
        </button>
      )}
    </main>
  );
}
