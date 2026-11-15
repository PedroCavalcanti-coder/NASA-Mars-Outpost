import { Drill, FlaskConical, Thermometer, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guideProgress } from '../../../game/guide/events';
import {
  collectSample,
  type DrillState,
  drillStep,
  initialDrill,
  layerAt,
  layerById,
  MAX_DEPTH,
  profileFor,
  type SampleResult,
} from '../../../game/tasks/drilling';
import { usePreviewClose } from '../usePreviewClose';
import './drilling.css';

/** Geometria do corte do subsolo no SVG. */
const TOP = 150;
const BOTTOM = 730;
const yOf = (depth: number) => TOP + (depth / MAX_DEPTH) * (BOTTOM - TOP);

export interface DrillingResult {
  research: number;
  layerName: string;
  hit: boolean;
}

/**
 * Sondagem do subsolo com a sonda de perfuração da base.
 * Segure "Perfurar" (ou Espaço/↓) para descer a broca; camadas duras esquentam mais e,
 * no vermelho, a broca trava até esfriar. Pare na camada pedida e colete a amostra (Enter).
 */
export default function DrillingMinigame({
  baseId,
  target,
  onClose,
  onComplete,
}: {
  baseId: string;
  target: string;
  onClose?: () => void;
  onComplete?: (r: DrillingResult) => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const profile = useMemo(() => profileFor(baseId), [baseId]);
  const goal = useMemo(() => layerById(profile, target), [profile, target]);
  const [drill, setDrill] = useState<DrillState>(initialDrill);
  const [drilling, setDrilling] = useState(false);
  const [result, setResult] = useState<SampleResult | null>(null);
  const drillButton = useRef<HTMLButtonElement>(null);
  const holding = useRef(false);

  // foco no controle principal (Espaço não pode cair no botão de fechar)
  useEffect(() => {
    drillButton.current?.focus({ preventScroll: true });
  }, []);

  // laço da broca: avança enquanto segura, esfria quando solta
  useEffect(() => {
    if (result) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      setDrill((s) => drillStep(s, profile, holding.current, dt));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [profile, result]);

  useEffect(() => {
    if (drilling && drill.depth > 0) guideProgress();
  }, [drill.depth, drilling]);
  const start = useCallback(() => {
    if (result) return;
    holding.current = true;
    setDrilling(true);
  }, [result]);
  const stop = useCallback(() => {
    holding.current = false;
    setDrilling(false);
  }, []);

  const collect = useCallback(() => {
    if (result || drill.depth < 1) return;
    stop();
    const r = collectSample(drill.depth, profile, goal);
    setResult(r);
    onComplete?.({ research: r.research, layerName: r.layer.name, hit: r.hit });
  }, [result, drill.depth, profile, goal, onComplete, stop]);

  // teclado: segurar Espaço/↓ perfura, Enter coleta
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('.bit-guide')) return;
      if (e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!e.repeat) start();
      } else if (e.key === 'Enter' && !result) {
        e.preventDefault();
        collect();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', stop);
    };
  }, [start, stop, collect, result]);

  const current = layerAt(profile, drill.depth);
  const heatPct = Math.round(drill.heat * 100);
  const heatLevel = drill.jammed
    ? 'jam'
    : drill.heat > 0.75
      ? 'hot'
      : drill.heat > 0.45
        ? 'warm'
        : 'ok';
  const bitY = yOf(drill.depth);

  return (
    <main className="drill-mg" aria-label="Sondagem do subsolo" data-done={!!result}>
      <div className="drill-mg__sky" aria-hidden="true" />

      <svg
        className="drill-mg__section"
        viewBox="0 0 420 760"
        role="img"
        aria-labelledby="drill-title"
      >
        <title id="drill-title">
          Corte do subsolo: broca a {Math.round(drill.depth)} cm, na camada de {current.name}
        </title>
        {/* camadas */}
        {profile.map((l) => (
          <g key={l.id}>
            <rect
              x="40"
              y={yOf(l.from)}
              width="340"
              height={yOf(l.to) - yOf(l.from)}
              fill={l.color}
            />
            <text x="372" y={yOf(l.from) + 22} textAnchor="end" className="drill-mg__layer-name">
              {l.name}
            </text>
          </g>
        ))}
        {/* textura de pedrinhas */}
        {Array.from({ length: 46 }, (_, i) => (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: pedrinhas fixas e decorativas
            key={i}
            cx={50 + ((i * 97) % 320)}
            cy={TOP + 10 + ((i * 53) % (BOTTOM - TOP - 20))}
            r={2 + (i % 3)}
            fill="#00000022"
          />
        ))}
        {/* alvo pedido pela ciência */}
        <rect
          x="36"
          y={yOf(goal.from)}
          width="348"
          height={yOf(goal.to) - yOf(goal.from)}
          className="drill-mg__target"
        />
        {/* régua de profundidade */}
        {[0, 50, 100, 150, 200].map((d) => (
          <g key={d}>
            <path d={`M28 ${yOf(d)}H40`} stroke="#f4e7d0" strokeWidth="2" />
            <text x="24" y={yOf(d) + 5} textAnchor="end" className="drill-mg__ruler">
              {d}
            </text>
          </g>
        ))}
        {/* sonda na superfície */}
        <path
          d={`M170 ${TOP}L190 60H230L250 ${TOP}Z`}
          fill="#3a3f4a"
          stroke="#1d2027"
          strokeWidth="4"
        />
        <rect
          x="186"
          y="44"
          width="48"
          height="24"
          rx="4"
          fill="#f2b632"
          stroke="#1d2027"
          strokeWidth="4"
        />
        <rect x="140" y={TOP - 8} width="140" height="12" rx="3" fill="#59606d" />
        {/* haste e broca */}
        <rect x="204" y="64" width="12" height={Math.max(0, bitY - 64)} fill="#c9ced8" />
        <g
          transform={`translate(210 ${bitY})`}
          className={drilling && drill.depth > 0 ? 'drill-mg__bit is-spinning' : 'drill-mg__bit'}
        >
          <path d="M-12 -14H12L0 16Z" fill="#e7ebf2" stroke="#2b2f37" strokeWidth="3" />
          {drill.heat > 0.45 && <circle r={10 + drill.heat * 10} className="drill-mg__glow" />}
        </g>
        <text x="228" y={bitY + 6} className="drill-mg__depth">
          {Math.round(drill.depth)} cm
        </text>
      </svg>

      <section className="drill-mg__panel" aria-label="Controles da sonda">
        <p className="drill-mg__kicker">
          <FlaskConical size={16} aria-hidden="true" /> Pedido da ciência
        </p>
        <h2>
          Amostra de{' '}
          <span className="drill-mg__goal-name">
            <span
              className="drill-mg__swatch"
              style={{ background: goal.color }}
              aria-hidden="true"
            />
            {goal.name}
          </span>
        </h2>
        <p className="drill-mg__goal">
          Entre {goal.from} e {goal.to} cm. Pare no meio da camada para render mais.
        </p>

        <div className={`drill-mg__heat is-${heatLevel}`}>
          <span>
            <Thermometer size={16} aria-hidden="true" /> Temperatura da broca
          </span>
          <meter
            className="sr-only"
            min={0}
            max={100}
            value={heatPct}
            aria-label="Temperatura da broca"
          >
            {heatPct}%
          </meter>
          <div className="drill-mg__heat-track" aria-hidden="true">
            <div className="drill-mg__heat-fill" style={{ width: `${heatPct}%` }} />
          </div>
          <small aria-live="polite">
            {drill.jammed
              ? 'Superaqueceu! Solte e espere esfriar.'
              : `Agora: ${current.name} (${Math.round(drill.depth)} cm)`}
          </small>
        </div>

        {!result ? (
          <div className="drill-mg__actions">
            <button
              ref={drillButton}
              type="button"
              className="drill-mg__drill"
              aria-pressed={drilling}
              disabled={drill.jammed || drill.depth >= MAX_DEPTH}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                start();
              }}
              onPointerUp={stop}
              onPointerCancel={stop}
              onLostPointerCapture={stop}
              onKeyDown={(e) => e.key === ' ' && e.preventDefault()}
              onClick={(e) => e.preventDefault()}
            >
              <Drill size={22} aria-hidden="true" />
              Perfurar <small className="drill-mg__key">(segure · Espaço)</small>
            </button>
            <button
              type="button"
              className="drill-mg__collect"
              onClick={collect}
              disabled={drill.depth < 1}
            >
              Coletar amostra <small className="drill-mg__key">(Enter)</small>
            </button>
          </div>
        ) : (
          <div className="drill-mg__result" role="status" aria-live="polite">
            <strong>
              {result.hit ? 'Amostra no alvo!' : `Amostra de ${result.layer.name} (fora do alvo)`}
            </strong>
            <span className="drill-mg__points">+{result.research} pontos de pesquisa</span>
            <p>{result.layer.fact}</p>
            {onComplete ? (
              <button type="button" className="drill-mg__collect" onClick={close}>
                Voltar à base
              </button>
            ) : (
              <button
                type="button"
                className="drill-mg__collect"
                onClick={() => {
                  setResult(null);
                  setDrill(initialDrill());
                }}
              >
                Perfurar de novo
              </button>
            )}
          </div>
        )}
      </section>

      <button
        ref={closeButton}
        className="drill-mg__close"
        type="button"
        onClick={close}
        aria-label="Fechar sondagem"
        title="Fechar (Esc)"
      >
        <X size={22} aria-hidden="true" />
      </button>
    </main>
  );
}
