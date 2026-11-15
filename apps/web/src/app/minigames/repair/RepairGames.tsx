import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { chime } from '../../../lib/chime';
import { useEasyMode } from '../../../lib/easyMode';
import { L } from '../../../lib/i18n';
import './repairGames.css';

/**
 * Os 5 minigames de reparo da blindagem (todos feitos do LADO DE FORA da base). Para o servidor
 * os cinco são iguais: 1 preparo + 4 passos. O que muda é a mecânica que o jogador usa.
 */
export interface RepairGameProps {
  /** o preparo (primeiro passo) já foi feito */
  prepared: boolean;
  /** passos principais já feitos (0 a 4) */
  progress: number;
  /** a rachadura está reservada para este jogador */
  ready: boolean;
  onPrep: () => void;
  onStep: () => void;
  /** estrago da rachadura (5 a 40): quanto maior, mais difícil */
  damage?: number;
}

export const REPAIR_STEPS = 4;

export interface RepairMeta {
  icon: string;
  title: [string, string];
  /** o que fazer, em uma frase curta */
  how: [string, string];
  /** “Você sabia?”: algo real sobre o assunto */
  fact: [string, string];
}

export const REPAIR_META: RepairMeta[] = [
  {
    icon: '🔩',
    title: ['Chapa e parafusos', 'Plate and bolts'],
    how: ['Encaixe a chapa na rachadura e aperte os 4 parafusos: segure cada um por 1 segundo.', 'Fit the plate over the crack and tighten the 4 bolts: hold each one for 1 second.'],
    fact: ['A Estação Espacial é feita de módulos presos por parafusos e travas. Os astronautas consertam peças em caminhadas espaciais.', 'The Space Station is made of modules held together with bolts and latches. Astronauts fix parts on spacewalks.'],
  },
  {
    icon: '🔥',
    title: ['Solda', 'Welding'],
    how: ['Acenda o maçarico. Segure em cada ponto brilhante e solte quando o medidor estiver no VERDE.', 'Light the torch. Hold each glowing spot and let go when the gauge is in the GREEN.'],
    fact: ['A primeira solda no espaço foi feita em 1969, na nave russa Soyuz 6. No vácuo não há ar para atrapalhar!', 'The first welding in space was done in 1969, aboard the Russian Soyuz 6. In a vacuum there is no air to get in the way!'],
  },
  {
    icon: '🧴',
    title: ['Selante', 'Sealant'],
    how: ['Misture o selante. Depois toque no buraco que está soltando ar (💨) antes que ele mude de lugar.', 'Mix the sealant. Then tap the hole that is leaking air (💨) before it moves.'],
    fact: ['Em 2018 um furinho de 2 mm na nave Soyuz foi tapado pelos astronautas com uma cola especial (epóxi).', 'In 2018 a 2 mm hole in the Soyuz spacecraft was plugged by the astronauts with a special glue (epoxy).'],
  },
  {
    icon: '🔌',
    title: ['Fios coloridos', 'Colored wires'],
    how: ['Abra o painel. Toque num fio e depois na tomada da MESMA cor para ligar os 4 fios.', 'Open the panel. Tap a wire and then the socket of the SAME color to connect all 4 wires.'],
    fact: ['Os cabos da Estação têm cores e etiquetas para ninguém errar. A eletricidade só anda por um caminho fechado: o circuito.', 'Cables on the Station are color-coded and labeled so nobody makes a mistake. Electricity only flows around a closed path: the circuit.'],
  },
  {
    icon: '🌡️',
    title: ['Aquecedores', 'Heaters'],
    how: ['Ligue o aquecedor. Olhe a sequência das placas coloridas e repita na mesma ordem. Cada rodada é maior!', 'Turn on the heater. Watch the sequence of colored plates and repeat it in the same order. Each round is longer!'],
    fact: ['À noite Marte esfria até cerca de −125 °C. Aquecedores mantêm os equipamentos funcionando, como no rover Perseverance.', 'At night Mars cools to about −125 °C. Heaters keep equipment working, like on the Perseverance rover.'],
  },
];

const PREP_LABEL: Array<[string, string]> = [
  ['Encaixar a chapa de aço', 'Fit the steel plate'],
  ['🔥 Acender o maçarico', '🔥 Light the torch'],
  ['🧴 Misturar o selante', '🧴 Mix the sealant'],
  ['🔌 Abrir o painel de fios', '🔌 Open the wire panel'],
  ['🌡️ Ligar o aquecedor', '🌡️ Turn on the heater'],
];

