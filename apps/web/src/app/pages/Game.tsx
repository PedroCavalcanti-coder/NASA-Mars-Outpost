import { GAME_EMOTES, WORLD_AUTOSAVE_MS } from '@mars/shared';
import {
  Camera,
  Car,
  Compass,
  Dices,
  Eye,
  EyeOff,
  Grid,
  MapPin,
  Moon,
  Settings,
  Share2,
  Smile,
  Sun,
  TriangleAlert,
  Users,
  Wind,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import type { BaseViewer, BaseViewerOptions, BaseViewer as Viewer } from '../../game/BaseViewer';
import { type BaseId, type BaseInfo, loadBaseInfo, pickRandomBase } from '../../lib/bases';
import { getGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';
import { useMission } from '../../store/mission';
import { toast } from '../../ui/toast';
import { ActionPanel } from '../components/mission/ActionPanel';
import { MissionEnd } from '../components/mission/MissionEnd';
import { MissionLog } from '../components/mission/MissionLog';
import { ResearchBar } from '../components/mission/ResearchBar';
import { ResourceHud } from '../components/mission/ResourceHud';
import {
  type AudioSettings,
  type GameplaySettings,
  SettingsModal,
  type VideoSettings,
} from '../components/SettingsModal';
import '../../styles/game.css';
import '../components/mission/mission.css';
import {
  expeditionSnapshot,
  peekExpedition,
  retainExpedition,
  subscribeExpedition,
} from '../../game/runtime/expedition';
import Home from './Home';

/**
 * Jogo (base marciana):
 * - Controle isométrico do astronauta com visualização em tempo real de coordenadas e grade;
 * - Animação de pouso da nave com chegada do astronauta e decolagem para a órbita;
 * - Multiplayer para até 4 jogadores por sala com sincronização em tempo real;
 * - Sujeira progressiva nos painéis solares durante tempestades de areia e limpeza interativa;
 * - Névoa atmosférica de borda que não invade o interior da base quando os tetos estão ocultos;
 * - Opção de alternar entre Câmera Seguir Astronauta e Câmera Livre.
 */
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
  const [searchParams] = useSearchParams();

  const queryRoom = searchParams.get('sala')?.trim();
  const queryBase = searchParams.get('base') as BaseId | null;

  const detectedBaseFromRoom = (() => {
    if (!queryRoom) return null;
    const upper = queryRoom.toUpperCase();
    const bases: BaseId[] = [
      'arcadia',
      'elysium',
      'gale',
      'hellas',
      'jezero',
      'olympus',
      'utopia',
      'valles',
    ];
    for (const b of bases) {
      if (upper.includes(b.toUpperCase())) return b;
    }
    return null;
  })();

  const [baseId, setBaseId] = useState<BaseId>(() => {
    if (queryBase) return queryBase;
    if (detectedBaseFromRoom) return detectedBaseFromRoom;
    return peekExpedition()?.id ?? pickRandomBase();
  });

  const [roomCode] = useState(() => {
    if (queryRoom) return queryRoom.toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `MARS-${baseId.toUpperCase()}-${rand}`;
  });

  const mount = useRef<HTMLDivElement>(null);
  const viewer = useRef<BaseViewer | null>(null);
  const [info, setInfo] = useState<BaseInfo | null>(() => peekExpedition()?.info ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** `false` = teto automático (some ao entrar na base); `true` = sempre oculto (visão de corte) */
  const [roofsHidden, setRoofsHidden] = useState(false);
  const [cameraMode, setCameraMode] = useState<'follow' | 'free'>('follow');
  const [gridVisible, setGridVisible] = useState(true);
  const [stormActive, setStormActive] = useState(false);
  const [driving, setDriving] = useState(false);
  const [persist, setPersist] = useState({ linked: false, canSave: false });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const startMission = useMission((m) => m.start);
  const sol = useMission((m) => m.state.sol);
  const blackout = useMission((m) => m.state.resources.energy.value <= 0);
  const missionStarted = useMission((m) => m.state.log.length > 0 && m.state.status === 'playing');

  // Cada base sorteada começa uma missão nova.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia a missão a cada base sorteada
  useEffect(() => {
    startMission();
  }, [baseId, startMission]);

  const [wheelOpen, setWheelOpen] = useState(false);
  const [emoteCooling, setEmoteCooling] = useState(false);
  const [chat, setChat] = useState<
    Array<{ id: number; name: string; emoji: string; local: boolean }>
  >([]);
  const chatId = useRef(0);
  const [players, setPlayers] = useState<{ count: number; mode: 'online' | 'local' }>({
    count: 1,
    mode: 'online',
  });
  const [coords, setCoords] = useState<{ gx: number; gy: number; inside: boolean } | null>(null);

  // Clima marciano e ciclo de 10 minutos
  const [marsTime, setMarsTime] = useState({
    hour: 9,
    sol: 1,
    isDay: true,
    formatted: '09:00',
  });

  // Configurações do jogo
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: o viewer é ativado uma vez por base
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
    setRoofsHidden(false);
    setCameraMode('follow');
    setStormActive(false);
    setPlayers({ count: 1, mode: 'online' });
    setDriving(false);

    // callbacks da interface e configurações (o viewer só começa a usá-los ao `activate`)
    const options: BaseViewerOptions = {
      roomCode,
      videoSettings: video,
      onTimeUpdate: (t) => {
        if (alive) setMarsTime(t);
      },
      onCoordinateUpdate: (c) => {
        if (alive) setCoords(c);
      },
      onStormAlert: (msg) => {
        toast(msg, 'error');
      },
      onStormChange: (active, remote) => {
        if (!alive) return;
        setStormActive((prev) => {
          if (remote && prev !== active) {
            toast(
              active
                ? '🌪️ Um colega iniciou uma tempestade de poeira marciana!'
                : '🌤️ A tempestade passou. Céu limpo.',
              active ? 'error' : 'ok',
            );
          }
          return active;
        });
      },
      onPlayersChange: (p) => {
        if (alive) setPlayers(p);
      },
      onEmote: ({ name: who, emoji, local }) => {
        if (!alive) return;
        const id = ++chatId.current;
        setChat((c) => [...c.slice(-5), { id, name: who, emoji, local }]);
        window.setTimeout(() => setChat((c) => c.filter((m) => m.id !== id)), 9000);
      },
      onMessage: (msg, kind) => {
        toast(msg, kind);
      },
      onVehicleChange: (d) => {
        if (alive) setDriving(d);
      },
      onWorldInfo: (info) => {
        if (!alive) return;
        setPersist({ linked: info.linked, canSave: info.canSave });
        // missão gravada pelo último jogador que salvou este mundo
        const m = info.mission as { sol?: unknown; resources?: unknown; log?: unknown } | undefined;
        if (
          m &&
          typeof m === 'object' &&
          typeof m.sol === 'number' &&
          m.resources &&
          Array.isArray(m.log)
        ) {
          useMission.setState({
            state: info.mission as ReturnType<typeof useMission.getState>['state'],
          });
          toast('💾 Mundo retomado de onde você parou.', 'ok');
        }
      },
      onRoomRejected: () => {
        // apelido em uso / sala cheia: volta ao início para escolher outro
        window.setTimeout(() => nav('/'), 1800);
      },
      onRoomError: (msg) => {
        toast(msg, 'error');
      },
      onSolarCleaned: () => {
        toast('✨ Painel solar limpo com sucesso! Eficiência energética a 100%.', 'ok');
      },
      onCameraModeChange: (m) => {
        if (alive) setCameraMode(m);
      },
    };

    if (baseId === session.info?.id && session.viewer) {
      session.viewer.activate(el, options);
      viewer.current = session.viewer;
      setInfo(session.info);
      setLoading(false);
    } else {
      void loadBaseInfo(baseId)
        .then(async (meta) => {
          const { BaseViewer: Viewer } = await import('../../game/BaseViewer');
          if (!alive) return;
          replacement = new Viewer(el, meta, session.runtime, session.assets);
          await replacement.ready;
          if (!alive) return;
          const previous = session.viewer;
          session.viewer = replacement;
          session.info = meta;
          try {
            sessionStorage.setItem('mo_base', meta.id);
          } catch {
            /* Private browsing. */
          }
          replacement.activate(el, options);
          viewer.current = replacement;
          previous?.dispose();
          setInfo(meta);
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

  useEffect(() => {
    viewer.current?.setQualitySettings(video);
  }, [video]);

  // Q abre/fecha o painel de emojis; Esc fecha
  // biome-ignore lint/correctness/useExhaustiveDependencies: registra uma vez
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === 'q') setWheelOpen((o) => !o);
      else if (e.key === 'Escape') setWheelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Salvamento automático a cada 5 minutos, depois que o mundo foi salvo/vinculado a este jogador
  // biome-ignore lint/correctness/useExhaustiveDependencies: o intervalo só depende do vínculo
  useEffect(() => {
    if (!persist.linked || !persist.canSave) return;
    const id = window.setInterval(() => void saveWorld(true), WORLD_AUTOSAVE_MS);
    return () => window.clearInterval(id);
  }, [persist.linked, persist.canSave]);

  if (!name) return <Navigate to="/" replace />;

  /** Mission sem o histórico longo: cabe no limite do salvamento. */
  function missionSnapshot() {
    const m = useMission.getState().state;
    return { ...m, log: m.log.slice(-30) };
  }

  async function saveWorld(silent = false) {
    const v = viewer.current;
    if (!v) return false;
    if (!silent) {
      setSaving(true);
      setSaveError('');
    }
    const r = await v.saveWorld(missionSnapshot());
    if (r.ok) setPersist((p) => ({ ...p, linked: true }));
    if (!silent) {
      setSaving(false);
      if (!r.ok) setSaveError(r.error);
    }
    return r.ok;
  }

  /** Sair: pergunta se quer salvar (o último jogador a salvar deixa o estado do mundo). */
  function requestLeave() {
    setSaveError('');
    setLeaveOpen(true);
  }

  async function saveAndLeave() {
    if (await saveWorld()) nav('/');
  }

  function rollBase() {
    if (missionStarted && !window.confirm('Sortear outra base reinicia a missão atual. Continuar?'))
      return;
    setBaseId((cur) => pickRandomBase(cur));
  }

  function pickEmote(index: number) {
    if (emoteCooling) return;
    if (viewer.current?.sendEmote(index)) {
      setEmoteCooling(true);
      window.setTimeout(() => setEmoteCooling(false), 1000);
    }
    setWheelOpen(false);
  }

  function toggleRoofs() {
    const next = !roofsHidden;
    setRoofsHidden(next);
    viewer.current?.setRoofsAlwaysHidden(next);
  }

  function toggleCamera() {
    const next = cameraMode === 'follow' ? 'free' : 'follow';
    setCameraMode(next);
    viewer.current?.setCameraMode(next);
  }

  function toggleGrid() {
    const next = !gridVisible;
    setGridVisible(next);
    viewer.current?.setGridVisible(next);
  }

  function toggleStorm() {
    const next = !stormActive;
    viewer.current?.setStormStrength(next ? 0.85 : 0);
    if (next) {
      toast(
        '🌪️ Tempestade de poeira marciana iniciada! Painéis solares em acumulação de poeira.',
        'error',
      );
    } else {
      toast('🌤️ Céu limpo. Ventos reduzidos em Marte.', 'ok');
    }
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(roomCode);
    toast(
      `Código exclusivo ${roomCode} copiado! Compartilhe com seu amigo (máx 4 jogadores).`,
      'ok',
    );
  };

  return (
    <main className="game">
      <div className="game__canvas" ref={mount} />
      <div className="game__vignette" />

      {/* Cabeçalho HUD Superior */}
      <header className="game__header">
        <div className="game__header-brands">
          <Link
            to="/"
            className="game__brand"
            aria-label="Mars Outpost — Início"
            onClick={(e) => {
              e.preventDefault();
              requestLeave();
            }}
          >
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
            <span>
              SOL {sol} · {blackout ? 'APAGÃO NA BASE' : 'BASE MARCIANA ATIVA'}
            </span>
          </div>

          {/* Relógio Solar de Marte */}
          <div
            className="game__weather-status"
            title="Ciclo Dia/Noite marciano: cada 10 minutos terrestres equivale a 1 Sol (24h) completo"
          >
            {marsTime.isDay ? (
              <Sun size={16} className="weather-icon-sun" />
            ) : (
              <Moon size={16} className="weather-icon-moon" />
            )}
            <span>
              SOL {marsTime.sol} · {marsTime.formatted} LMST · {marsTime.isDay ? 'DIA' : 'NOITE'}
            </span>
          </div>

          {/* Badge da Sala Exclusiva */}
          <button
            type="button"
            className="game__room-status"
            onClick={handleCopyInvite}
            title={`Clique para copiar o código da sala (máx 4 jogadores). ${
              players.mode === 'online'
                ? 'Sala online: qualquer dispositivo com o código entra.'
                : 'Servidor indisponível: só abas deste navegador sincronizam.'
            }`}
          >
            <Users size={14} />
            <span>
              SALA: {roomCode} · {players.count}/4
              {players.mode === 'local' ? ' (local)' : ''}
            </span>
          </button>
        </div>

        <nav className="game__actions" aria-label="Ações da base">
          {/* Câmera: Seguir Astronauta vs Livre */}
          <button
            type="button"
            className={`game__action-btn ${cameraMode === 'free' ? 'game__action-btn--active' : ''}`}
            onClick={toggleCamera}
            disabled={loading}
            title="Alternar entre Seguir o Astronauta e Câmera Livre"
          >
            <Camera size={17} />
            <span>{cameraMode === 'follow' ? 'Seguir' : 'Câmera Livre'}</span>
          </button>

          {/* Grade e Coordenadas */}
          <button
            type="button"
            className={`game__action-btn ${gridVisible ? 'game__action-btn--active' : ''}`}
            onClick={toggleGrid}
            disabled={loading}
            title="Exibir ou ocultar a grade do terreno"
          >
            <Grid size={17} />
            <span>{gridVisible ? 'Grade ON' : 'Grade OFF'}</span>
          </button>

          {/* Simulador de Tempestade de Areia */}
          <button
            type="button"
            className={`game__action-btn ${stormActive ? 'game__action-btn--storm-active' : ''}`}
            onClick={toggleStorm}
            disabled={loading}
            title="Simular Tempestade de Areia para sujar painéis solares"
          >
            <Wind size={17} />
            <span>{stormActive ? 'Tempestade ON' : 'Tempestade'}</span>
          </button>

          <button
            type="button"
            className="game__action-btn game__action-btn--invite"
            onClick={handleCopyInvite}
            title="Copiar código de convite da sala"
          >
            <Share2 size={17} />
            <span>Convidar</span>
          </button>

          <button
            type="button"
            className="game__action-btn"
            onClick={() => setBaseId((cur) => pickRandomBase(cur))}
            disabled={loading}
            title="Sortear outra das 8 bases marcianas"
          >
            <Dices size={18} />
            <span>Sortear base</span>
          </button>

          <button
            type="button"
            className="game__action-btn"
            onClick={toggleRoofs}
            disabled={loading}
            title={
              roofsHidden
                ? 'Teto sempre oculto (visão de corte). Clique para voltar ao automático'
                : 'Teto automático: some quando você entra na base. Clique para mantê-lo sempre oculto'
            }
          >
            {roofsHidden ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>{roofsHidden ? 'Teto oculto' : 'Teto auto'}</span>
          </button>

          {/* Engrenagem de Configurações no Canto da Tela */}
          <button
            type="button"
            className="game__settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="Configurações e Sala"
            aria-label="Configurações da simulação"
          >
            <Settings size={20} />
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

      {/* Missão: recursos, pesquisa, diário e ações */}
      {!loading && !error && (
        <>
          <aside className="mission-status" aria-label="Estado da missão">
            <ResearchBar />
            <ResourceHud />
          </aside>
          <MissionLog />
          <ActionPanel />
          <MissionEnd onRestart={() => startMission()} onExit={() => nav('/')} />
        </>
      )}

      {/* Indicador de Coordenadas em Tempo Real */}
      {coords && !loading && (
        <div className="game__coord-status">
          <MapPin size={13} className="game__coord-icon" />
          <span>
            COORDENADAS: [X: {coords.gx >= 0 ? `+${coords.gx}` : coords.gx}, Y:{' '}
            {coords.gy >= 0 ? `+${coords.gy}` : coords.gy}] ·{' '}
            <strong className={coords.inside ? 'coord-inside' : 'coord-outside'}>
              {coords.inside ? 'BASE INTERIOR' : 'TERRENO EXTERNO'}
            </strong>
          </span>
        </div>
      )}

      {/* Chat: emojis enviados pelos astronautas */}
      {chat.length > 0 && (
        <ul className="game__chat" aria-live="polite" aria-label="Mensagens da sala">
          {chat.map((m) => (
            <li
              key={m.id}
              className={m.local ? 'game__chat-msg game__chat-msg--me' : 'game__chat-msg'}
            >
              <strong>{m.name}</strong>
              <span className="game__chat-emoji">{m.emoji}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Painel circular de emojis */}
      {!loading && !error && (
        <div className="game__emote">
          {wheelOpen && (
            <div className="game__emote-wheel" role="menu" aria-label="Emojis">
              {GAME_EMOTES.map((emoji, i) => {
                const angle = (i / GAME_EMOTES.length) * Math.PI * 2 - Math.PI / 2;
                const x = Math.cos(angle) * 82;
                const y = Math.sin(angle) * 82;
                return (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    className="game__emote-item"
                    style={{
                      transform: `translate(${x}px, ${y}px)`,
                      animationDelay: `${i * 22}ms`,
                    }}
                    onClick={() => pickEmote(i)}
                    disabled={emoteCooling}
                    aria-label={`Enviar ${emoji}`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className={`game__emote-btn ${wheelOpen ? 'game__emote-btn--open' : ''}`}
            onClick={() => setWheelOpen((o) => !o)}
            title="Emojis (Q)"
            aria-expanded={wheelOpen}
            aria-label="Abrir painel de emojis"
          >
            <Smile size={24} />
          </button>
        </div>
      )}

      {/* Sair: salvar o mundo? */}
      {leaveOpen && (
        <div className="game__leave-backdrop" role="presentation">
          <div
            className="game__leave"
            role="alertdialog"
            aria-labelledby="leave-title"
            aria-modal="true"
          >
            <h2 id="leave-title">Salvar o mundo antes de sair?</h2>
            <p>
              {persist.canSave
                ? 'O mundo fica ligado à sua conta/navegador por 30 dias (entrar de novo renova). O salvamento que vale é o do último jogador a salvar.'
                : 'Para salvar é preciso permitir o cookie de salvamento na tela inicial ou entrar na sua conta. Você pode sair sem salvar.'}
            </p>
            {saveError && (
              <p className="game__leave-error" role="alert">
                {saveError}
              </p>
            )}
            <div className="game__leave-actions">
              <button type="button" onClick={() => setLeaveOpen(false)} disabled={saving}>
                Continuar jogando
              </button>
              <button type="button" onClick={() => nav('/')} disabled={saving}>
                Sair sem salvar
              </button>
              {persist.canSave && (
                <button
                  type="button"
                  className="game__leave-save"
                  onClick={() => void saveAndLeave()}
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : 'Salvar e sair'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sair do rover */}
      {driving && (
        <button
          type="button"
          className="game__vehicle-exit"
          onClick={() => viewer.current?.exitRover()}
        >
          <Car size={18} />
          <span>Sair do rover</span>
          <kbd>E</kbd>
        </button>
      )}

      {/* Dicas de Controle */}
      {!loading && !error && (
        <div className="game__hint" role="note">
          <span className="game__hint-action">Clique no chão ou use WASD para andar</span>
          <span className="game__hint-dot">·</span>
          <span>Clique em painéis, plantas e máquinas para trabalhar</span>
          <span className="game__hint-dot">·</span>
          <span>Clique no rover (ou E) para dirigir</span>
          <span className="game__hint-dot">·</span>
          <span>Arraste para girar a câmera</span>
          {gameplay.showHints && (
            <>
              <span className="game__hint-dot">·</span>
              <span className="game__hint-highlight">Dia/Noite: 10 min por Sol</span>
            </>
          )}
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
          <h2 className="game__loading-title">Pousando em Marte…</h2>
          <p className="game__loading-sub">
            Preparando astronauta personalizado, grade tática e propulsão de pouso
          </p>
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

      {/* Menu de Configurações avançado */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        video={video}
        onVideoChange={setVideo}
        audio={audio}
        onAudioChange={setAudio}
        gameplay={gameplay}
        onGameplayChange={setGameplay}
        inGame={true}
        roomCode={roomCode}
        onCopyRoomCode={handleCopyInvite}
        onLeaveRoom={() => requestLeave()}
      />
    </main>
  );
}
