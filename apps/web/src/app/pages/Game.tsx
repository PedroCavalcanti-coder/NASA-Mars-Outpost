import { Dices, Eye, EyeOff, LogOut, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { BaseViewer } from '../../game/BaseViewer';
import { type BaseId, type BaseInfo, loadBaseInfo, pickRandomBase } from '../../lib/bases';
import { getGuestName } from '../../lib/guest';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Empty';
import '../../styles/game.css';

/** Jogo (por enquanto só a base): sorteia uma das 8 bases e mostra em 3D. Funciona sem conta. */
export default function Game() {
  const name = getGuestName();
  const nav = useNavigate();
  const mount = useRef<HTMLDivElement>(null);
  const viewer = useRef<BaseViewer | null>(null);
  const [baseId, setBaseId] = useState<BaseId>(() => pickRandomBase());
  const [info, setInfo] = useState<BaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roofs, setRoofs] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recria a cena a cada base sorteada
  useEffect(() => {
    const el = mount.current;
    if (!el || !name) return;
    let alive = true;
    let v: BaseViewer | null = null;
    setLoading(true);
    setError(null);
    setInfo(null);
    setRoofs(false);
    (async () => {
      try {
        const [meta, { BaseViewer }] = await Promise.all([
          loadBaseInfo(baseId),
          import('../../game/BaseViewer'), // o three.js só é baixado ao entrar no jogo
        ]);
        if (!alive) return;
        setInfo(meta);
        v = new BaseViewer(el, meta);
        viewer.current = v;
        await v.ready;
        if (alive) setLoading(false);
      } catch (e) {
        console.error(e);
        if (alive) {
          setError('Não foi possível carregar a base 3D neste dispositivo.');
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      v?.dispose();
      viewer.current = null;
    };
  }, [baseId, name]);

  if (!name) return <Navigate to="/" replace />;

  function toggleRoofs() {
    const next = !roofs;
    setRoofs(next);
    viewer.current?.setRoofs(next);
  }

  return (
    <main className="game">
      <div className="game__canvas" ref={mount} />

      <header className="game__hud">
        <div className="game__card">
          <span className="eyebrow">Astronauta {name}</span>
          <h1>{info?.name ?? 'Sorteando a base…'}</h1>
          {info && <p>{info.description}</p>}
        </div>
        <div className="game__actions">
          <Button
            size="sm"
            icon={<Dices />}
            onClick={() => setBaseId((cur) => pickRandomBase(cur))}
            disabled={loading}
          >
            Sortear outra base
          </Button>
          <Button
            size="sm"
            icon={roofs ? <EyeOff /> : <Eye />}
            onClick={toggleRoofs}
            disabled={loading}
          >
            {roofs ? 'Ocultar telhados' : 'Mostrar telhados'}
          </Button>
          <Button size="sm" variant="ghost" icon={<LogOut />} onClick={() => nav('/')}>
            Sair
          </Button>
        </div>
      </header>

      {!loading && !error && (
        <p className="game__hint">
          Arraste para girar · botão direito (ou dois dedos) para mover · roda para aproximar
        </p>
      )}
      {loading && (
        <div className="game__loading">
          <Spinner label="Carregando a base" />
          <p>Montando a base em Marte…</p>
        </div>
      )}
      {error && (
        <div className="game__loading">
          <div className="alert alert--error" role="alert">
            <TriangleAlert /> {error}
          </div>
          <Button onClick={() => setBaseId((cur) => pickRandomBase(cur))}>Tentar outra base</Button>
        </div>
      )}
    </main>
  );
}