function Prep({ kind, ready, onPrep }: { kind: number; ready: boolean; onPrep: () => void }) {
  const label = PREP_LABEL[kind]!;
  return (
    <div className="rg-prep">
      <span className="rg-prep__icon" aria-hidden="true">{REPAIR_META[kind]!.icon}</span>
      <button type="button" className="rg-btn rg-btn--go" disabled={!ready} onClick={onPrep}>
        {L(label[0], label[1])}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- 1) chapa e parafusos
function PatchGame({ prepared, progress, ready, onPrep, onStep }: RepairGameProps) {
  const [hold, setHold] = useState<number | null>(null);
  const [turn, setTurn] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const finished = useRef(false);

  useEffect(() => {
    if (hold === null) return;
    finished.current = false;
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / 1000);
      setTurn(p);
      if (p < 1) frame = requestAnimationFrame(tick);
      else if (!finished.current) {
        finished.current = true;
        setDone((d) => (d.includes(hold) ? d : [...d, hold]));
        setHold(null);
        onStep();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hold, onStep]);

  if (!prepared) return <Prep kind={0} ready={ready} onPrep={onPrep} />;
  const marked = (n: number) => done.includes(n) || (done.length === 0 && n < progress);
  return (
    <div className="rg-plate" role="group" aria-label={L('Chapa de aço com 4 parafusos', 'Steel plate with 4 bolts')}>
      {[0, 1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          className={`rg-screw rg-screw--${n} ${marked(n) ? 'is-done' : ''}`}
          style={{ transform: `rotate(${hold === n ? turn * 720 : 0}deg)` }}
          disabled={!ready || marked(n)}
          aria-label={L(`Parafuso ${n + 1}: segure um segundo`, `Bolt ${n + 1}: hold for a second`)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setHold(n);
            setTurn(0);
          }}
          onPointerUp={() => setHold(null)}
          onPointerCancel={() => setHold(null)}
          onLostPointerCapture={() => setHold(null)}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              setHold(n);
              setTurn(0);
            }
          }}
          onKeyUp={() => setHold(null)}
        >
          ✚
        </button>
      ))}
      {hold !== null && <progress className="rg-progress" value={turn} max={1} />}
    </div>
  );
}

// ---------------------------------------------------------------- 2) solda
const WELD_SPOTS: Array<[number, number]> = [
  [14, 22],
  [38, 62],
  [62, 28],
  [86, 70],
];
/** janela verde da solda: estreita com o estrago e alarga no modo fácil */
const greenFor = (damage: number, easy: boolean): [number, number] => {
  const half = Math.max(0.08, 0.15 - damage / 400) + (easy ? 0.07 : 0);
  return [0.7 - half, 0.7 + half];
};
const HEAT_SECONDS = 1.9;

