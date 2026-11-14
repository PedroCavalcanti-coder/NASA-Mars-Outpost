import { WORLD_AUTOSAVE_MS } from '@mars/shared';
import { TriangleAlert } from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import type {
  BaseViewer,
  BaseViewerOptions,
  MinigameRequest,
  MinigameResult,
  BaseViewer as Viewer,
} from '../../game/BaseViewer';
import { registerDevAction } from '../../game/dev/devActions';
import {
  expeditionSnapshot,
  peekExpedition,
  retainExpedition,
  subscribeExpedition,
} from '../../game/runtime/expedition';
import { type BaseId, type BaseInfo, loadBaseInfo, pickRandomBase } from '../../lib/bases';
import { useGameSettings } from '../../lib/gameSettings';
import { getGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';
import { useMission } from '../../store/mission';
import { toast } from '../../ui/toast';
import { HudRoot } from '../components/hud/HudRoot';
import { MissionEnd } from '../components/mission/MissionEnd';
import { SettingsModal } from '../components/SettingsModal';
import '../../styles/game.css';
import '../components/mission/mission.css';
import Home from './Home';

// Minigames das tarefas do Sol: carregados só quando abertos
const SolarCleaningPreview = lazy(() => import('../minigames/solar-cleaning/SolarCleaningPreview'));
const OxygenFilterPreview = lazy(() => import('../minigames/oxygen-filter/OxygenFilterPreview'));
const GreenhousePreview = lazy(() => import('../minigames/greenhouse/GreenhousePreview'));
const DrillingMinigame = lazy(() => import('../minigames/drilling/DrillingMinigame'));

/**
 * Jogo (base marciana):
 * - Controle isométrico do astronauta com visualização em tempo real de coordenadas e grade;
 * - Animação de pouso da nave com chegada do astronauta e decolagem para a órbita;
 * - Multiplayer para até 4 jogadores por sala com sincronização em tempo real;
 * - Sujeira progressiva nos painéis solares durante tempestades de areia e limpeza interativa;
 * - Névoa atmosférica de borda que não invade o interior da base quando os tetos estão ocultos;
 * - HUD modular organizada em painéis recolhíveis, doca acessível e barra essencial.
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
  const [minigame, setMinigame] = useState<MinigameRequest | null>(null);
  const closeMinigame = useCallback(() => setMinigame(null), []);
  /** o minigame foi concluído: o viewer aplica o efeito no mundo (painel limpo, canteiro cuidado…) */
  const finishMinigame = useCallback(
    (result?: MinigameResult) => {
      if (minigame) viewer.current?.completeMinigame(minigame, result);
    },
    [minigame],
  );

  // Com um minigame aberto por cima, a base fica carregada mas para de desenhar
  // (a simulação segue pelo relógio de apoio: numa sala, o mundo não para para os outros).
  useEffect(() => {
    if (!minigame) return;
    const runtime = peekExpedition()?.runtime;
    if (!runtime) return;
    const wasPaused = runtime.paused;
    runtime.paused = true;
    return () => {
      runtime.paused = wasPaused;
    };
  }, [minigame]);
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
  const missionStarted = useMission((m) => m.state.log.length > 0 && m.state.status === 'playing');

  // Cada base sorteada começa uma missão nova.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia a missão a cada base sorteada
  useEffect(() => {
    startMission();
  }, [baseId, startMission]);

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
  const [showCoords, setShowCoords] = useState(true);
  const [navDebug, setNavDebug] = useState(false);

  // Clima marciano e ciclo de 10 minutos
  const [marsTime, setMarsTime] = useState({
    hour: 9,
    sol: 1,
    isDay: true,
    formatted: '09:00',
  });

  // Configurações do jogo
  const [settingsOpen, setSettingsOpen] = useState(false);
  // vídeo, áudio, jogabilidade e contorno: salvos no navegador (valem também na Home)
  const video = useGameSettings((s) => s.video);
  const setVideo = useGameSettings((s) => s.setVideo);
  const audio = useGameSettings((s) => s.audio);
  const setAudio = useGameSettings((s) => s.setAudio);
  const gameplay = useGameSettings((s) => s.gameplay);
  const setGameplay = useGameSettings((s) => s.setGameplay);
  const outline = useGameSettings((s) => s.outline);
  const setOutline = useGameSettings((s) => s.setOutline);

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
      outlineSettings: outline,
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
        toast('✨ Painel solar limpo! Ele volta a gerar 100% da energia.', 'ok');
      },
      onMinigame: (req) => {
        if (alive) setMinigame(req);
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

  useEffect(() => {
    viewer.current?.setOutlineSettings(outline);
  }, [outline]);

  // Salvamento automático a cada 5 minutos, depois que o mundo foi salvo/vinculado a este jogador
  // biome-ignore lint/correctness/useExhaustiveDependencies: o intervalo só depende do vínculo
  useEffect(() => {
    if (!persist.linked || !persist.canSave) return;
    const id = window.setInterval(() => void saveWorld(true), WORLD_AUTOSAVE_MS);
    return () => window.clearInterval(id);
  }, [persist.linked, persist.canSave]);

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

  function toggleNavDebug() {
    setNavDebug((prev) => {
      const next = !prev;
      viewer.current?.setNavDebug(next);
      toast(
        next
          ? '🗺️ Debug de navegação ativado (células caminháveis visíveis).'
          : '🗺️ Debug de navegação desativado.',
        'ok',
      );
      return next;
    });
  }

  function toggleCoords() {
    setShowCoords((prev) => {
      const next = !prev;
      toast(next ? '📌 Coordenadas visíveis na tela.' : '📌 Coordenadas ocultas.', 'ok');
      return next;
    });
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(roomCode);
    toast(
      `Código exclusivo ${roomCode} copiado! Compartilhe com seu amigo (máx 4 jogadores).`,
      'ok',
    );
  };

  // Registra as ferramentas e comandos de teste como devActions para o DevPanel
  // biome-ignore lint/correctness/useExhaustiveDependencies: atualiza rótulos ao mudar estados
  useEffect(() => {
    const unregs = [
      registerDevAction({
        id: 'dev:storm',
        label: stormActive ? 'Parar Tempestade' : 'Simular Tempestade',
        group: 'Ambiente & Clima',
        run: () => toggleStorm(),
      }),
      registerDevAction({
        id: 'dev:grid',
        label: gridVisible ? 'Ocultar Grade' : 'Exibir Grade',
        group: 'Visualização & Terreno',
        run: () => toggleGrid(),
      }),
      registerDevAction({
        id: 'dev:nav',
        label: navDebug ? 'Ocultar Células (?nav)' : 'Exibir Células (?nav)',
        group: 'Visualização & Terreno',
        run: () => toggleNavDebug(),
      }),
      registerDevAction({
        id: 'dev:coords',
        label: showCoords ? 'Ocultar Coordenadas' : 'Exibir Coordenadas',
        group: 'Visualização & Terreno',
        run: () => toggleCoords(),
      }),
      registerDevAction({
        id: 'dev:roofs',
        label: roofsHidden ? 'Teto Automático' : 'Teto Sempre Oculto (Corte)',
        group: 'Visualização & Terreno',
        run: () => toggleRoofs(),
      }),
      registerDevAction({
        id: 'dev:roll-base',
        label: 'Sortear Outra Base Marciana',
        group: 'Mundo & Missão',
        run: () => rollBase(),
      }),
    ];

    return () => {
      for (const unreg of unregs) {
        unreg();
      }
    };
  }, [stormActive, gridVisible, navDebug, showCoords, roofsHidden]);

  if (!name) return <Navigate to="/" replace />;

  return (
    <main className="game">
      {minigame &&
        createPortal(
          <Suspense fallback={null}>
            {minigame.kind === 'solar' ? (
              <SolarCleaningPreview onClose={closeMinigame} onComplete={finishMinigame} />
            ) : minigame.kind === 'oxygen' ? (
              <OxygenFilterPreview onClose={closeMinigame} onComplete={finishMinigame} />
            ) : minigame.kind === 'greenhouse' ? (
              <GreenhousePreview onClose={closeMinigame} onComplete={finishMinigame} />
            ) : (
              <DrillingMinigame
                baseId={minigame.baseId}
                target={minigame.target}
                onClose={closeMinigame}
                onComplete={finishMinigame}
              />
            )}
          </Suspense>,
          document.body,
        )}
      {/* `display: contents` mantém o layout; `inert` bloqueia a base enquanto o minigame está aberto */}
      <div className="game__interface" style={{ display: 'contents' }} inert={minigame !== null}>
        <div className="game__canvas" ref={mount} />
        <div className="game__vignette" />

        {/* Nova HUD Modular Unificada (Barra Essencial, Doca e Painéis Recolhíveis) */}
        {!loading && !error && (
          <HudRoot
            marsTime={marsTime}
            stormActive={stormActive}
            roomCode={roomCode}
            players={players}
            onCopyInvite={handleCopyInvite}
            cameraMode={cameraMode}
            onToggleCamera={toggleCamera}
            roofsHidden={roofsHidden}
            onToggleRoofs={toggleRoofs}
            chat={chat}
            onSendEmote={pickEmote}
            info={info}
            astronautName={name ?? 'Explorador'}
            coords={coords}
            viewer={viewer.current}
            onOpenSettings={() => setSettingsOpen(true)}
            onRequestLeave={requestLeave}
            rollBase={rollBase}
            onGoToTask={(kind, index) => viewer.current?.goToTask(kind, index)}
            driving={driving}
            onExitRover={() => viewer.current?.exitRover()}
            showHints={gameplay.showHints}
            showCoords={showCoords}
          />
        )}

        {/* Tela de Fim de Missão: vitória (100% dos dados) ou evacuação */}
        {!loading && !error && (
          <MissionEnd onRestart={() => startMission()} onExit={() => nav('/')} />
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
          outline={outline}
          onOutlineChange={setOutline}
          inGame={true}
          roomCode={roomCode}
          onCopyRoomCode={handleCopyInvite}
          onLeaveRoom={() => requestLeave()}
        />
      </div>
    </main>
  );
}
