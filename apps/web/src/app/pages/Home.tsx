import { ArrowRight, LogIn, LogOut, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LaunchScene } from '../../game/LaunchScene';
import { getGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';
import { PlayModal } from './PlayModal';
import './home.css';

export default function Home() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();
  const canvas = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const scene = useRef<LaunchScene | null>(null);
  const started = useRef(false);
  const [phase, setPhase] = useState<'ready' | 'ignition' | 'flight' | 'complete'>('ready');
  const [fallback, setFallback] = useState(false);
  const [progress, setProgress] = useState(0);
  const [panel, setPanel] = useState<'settings' | 'about'>('settings');
  const [playModalOpen, setPlayModalOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [quality, setQuality] = useState<'standard' | 'low'>('standard');

  useEffect(() => {
    if (!canvas.current || !target.current) return;
    try {
      scene.current = new LaunchScene(
        canvas.current,
        target.current,
        (p) => {
          setProgress(p);
          setPhase(p > 0.14 ? 'flight' : 'ignition');
        },
        () => setPhase('complete'),
      );
    } catch {
      canvas.current.replaceChildren();
      setFallback(true);
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    scene.current?.setQuality(quality);
  }, [quality]);

  // Ao completar a decolagem, aterra automaticamente na base em Marte após breve transição
  useEffect(() => {
    if (phase === 'complete') {
      const timer = setTimeout(() => {
        nav('/jogar');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [phase, nav]);

  const launch = () => {
    if (started.current || !scene.current || fallback) return;
    started.current = true;
    setPhase('ignition');
    scene.current.launch();
  };

  const handlePlay = () => {
    if (phase !== 'ready') return;
    const currentName = user?.name ?? getGuestName();
    if (!currentName) {
      setPlayModalOpen(true);
      return;
    }
    if (fallback) {
      nav('/jogar');
      return;
    }
    launch();
  };

  const openPanel = (next: 'settings' | 'about') => {
    setPanel(next);
    dialog.current?.showModal();
  };

  const launching = phase !== 'ready';

  return (
    <main
      className={`launch-home ${launching ? 'is-launching' : ''}`}
      data-phase={phase}
      data-reduced-motion={reducedMotion}
    >
      <div className="launch-sky" aria-hidden="true">
        <div className="launch-moon">
          <span />
          <span />
          <span />
          <span />
        </div>
        <span className="launch-star launch-star--one">✦</span>
        <span className="launch-star launch-star--two">✦</span>
        <span className="launch-star launch-star--three">✦</span>
      </div>

      <div className="launch-canvas" ref={canvas} />
      <div className="launch-vignette" />

      <header className="launch-header">
        <div className="launch-brands">
          <Link to="/" className="launch-brand" aria-label="Mars Outpost, início">
            <img
              className="launch-brand-mark"
              src="/assets/branding/mars-outpost-logo.svg"
              alt=""
              width={72}
              height={72}
            />
            <img
              className="launch-brand-name"
              src="/assets/branding/mars-outpost-wordmark.svg"
              alt=""
              width={1012}
              height={440}
            />
          </Link>
          <span className="launch-brand-divider" aria-hidden="true" />
          <img
            className="launch-space-apps-logo"
            src="/assets/branding/space-apps-challenge.png"
            alt="NASA Space Apps Challenge"
            width={112}
            height={84}
          />
        </div>

        <nav className="launch-nav" aria-label="Navegação inicial">
          <button
            className="launch-nav-button"
            type="button"
            aria-label="Configurações"
            onClick={() => openPanel('settings')}
          >
            <Settings size={21} aria-hidden="true" />
            <span>Configurações</span>
          </button>
          {user ? (
            <button
              className="launch-nav-button"
              type="button"
              aria-label="Sair"
              onClick={() => void logout()}
            >
              <LogOut size={20} aria-hidden="true" />
              <span>Sair</span>
            </button>
          ) : (
            <Link className="launch-nav-button" to="/login" aria-label="Entrar">
              <LogIn size={20} aria-hidden="true" />
              <span>Entrar</span>
            </Link>
          )}
        </nav>
      </header>

      <section className="launch-copy" aria-label="Sua expedição começa aqui" inert={launching}>
        <div className="launch-eyebrow">
          BASE ESPACIAL ARES <span>·</span> TERRA <i />
        </div>
        <h1>
          <img
            className="launch-title-image"
            src="/assets/branding/mars-outpost-wordmark.svg"
            alt="Mars Outpost"
            width={1012}
            height={440}
          />
        </h1>
        <p>
          Construa e mantenha uma base em Marte
          <br className="launch-desktop-break" /> com um clima de exploração e descoberta.
        </p>
        {fallback ? (
          <button className="launch-cta" type="button" onClick={handlePlay}>
            <span className="launch-cta-icon" aria-hidden="true">
              <ArrowRight />
            </span>
            <span className="launch-cta-label">
              Jogar Agora<small>Entrar direto na base marciana</small>
            </span>
          </button>
        ) : (
          <button className="launch-cta" type="button" onClick={handlePlay} disabled={launching}>
            <span className="launch-cta-icon" aria-hidden="true">
              <ArrowRight />
            </span>
            <span className="launch-cta-label">
              Jogar Agora<small>Sua missão começa aqui!</small>
            </span>
          </button>
        )}
      </section>

      {!fallback && (
        <button
          ref={target}
          type="button"
          className="rocket-hit-target"
          aria-label="Lançar foguete"
          title="Lançar foguete"
          onClick={handlePlay}
          disabled={launching}
        />
      )}

      <div className="launch-flight-status" role="status" aria-live="polite">
        {launching && (
          <>
            <span className="launch-eyebrow">SUA MISSÃO COMEÇA AQUI</span>
            <strong>
              {phase === 'ignition'
                ? 'Ignição'
                : phase === 'complete'
                  ? 'Rumo a Marte'
                  : 'Decolando'}
            </strong>
            <div className="launch-flight-line">
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
            <div className="launch-flight-actions">
              <button
                type="button"
                className="launch-skip-button"
                onClick={() => nav('/jogar')}
              >
                Pular viagem e aterrissar na base →
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="launch-footer">
        <span className="launch-system-status">
          <i />
          {launching ? 'EXPEDIÇÃO EM VOO' : 'TODOS OS SISTEMAS PRONTOS'}
        </span>
        <nav className="launch-footer-nav" aria-label="Links do projeto">
          <Link to="/central">Centro</Link>
          <a
            href="https://github.com/PedroCavalcanti-coder/NASA-Mars-Outpost/issues"
            target="_blank"
            rel="noreferrer"
          >
            Suporte
          </a>
          <button type="button" onClick={() => openPanel('about')}>
            Sobre
          </button>
        </nav>
      </footer>

      {/* Modal de apelido/jogar */}
      <PlayModal
        open={playModalOpen}
        onClose={() => setPlayModalOpen(false)}
        onStart={launch}
      />

      <dialog className="launch-dialog" ref={dialog} aria-labelledby="launch-dialog-title">
        <div className="launch-dialog-head">
          <span className="launch-dialog-kicker">MARS OUTPOST</span>
          <button
            className="launch-dialog-close"
            type="button"
            aria-label="Fechar"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <h2 id="launch-dialog-title">{panel === 'settings' ? 'Configurações' : 'Nossa missão'}</h2>
        {panel === 'settings' ? (
          <div className="launch-preferences">
            <label className="launch-preference">
              <span>
                Reduzir movimentos<small>Uma decolagem mais suave, sem movimento de câmera.</small>
              </span>
              <input
                type="checkbox"
                checked={reducedMotion}
                disabled={launching}
                onChange={(e) => setReducedMotion(e.target.checked)}
              />
            </label>
            <label className="launch-preference">
              <span>
                Qualidade gráfica<small>Ajuste o cenário para o seu dispositivo.</small>
              </span>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as 'standard' | 'low')}
              >
                <option value="standard">Padrão</option>
                <option value="low">Econômica</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="launch-about">
            <p>
              Explore Marte, reúna sua tripulação e descubra a ciência por trás de uma base
              espacial.
            </p>
            <p>
              Mars Outpost é um projeto educativo criado para o NASA Space Apps Challenge de
              Fortaleza.
            </p>
            <small>Projeto independente, sem endosso ou parceria oficial da NASA.</small>
          </div>
        )}
      </dialog>
    </main>
  );
}
