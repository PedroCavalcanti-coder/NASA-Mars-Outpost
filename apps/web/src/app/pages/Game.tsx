import ServerMinigame from '../minigames/ServerMinigame';
import { newRoomCode } from '../../lib/roomCode';
import { DUO_GESTURES, type DuoGestureId, WORLD_VISIBLE_AUTOSAVE_MS } from '@mars/shared';
import { ensureShielding, migrateMission } from '@mars/sim';
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
import { type EventOutcome, GAME_EVENTS, type GameEventDef } from '../../game/events/events';
import {
  onRemoteResult,
  onRemoteVote,
  scaleDamage,
  setEventFlowContext,
} from '../../game/events/flow';
import { useGameEvents } from '../../game/events/store';
import { emitGuideEvent } from '../../game/guide/events';
import { LORE, type LoreId } from '../../game/lore/lore';
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
  requestBase,
} from '../../lib/bases';
import { copyText } from '../../lib/clipboard';
import {
  clearMissionSnapshot,
  clearPlaySession,
  getPlaySession,
  savePlaySession,
  getPendingDifficulty,
} from '../../lib/gameSession';
import { useGameSettings } from '../../lib/gameSettings';
import { getGuestName } from '../../lib/guest';
import { useMission } from '../../store/mission';
import { toast } from '../../ui/toast';
import { BitGuide } from '../components/bit/BitGuide';
import { HudRoot } from '../components/hud/HudRoot';
import { MissionVeil } from '../components/hud/MissionVeil';
import { TouchJoystick, useIsTouch } from '../components/hud/TouchControls';
import { EventFx } from '../components/mission/EventFx';
import { EventTablet } from '../components/mission/EventTablet';
import { CriticalAlert } from '../components/mission/CriticalAlert';
import { IncidentCard } from '../components/mission/IncidentCard';
import { SolReport } from '../components/mission/SolReport';
import { LoreCard } from '../components/mission/LoreCard';
import { MissionEnd } from '../components/mission/MissionEnd';
import { SettingsModal } from '../components/SettingsModal';
import { IntroTutorial, introSeenBefore } from '../components/intro/IntroTutorial';
import { MinigameResult as ResultCard } from '../components/feedback/MinigameResult';
import { DevPanel } from '../components/DevPanel';
import { RadiationBanner } from '../components/hud/RadiationBanner';
import { ExpeditionHud } from '../components/expedition/ExpeditionHud';
import RepairMinigame from '../minigames/RepairMinigame';
import '../../styles/game.css';
import '../components/mission/mission.css';
import { Spinner } from '../../ui/Empty';
// por último: o layout de celular deitado vence as regras de largura da HUD e do B.I.T.
import '../components/hud/shortLandscape.css';
import { L, t } from '../../lib/i18n';

// Minigames das tarefas do Sol: carregados só quando abertos

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
  if (session?.entered && session.ready) return <ReadyGame />;
  // sem partida em andamento (digitou /jogar na barra de endereço): volta ao início, onde se
  // escolhe o traje e se faz a viagem; recarregar DENTRO do jogo continua a mesma partida
  if (!getPlaySession() && !session?.entered) return <RedirectHome />;
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
  if (base && BASE_IDS.includes(base as BaseId)) requestBase(base as BaseId);
  return <Navigate to={sala ? `/?sala=${encodeURIComponent(sala)}` : '/'} replace />;
}

/** Curiosidade ligada ao equipamento de cada minigame (aparece no primeiro uso). */
function loreForMinigame(req: MinigameRequest): LoreId | null {
  switch (req.kind) {
    case 'solar':
      return 'solar';
    case 'oxygen':
      return 'oxygen';
    case 'greenhouse':
      return 'garden';
    case 'drill':
      return 'drill';
    case 'soil':
      return 'rover';
    case 'moxie':
      return 'oxygen';
    case 'water':
      return 'water';
    case 'upload':
      return 'antenna';
    case 'station': {
      const site = MISSIONS[req.mission]?.site;
      if (site === 'lab') return 'lab';
      if (site === 'comms') return 'antenna';
      if (site === 'power') return 'power';
      if (site === 'medical') return 'medical';
      return null;
    }
    default:
      return null;
  }
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
            <h2 className="game__loading-title">{L('Não foi possível retomar', 'Could not resume')}</h2>
            <p>{error}</p>
            <button
              type="button"
              className="game__intro-btn"
              onClick={() => {
                clearPlaySession();
                nav('/', { replace: true });
              }}
            >
              {L('Voltar ao início', 'Back to start')}
            </button>
          </>
        ) : (
          <>
            <span className="game__loading-kicker">{L('RETOMANDO A MISSÃO', 'RESUMING THE MISSION')}</span>
            <h2 className="game__loading-title">{L('Voltando para a sua base…', 'Heading back to your base…')}</h2>
          </>
        )}
      </div>
    </main>
  );
}

