import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import '../missions/missions.css';
import { L } from '../../../lib/i18n';

/** Temperatura de trabalho do MOXIE (a eletrólise de óxido sólido funciona perto de 800 °C). */
const TARGET_C = 800;
const ZONE_C = 70;
const MAX_C = 1000;
const GOAL_O2 = 3;

interface Molecule {
  id: number;
  x: number;
  y: number;
}

/**
 * MOXIE (oxigênio): segure "Aquecer" para manter o forno perto de 800 °C e toque nas moléculas de
 * CO₂ do ar de Marte. Na temperatura certa, cada CO₂ perde um oxigênio; dois oxigênios formam O₂.
 * Frio demais, nada acontece; quente demais, o forno desliga para esfriar.
 */
export default function MoxieGame({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: (r: { quality: number }) => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const [temp, setTemp] = useState(300);
  const [heating, setHeating] = useState(false);
  const [overheat, setOverheat] = useState(false);
  const [molecules, setMolecules] = useState<Molecule[]>([]);
  const [atoms, setAtoms] = useState(0);
  const [o2, setO2] = useState(0);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const [misses, setMisses] = useState(0);
  const nextId = useRef(1);
  const reported = useRef(false);
  const done = o2 >= GOAL_O2;
  const inZone = Math.abs(temp - TARGET_C) <= ZONE_C;

  // forno: sobe segurando o botão, esfria sozinho; passou de 1000 °C, desliga até esfriar
  const tempRef = useRef(temp);
  const overheatRef = useRef(false);
  const heatingRef = useRef(false);
  heatingRef.current = heating;
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      let t = tempRef.current;
      if (overheatRef.current) {
        t -= 22;
        if (t <= 600) overheatRef.current = false;
      } else {
        t = heatingRef.current ? t + 26 : t - 9;
        if (t >= MAX_C) {
          t = MAX_C;
          overheatRef.current = true;
          setHeating(false);
        }
      }
      tempRef.current = Math.max(250, t);
      setTemp(tempRef.current);
      setOverheat(overheatRef.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [done]);

  // moléculas de CO₂ entram pela tomada de ar
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      setMolecules((list) =>
        list.length >= 3
          ? list
          : [...list, { id: nextId.current++, x: 12 + Math.random() * 76, y: 18 + Math.random() * 62 }],
      );
    }, 700);
    return () => window.clearInterval(id);
  }, [done]);

  const pop = (x: number, y: number, text: string) => {
    const id = nextId.current++;
    setPops((p) => [...p, { id, x, y, text }]);
    window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 900);
  };

  const split = (m: Molecule) => {
    if (done) return;
    if (!inZone || overheat) {
      setMisses((n) => n + 1);
      pop(m.x, m.y, temp < TARGET_C ? L('🥶 frio', '🥶 cold') : L('🔥 quente', '🔥 hot'));
      return;
    }
    setMolecules((list) => list.filter((q) => q.id !== m.id));
    pop(m.x, m.y, 'CO₂ → CO + O');
    // dois átomos de oxigênio formam uma molécula de O₂
    if (atoms + 1 >= 2) {
      setAtoms(0);
      setO2((n) => n + 1);
    } else setAtoms(atoms + 1);
  };

  const finish = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    onComplete?.({ quality: Math.max(0.4, 1 - misses * 0.08) });
    close();
  }, [onComplete, close, misses]);

  const pct = (c: number) => `${(c / MAX_C) * 100}%`;
  return (
    <main className="msn-mg" aria-label={L('MOXIE: oxigênio do ar de Marte', 'MOXIE: oxygen from Mars air')}>
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card">
        <div className="msn-mg__head">
          <div>
            <h2>{L('🫁 MOXIE: oxigênio do ar de Marte', '🫁 MOXIE: oxygen from Mars air')}</h2>
            <p>{L('Segure “Aquecer” para deixar o forno na faixa verde e toque nas moléculas de CO₂.', 'Hold “Heat” to keep the oven in the green zone and tap the CO₂ molecules.')}</p>
          </div>
          <button ref={closeButton} type="button" className="msn-mg__close" onClick={close} aria-label={L('Fechar', 'Close')}>
            <X size={18} />
          </button>
        </div>

        <div className="sci-row">
          <span>
            🌡️ {Math.round(temp)} °C {overheat ? L('(esfriando…)', '(cooling…)') : inZone ? '✅' : ''}
          </span>
          <span>
            {L('O₂ produzido:', 'O₂ made:')} <b>{o2}</b>/{GOAL_O2}
          </span>
        </div>
        <div className="sci-meter" aria-hidden="true">
          <span
            className="sci-meter__zone"
            style={{ left: pct(TARGET_C - ZONE_C), width: pct(ZONE_C * 2) }}
          />
          <span className="sci-meter__needle" style={{ left: pct(temp) }} />
        </div>

        {done ? (
          <div className="msn-mg__result">
            <strong>Oxigênio enviado para a base! +{GOAL_O2} O₂</strong>
            <span>{L('O monóxido de carbono (CO) volta para fora, para o ar de Marte.', 'The carbon monoxide (CO) goes back outside, into Mars air.')}</span>
            <button type="button" className="msn-mg__btn" onClick={finish}>
              {L('Guardar oxigênio', 'Store oxygen')}
            </button>
          </div>
        ) : (
          <>
            <div className="sci-stage">
              {molecules.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`sci-bubble ${inZone && !overheat ? 'is-good' : 'is-bad'}`}
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                  onClick={() => split(m)}
                  aria-label={L('Molécula de CO₂', 'CO₂ molecule')}
                >
                  CO₂
                </button>
              ))}
              {pops.map((p) => (
                <span key={p.id} className="sci-pop" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  {p.text}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="msn-mg__btn"
              disabled={overheat}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setHeating(true);
              }}
              onPointerUp={() => setHeating(false)}
              onPointerCancel={() => setHeating(false)}
              onKeyDown={(e) => {
                if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) setHeating(true);
              }}
              onKeyUp={() => setHeating(false)}
              onBlur={() => setHeating(false)}
            >
              {L('🔥 Segure para aquecer', '🔥 Hold to heat')}
            </button>
          </>
        )}

        <p className="sci-fact">
          <b>{L('CIÊNCIA DE VERDADE', 'REAL SCIENCE')}</b>{L('O ar de Marte é 95% gás carbônico (CO₂). O MOXIE, que viajou no rover Perseverance, aquece esse ar a cerca de 800 °C e usa eletricidade para tirar um átomo de oxigênio de cada CO₂. Em 2021 ele fez o primeiro oxigênio em outro planeta!', 'Mars air is 95% carbon dioxide (CO₂). MOXIE, which flew on the Perseverance rover, heats that air to about 800 °C and uses electricity to pull one oxygen atom off each CO₂. In 2021 it made the first oxygen on another planet!')}
        </p>
      </section>
    </main>
  );
}
