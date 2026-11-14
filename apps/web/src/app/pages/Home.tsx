import { ArrowRight, LogIn, LogOut, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LaunchScene } from '../../game/LaunchScene';
import { useAuth } from '../../store/auth';
import { LoadingScreen } from '../components/LoadingScreen';
import {
  type AudioSettings,
  type GameplaySettings,
  SettingsModal,
  type VideoSettings,
} from '../components/SettingsModal';
import { SuitModal } from '../components/astronaut/SuitModal';
import './home.css';

export default function Home() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();
  const canvas = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLButtonElement>(null);
  const scene = useRef<LaunchScene | null>(null);
  const started = useRef(false);

  const [phase, setPhase] = useState<'ready' | 'ignition' | 'flight' | 'complete'>('ready');
  const [fallback, setFallback] = useState(false);
  const [progress, setProgress] = useState(0);

  // Efeito de tela branca ao se aproximar do fim do lançamento
  const [whiteout, setWhiteout] = useState(false);

  // Popup de apelido e personalização do astronauta
  const [suitModalOpen, setSuitModalOpen] = useState(false);
  const [astronautName, setAstronautName] = useState('');

  // Tela de Loading antes de entrar no jogo
  const [showLoading, setShowLoading] = useState(false);

  // Menu de Configurações com sub-painéis
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Detecção de tela pequena: baixo por padrão em mobile, médio em desktop
  const isSmallScreen =
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 || matchMedia('(pointer: coarse)').matches);

  const [video, setVideo] = useState<VideoSettings>({
    quality: isSmallScreen ? 'low' : 'medium',
    postProcessing: true,
    antialiasing: true,
    reducedMotion:
      typeof window !== 'undefined'
        ? matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
  });

  const [audio, setAudio] = useState<AudioSettings>({
    masterVolume: 80,
    sfxVolume: 85,
    musicVolume: 70,
    muted: false,
  });

  const [gameplay, setGameplay] = useState<GameplaySettings>({
    showHints: true,
    highContrast: false,
    cameraSensitivity: 1,
  });

  useEffect(() => {
    if (!canvas.current || !target.current) return;
    try {
      scene.current = new LaunchScene(
        canvas.current,
        target.current,
        (p) => {
          setProgress(p);
          setPhase(p > 0.14 ? 'flight' : 'ignition');

          // Quando chegar perto de terminar a animação (aprox 78%), a tela fica toda branca
          if (p >= 0.78) {
            setWhiteout(true);
          }
        },
        () => {
          setPhase('complete');
          // Ao completar a decolagem, abre o popup de apelido e personalização
          setSuitModalOpen(true);
          // Dissipa suavemente o flash branco revelando a personalização
          setTimeout(() => {
            setWhiteout(false);
          }, 350);
        },
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
    scene.current?.setReducedMotion(video.reducedMotion);
  }, [video.reducedMotion]);

  useEffect(() => {
    scene.current?.setQuality(video.quality);
  }, [video.quality]);

  useEffect(() => {
    scene.current?.setAntialiasing(video.antialiasing);
  }, [video.antialiasing]);

  useEffect(() => {
    scene.current?.setPostProcessing(video.postProcessing);
  }, [video.postProcessing]);

  const launch = () => {
    if (started.current) return;
    if (fallback) {
      setSuitModalOpen(true);
      return;
    }
    if (!scene.current) return;
    started.current = true;
    setPhase('ignition');
    scene.current.launch();
  };

  const handleSuitLaunch = (name: string) => {
    setAstronautName(name);
    setShowLoading(true);
  };

  const launching = phase !== 'ready';

  return (
    <main
      className={`launch-home ${launching ? 'is-launching' : ''}`}
      data-phase={phase}
      data-reduced-motion={video.reducedMotion}
    >
      {/* Efeito de flash/tela branca ao final do lançamento */}
      <div className={`launch-whiteout ${whiteout ? 'is-active' : ''}`} aria-hidden="true" />

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
            onClick={() => setSettingsOpen(true)}
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
        <button className="launch-cta" type="button" onClick={launch} disabled={launching}>
          <span className="launch-cta-icon" aria-hidden="true">
            <ArrowRight />
          </span>
          <span className="launch-cta-label">
            Jogar Agora<small>Sua missão começa aqui!</small>
          </span>
        </button>
      </section>

      {!fallback && (
        <button
          ref={target}
          type="button"
          className="rocket-hit-target"
          aria-label="Lançar foguete"
          title="Lançar foguete"
          onClick={launch}
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
                onClick={() => {
                  setWhiteout(false);
                  setSuitModalOpen(true);
                }}
              >
                Personalizar astronauta e aterrissar →
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
          <Link to="/centro">Centro</Link>
          <Link to="/suporte">Suporte</Link>
          <Link to="/sobre">Sobre</Link>
        </nav>
      </footer>

      {/* Popup de Personalização do Astronauta e Apelido */}
      <SuitModal
        open={suitModalOpen}
        onClose={() => setSuitModalOpen(false)}
        onLaunch={handleSuitLaunch}
      />

      {/* Tela de Loading que leva para o game */}
      {showLoading && (
        <LoadingScreen
          astronautName={astronautName}
          onComplete={() => nav('/jogar')}
        />
      )}

      {/* Menu de Configurações avançado com Sub-Painéis */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        video={video}
        onVideoChange={setVideo}
        audio={audio}
        onAudioChange={setAudio}
        gameplay={gameplay}
        onGameplayChange={setGameplay}
      />
    </main>
  );
}
