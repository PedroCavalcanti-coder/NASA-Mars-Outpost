import { DUO_GESTURES, type DuoGestureId, WORLD_AUTOSAVE_MS } from '@mars/shared';
import { ensureShielding } from '@mars/sim';
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
import { type EventOutcome, GAME_EVENTS, type GameEventDef } from '../../game/events/events';
import {
  onRemoteResult,
  onRemoteVote,
  scaleDamage,
  setEventFlowContext,
} from '../../game/events/flow';
import { useGameEvents } from '../../game/events/store';
import { LORE } from '../../game/lore/lore';
import { useLore } from '../../game/lore/store';
import { MISSIONS, type MissionId } from '../../game/missions/rules';
import {
  expeditionSnapshot,
  peekExpedition,
  retainExpedition,
  subscribeExpedition,
} from '../../game/runtime/expedition';
import {
  BASE_IDS,
  type BaseId,
  type BaseInfo,
  loadBaseInfo,
  pickRandomBase,
} from '../../lib/bases';
import { copyText } from '../../lib/clipboard';
import {
  clearMissionSnapshot,
  clearPlaySession,
  getPlaySession,
  loadMissionSnapshot,
  saveMissionSnapshot,
  savePlaySession,
} from '../../lib/gameSession';
import { useGameSettings } from '../../lib/gameSettings';
import { getGuestName } from '../../lib/guest';
import { useAuth } from '../../store/auth';
import { useMission } from '../../store/mission';
import { toast } from '../../ui/toast';
import { HudRoot } from '../components/hud/HudRoot';
import { MissionVeil } from '../components/hud/MissionVeil';
import { RotateGate, TouchJoystick, useIsTouch } from '../components/hud/TouchControls';
import { EventFx } from '../components/mission/EventFx';
import { EventTablet } from '../components/mission/EventTablet';
import { LoreCard } from '../components/mission/LoreCard';
import { MissionEnd } from '../components/mission/MissionEnd';
import { SettingsModal } from '../components/SettingsModal';
import '../../styles/game.css';
import '../components/mission/mission.css';
import { Spinner } from '../../ui/Empty';

// Minigames das tarefas do Sol: carregados só quando abertos
const SolarCleaningPreview = lazy(() => import('../minigames/solar-cleaning/SolarCleaningPreview'));
const OxygenFilterPreview = lazy(() => import('../minigames/oxygen-filter/OxygenFilterPreview'));
const GreenhousePreview = lazy(() => import('../minigames/greenhouse/GreenhousePreview'));
const DrillingMinigame = lazy(() => import('../minigames/drilling/DrillingMinigame'));
const StationConsoleGame = lazy(() => import('../minigames/missions/StationConsoleGame'));
const SoilSamplingGame = lazy(() => import('../minigames/missions/SoilSamplingGame'));

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
  const authReady = useAuth((s) => s.ready);
  const session = peekExpedition();
  if (session?.entered && session.ready) return <ReadyGame />;
  // sem partida em andamento (digitou /jogar na barra de endereço): volta ao início, onde se
  // escolhe o traje e se faz a viagem; recarregar DENTRO do jogo continua a mesma partida
  if (!getPlaySession() && !session?.entered) return <RedirectHome />;
  if (!authReady) return <Spinner />;
  return <ResumeGame />;
}

/**
 * `/jogar` sem partida em andamento: volta ao início. Um convite (`?sala=`) abre a janela de
 * entrar no mundo com o código já preenchido; `?base=` só escolhe a base da próxima viagem.
 */
function RedirectHome() {
  const [params] = useSearchParams();
  const sala = params.get('sala')?.trim();
  const base = params.get('base');
  if (base && BASE_IDS.includes(base as BaseId)) {
    try {
      sessionStorage.setItem('mo_base', base);
    } catch {
      /* navegação privada: usa a base sorteada */
    }
  }
  return <Navigate to={sala ? `/?sala=${encodeURIComponent(sala)}` : '/'} replace />;
}

/** Código de sala de 4 caracteres (sem o nome da base). */
function newRoomCode() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

