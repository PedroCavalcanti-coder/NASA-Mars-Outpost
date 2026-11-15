import { ArrowRight, Globe, Settings, Users } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { LaunchScene } from '../../game/LaunchScene';
import {
  expeditionSnapshot,
  peekExpedition,
  retainExpedition,
  subscribeExpedition,
} from '../../game/runtime/expedition';
import { clearPlaySession, setPendingDifficulty } from '../../lib/gameSession';
import { DifficultyModal } from '../components/DifficultyModal';
import { useGameSettings } from '../../lib/gameSettings';
import { getGuestName } from '../../lib/guest';
import { SuitModal } from '../components/astronaut/SuitModal';
import { CookieConsent } from '../components/CookieConsent';
import { LaunchBit } from '../components/bit/LaunchBit';
import { JoinWorldModal } from '../components/JoinWorldModal';
import { SettingsModal } from '../components/SettingsModal';
import './home.css';
import { L } from '../../lib/i18n';

const DECOMPRESSION_GAIN = 0.5;

export default function Home({ arrivalOnly = false }: { arrivalOnly?: boolean }) {
  useSyncExternalStore(subscribeExpedition, expeditionSnapshot);
  const session = peekExpedition();
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

  const [phase, setPhase] = useState<'ready' | 'countdown' | 'ignition' | 'flight' | 'complete'>('ready');
  const [count, setCount] = useState(5);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [fallback, setFallback] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  const [suitModalOpen, setSuitModalOpen] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const skipSuit = useRef(false);
  // Modal para entrar em um mundo compartilhado (o destino vale depois da viagem e da suit)
  // convite aberto por link (/jogar?sala=CODIGO volta aqui): a janela abre com o código preenchido
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('sala')?.trim().toUpperCase() ?? '';
  const [joinModalOpen, setJoinModalOpen] = useState(() => Boolean(inviteCode) && !arrivalOnly);
  const [destinationUrl, setDestinationUrl] = useState('/jogar');
  const [joinTab, setJoinTab] = useState<'code' | 'recent'>('code');

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
      // Voltou ao início: a partida anterior acabou. A próxima viagem sorteia base e sala novas
      // (sem isso, a sessão da aba fazia o "Jogar agora" repetir a base da última partida).
      if (!arrivalOnly) clearPlaySession();
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
            airAudio.current.volume = landingVolume.current * DECOMPRESSION_GAIN;
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
        setInitializationError(L('Não foi possível iniciar o modo 3D neste dispositivo.', 'Could not start 3D mode on this device.'));
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
    if (arrivalOnly && getGuestName()) {
      session.enter();
      nav('/jogar', { replace: true });
    } else if (arrivalOnly) setSuitModalOpen(true);
    // após a viagem, quem decide é o botão em destaque: nada abre sozinho
  }, [phase, session, session?.ready, arrivalOnly, nav]);

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
    if (airAudio.current) airAudio.current.volume = landingVolume.current * DECOMPRESSION_GAIN;
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
    // contagem regressiva do B.I.T. antes de acender os motores
    const from = video.reducedMotion ? 3 : 5;
    setCount(from);
    setPhase('countdown');
    let left = from;
    countdownTimer.current = setInterval(() => {
      left -= 1;
      setCount(left);
      if (left <= 0) {
        clearInterval(countdownTimer.current);
        ignite();
      }
    }, 1000);
  };

  /** Acende os motores: sons e animação da decolagem. */
  const ignite = () => {
    clearInterval(countdownTimer.current);
    if (!scene.current) return;
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

  useEffect(() => () => clearInterval(countdownTimer.current), []);

  const handleSuitLaunch = () => {
    if (!session?.ready) return;
    // viagem nova: nunca reaproveita a sala/missão da partida anterior
    clearPlaySession();
    skipSuit.current = false;
    session.enter();
    nav(destinationUrl);
  };

  // Entrar em um mundo: mesma viagem do "Jogar agora", mas o destino é a sala informada
  const handleJoinWorld = (
    roomCode: string,
    _nickname: string,
    baseId?: string,
    hasSuit?: boolean,
  ) => {
    // já tem personagem neste mundo: não personaliza de novo
    skipSuit.current = Boolean(hasSuit);
    const base = baseId ? `&base=${encodeURIComponent(baseId)}` : '';
    setDestinationUrl(`/jogar?sala=${encodeURIComponent(roomCode)}${base}`);
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
          <Link to="/" className="launch-brand" aria-label={L('Mars Outpost, início', 'Mars Outpost, home')}>
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

        <nav className="launch-nav" aria-label={L('Navegação inicial', 'Main navigation')}>
          <button
            className="launch-nav-button"
            type="button"
            aria-label={L('Entrar em um mundo compartilhado', 'Join a shared world')}
            onClick={() => {
              setJoinTab('code');
              setJoinModalOpen(true);
            }}
            title={L('Conectar a uma sala marciana com código de convite', 'Join a Mars room with an invite code')}
          >
            <Users size={20} aria-hidden="true" />
            <span>{L('Entrar em um Mundo', 'Join a World')}</span>
          </button>

          <button
            className="launch-nav-button"
            type="button"
            aria-label={L('Ver meus mundos salvos', 'See my saved worlds')}
            onClick={() => {
              setJoinTab('recent');
              setJoinModalOpen(true);
            }}
            title={L('Seus 5 mundos mais recentes', 'Your 5 most recent worlds')}
          >
            <Globe size={20} aria-hidden="true" />
            <span>{L('Meus mundos', 'My worlds')}</span>
          </button>

          <button
            className="launch-nav-button"
            type="button"
            aria-label={L('Configurações', 'Settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={21} aria-hidden="true" />
            <span>{L('Configurações', 'Settings')}</span>
          </button>
        </nav>
      </header>

      <section
        ref={copy}
        className="launch-copy"
        aria-label={L('Sua expedição começa aqui', 'Your expedition starts here')}
        inert={launching}
      >
        <div className="launch-eyebrow">
          {L('BASE ESPACIAL ARES', 'ARES SPACE BASE')} <span>·</span> {L('TERRA', 'EARTH')} <i />
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
          {L('Construa e mantenha uma base em Marte', 'Build and run a base on Mars')}
          <br className="launch-desktop-break" /> {L('com um clima de exploração e descoberta.', 'full of exploration and discovery.')}
        </p>

        <div className="launch-cta-row">
          <button
            className="launch-cta"
            type="button"
            aria-label={L('Jogar agora', 'Play now')}
            onClick={() => setDifficultyOpen(true)}
            disabled={launching || Boolean(initializationError)}
          >
            <span className="launch-cta-icon" aria-hidden="true">
              <ArrowRight />
            </span>
            <span className="launch-cta-label">
              {L('Jogar Agora', 'Play Now')}
            </span>
          </button>
        </div>
      </section>

      {!fallback && (
        <button
          ref={target}
          type="button"
          className="rocket-hit-target"
          aria-label={L('Lançar foguete', 'Launch rocket')}
          title={L('Lançar foguete', 'Launch rocket')}
          onClick={launch}
          disabled={launching}
        />
      )}

      {launching && !arrivalOnly && !fallback && <LaunchBit phase={phase as 'countdown'} count={count} />}
      <div className="launch-flight-status" role="status" aria-live="polite">
        {launching && (
          <>
            <span className="launch-eyebrow">{L('SUA MISSÃO COMEÇA AQUI', 'YOUR MISSION STARTS HERE')}</span>
            <strong>
              {phase === 'countdown'
                ? L('Contagem regressiva', 'Countdown')
                : phase === 'ignition'
                  ? L('Ignição', 'Ignition')
                  : phase === 'complete'
                    ? L('Rumo a Marte', 'Off to Mars')
                    : L('Decolando', 'Lifting off')}
            </strong>
            <div className="launch-flight-actions">
              <button
                type="button"
                className="launch-skip-button"
                disabled={phase === 'complete' && !session?.ready}
                onClick={() => {
                  if (phase === 'complete') {
                    if (!session?.ready) return;
                    // mundo em que já tenho personagem: entra com o traje guardado no servidor
                    if (skipSuit.current && getGuestName()) handleSuitLaunch();
                    else setSuitModalOpen(true);
                  } else if (phase === 'countdown') ignite();
                  else scene.current?.skip();
                }}
                data-cta={phase === 'complete' ? 'true' : undefined}
              >
                {phase === 'complete'
                  ? skipSuit.current
                    ? L('Entrar na base', 'Enter the base')
                    : L('Personalizar astronauta', 'Customize astronaut')
                  : L('Pular animação →', 'Skip animation →')}
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="launch-footer">
        <nav className="launch-footer-nav" aria-label={L('Links do projeto', 'Project links')}>
          <Link to="/centro">{L('Centro', 'Center')}</Link>
          <Link to="/suporte">{L('Suporte', 'Support')}</Link>
          <Link to="/sobre">{L('Sobre', 'About')}</Link>
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
            {L('Tentar novamente', 'Try again')}
          </button>
        </div>
      )}

      {!initializationError && session?.error && (
        <div className="expedition-error" role="alert">
          <p>{session.error}</p>
          <button type="button" onClick={() => void session.prepare()}>
            {L('Tentar novamente', 'Try again')}
          </button>
          <button type="button" onClick={() => window.location.assign('/')}>
            {L('Voltar ao início', 'Back to start')}
          </button>
        </div>
      )}

      <CookieConsent />

      <DifficultyModal
        open={difficultyOpen}
        onClose={() => setDifficultyOpen(false)}
        onPick={(d) => {
          setPendingDifficulty(d);
          setDifficultyOpen(false);
          setDestinationUrl('/jogar');
          launch();
        }}
      />
      {/* Modal para Entrar em um Mundo com Código da Sala */}
      <JoinWorldModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onJoin={handleJoinWorld}
        initialCode={inviteCode}
        initialTab={joinTab}
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
