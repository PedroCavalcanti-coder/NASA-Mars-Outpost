import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePreviewClose } from '../usePreviewClose';
import '../missions/missions.css';
import { L } from '../../../lib/i18n';

const GOAL_SCOOPS = 4;

interface Scoop {
  id: number;
  icy: boolean;
  label: string;
}

const ICY = [L('Solo com cristais brancos', 'Soil with white crystals'), L('Solo escuro e úmido', 'Dark, damp soil'), L('Solo com gelo azulado', 'Soil with bluish ice')];
const DRY = [L('Areia vermelha seca', 'Dry red sand'), L('Poeira fina', 'Fine dust'), L('Pedrinhas soltas', 'Loose pebbles')];

function deal(seed: number): Scoop[] {
  // 6 pás: 3 com gelo e 3 secas, em ordem embaralhada
  const list = [
    ...ICY.map((label, i) => ({ id: seed * 10 + i, icy: true, label })),
    ...DRY.map((label, i) => ({ id: seed * 10 + 3 + i, icy: false, label })),
  ];
  return list.sort(() => Math.random() - 0.5);
}

/**
 * Água de Marte: escolha as pás de solo que têm gelo (as secas não rendem água), aqueça no forno
 * e veja o vapor virar gotas no condensador. Cada pá certa enche um pouco o tanque.
 */
export default function WaterGame({
  onClose,
  onComplete,
}: {
  onClose?: () => void;
  onComplete?: (r: { quality: number }) => void;
}) {
  const { close, closeButton } = usePreviewClose(onClose);
  const [round, setRound] = useState(0);
  const scoops = useMemo(() => deal(round), [round]);
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [water, setWater] = useState(0);
  const [heating, setHeating] = useState(false);
  const reported = useRef(false);
  const done = water >= GOAL_SCOOPS;

  // forno: depois de escolher, o gelo vira vapor e o vapor vira gota no condensador
  useEffect(() => {
    if (!heating) return;
    const id = window.setTimeout(() => {
      setWater((w) => w + 1);
      setHeating(false);
      setPicked([]);
      setRound((r) => r + 1);
    }, 1400);
    return () => window.clearTimeout(id);
  }, [heating]);

  const choose = (s: Scoop) => {
    if (heating || done || picked.includes(s.id)) return;
    if (!s.icy) {
      setWrong(s.id);
      setMistakes((m) => m + 1);
      window.setTimeout(() => setWrong(null), 400);
      return;
    }
    setPicked([s.id]);
    setHeating(true);
  };

  return (
    <main className="msn-mg" aria-label={L('Extração de água', 'Water extraction')}>
      <div className="msn-mg__bg" aria-hidden="true" />
      <section className="msn-mg__card">
        <div className="msn-mg__head">
          <div>
            <h2>{L('💧 Água do subsolo de Marte', '💧 Underground water on Mars')}</h2>
            <p>{L('Escolha a pá de solo que tem gelo. O forno derrete o gelo e o vapor vira água.', 'Pick the scoop of soil that has ice. The oven melts the ice and the vapor turns into water.')}</p>
          </div>
          <button ref={closeButton} type="button" className="msn-mg__close" onClick={close} aria-label={L('Fechar', 'Close')}>
            <X size={18} />
          </button>
        </div>

        <div className="sci-row">
          <span>{heating ? L('♨️ Aquecendo… o vapor está subindo', '♨️ Heating… the vapor is rising') : L('Qual pá tem gelo?', 'Which scoop has ice?')}</span>
          <span>
            {L('Tanque:', 'Tank:')} <b>{water}</b>/{GOAL_SCOOPS}
          </span>
        </div>
        <div className="sci-meter" aria-hidden="true">
          <i style={{ width: `${(water / GOAL_SCOOPS) * 100}%` }} />
        </div>

        {done ? (
          <div className="msn-mg__result">
            <strong>{L('Tanque cheio! A tripulação tem água limpa.', 'Tank full! The crew has clean water.')}</strong>
            <span>{L('Essa água serve para beber, regar a horta e até virar oxigênio.', 'This water is for drinking, watering the garden and even making oxygen.')}</span>
            <button
              type="button"
              className="msn-mg__btn"
              onClick={() => {
                if (reported.current) return;
                reported.current = true;
                onComplete?.({ quality: Math.max(0.4, 1 - mistakes * 0.1) });
                close();
              }}
            >
              {L('Guardar água', 'Store water')}
            </button>
          </div>
        ) : (
          <div className="sci-grid">
            {scoops.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`sci-card ${picked.includes(s.id) ? 'is-on' : ''} ${wrong === s.id ? 'is-wrong' : ''}`}
                onClick={() => choose(s)}
                disabled={heating}
              >
                <span aria-hidden="true">{s.icy ? '🧊' : '🟫'}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        <p className="sci-fact">
          <b>{L('CIÊNCIA DE VERDADE', 'REAL SCIENCE')}</b>{L('Marte não tem rios, mas tem muito gelo escondido debaixo do chão.', 'Mars has no rivers, but it has lots of ice hidden under the ground.')}
          A sonda Mars Reconnaissance Orbiter achou camadas de gelo quase puro a poucos metros da
          superfície. Aquecendo o solo, o gelo vira vapor; esfriando o vapor, ele vira água de novo.
        </p>
      </section>
    </main>
  );
}