function ReadyGame() {
  const name = getGuestName();
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

  // Quem só tem o código (convite) nunca cria a sala; quem a abriu ou já estava nela pode recriá-la.
  const [createRoom] = useState(
    () => !queryRoom || getPlaySession()?.room === queryRoom.toUpperCase(),
  );
  // Código sorteado aqui (ou no "Mundo novo"): o servidor confirma que não é de outro mundo.
  const [freshRoom] = useState(() => !queryRoom && (!getPlaySession() || !!getPlaySession()?.fresh));
  const [roomCode, setRoomCode] = useState(() => {
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
  const [error, setError] = useState<string | null>(null);
  const [minigame, setMinigame] = useState<MinigameRequest | null>(null);
  /** minigame esperando o jogador fechar a curiosidade do equipamento */
  const [pendingMinigame, setPendingMinigame] = useState<MinigameRequest | null>(null);
  const loreOpen = useLore((s) => s.queue.length > 0);
  useEffect(() => {
    if (loreOpen || !pendingMinigame) return;
    setMinigame(pendingMinigame);
    setPendingMinigame(null);
  }, [loreOpen, pendingMinigame]);
  const uploadDone = useRef(false);
  const closeMinigame = useCallback(() => {
    // fechar no meio só libera a tarefa no servidor (o ServerMinigame cancela a tentativa)
    if (minigame?.kind === 'soil') viewer.current?.abortSoilRun();
    uploadDone.current = false;
    setMinigame(null);
  }, [minigame]);
  /** o minigame foi concluído: o viewer aplica o efeito no mundo (painel limpo, canteiro cuidado…) */
  const finishMinigame = useCallback(
    (result?: MinigameResult) => {
      if (minigame?.kind === 'upload') uploadDone.current = true;
      if (minigame) viewer.current?.completeMinigame(minigame, result);
    },
    [minigame],
  );

  // Com um minigame aberto por cima, a base fica carregada mas para de desenhar
  // (a simulação segue pelo relógio de apoio: numa sala, o mundo não para para os outros).
  useEffect(() => {
    viewer.current?.setRepairOpen(minigame?.kind === 'repair');
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
  // abre o tutorial uma vez por sala: sempre num mundo novo; num mundo já visto só na 1ª vez do aparelho
  useEffect(() => {
    if (loading || error || introFor.current === roomCode) return;
    introFor.current = roomCode;
    let shown = false;
    try {
      shown = sessionStorage.getItem(`mo_intro:${roomCode}`) === '1';
      sessionStorage.setItem(`mo_intro:${roomCode}`, '1');
    } catch {
      /* sem sessionStorage: mostra só desta vez */
    }
    if (!shown && (freshRoom || !introSeenBefore())) setIntroOpen(true);
  }, [loading, error, roomCode, freshRoom]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const startMission = useMission((m) => m.start);
  const missionStarted = useMission((m) => m.state.log.length > 0 && m.state.status === 'playing');

  // Cada base sorteada começa uma missão nova (exceto ao recarregar a página: a missão volta).
  useEffect(()=>{savePlaySession({room:roomCode,base:baseId});useGameEvents.getState().clear();},[baseId,roomCode]);


  const [emoteCooling, setEmoteCooling] = useState(false);
  // força o DevPanel a atualizar rótulos de ações que mudam de estado
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
  const [players, setPlayers] = useState<{
    count: number;
    mode: 'online' | 'local';
    status?: 'connected' | 'reconnecting' | 'failed';
  }>({
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
  // tutorial de abertura: o personagem fica parado enquanto os painéis estão na tela
  const [introOpen, setIntroOpen] = useState(false);
  const introFor = useRef('');
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
      onGuideEvent: emitGuideEvent,
      roomCode,
      createRoom,
      freshRoom,
      difficulty: getPendingDifficulty(),
      onRoomCodeChange: (code) => {
        if (alive) setRoomCode(code);
      },
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
                ? '🌪️ Tempestade de poeira chegando à base!'
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

      },
      onRoomBaseChange: (id) => {
        if (BASE_IDS.includes(id as BaseId)) setBaseId(id as BaseId);
        else {
          clearPlaySession();
          nav('/');
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
        if (!alive) return;
        // primeira vez neste equipamento: a curiosidade dele abre antes do minigame
        const lore = loreForMinigame(req);
        if (lore && !useLore.getState().seen.includes(lore)) {
          useLore.getState().request(lore);
          setPendingMinigame(req);
        } else setMinigame(req);
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
          previous?.dispose();
          replacement.activate(el, options);
          viewer.current = replacement;
          setInfo(meta);
          setLoading(false);
        })
        .catch((e) => {
          if (!alive) return;
          replacement?.dispose();
          console.error(e);
          setError(L('Não foi possível preparar outra base.', 'Could not prepare another base.'));
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

  async function saveWorld(silent = false) {
    const v = viewer.current;
    if (!v) return false;
    if (!silent) {
      setSaving(true);
      setSaveError('');
    }
    const r = await v.saveWorld();
    if (r.ok) setPersist((p) => ({ ...p, linked: true }));
    if (!silent) {
      setSaving(false);
      if (!r.ok) setSaveError(r.error);
    }
    return r.ok;
  }

  // Salvamento automático a cada 10 minutos (com aviso). Sem cookie de salvamento o servidor
  // continua guardando o mundo, mas ele não entra em "Meus mundos".
  const saveRef = useRef(saveWorld);
  saveRef.current = saveWorld;
  useEffect(() => {
    if (!persist.canSave) return;
    const id = window.setInterval(() => {
      void saveRef.current(true).then((ok) => {
        if (ok) toast('💾 Jogo salvo automaticamente.', 'ok');
      });
    }, WORLD_VISIBLE_AUTOSAVE_MS);
    return () => window.clearInterval(id);
  }, [persist.canSave]);

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

  /** Mundo novo: sala nova, missão do zero e outra base sorteada. */
  function newWorld() {
    clearMissionSnapshot();
    savePlaySession({ room: newRoomCode(), base: pickRandomBase(baseId), fresh: true });
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
  function resolveEvent(_event: GameEventDef,outcome: EventOutcome): EventOutcome {return outcome;}


  // o fluxo de decisão dos eventos (pausa, votação, resultado) usa o viewer e o resolveEvent atuais
  const resolveRef = useRef(resolveEvent);
  resolveRef.current = resolveEvent;
  useEffect(() => {
    setEventFlowContext({
      viewer: () => viewer.current,
      apply: (event: GameEventDef, outcome: EventOutcome) => resolveRef.current(event, outcome),
    });
    return () => setEventFlowContext(null);
  }, []);

  function rollBase() {
    if (missionStarted && !window.confirm(L('Sortear outra base reinicia a missão atual. Continuar?', 'Picking another base restarts the current mission. Continue?')))
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


  if (!name) return <Navigate to="/" replace />;

  return (
    <main className={`game ${touch ? 'game--touch' : ''}`}>
      {!loading && !error && (
        <BitGuide
          key={`${name}:${baseId}`}
          identity={String(name)}
          viewer={viewer.current}
          minigame={minigame}
          suspended={settingsOpen || leaveOpen || introOpen}
          driving={driving}
        />
      )}
      {minigame &&
        createPortal(
          <Suspense fallback={null}>
            {minigame.kind === 'repair' ? (
              <RepairMinigame id={minigame.id} viewer={viewer.current} onClose={closeMinigame} />
            ) : (
              <ServerMinigame
                request={minigame}
                viewer={viewer.current}
                onClose={closeMinigame}
                onComplete={finishMinigame}
                onError={(message) => toast(`Tarefa não registrada: ${message}`, 'error')}
              />
            )}
          </Suspense>,
          document.body,
        )}
      {/* votação da sala aberta durante um minigame: o tablet vem por cima (ninguém perde o voto) */}
      {!loading &&
        !error &&
        minigame &&
        eventsPending &&
        createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 3000 }}>
            <EventTablet />
          </div>,
          document.body,
        )}
      {/* `display: contents` mantém o layout; `inert` bloqueia a base enquanto o minigame está aberto */}
      <div className="game__interface" style={{ display: 'contents' }} inert={minigame !== null || introOpen}>
        <div className="game__canvas" ref={mount} />

        <MissionVeil />
        <EventFx />
        {touch && !loading && !error && (
          <TouchJoystick viewer={viewer.current} />
        )}
        {/* Tablet de eventos: só com a base à vista (sem minigame nem fim de missão) */}
        {!loading && !error && !minigame && eventsPending && <EventTablet />}
        {/* Curiosidades: só quando nada mais está na tela (eventos e minigames têm prioridade) */}
        {!loading && !error && <IncidentCard hidden={!!minigame || eventsPending} />}
        {!loading && !error && <SolReport hidden={!!minigame || eventsPending} />}
        {!loading && !error && (
          <CriticalAlert
            hidden={!!minigame || eventsPending}
            onGo={() => viewer.current?.goToCritical()}
          />
        )}
        {!loading && !error && !minigame && !introOpen && <ExpeditionHud />}
        {!loading && !error && !minigame && !introOpen && <RadiationBanner hour={marsTime.hour} sol={marsTime.sol} />}
        {!loading && !error && !minigame && !eventsPending && !introOpen && <LoreCard />}
        {duoInvite && (
          <div className="duo-invite" role="alert">
            <span>
              {duoInvite.name} {L('quer fazer:', 'wants to do:')}{' '}
              {DUO_GESTURES[duoInvite.gesture].emoji} {t(DUO_GESTURES[duoInvite.gesture].label)}
            </span>
            <button type="button" onClick={() => viewer.current?.acceptGesture()}>
              {L('Aceitar', 'Accept')}
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
            onSaveWorld={() => {
              if (!persist.canSave) {
                toast('Para salvar, permita o cookie de salvamento na tela inicial.', 'error');
                return;
              }
              void saveWorld(true).then((ok) => {
                toast(ok ? '💾 Mundo salvo!' : 'Não foi possível salvar agora. Tente de novo.', ok ? 'ok' : 'error');
                if (ok) emitGuideEvent({ type: 'saved' });
              });
            }}
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
              <h2 id="leave-title">{L('Salvar o mundo antes de sair?', 'Save the world before leaving?')}</h2>
              <p>
                {persist.canSave
                  ? L('O mundo fica ligado à sua conta/navegador por 30 dias (entrar de novo renova). O servidor preserva o progresso da sala.', 'The world stays linked to your browser for 30 days (joining again renews it). The server keeps the room\'s progress.')
                  : L('Para salvar é preciso permitir o cookie de salvamento na tela inicial ou entrar na sua conta. Você pode sair sem salvar.', 'To save you need to allow the save cookie on the home screen. You can leave without saving.')}
              </p>
              {saveError && (
                <p className="game__leave-error" role="alert">
                  {saveError}
                </p>
              )}
              <div className="game__leave-actions">
                <button type="button" onClick={() => setLeaveOpen(false)} disabled={saving}>
                  {L('Continuar jogando', 'Keep playing')}
                </button>
                <button type="button" onClick={leaveToHome} disabled={saving}>
                  {L('Sair sem salvar', 'Leave without saving')}
                </button>
                {persist.canSave && (
                  <button
                    type="button"
                    className="game__leave-save"
                    onClick={() => void saveAndLeave()}
                    disabled={saving}
                  >
                    {saving ? L('Salvando…', 'Saving…') : L('Salvar e sair', 'Save and leave')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && !error && (
          <div className="game__loading" role="status">
            <h2 className="game__loading-title">{L('Preparando a base…', 'Preparing the base…')}</h2>
          </div>
        )}

        {/* Estado de Erro */}
        {error && (
          <div className="game__error-dialog">
            <div className="game__error-card" role="alert">
              <TriangleAlert size={28} className="game__error-icon" />
              <div>
                <h3>{L('Falha no carregamento', 'Loading failed')}</h3>
                <p>{error}</p>
              </div>
              <button
                type="button"
                className="game__action-btn"
                onClick={() => setBaseId((cur) => pickRandomBase(cur))}
              >
                {L('Tentar outra base', 'Try another base')}
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
          onReplayTutorial={() => setIntroOpen(true)}
        />
        {import.meta.env.DEV && <DevPanel />}
        <ResultCard />
        {introOpen && (
          <IntroTutorial canSkip={introSeenBefore()} onClose={() => setIntroOpen(false)} />
        )}
      </div>
    </main>
  );
}
