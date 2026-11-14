import { Compass, Dices, Eye, EyeOff, LogOut, TriangleAlert } from 'lucide-react';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router';
import type { BaseViewer, BaseViewer as Viewer } from '../../game/BaseViewer';
import { type BaseId, type BaseInfo, loadBaseInfo, pickRandomBase } from '../../lib/bases';
import { getGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';
import '../../styles/game.css';
import {
  expeditionSnapshot,
  peekExpedition,
  retainExpedition,
  subscribeExpedition,
} from '../../game/runtime/expedition';
import Home from './Home';

/** Jogo (base marciana): sorteia uma das 8 bases e mostra em 3D interativo. */
export default function Game() {
  useSyncExternalStore(subscribeExpedition, expeditionSnapshot);
  const session = peekExpedition();
  if (!session?.entered || !session.ready) return <Home arrivalOnly />;
  return <ReadyGame />;
}

function ReadyGame() {
  const user = useAuth((s) => s.user);
  const guestName = getGuestName();
  const name = user?.name ?? guestName;
  const nav = useNavigate();
  const mount = useRef<HTMLDivElement>(null);
  const viewer = useRef<BaseViewer | null>(null);
  const [baseId, setBaseId] = useState<BaseId>(() => peekExpedition()?.id ?? pickRandomBase());
  const [info, setInfo] = useState<BaseInfo | null>(() => peekExpedition()?.info ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roofs, setRoofs] = useState(false);

  useLayoutEffect(() => {
    const el = mount.current;
    if (!el) return;
    const lease = retainExpedition();
    const session = lease.session;
    const releasePreview = setTimeout(() => {
      session.preview?.dispose();
      session.preview = null;
    }, 0);
    let alive = true;
    let replacement: Viewer | null = null;
    setLoading(true);
    setError(null);
    setRoofs(false);
    if (baseId === session.info?.id && session.viewer) {
      session.viewer.activate(el);
      viewer.current = session.viewer;
      setInfo(session.info);
      setLoading(false);
    } else {
      void loadBaseInfo(baseId)
        .then(async (info) => {
          const { BaseViewer: Viewer } = await import('../../game/BaseViewer');
          if (!alive) return;
          replacement = new Viewer(el, info, session.runtime, session.assets);
          await replacement.ready;
          if (!alive) return;
          const previous = session.viewer;
          session.viewer = replacement;
          session.info = info;
          try {
            sessionStorage.setItem('mo_base', info.id);
          } catch {
            /* Private browsing. */
          }
          replacement.activate(el);
          viewer.current = replacement;
          previous?.dispose();
          setInfo(info);
          setLoading(false);
        })
        .catch((e) => {
          if (!alive) return;
          replacement?.dispose();
          console.error(e);
          setError('Não foi possível preparar outra base.');
          setLoading(false);
        });
    }
    return () => {
      alive = false;
      clearTimeout(releasePreview);
      if (replacement && replacement !== session.viewer) replacement.dispose();
      lease.release();
    };
  }, [baseId]);

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
          <span>ASTRONAUTA {(name ?? 'Explorador').toUpperCase()}</span>
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
