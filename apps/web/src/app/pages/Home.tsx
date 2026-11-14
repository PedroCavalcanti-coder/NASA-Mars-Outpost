import { ArrowRight, LogIn, LogOut, Settings, Users } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router';
import { LaunchScene } from '../../game/LaunchScene';
import {
  expeditionSnapshot,
  peekExpedition,
  retainExpedition,
  subscribeExpedition,
} from '../../game/runtime/expedition';
import { useGameSettings } from '../../lib/gameSettings';
import { getGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';
import { SuitModal } from '../components/astronaut/SuitModal';
import { CookieConsent } from '../components/CookieConsent';
import { JoinWorldModal } from '../components/JoinWorldModal';
import { SettingsModal } from '../components/SettingsModal';
import './home.css';

export default function Home({ arrivalOnly = false }: { arrivalOnly?: boolean }) {
  useSyncExternalStore(subscribeExpedition, expeditionSnapshot);
  const session = peekExpedition();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();
  const canvas = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLButtonElement>(null);
  const copy = useRef<HTMLElement>(null);
  const launchAudio = useRef<HTMLAudioElement>(null);
  const spaceAudio = useRef<HTMLAudioElement>(null);
  const parachuteAudio = useRef<HTMLAudioElement>(null);
  const fallingAudio = useRef<HTMLAudioElement>(null);
  const airAudio = useRef<HTMLAudioElement>(null);
  const landingVolume = useRef(0.8 * 0.85);
  const fallingGain = useRef(1);
  const scene = useRef<LaunchScene | null>(null);
  const started = useRef(false);

  const [phase, setPhase] = useState<'ready' | 'ignition' | 'flight' | 'complete'>('ready');
  const [fallback, setFallback] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  const [suitModalOpen, setSuitModalOpen] = useState(false);
  // Modal para entrar em um mundo compartilhado (o destino vale depois da viagem e da suit)
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [destinationUrl, setDestinationUrl] = useState('/jogar');

  // Menu de Configurações com sub-painéis
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Configurações salvas no navegador (as mesmas do jogo; baixo por padrão em celular)
  const video = useGameSettings((s) => s.video);
  const setVideo = useGameSettings((s) => s.setVideo);
  const audio = useGameSettings((s) => s.audio);
  const setAudio = useGameSettings((s) => s.setAudio);
  const gameplay = useGameSettings((s) => s.gameplay);
  const setGameplay = useGameSettings((s) => s.setGameplay);
  const outline = useGameSettings((s) => s.outline);
  const setOutline = useGameSettings((s) => s.setOutline);

  useEffect(() => {
    if (!canvas.current || !target.current) return;
    let fadeTimer: ReturnType<typeof setInterval> | undefined;
    const cancelFallingFade = () => {
      clearInterval(fadeTimer);
      fadeTimer = undefined;
    };
    let emittedFlightPhase: string | null = null;
    let releaseSession: (() => void) | undefined;
    try {
      const lease = retainExpedition();
      releaseSession = lease.release;
      if (!arrivalOnly && lease.session.entered) lease.session.restart();
      scene.current = new LaunchScene(
        lease.session.runtime,
        canvas.current,
        target.current,
        (p) => {
          canvas.current?.parentElement?.style.setProperty('--flight-p', String(p));
          const next = p > 0.14 ? 'flight' : 'ignition';
          if (next !== emittedFlightPhase) {
            emittedFlightPhase = next;
            setPhase(next);
          }
        },
        () => {
          launchAudio.current?.pause();
          spaceAudio.current?.pause();
          parachuteAudio.current?.pause();
          cancelFallingFade();
          fallingAudio.current?.pause();
          airAudio.current?.pause();
          setPhase('complete');
        },
        copy.current,
        (active) => {
          if (active) {
            launchAudio.current?.pause();
            void spaceAudio.current?.play().catch(() => {});
          } else {
            spaceAudio.current?.pause();
          }
        },
        (event) => {
          if (event === 'decompression') {
            if (!airAudio.current) airAudio.current = new Audio('/assets/audio/air.mp3');
            airAudio.current.volume = landingVolume.current;
            airAudio.current.currentTime = 0;
            void airAudio.current.play().catch(() => {});
            return;
          }
          if (event === 'touchdown') {
            cancelFallingFade();
            fallingAudio.current?.pause();
            return;
          }
          if (event === 'falling') {
            cancelFallingFade();
            fallingGain.current = 1;
          } else {
            cancelFallingFade();
            const fadeStarted = Date.now();
            fadeTimer = setInterval(() => {
              const progress = Math.min(1, (Date.now() - fadeStarted) / 1000);
              fallingGain.current = 1 - progress * 0.8;
              if (fallingAudio.current) {
                fallingAudio.current.volume = landingVolume.current * fallingGain.current;
              }
              if (progress === 1) cancelFallingFade();
            }, 25);
          }
          const ref = event === 'falling' ? fallingAudio : parachuteAudio;
          if (!ref.current)
            ref.current = new Audio(
              event === 'parachute'
                ? '/assets/audio/parachute-open.mp3'
                : '/assets/audio/falling.mp3',
            );
          ref.current.volume = landingVolume.current;
          ref.current.currentTime = 0;
          ref.current.loop = event === 'falling';
          void ref.current.play().catch(() => {});
        },
      );
      if (arrivalOnly) {
        started.current = true;
        setPhase('flight');
        scene.current.startArrival();
      }
    } catch {
      canvas.current.replaceChildren();
      setFallback(true);
      if (!releaseSession) {
        setInitializationError('Não foi possível iniciar o modo 3D neste dispositivo.');
      } else if (arrivalOnly) {
        setPhase('complete');
      }
    }
    return () => {
      cancelFallingFade();
      launchAudio.current?.pause();
      spaceAudio.current?.pause();
      parachuteAudio.current?.pause();
      fallingAudio.current?.pause();
      airAudio.current?.pause();
      scene.current?.dispose();
      scene.current = null;
      releaseSession?.();
    };
  }, [arrivalOnly]);

  useEffect(() => {
    if (phase !== 'complete' || !session?.ready) return;
    if (arrivalOnly && (user?.name || getGuestName())) {
      session.enter();
      nav('/jogar', { replace: true });
    } else setSuitModalOpen(true);
  }, [phase, session, session?.ready, arrivalOnly, nav, user?.name]);

  useEffect(() => {
    if (session) session.runtime.paused = suitModalOpen;
    return () => {
      if (session) session.runtime.paused = false;
    };
  }, [session, suitModalOpen]);

  useEffect(() => {
    scene.current?.setReducedMotion(video.reducedMotion);
  }, [video.reducedMotion]);

  useEffect(() => {
    scene.current?.setQuality(video.quality);
    scene.current?.setAntialiasing(video.antialiasing);
    scene.current?.setPostProcessing(video.postProcessing);
    peekExpedition()?.refreshGraphics();
  }, [video.quality, video.antialiasing, video.postProcessing]);

  useEffect(() => {
    landingVolume.current = audio.muted ? 0 : (audio.masterVolume / 100) * (audio.sfxVolume / 100);
    if (airAudio.current) airAudio.current.volume = landingVolume.current;
    if (fallingAudio.current)
      fallingAudio.current.volume = landingVolume.current * fallingGain.current;
    if (launchAudio.current) {
      launchAudio.current.volume = audio.muted
        ? 0
        : 0.65 * (audio.masterVolume / 100) * (audio.sfxVolume / 100);
    }
    if (spaceAudio.current) {
      spaceAudio.current.volume = audio.muted
        ? 0
        : (audio.masterVolume / 100) * (audio.sfxVolume / 100);
    }
    if (parachuteAudio.current) {
      parachuteAudio.current.volume = audio.muted
        ? 0
        : (audio.masterVolume / 100) * (audio.sfxVolume / 100);
    }
  }, [audio]);

  const launch = () => {
    if (started.current || initializationError) return;
    if (fallback) {
      started.current = true;
      setPhase('complete');
      return;
    }
    if (!scene.current) return;
    started.current = true;
    spaceAudio.current = new Audio('/assets/audio/foguete2.mp3');
    spaceAudio.current.volume = audio.muted
      ? 0
      : (audio.masterVolume / 100) * (audio.sfxVolume / 100);
    parachuteAudio.current = new Audio('/assets/audio/parachute-open.mp3');
    parachuteAudio.current.volume = audio.muted
      ? 0
      : (audio.masterVolume / 100) * (audio.sfxVolume / 100);
    launchAudio.current = new Audio('/assets/audio/foguete.mp3');
    launchAudio.current.volume = audio.muted
      ? 0
      : 0.65 * (audio.masterVolume / 100) * (audio.sfxVolume / 100);
    void launchAudio.current.play().catch(() => {});
    setPhase('ignition');
    scene.current.launch();
  };

  const handleSuitLaunch = () => {
    if (!session?.ready) return;
    session.enter();
    nav(destinationUrl);
  };

  // Entrar em um mundo: mesma viagem do "Jogar agora", mas o destino é a sala informada
  const handleJoinWorld = (roomCode: string) => {
    setDestinationUrl(`/jogar?sala=${encodeURIComponent(roomCode)}`);
    launch();
  };

  const launching = phase !== 'ready';

  return (
    <main
      className={`launch-home ${launching ? 'is-launching' : ''}`}
      data-phase={phase}
      data-reduced-motion={video.reducedMotion}
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
            aria-label="Entrar em um mundo compartilhado"
            onClick={() => setJoinModalOpen(true)}
            title="Conectar a uma sala marciana com código de convite"
          >
            <Users size={20} aria-hidden="true" />
            <span>Entrar em um Mundo</span>
          </button>

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

      <section
        ref={copy}
        className="launch-copy"
        aria-label="Sua expedição começa aqui"
        inert={launching}
      >
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

        <div className="launch-cta-row">
          <button
            className="launch-cta"
            type="button"
            aria-label="Jogar agora"
            onClick={() => {
              setDestinationUrl('/jogar');
              launch();
            }}
            disabled={launching || Boolean(initializationError)}
          >
            <span className="launch-cta-icon" aria-hidden="true">
              <ArrowRight />
            </span>
            <span className="launch-cta-label">
              Jogar Agora<small>Sua missão começa aqui!</small>
            </span>
          </button>

          <button
            className="launch-join-cta"
            type="button"
            onClick={() => setJoinModalOpen(true)}
            disabled={launching || Boolean(initializationError)}
            title="Conectar à base de um amigo usando o código da sala"
          >
            <span className="launch-join-cta-icon" aria-hidden="true">
              <Users size={22} />
            </span>
            <span className="launch-join-cta-label">
              Entrar em um Mundo<small>Conectar com código da sala</small>
            </span>
          </button>
        </div>
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
            <div className="launch-flight-actions">
              <button
                type="button"
                className="launch-skip-button"
                disabled={phase === 'complete' && !session?.ready}
                onClick={() => {
                  if (phase === 'complete') {
                    if (session?.ready) setSuitModalOpen(true);
                  } else scene.current?.skip();
                }}
              >
                {phase === 'complete' ? 'Personalizar astronauta' : 'Pular animação →'}
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
          <Link to="/previa/painel-solar">Prévia: painel solar</Link>
          <Link to="/previa/filtro-oxigenio">Prévia: oxigênio</Link>
          <Link to="/previa/estufa">Prévia: estufa</Link>
          <Link to="/previa/rover">Prévia: rover</Link>
          <Link to="/centro">Centro</Link>
          <Link to="/suporte">Suporte</Link>
          <Link to="/sobre">Sobre</Link>
        </nav>
      </footer>

      {/* Popup de Personalização do Astronauta e Apelido */}
      {session?.ready && (
        <SuitModal
          open={suitModalOpen}
          onClose={() => setSuitModalOpen(false)}
          onLaunch={handleSuitLaunch}
        />
      )}

      {initializationError && (
        <div className="expedition-error" role="alert">
          <p>{initializationError}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!initializationError && session?.error && (
        <div className="expedition-error" role="alert">
          <p>{session.error}</p>
          <button type="button" onClick={() => void session.prepare()}>
            Tentar novamente
          </button>
          <button type="button" onClick={() => window.location.assign('/')}>
            Voltar ao início
          </button>
        </div>
      )}

      <CookieConsent />

      {/* Modal para Entrar em um Mundo com Código da Sala */}
      <JoinWorldModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onJoin={handleJoinWorld}
      />

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
        outline={outline}
        onOutlineChange={setOutline}
      />
    </main>
  );
}