function WeldGame({ prepared, progress, ready, onPrep, onStep, damage = 15 }: RepairGameProps) {
  const easy = useEasyMode((s) => s.easy);
  const GREEN = greenFor(damage, easy);
  const [heat, setHeat] = useState(0);
  const [holding, setHolding] = useState(false);
  const [msg, setMsg] = useState('');
  const heatRef = useRef(0);

  useEffect(() => {
    if (!holding) return;
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const h = Math.min(1, (performance.now() - start) / (HEAT_SECONDS * 1000));
      heatRef.current = h;
      setHeat(h);
      if (h < 1) frame = requestAnimationFrame(tick);
      else {
        setHolding(false);
        setMsg(L('Esquentou demais! Tente de novo.', 'Too hot! Try again.'));
        window.setTimeout(() => setHeat(0), 500);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [holding]);

  const release = () => {
    if (!holding) return;
    setHolding(false);
    const h = heatRef.current;
    if (h >= GREEN[0] && h <= GREEN[1]) {
      setMsg('');
      chime([660, 880], 0.08);
      onStep();
      setHeat(0);
    } else {
      setMsg(h < GREEN[0] ? L('Soltou cedo: o metal não derreteu.', 'Released too early: the metal did not melt.') : L('Passou do ponto!', 'Too long!'));
      setHeat(0);
    }
  };

  if (!prepared) return <Prep kind={1} ready={ready} onPrep={onPrep} />;
  const active = Math.min(progress, REPAIR_STEPS - 1);
  return (
    <div className="rg-weld">
      <div className="rg-seam" role="group" aria-label={L('Linha da rachadura', 'Crack line')}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={WELD_SPOTS.map((p) => p.join(',')).join(' ')} />
        </svg>
        {WELD_SPOTS.map(([x, y], i) => (
          <button
            key={`${x}-${y}`}
            type="button"
            className={`rg-spot ${i < progress ? 'is-done' : i === active ? 'is-active' : ''} ${holding && i === active ? 'is-hot' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            disabled={!ready || i !== active || progress >= REPAIR_STEPS}
            aria-label={L(`Ponto de solda ${i + 1}`, `Weld spot ${i + 1}`)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              heatRef.current = 0;
              setMsg('');
              setHolding(true);
            }}
            onPointerUp={release}
            onPointerCancel={() => setHolding(false)}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                heatRef.current = 0;
                setHolding(true);
              }
            }}
            onKeyUp={release}
          >
            {i < progress ? '✓' : '🔥'}
          </button>
        ))}
      </div>
      <div className="rg-gauge" aria-label={L('Medidor de calor', 'Heat gauge')}>
        <i className="rg-gauge__ok" style={{ left: `${GREEN[0] * 100}%`, width: `${(GREEN[1] - GREEN[0]) * 100}%` }} />
        <b style={{ width: `${heat * 100}%` }} />
      </div>
      <p className="rg-msg" role="status">{msg}</p>
    </div>
  );
}

// ---------------------------------------------------------------- 3) selante
const HOLES = [0, 1, 2, 3, 4, 5];

function SealGame({ prepared, progress, ready, onPrep, onStep, damage = 15 }: RepairGameProps) {
  const easy = useEasyMode((s) => s.easy);
  const leakMs = Math.max(1300, 3000 - damage * 30) + (easy ? 900 : 0);
  const [leak, setLeak] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);

  // o vazamento muda de buraco se ninguém tapar a tempo
  useEffect(() => {
    if (!prepared || progress >= REPAIR_STEPS) return;
    const id = window.setTimeout(() => {
      setLeak((cur) => {
        const options = HOLES.filter((h) => h !== cur);
        return options[Math.floor(Math.random() * options.length)]!;
      });
    }, leakMs);
    return () => window.clearTimeout(id);
  }, [prepared, progress, leak, leakMs]);

  if (!prepared) return <Prep kind={2} ready={ready} onPrep={onPrep} />;
  const tap = (h: number) => {
    if (!ready || progress >= REPAIR_STEPS) return;
    if (h === leak) {
      chime([740], 0);
      onStep();
      setLeak((cur) => HOLES.filter((x) => x !== cur)[Math.floor(Math.random() * 5)]!);
    } else {
      setWrong(h);
      chime([180], 0, 'sawtooth', 0.04);
      window.setTimeout(() => setWrong(null), 350);
    }
  };
  return (
    <div className="rg-seal" role="group" aria-label={L('Buracos da parede', 'Holes in the wall')}>
      {HOLES.map((h) => (
        <button
          key={h}
          type="button"
          className={`rg-hole ${h === leak && progress < REPAIR_STEPS ? 'is-leaking' : ''} ${wrong === h ? 'is-wrong' : ''}`}
          disabled={!ready}
          onClick={() => tap(h)}
          aria-label={h === leak ? L('Buraco soltando ar', 'Hole leaking air') : L('Buraco', 'Hole')}
        >
          {h === leak && progress < REPAIR_STEPS ? '💨' : ''}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 4) fios
const WIRES = [
  { id: 'red', pt: 'vermelho', en: 'red', color: '#ff5a4d', mark: '●' },
  { id: 'blue', pt: 'azul', en: 'blue', color: '#4da3ff', mark: '▲' },
  { id: 'green', pt: 'verde', en: 'green', color: '#58d68d', mark: '■' },
  { id: 'yellow', pt: 'amarelo', en: 'yellow', color: '#ffd34d', mark: '◆' },
];

function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function WiresGame({ prepared, progress, ready, onPrep, onStep }: RepairGameProps) {
  const [left] = useState(() => shuffled(WIRES));
  const [right] = useState(() => shuffled(WIRES));
  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);

  if (!prepared) return <Prep kind={3} ready={ready} onPrep={onPrep} />;
  const linked = (id: string) => matched.includes(id) || matched.length < progress;
  const tapSocket = (id: string) => {
    if (!picked || !ready || matched.includes(id)) return;
    if (picked === id) {
      setMatched((m) => [...m, id]);
      setPicked(null);
      onStep();
    } else {
      setWrong(id);
      setPicked(null);
      window.setTimeout(() => setWrong(null), 400);
    }
  };
  return (
    <div className="rg-wires" role="group" aria-label={L('Fios e tomadas', 'Wires and sockets')}>
      <div className="rg-wires__col">
        {left.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`rg-wire ${picked === w.id ? 'is-picked' : ''} ${matched.includes(w.id) ? 'is-linked' : ''}`}
            style={{ background: w.color }}
            disabled={!ready || matched.includes(w.id)}
            onClick={() => setPicked(w.id)}
            aria-label={`${L('Fio', 'Wire')} ${L(w.pt, w.en)}`}
            aria-pressed={picked === w.id}
          >
            {w.mark} {L(w.pt, w.en)}
          </button>
        ))}
      </div>
      <div className="rg-wires__col">
        {right.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`rg-socket ${wrong === w.id ? 'is-wrong' : ''} ${matched.includes(w.id) ? 'is-linked' : ''}`}
            style={{ borderColor: w.color, color: w.color }}
            disabled={!ready || linked(w.id) || !picked}
            onClick={() => tapSocket(w.id)}
            aria-label={`${L('Tomada', 'Socket')} ${L(w.pt, w.en)}`}
          >
            {w.mark} {matched.includes(w.id) ? '⚡' : '○'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 5) aquecedores (sequência)
const PLATES = [
  { color: '#ff5a4d', mark: '●' },
  { color: '#4da3ff', mark: '▲' },
  { color: '#58d68d', mark: '■' },
  { color: '#ffd34d', mark: '◆' },
];

function HeatGame({ prepared, progress, ready, onPrep, onStep }: RepairGameProps) {
  const [sequence] = useState(() => Array.from({ length: REPAIR_STEPS }, () => Math.floor(Math.random() * 4)));
  const [phase, setPhase] = useState<'watch' | 'repeat'>('watch');
  const [lit, setLit] = useState<number | null>(null);
  const [typed, setTyped] = useState(0);
  const [round, setRound] = useState(0);
  const [msg, setMsg] = useState('');
  const length = Math.min(REPAIR_STEPS, progress + 1);

  // mostra a sequência desta rodada
  // biome-ignore lint/correctness/useExhaustiveDependencies: `round` reinicia a exibição
  useEffect(() => {
    if (!prepared || progress >= REPAIR_STEPS) return;
    setPhase('watch');
    setTyped(0);
    const timers: number[] = [];
    sequence.slice(0, length).forEach((p, i) => {
      timers.push(window.setTimeout(() => setLit(p), 700 + i * 800));
      timers.push(window.setTimeout(() => setLit(null), 700 + i * 800 + 520));
    });
    timers.push(window.setTimeout(() => setPhase('repeat'), 700 + length * 800));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [prepared, progress, length, sequence, round]);

  if (!prepared) return <Prep kind={4} ready={ready} onPrep={onPrep} />;
  const press = (p: number) => {
    if (!ready || phase !== 'repeat' || progress >= REPAIR_STEPS || typed >= length) return;
    setLit(p);
    window.setTimeout(() => setLit(null), 220);
    if (sequence[typed] !== p) {
      chime([180], 0, 'sawtooth', 0.04);
      setMsg(L('Ops! Olhe a sequência de novo.', 'Oops! Watch the sequence again.'));
      setRound((r) => r + 1);
      return;
    }
    setMsg('');
    const next = typed + 1;
    setTyped(next);
    if (next === length) onStep();
    chime([300 + p * 120], 0);
  };
  return (
    <div className="rg-heat">
      <p className="rg-msg" role="status">
        {phase === 'watch' ? L('👀 Olhe…', '👀 Watch…') : L('👆 Sua vez!', '👆 Your turn!')} {msg}
      </p>
      <div className="rg-plates" role="group" aria-label={L('Placas de aquecimento', 'Heating plates')}>
        {PLATES.map((p, i) => (
          <button
            key={p.color}
            type="button"
            className={`rg-heatplate ${lit === i ? 'is-lit' : ''}`}
            style={{ '--c': p.color } as CSSProperties}
            disabled={!ready || phase !== 'repeat'}
            onClick={() => press(i)}
            aria-label={L(`Placa ${i + 1}`, `Plate ${i + 1}`)}
          >
            {p.mark}
          </button>
        ))}
      </div>
    </div>
  );
}

const GAMES = [PatchGame, WeldGame, SealGame, WiresGame, HeatGame];

export function RepairGame({ kind, ...props }: RepairGameProps & { kind: number }) {
  const Game = GAMES[kind] ?? PatchGame;
  return <Game {...props} />;
}