/** Recarregou a página no meio do jogo: reabre a mesma base e a mesma sala, sem o pouso. */
function ResumeGame() {
  const nav = useNavigate();
  useSyncExternalStore(subscribeExpedition, expeditionSnapshot);
  useEffect(() => {
    const lease = retainExpedition();
    const s = lease.session;
    const enter = () => {
      if (s.ready && !s.entered) s.enter();
    };
    enter();
    const off = subscribeExpedition(enter);
    return () => {
      off();
      lease.release();
    };
  }, []);
  const error = peekExpedition()?.error;
  return (
    <main className="game">
      <div className="game__loading" role="status">
        {error ? (
          <>
            <TriangleAlert size={28} />
            <h2 className="game__loading-title">Não foi possível retomar</h2>
            <p>{error}</p>
            <button
              type="button"
              className="game__intro-btn"
              onClick={() => {
                clearPlaySession();
                nav('/', { replace: true });
              }}
            >
              Voltar ao início
            </button>
          </>
        ) : (
          <>
            <span className="game__loading-kicker">RETOMANDO A MISSÃO</span>
            <h2 className="game__loading-title">Voltando para a sua base…</h2>
          </>
        )}
      </div>
    </main>
  );
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
    const resumed = getPlaySession()?.base as BaseId | undefined;
    return peekExpedition()?.id ?? resumed ?? pickRandomBase();
  });

  const [roomCode] = useState(() => {
    if (queryRoom) return queryRoom.toUpperCase();
    // recarregou a página: continua na mesma sala (o mesmo mundo e o mesmo save)
    const resumedRoom = getPlaySession()?.room;
    if (resumedRoom) return resumedRoom;
    return newRoomCode();
  });

  const mount = useRef<HTMLDivElement>(null);
  const viewer = useRef<BaseViewer | null>(null);
  const [info, setInfo] = useState<BaseInfo | null>(() => peekExpedition()?.info ?? null);
  const [loading, setLoading] = useState(true);
  // tela de introdução: fica até o jogador clicar em "Começar" (e a base terminar de carregar)
  // recarregou a página no meio do jogo: sem a introdução (ela é só da primeira entrada)
  const [intro, setIntro] = useState<'show' | 'leaving' | 'gone'>(() =>
    getPlaySession() ? 'gone' : 'show',
  );
  const [error, setError] = useState<string | null>(null);
  const [minigame, setMinigame] = useState<MinigameRequest | null>(null);
  const closeMinigame = useCallback(() => {
    // fechar a coleta de solo sem terminar faz o rover voltar sem amostras
    if (minigame?.kind === 'soil') viewer.current?.abortSoilRun();
    setMinigame(null);
  }, [minigame]);
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
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const touch = useIsTouch();
  const eventsPending = useGameEvents((s) => s.queue.length > 0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const startMission = useMission((m) => m.start);
  const missionStarted = useMission((m) => m.state.log.length > 0 && m.state.status === 'playing');

  // Cada base sorteada começa uma missão nova (exceto ao recarregar a página: a missão volta).
  const firstMission = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia a missão a cada base sorteada
  useEffect(() => {
    const first = firstMission.current;
    firstMission.current = false;
    savePlaySession({ room: roomCode, base: baseId });
    const saved = first
      ? loadMissionSnapshot<ReturnType<typeof useMission.getState>['state']>(roomCode)
      : null;
    if (saved && typeof saved.sol === 'number' && saved.resources) {
      useMission.setState({
        state: ensureShielding(saved),
        feedback: null,
        lastEntries: [],
        error: null,
      });
    } else {
      startMission();
      useGameEvents.getState().clear();
    }
  }, [baseId, startMission]);

  // guarda a missão para o recarregar da página (no máximo a cada 2 s)
  useEffect(() => {
    let timer: number | undefined;
    const unsub = useMission.subscribe(() => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        saveMissionSnapshot(roomCode, useMission.getState().state);
      }, 2000);
    });
    return () => {
      unsub();
      if (timer) window.clearTimeout(timer);
    };
  }, [roomCode]);

  const [emoteCooling, setEmoteCooling] = useState(false);
  // força o DevPanel a atualizar rótulos de ações que mudam de estado
  const [devTick, setDevTick] = useState(0);
  // convite de outro jogador para um gesto em dupla (some em ~5 s)
  const [duoInvite, setDuoInvite] = useState<{
    fromId: string;
    name: string;
    gesture: DuoGestureId;
  } | null>(null);
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
      onGestureInvite: (invite) => {
        if (alive) setDuoInvite(invite);
      },
      onEventVote: (id, eid, choice) => onRemoteVote(id, eid, choice),
      onEventResult: (eid, choice, roll) => onRemoteResult(eid, choice, roll),
      onChat: ({ name, message, local }) => {
        if (alive)
          setChat((c) => [...c.slice(-49), { id: ++chatId.current, name, emoji: message, local }]);
      },
      onEmote: ({ name: who, emoji, local }) => {
        if (!alive) return;
        const id = ++chatId.current;
        setChat((c) => [...c.slice(-49), { id, name: who, emoji, local }]);
      },
      onMessage: (msg, kind) => {
        // o aviso das missões do dia fica mais tempo na tela: diz onde cada uma acontece
        toast(msg, kind, msg.startsWith('☀️ Sol') ? 15000 : undefined);
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
            state: ensureShielding(info.mission as ReturnType<typeof useMission.getState>['state']),
          });
          toast('💾 Mundo retomado de onde você parou.', 'ok');
        }
      },
      onRoomRejected: () => {
        // apelido em uso / sala cheia: volta ao início para escolher outro
        window.setTimeout(() => {
          clearPlaySession();
          nav('/');
        }, 1800);
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

  function leaveToHome() {
    clearPlaySession();
    nav('/');
  }

  async function saveAndLeave() {
    if (await saveWorld()) leaveToHome();
  }

  /** Mundo novo: sala nova e missão do zero (recarrega a base já na sala nova). */
  function newWorld() {
    clearMissionSnapshot();
    savePlaySession({ room: newRoomCode(), base: baseId });
    window.location.replace('/jogar');
  }

  /** Voltar ao último save: o servidor recarrega o mundo salvo e a página reabre nele. */
  async function restoreLastSave() {
    const v = viewer.current;
    if (!v || restoring) return;
    setRestoring(true);
    setRestoreError('');
    const r = await v.restoreWorld();
    if (r.ok) {
      clearMissionSnapshot();
      window.location.replace('/jogar');
      return;
    }
    setRestoring(false);
    setRestoreError(r.error);
  }

  /**
   * A decisão do evento chegou (a minha ou a da sala): aplica recursos na missão e efeitos no
   * mundo. Com a blindagem zerada, as perdas de energia, mantimentos e oxigênio saem em dobro.
   */
  function resolveEvent(event: GameEventDef, outcome: EventOutcome): EventOutcome {
    const shielding = useMission.getState().state.resources.shielding?.value ?? 100;
    const deltas = scaleDamage(outcome.deltas, shielding);
    const final: EventOutcome = deltas ? { ...outcome, deltas } : outcome;
    if (deltas && Object.values(deltas).some((v) => v)) {
      useMission.getState().run({
        type: 'reward',
        tone: final.tone,
        title: event.title,
        text: final.text,
        deltas,
      });
    }
    viewer.current?.applyEventEffects(final);
    return final;
  }

  // o fluxo de decisão dos eventos (pausa, votação, resultado) usa o viewer e o resolveEvent atuais
  const resolveRef = useRef(resolveEvent);
  resolveRef.current = resolveEvent;
  useEffect(() => {
    setEventFlowContext({
      viewer: () => viewer.current,
      apply: (event, outcome) => resolveRef.current(event, outcome),
    });
    return () => setEventFlowContext(null);
  }, []);

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

  const handleCopyInvite = async () => {
    const ok = await copyText(roomCode);
    if (ok) {
      toast(
        `Código exclusivo ${roomCode} copiado! Compartilhe com seu amigo (máx 4 jogadores).`,
        'ok',
      );
    } else {
      toast(`Não foi possível copiar. Selecione o código manualmente: ${roomCode}`, 'error');
    }
    return ok;
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
        id: 'dev:mission-test',
        label: viewer.current?.isMissionTestMode
          ? 'Teste de Missões: DESLIGAR'
          : 'Teste de Missões: LIGAR (todas, sem custo/horário)',
        group: 'Missões & Minigames',
        run: () => {
          const v = viewer.current;
          v?.setMissionTestMode(!v.isMissionTestMode);
          setDevTick((n) => n + 1);
        },
      }),
      ...(Object.keys(MISSIONS) as MissionId[]).map((id) =>
        registerDevAction({
          id: `dev:mission-done:${id}`,
          label: `Concluir: ${MISSIONS[id].title}`,
          group: 'Missões & Minigames',
          run: () => viewer.current?.devCompleteMission(id),
        }),
      ),
      ...(
        [
          ['Painel solar', { kind: 'solar', index: 0 }],
          ['Filtro de ar', { kind: 'oxygen', index: 0 }],
          ['Horta (estufa)', { kind: 'greenhouse', index: 0 }],
          ['Coleta de solo (rover)', { kind: 'soil' }],
        ] as Array<[string, MinigameRequest]>
      ).map(([label, req]) =>
        registerDevAction({
          id: `dev:minigame:${req.kind}`,
          label: `Abrir minigame: ${label}`,
          group: 'Missões & Minigames',
          run: () => setMinigame(req),
        }),
      ),
      ...GAME_EVENTS.map((ev) =>
        registerDevAction({
          id: `dev:event:${ev.id}`,
          label: `Evento (${ev.kind === 'major' ? 'grande' : 'fácil'}): ${ev.title}`,
          group: 'Eventos',
          run: () => useGameEvents.getState().push([ev]),
        }),
      ),
      ...Object.values(LORE).map((l) =>
        registerDevAction({
          id: `dev:lore:${l.id}`,
          label: `Curiosidade: ${l.title}`,
          group: 'Eventos',
          run: () => useLore.setState((st) => ({ queue: [...st.queue, l.id] })),
        }),
      ),
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
  }, [stormActive, gridVisible, navDebug, showCoords, roofsHidden, devTick]);

  if (!name) return <Navigate to="/" replace />;

  return (
    <main className={`game ${touch ? 'game--touch' : ''}`}>
      <RotateGate />
      {minigame &&
        createPortal(
          <Suspense fallback={null}>
            {minigame.kind === 'solar' ? (
              <SolarCleaningPreview onClose={closeMinigame} onComplete={finishMinigame} />
            ) : minigame.kind === 'oxygen' ? (
              <OxygenFilterPreview onClose={closeMinigame} onComplete={finishMinigame} />
            ) : minigame.kind === 'greenhouse' ? (
              <GreenhousePreview onClose={closeMinigame} onComplete={finishMinigame} />
            ) : minigame.kind === 'station' ? (
              <StationConsoleGame
                title={minigame.title}
                hint={minigame.hint}
                onClose={closeMinigame}
                onComplete={finishMinigame}
              />
            ) : minigame.kind === 'soil' ? (
              <SoilSamplingGame onClose={closeMinigame} onComplete={finishMinigame} />
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

        <MissionVeil />
        <EventFx />
        {touch && !loading && !error && intro === 'gone' && (
          <TouchJoystick viewer={viewer.current} />
        )}
        {/* Tablet de eventos: só com a base à vista (sem minigame, introdução nem fim de missão) */}
        {intro === 'gone' && !loading && !error && !minigame && eventsPending && <EventTablet />}
        {/* Curiosidades: só quando nada mais está na tela (eventos e minigames têm prioridade) */}
        {intro === 'gone' && !loading && !error && !minigame && !eventsPending && <LoreCard />}
        {duoInvite && (
          <div className="duo-invite" role="alert">
            <span>
              {duoInvite.name} quer fazer: {DUO_GESTURES[duoInvite.gesture].emoji}{' '}
              {DUO_GESTURES[duoInvite.gesture].label}
            </span>
            <button type="button" onClick={() => viewer.current?.acceptGesture()}>
              Aceitar
            </button>
          </div>
        )}
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
            onSendChat={(message) => viewer.current?.sendChat(message) ?? false}
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
          <MissionEnd
            onRestart={newWorld}
            onExit={leaveToHome}
            canRestore={persist.linked && persist.canSave}
            onRestore={() => void restoreLastSave()}
            restoring={restoring}
            restoreError={restoreError}
          />
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
                <button type="button" onClick={leaveToHome} disabled={saving}>
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

        {/* Introdução + carregamento: o texto é lido enquanto a base prepara */}
        {intro !== 'gone' && !error && (
          <div
            className={`game__loading game__intro ${intro === 'leaving' ? 'is-leaving' : ''}`}
            role="dialog"
            aria-label="Introdução da missão"
          >
            <img src="/assets/branding/mars-outpost-logo.svg" alt="" className="game__intro-logo" />
            <span className="game__loading-kicker">SOL 1 · ZONA DE POUSO · JEZERO</span>
            <h2 className="game__loading-title">Bem-vindo a Marte, {name ?? 'Explorador'}</h2>
            <div className="game__intro-text">
              <p>
                Sua cápsula pousou em Marte. Aqui o dia dura 24 h 39 min e a noite traz um frio que
                a base precisa vencer com energia, oxigênio e mantimentos.
              </p>
              <p>
                Sua missão: manter a base viva e produzir pesquisa. Limpe os painéis solares, troque
                o filtro de ar, cuide da horta (5 dias da muda à colheita) e cumpra as missões do
                dia. Quem faz tudo sozinho escolhe bem: cada missão gasta recursos.
              </p>
              <ul>
                <li>
                  <b>WASD</b> ou clique para andar · <b>T</b> abre as tarefas do Sol
                </li>
                <li>
                  No celular: use o <b>joystick</b> ou <b>toque num objeto</b> (painel, horta,
                  filtro, cama, rover…) e o astronauta vai até ele e usa
                </li>
                <li>
                  clique no rover para entrar · duplo clique nele para sair · arraste para girar a
                  câmera · role para dar zoom
                </li>
              </ul>
            </div>
            <button
              type="button"
              className="game__intro-btn"
              disabled={loading}
              onClick={() => {
                setIntro('leaving');
                window.setTimeout(() => setIntro('gone'), 600);
              }}
            >
              {loading ? 'Preparando a base…' : 'Começar missão'}
            </button>
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
