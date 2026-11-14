import { Compass, Dices, Eye, EyeOff, LogOut, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import type { BaseViewer } from '../../game/BaseViewer';
import { type BaseId, type BaseInfo, loadBaseInfo, pickRandomBase } from '../../lib/bases';
import { getGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';
import '../../styles/game.css';

/** Jogo (base marciana): sorteia uma das 8 bases e mostra em 3D interativo. */
export default function Game() {
  const user = useAuth((s) => s.user);
  const guestName = getGuestName();
  const name = user?.name ?? guestName;
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
      <div className="game__vignette" />

      {/* Cabeçalho HUD Superior */}
      <header className="game__header">
        <div className="game__header-brands">
          <Link to="/" className="game__brand" aria-label="Mars Outpost — Início">
            <img
              className="game__brand-logo"
              src="/assets/branding/mars-outpost-logo.svg"
              alt=""
              width={46}
              height={46}
            />
            <img
              className="game__brand-wordmark"
              src="/assets/branding/mars-outpost-wordmark.svg"
              alt="Mars Outpost"
              width={160}
              height={70}
            />
          </Link>
          <span className="game__brand-divider" aria-hidden="true" />
          <div className="game__mission-status">
            <span className="game__status-dot" aria-hidden="true" />
            <span>SOL 1 · BASE MARCIANA ATIVA</span>
          </div>
        </div>

        <nav className="game__actions" aria-label="Ações da base">
          <button
            type="button"
            className="game__action-btn"
            onClick={() => setBaseId((cur) => pickRandomBase(cur))}
            disabled={loading}
            title="Sortear outra das 8 bases marcianas"
          >
            <Dices size={18} />
            <span>Sortear outra base</span>
          </button>

          <button
            type="button"
            className="game__action-btn"
            onClick={toggleRoofs}
            disabled={loading}
            title={roofs ? 'Ocultar telhados (visão de corte)' : 'Mostrar telhados'}
          >
            {roofs ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>{roofs ? 'Ocultar telhados' : 'Mostrar telhados'}</span>
          </button>

          <button
            type="button"
            className="game__action-btn game__action-btn--exit"
            onClick={() => nav('/')}
            title="Voltar ao início"
          >
            <LogOut size={18} />
            <span>Voltar à Terra</span>
          </button>
        </nav>
      </header>

      {/* Cartão de Informações da Base Marciana */}
      <aside className="game__card" aria-label="Informações da base">
        <div className="game__card-eyebrow">
          <Compass size={14} />
          <span>ASTRONAUTA {name.toUpperCase()}</span>
        </div>
        <h1 className="game__card-title">{info?.name ?? 'Sorteando a base…'}</h1>
        {info && <p className="game__card-desc">{info.description}</p>}
      </aside>

      {/* Dicas de Controle da Câmera */}
      {!loading && !error && (
        <div className="game__hint" role="note">
          <span>Arraste para girar</span>
          <span className="game__hint-dot">·</span>
          <span>Botão direito (ou 2 dedos) para mover</span>
          <span className="game__hint-dot">·</span>
          <span>Roda do mouse para aproximar</span>
        </div>
      )}

      {/* Tela de Carregamento 3D */}
      {loading && (
        <div className="game__loading" role="status" aria-live="polite">
          <div className="game__spinner">
            <div className="game__spinner-ring" />
            <img
              src="/assets/branding/mars-outpost-logo.svg"
              alt=""
              className="game__spinner-logo"
            />
          </div>
          <span className="game__loading-kicker">APROXIMAÇÃO ORBITAL</span>
          <h2 className="game__loading-title">Montando a base em Marte…</h2>
          <p className="game__loading-sub">Renderizando terreno, módulos 3D e estufas</p>
        </div>
      )}

      {/* Estado de Erro */}
      {error && (
        <div className="game__error-dialog">
          <div className="game__error-card" role="alert">
            <TriangleAlert size={28} className="game__error-icon" />
            <div>
              <h3>Falha no carregamento</h3>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="game__action-btn"
              onClick={() => setBaseId((cur) => pickRandomBase(cur))}
            >
              Tentar outra base
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
