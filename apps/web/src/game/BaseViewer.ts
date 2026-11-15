import { GAMEPLAY_TARGETS, type GamePayload, type GameplayState } from '@mars/shared';
import { gameplayCommand, useGameplay } from '../store/gameplay';
import {
  NAVIGATION_HASH,
  mapTransform,
  mapDirection,
  navigationData,
  neutralInput,
  type MovementSnapshot,
} from '@mars/shared';
import { MovementClient } from './MovementClient';
import {
  applyMissionEvent,
  armorValue,
  BASE_EVENTS,
  DUO_GESTURES,
  type DuoGestureId,
  duoPartnerPosition,
  formatSolClock,
  GAME_EMOTES,
  GAME_MAX_SOLAR,
  type GameCareState,
  type GameMissionBoard,
  type GameMissionEvent,
  type GameMotion,
  GESTURE_INVITE_TTL_MS,
  GESTURE_MAX_DISTANCE,
  type GestureStart,
  type IntegrityState,
  leakRate,
  normalizeTimeScale,
  type RepairIntent,
} from '@mars/shared';
import { checkOutcome, UPLOAD_THRESHOLD } from '@mars/sim';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { VideoSettings } from '../app/components/SettingsModal';
import { type BaseId, type BaseInfo, baseModelUrl } from '../lib/bases';
import { isGameOverlayOpen } from '../lib/gameOverlay';
import { useGameSettings } from '../lib/gameSettings';
import { getGuestName } from '../lib/guest';
import { loadGLB } from '../lib/modelCache';
import { readSuitPreference } from '../lib/suitPreference';
import { useMission } from '../store/mission';
import { AstronautActor, type Collider, type MoveContext } from './AstronautActor';
import { marsSky, SkyDome } from './Atmosphere';
import {
  type BaseFullLayout,
  BaseGrid,
  FLOOR_Y,
  GROUND_Y,
  PLAYER_RADIUS,
  STORM_SAFE_RADIUS,
} from './BaseGrid';
import { applyBoundaryFog, setEdgeFog } from './boundaryFog';
import { CropSystem } from './Crops';
import { DoorSystem } from './Doors';
import { DustStorm, DustStormOverlay } from './DustStorm';
import { type EventOutcome, eventsForSol, type WorldEffect } from './events/events';
import { useGameEvents } from './events/store';
import type { GuideEvent } from './guide/events';
import { IntegrityVisuals } from './IntegrityVisuals';
import { InteriorFader } from './InteriorFader';
import { LifeSupportStations } from './LifeSupportStations';
import { useLore } from './lore/store';
import {
  MultiplayerRoom,
  RoomBaseMismatchError,
  type RemotePlayer,
  type RoomMode,
  RoomRejectedError,
} from './MultiplayerRoom';
import {
  COOP_COST_MULT,
  COOP_POINTS_MULT,
  costText,
  cropGraceDays,
  describeDirection,
  GARDEN_CARE_COST,
  GARDEN_LITRES_PER_SUPPLY,
  GARDEN_OXYGEN_BONUS,
  gardenComplete,
  MISSIONS,
  type MissionContext,
  type MissionId,
  type MissionSite,
  missionBlock,
  missionsForSol,
  roomLabel,
  STATION_LABEL,
  type StationSite,
  soilReward,
  soilSamples,
  stationRoomIndex,
} from './missions/rules';
import { StationMarkers } from './missions/StationMarkers';
import { useSoilCoop } from './missions/soilCoop';
import { publishMissionBoard, resetMissionBoard, type SoilPhase } from './missions/store';
import { NightLights } from './NightLights';
import { Propulsion } from './Propulsion';
import { InvertedHullManager, type OutlineOptions, OutlineSystem } from './render/Outline';
import type { AssetPool } from './runtime/assets';
import type { GameRuntime } from './runtime/expedition';
import { batchStaticMeshes, freezeStatic } from './StaticBatcher';
import { GameClock } from './sim/clock';
// [seam:survival]
import type { SystemContext } from './systems/context';
import { GameSystemRegistry } from './systems/registry';
import { TaskMarkers } from './TaskMarkers';
import { targetLayer } from './tasks/drilling';
import {
  caredToday,
  cropDead,
  dustStage,
  dustStep,
  filterClogged,
  GRID,
  gridLoad,
  gridStep,
  hashString,
  MAX_DUST,
  OXYGEN_PLANT,
  panelDustRate,
  SOL_SECONDS,
  seeded,
  solarGeneration,
} from './tasks/rules';
import { publishOps, resetOps, tasksFrom, useBaseOps } from './tasks/store';
import { Rover } from './Vehicle';
import './survival';

export const MARS_SOL_DURATION_SECONDS = 600;

/** Tempos da chegada: a nave desce, o astronauta desembarca e a nave decola. */
const LANDING_SECONDS = 3.8;
const HOLD_SECONDS = 1.0;
const DEPARTURE_SECONDS = 4.2;

/** Passo máximo da simulação (s): a lógica é a mesma com 60 fps ou depois de minutos em segundo plano. */
const SIM_STEP = 1 / 30;
const MAX_CATCHUP_SECONDS = 20;

/** Distâncias (u) para considerar que o astronauta "chegou" ao alvo de uma tarefa. */
const TASK_REACH = 6.5;
const ENTER_REACH = 3.4;
/** intervalo máximo entre os dois cliques no rover para sair dele */
const DOUBLE_CLICK_MS = 400;

function shade(root: THREE.Object3D, cast = true) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = true;
    }
  });
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

export interface BaseViewerOptions {
  onGuideEvent?: (event: GuideEvent) => void;
  roomCode?: string;
  initialHour?: number;
  initialSol?: number;
  videoSettings?: VideoSettings;
  /** linha de contorno inicial (ver `setOutlineSettings`) */
  outlineSettings?: Pick<OutlineOptions, 'enabled' | 'strength' | 'color'>;
  onTimeUpdate?: (info: { hour: number; sol: number; isDay: boolean; formatted: string }) => void;
  onCoordinateUpdate?: (info: { gx: number; gy: number; inside: boolean }) => void;
  onStormAlert?: (msg: string) => void;
  onStormChange?: (active: boolean, remote: boolean) => void;
  onSolarCleaned?: () => void;
  /** abre um minigame por cima da base (tarefas do Sol) */
  onMinigame?: (req: MinigameRequest) => void;
  onCameraModeChange?: (mode: 'follow' | 'free') => void;
  onPlayersChange?: (info: {
    count: number;
    mode: RoomMode;
    status?: 'connected' | 'reconnecting' | 'failed';
  }) => void;
  onRoomError?: (msg: string) => void;
  /** avisos do jogo (tarefa concluída, alvo inválido…) */
  onMessage?: (msg: string, kind: 'ok' | 'error' | 'info') => void;
  /** outro jogador convidou para um gesto em dupla (null = o convite acabou) */
  onGestureInvite?: (
    invite: { fromId: string; name: string; gesture: DuoGestureId } | null,
  ) => void;
  /** um emoji foi enviado (por mim ou por outro jogador): alimenta o chat */
  onChat?: (info: { name: string; message: string; local: boolean }) => void;
  /** alguém da sala votou num evento da base */
  onEventVote?: (id: string, eid: string, choice: number) => void;
  /** a decisão final de um evento chegou (todos aplicam igual) */
  onEventResult?: (eid: string, choice: number, roll: number) => void;
  onEmote?: (info: { name: string; emoji: string; local: boolean }) => void;
  /** a sala recusou a entrada (apelido em uso, sala cheia): a interface deve voltar ao início */
  onRoomRejected?: () => void;
  onRoomBaseChange?: (baseId: string) => void;
  /** estado de salvamento do mundo ao entrar */
  onWorldInfo?: (info: { linked: boolean; canSave: boolean; mission?: unknown }) => void;
  /** o jogador entrou/saiu do rover */
  onVehicleChange?: (driving: boolean) => void;
}

interface Arrival {
  actor: AstronautActor;
  spawn: THREE.Vector3;
  heading: number;
}

type ShipPhase = 'away' | 'landing' | 'hold' | 'depart';

/** O que o jogador está indo fazer quando terminar de andar. */
type PendingTask =
  | { kind: 'clean'; index: number; face: THREE.Vector3 }
  | { kind: 'crop'; index: number; face: THREE.Vector3 }
  | { kind: 'filter'; index: number; face: THREE.Vector3 }
  | { kind: 'oxygen_station'; face: THREE.Vector3 }
  | { kind: 'water_station'; face: THREE.Vector3 }
  | { kind: 'drill'; face: THREE.Vector3 }
  | { kind: 'station'; site: StationSite; face: THREE.Vector3 }
  | { kind: 'prop'; prop: SceneryProp; index: number; face: THREE.Vector3 }
  | { kind: 'soilstart'; face: THREE.Vector3 }
  | { kind: 'enter'; face: THREE.Vector3 }
  | { kind: 'repair'; id: number; face: THREE.Vector3 }
  | { kind: 'goto'; face: THREE.Vector3 };

/** Minigame que o viewer pede para a interface abrir (e que volta em `completeMinigame`). */
export type MinigameRequest =
  | { kind: 'repair'; id: number }
  | { kind: 'solar'; index: number }
  | { kind: 'greenhouse'; index: number }
  | { kind: 'oxygen'; index: number }
  | { kind: 'drill'; baseId: string; target: string; sol: number }
  | { kind: 'station'; mission: MissionId; title: string; hint: string }
  | { kind: 'soil'; coop?: boolean; role?: 'driver' | 'passenger' }
  | { kind: 'upload' };

/** Resultado de um minigame concluído. */
export type MinigameResult = {
  research?: number;
  layerName?: string;
  hit?: boolean;
  /** nota 0..1 dos minigames de missão (calibragem e coleta de solo) */
  quality?: number;
  /** água usada no cuidado da horta (unidades do minigame; ~10 L cada) */
  waterUsed?: number;
};

type SceneryProp = 'bed' | 'bench' | 'rock';

/** Resultado de um clique no cenário. */
type PickResult =
  | { type: 'prop'; prop: SceneryProp; index: number }
  | { type: 'repair'; id: number }
  | { type: 'solar'; index: number }
  | { type: 'crop'; index: number }
  | { type: 'filter'; index: number }
  | { type: 'oxygen_station' }
  | { type: 'water_station' }
  | { type: 'drill' }
  | { type: 'station'; site: StationSite }
  | { type: 'vehicle' }
  | { type: 'floor'; point: THREE.Vector3 }
  | { type: 'surface'; point: THREE.Vector3; normal: THREE.Vector3 }
  | { type: 'roof'; point: THREE.Vector3 }
  | { type: 'none' };

/** Tempo (s) até a Terra confirmar o pacote de dados da antena (a luz leva minutos até Marte). */
const ANTENNA_DELAY_S = 25;

/** Divisor de tarefas que roda mesmo com a aba escondida (timers comuns são freados a 1/s). */
function createBackgroundTicker(onTick: () => void): () => void {
  try {
    const src = 'let t=setInterval(()=>postMessage(0),100);onmessage=()=>clearInterval(t)';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = onTick;
    return () => {
      worker.postMessage(0);
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = window.setInterval(onTick, 250);
    return () => window.clearInterval(id);
  }
}

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el?.tagName) return false;
  return (
    el.isContentEditable ||
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT'
  );
}

export class BaseViewer {
  private guideMoved = false;
  get guideReady() {
    return Boolean(this.localAstronaut?.isRevealed);
  }
  private integrityVisuals: IntegrityVisuals | null = null;
  private integrityLeak = 0;
  private integrityOutlines = new Set<THREE.Object3D>();
  private stopIntegritySubscription?: () => void;
  private repairOpen = false;
  private repairPaused = false;
  private hazardReady = false;
  private eventSeen = -1;
  private integrityWarning = new Set<string>();
  private readonly renderer: THREE.WebGLRenderer;
  /** linha de contorno (desligada por padrão; ligada nas configurações de vídeo) */
  private readonly outline: OutlineSystem;
  /** Indicação de interação, independente do contorno opcional das configurações de vídeo. */
  private readonly interactionOutline = new InvertedHullManager({
    enabled: true,
    color: '#ffffff',
    strength: 2,
  });
  private readonly scene = new THREE.Scene();
  private readonly taskMarkers = new TaskMarkers(this.scene);
  private readonly taskMarkerPositions = new Map<string, THREE.Vector3>();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 900);
  private readonly controls: OrbitControls;
  private readonly resizeObserver: ResizeObserver;
  private options?: BaseViewerOptions;
  private mixer: THREE.AnimationMixer | null = null;
  private frame = 0;
  private disposed = false;
  private stopTicker: (() => void) | null = null;
  private lastStep = performance.now();
  private lastRender = performance.now();
  /** último quadro desenhado pelo requestAnimationFrame (se parar, o relógio de apoio assume) */
  private lastFrame = performance.now();
  /** relógio da simulação (s): avança igual dentro e fora de foco */
  private simTime = 0;

  // Clima e atmosfera
  private readonly skyDome: SkyDome;
  private readonly dustStorm = new DustStorm();
  private dustOverlay: DustStormOverlay | null = null;
  /** raízes vindas do AssetPool (compartilhadas): quem as libera é o pool, não nós */
  private pooledRoots: THREE.Object3D[] = [];
  private urls: string[] = [];
  private started = false;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly groundSkirt: THREE.Mesh;
  private stormTarget = 0;
  private stormCurrent = 0;
  private stormAudio: HTMLAudioElement | null = null;
  private stormAudioStarting = false;
  private stormAudioRetryAt = 0;
  private currentReducedMotion = false;
  private stormAlertShown = false;

  // Ciclo dia/noite
  private currentHour = 9;
  private currentSol = 1;
  private lastReportedMinute = -1;
  private lastAtmosphereHour = -99;
  private lastAtmosphereStorm = -1;

  // Câmera
  private view = 28;
  private cameraMode: 'follow' | 'free' = 'follow';
  private readonly cameraFocus = new THREE.Vector3();

  // Grade, colisões e navegação
  private grid: BaseGrid | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly planeFloor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y);
  private readonly planeGround = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
  private readonly clickDownPos = new THREE.Vector2();
  /** hora do último clique no rover enquanto dirige (duplo clique = sair) */
  private lastRoverClick = 0;
  private interior: InteriorFader | null = null;
  private lights: NightLights | null = null;
  /** 0 dia … 1 noite fechada (vem do céu) */
  private nightFactor = 0;
  private doors: DoorSystem | null = null;
  private roofsAlwaysHidden = false;
  /** raízes testadas no clique: a base, o terreno e os volumes de clique das plantações */
  private pickRoots: THREE.Object3D[] = [];

  // Anel de destino
  private readonly destinationRing: THREE.Mesh;
  private ringFade = 0;

  // Astronautas (local e remotos)
  private localAstronaut: AstronautActor | null = null;
  private footstepAudio: [HTMLAudioElement, HTMLAudioElement] | null = null;
  private metalFootstepAudio: [HTMLAudioElement, HTMLAudioElement] | null = null;
  private nextFootstep = 0;
  private footstepDistance = 0;
  private readonly doorSounds = new Set<HTMLAudioElement>();
  private movementClient: MovementClient | null = null;
  private movementActionPending = false;
  private readonly remoteAstronauts = new Map<string, AstronautActor>();
  private readonly remoteList: AstronautActor[] = [];
  private pending: PendingTask | null = null;
  private repathCount = 0;

  // [seam:survival] subsistemas de simulação e controle de estado
  readonly systems = new GameSystemRegistry();
  private exitBlocked = false;
  private playerBlocked = false;
  private playerSpeedScale = 1;
  private fadeOverlay: HTMLDivElement | null = null;
  private systemContext: SystemContext | null = null;

  // Teclado
  private readonly keys = new Set<string>();
  private lastInputKey = '';

  // Rover
  private rover: Rover | null = null;
  private roverDriver: 'local' | string | null = null;
  /** o jogador local é o passageiro do rover (o rover tem 2 lugares: motorista e passageiro) */
  private roverRider = false;
  /** direção do joystick virtual (toque): x para a direita, y para cima, -1..1 */
  private virtualMove = { x: 0, y: 0 };
  private roverRemoteTarget: { x: number; z: number; h: number } | null = null;
  private readonly roverCollider: Collider;
  private roverPark = { x: 0, z: 0, h: 0 };

  // Plantações
  private crops: CropSystem | null = null;

  // Multiplayer
  private room: MultiplayerRoom | null = null;
  /** viewer que controla o GameClock global agora (o último ativado) */
  private static clockOwner: BaseViewer | null = null;
  private netAcc = 0;
  private lastSent: GameMotion | null = null;

  // Painéis solares e poeira
  private solarPanels: Array<{ mesh: THREE.Mesh; stage: number; parentPos: THREE.Vector3 }> = [];
  private solarDustMats: THREE.MeshStandardMaterial[] = [];
  /** poeira contínua de cada painel (0..4); o estágio visível é a parte inteira */
  private solarDust: number[] = [];
  private dustRates: number[] = [];
  /** semente das tarefas/poeira desta sala (igual para todos os jogadores) */
  private opsSeed = 0;
  /** cuidados diários compartilhados (horta e filtro) */
  private care: GameCareState = { crops: [], filter: 0 };
  /** Sol visto no último quadro (para detectar a virada do dia) */
  private opsSol = 0;
  private opsTimer = 0;
  private panelsCleanedToday: number[] = [];
  /** bateria com fração (a missão guarda inteiros) e último valor escrito nela */
  private batteryFloat = -1;
  private batteryWritten = -1;
  private oxygenAcc = 0;
  private lowOxygenWarned = false;
  /** segundos de mundo até a tempestade de um evento acabar */
  private eventStormLeft = 0;
  private generation = 0;
  private blackout = false;
  private filterSpots: THREE.Vector3[] = [];
  /** onde ficam as camas e as bancadas (objetos do cenário) */
  private propSpots: Record<'bed' | 'bench', THREE.Vector3[]> = { bed: [], bench: [] };
  private benchUse = { sol: 0, n: 0, repairs: 0 };
  /** amostras de rocha do dia, do lado de fora da base */
  private rocks: Array<{ mesh: THREE.Mesh; proxy: THREE.Mesh; taken: boolean }> = [];
  private rocksGroup = new THREE.Group();
  private rocksSol = 0;
  private readonly rockGeo = new THREE.DodecahedronGeometry(0.42, 0);
  private readonly rockMat = new THREE.MeshStandardMaterial({
    color: 0xa9693f,
    roughness: 1,
    flatShading: true,
    emissive: 0x1d6f58,
    emissiveIntensity: 0.6,
  });
  private readonly rockProxyGeo = new THREE.SphereGeometry(1.25, 8, 6);
  private readonly rockProxyMat = new THREE.MeshBasicMaterial({ visible: false });
  /** tipo do último ponteiro (toque ou mouse): o toque tem mais folga para acertar objetos */
  private lastPointerType = 'mouse';
  private drillSpot: THREE.Vector3 | null = null;

  // Missões de pesquisa (sorteadas por Sol; o quadro das concluídas é compartilhado pela sala)
  private missionIds: MissionId[] = [];
  /** sem sala (ou sem servidor): quadro só deste jogador */
  private localBoard: GameMissionBoard | undefined;
  private stationMarkers: StationMarkers | null = null;
  private lifeSupportStations: LifeSupportStations | null = null;
  private oxygenStationUse = { sol: 0, n: 0 };
  private waterStationUse = { sol: 0, n: 0 };
  private stationInfo = new Map<StationSite, { label: string; pos: THREE.Vector3 }>();
  private missionTimer = 0;
  private beaconsOn = true;
  /** amostras de solo que o jogador carrega até o computador */
  private soilCarry = 0;
  private soilQuality = 0;
  /** coleta de solo aberta (minigame no ponto marcado) */
  private soil: {
    eid: string;
    coop: boolean;
    /** minha nota (0..1) e a do parceiro */
    mine: number | null;
    partner: number | null;
  } | null = null;
  /** ponto de coleta de solo: é preciso dirigir até lá, dentro do rover */
  private soilSite: THREE.Vector3 | null = null;
  private soilBlockWarned = false;
  /** quem já apertou para pular a noite (todos os presentes precisam apertar) */
  /** a coleta que gerou as amostras carregadas foi em dupla (custo ×2, pontos ×3)? */
  private soilCoopRun = false;
  /** só abre de novo depois de se afastar do ponto (evita reabrir ao cancelar) */
  private soilArmed = true;

  // Nave: pouso -> desembarque -> decolagem, uma chegada por vez
  private ship: THREE.Object3D | null = null;
  private readonly shipRest = new THREE.Vector3();
  private readonly shipRestWorld = new THREE.Vector3();
  private readonly shipFx = new Propulsion();
  private shipPhase: ShipPhase = 'away';
  private shipT = 0;
  private shipArrival: Arrival | null = null;
  private readonly arrivals: Arrival[] = [];
  /** pontos de desembarque (um por vaga da sala), válidos para ESTA base */
  private spawnPoints: THREE.Vector3[] = [];

  // Sombras: o mapa só é refeito quando algo que projeta sombra mudou
  private shadowDirty = true;
  private lastSunHour = -99;
  private lastShadowUpdate = 0;

  readonly ready: Promise<void>;

  /**
   * O mundo é montado (e pode ficar escondido, preparado durante a viagem) pelo construtor;
   * `activate` o coloca na tela, entra na sala e começa o jogo. Com `runtime`, o renderer é o
   * compartilhado da expedição e os modelos vêm do `AssetPool`.
   */
  constructor(
    private container: HTMLElement,
    private readonly info: BaseInfo,
    private readonly runtime?: GameRuntime,
    private readonly assets?: AssetPool,
  ) {
    const self = this;
    const farAway = new THREE.Vector3(0, 0, 9999);
    this.roverCollider = {
      get position() {
        return self.rover?.position ?? farAway;
      },
      radius: 1.5,
      get isCollidable() {
        return !!self.rover && self.roverDriver !== 'local';
      },
    };

    const coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer =
      runtime?.renderer ??
      new THREE.WebGLRenderer({ antialias: !coarse, powerPreference: 'high-performance' });
    if (!runtime) this.configureRenderer(coarse);
    this.outline = new OutlineSystem(this.renderer, this.scene, this.camera);

    this.skyDome = new SkyDome(380, true);
    this.scene.add(this.skyDome.mesh);

    this.scene.fog = new THREE.Fog(0xe0b48c, 240, 520);
    setEdgeFog(55, 90);

    const { bounds: b } = info;
    const spanX = (b.x1 - b.x0) * 3;
    const spanY = (b.y1 - b.y0) * 3;
    const radius = Math.hypot(spanX, spanY) / 2 + 12;
    this.view = Math.max(28, radius * 0.82);

    const skirtGeo = new THREE.RingGeometry(80, 520, 64, 4);
    skirtGeo.rotateX(-Math.PI / 2);
    this.groundSkirt = new THREE.Mesh(
      skirtGeo,
      new THREE.MeshStandardMaterial({
        color: 0xc48052,
        roughness: 0.95,
        metalness: 0.02,
        fog: true,
      }),
    );
    this.groundSkirt.position.set(0, -1.0, 0);
    this.groundSkirt.receiveShadow = true;
    this.scene.add(this.groundSkirt);

    this.hemiLight = new THREE.HemisphereLight(0xffd9b8, 0x5a2414, 1.2);
    this.scene.add(this.hemiLight);

    this.sun = new THREE.DirectionalLight(0xffe2c4, 2.4);
    this.sun.position.set(-radius * 0.9, radius * 1.3, radius * 0.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(coarse ? 1024 : 4096);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -radius * 1.2;
    sc.right = sc.top = radius * 1.2;
    sc.near = 1;
    sc.far = radius * 5;
    // Sem bias a sombra se auto-intercepta (listras nas paredes). O bias vai na LUZ, não na câmera.
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun, this.sun.target);

    // Câmera isométrica
    const d = 160;
    this.camera.position.set(d, d * 0.85, d);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minZoom = 1.0;
    this.controls.maxZoom = 9;
    this.controls.minPolarAngle = 0.6;
    this.controls.maxPolarAngle = 1.12;
    this.controls.screenSpacePanning = false;
    this.controls.target.set(0, 0, 0);
    this.controls.enabled = false; // só responde depois de `activate`

    const ringGeo = new THREE.RingGeometry(0.3, 0.45, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.destinationRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffb511,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        fog: false,
      }),
    );
    this.destinationRing.renderOrder = 3;
    this.scene.add(this.destinationRing);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.updateAtmosphere(true);

    this.ready = this.load();
  }

  /** Ajustes do renderer (sombras sob demanda, tom, densidade de pixels). */
  private configureRenderer(coarse = matchMedia('(pointer: coarse)').matches) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.4 : 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false; // refeito sob demanda (ver `render`)
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.touchAction = 'none';
  }

  /** Coloca o mundo já montado na tela e começa o jogo (sala, astronauta, chegada da nave). */
  activate(container: HTMLElement, options?: BaseViewerOptions) {
    if (this.disposed) return;
    if (this.started) {
      // reativação (React StrictMode / retorno à tela): só renova os callbacks
      this.options = options;
      return;
    }
    this.started = true;
    this.container = container;
    this.options = options;
    this.currentHour = options?.initialHour ?? 9;
    this.currentSol = options?.initialSol ?? 1;
    // tarefas do Sol: semente estável por sala+base (poeira e sorteios iguais para todos)
    this.opsSeed = hashString(`${options?.roomCode ?? ''}|${this.info.id}`);
    this.dustRates = this.solarPanels.map((_, i) => panelDustRate(this.opsSeed, i));
    this.opsSol = 0;
    resetOps();

    // relógio da simulação: começa rodando a 1× (a sala, se houver, ajusta ao entrar)
    BaseViewer.clockOwner = this;
    GameClock.reset();
    GameClock.setTimeSkipper(
      (hour) => this.skipHours((((hour - this.currentHour) % 24) + 24) % 24),
      () => this.skipHours(24),
    );

    this.runtime?.stop();
    if (this.runtime) this.configureRenderer();
    this.renderer.domElement.setAttribute(
      'aria-label',
      `Base marciana ${this.info.name} em 3D. Clique no solo para andar, em painéis solares e canteiros para trabalhar, no rover para dirigir. Setas ou WASD também movem.`,
    );
    this.renderer.domElement.removeAttribute('aria-hidden');
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);
    this.dustOverlay = new DustStormOverlay(container);
    this.controls.enabled = true;

    this.bindEvents();
    this.resizeObserver.observe(container);
    if (options?.videoSettings) this.setQualitySettings(options.videoSettings);
    if (options?.outlineSettings) this.setOutlineSettings(options.outlineSettings);
    this.resize();

    // Não depende de `document.hidden`: janela coberta/minimizada também pára o rAF sem avisar.
    this.stopTicker = createBackgroundTicker(() => {
      if (performance.now() - this.lastFrame > 250) this.step(false);
    });
    if (import.meta.env.DEV) {
      (window as unknown as { __marsViewer?: BaseViewer }).__marsViewer = this;
    }
    this.lastStep = performance.now();
    this.lastFrame = performance.now();
    this.frame = this.schedule(this.tick);
    void this.begin();
  }

  private schedule(cb: FrameRequestCallback) {
    return this.runtime ? this.runtime.request(cb) : requestAnimationFrame(cb);
  }

  /** Reaquece os shaders (por exemplo, depois de mudar a qualidade gráfica). */
  prepareGraphics() {
    return this.runtime ? this.runtime.warm(this.scene, this.camera) : Promise.resolve();
  }

  get diagnostics() {
    return {
      movement: this.movementClient?.diagnostics ?? null,
      drawCalls: this.renderer.info.render.calls,
      ...this.renderer.info.memory,
      programs: this.renderer.info.programs?.length ?? 0,
    };
  }

  private async begin() {
    await this.joinRoom();
    if (this.disposed) return;
    await this.spawnLocalAstronaut();
    if (this.disposed) return;

    // A chegada começa com o jogador olhando para a plataforma
    this.cameraFocus.copy(this.shipRestWorld);
    this.controls.target.set(this.shipRestWorld.x, 0, this.shipRestWorld.z);
    this.queueArrival(this.localAstronaut!, this.room?.self.slot ?? 0);
  }

  /** Modelo do pool (clonado: a cena do cache continua intacta) ou do cache de modelos local. */
  private async fetchModel(url: string, optional = false) {
    this.urls.push(url);
    try {
      if (this.assets) {
        const g = await this.assets.load(url);
        return { scene: g.scene.clone(true), animations: g.animations };
      }
      return await loadGLB(url);
    } catch (err) {
      if (optional) return null;
      throw err;
    }
  }

  // ====================================================================== carregamento

  private async load() {
    const { id } = this.info;
    const grid = new BaseGrid(this.info as unknown as BaseFullLayout);
    this.grid = grid;
    this.scene.add(grid.gridMesh);

    const rover = new Rover();
    this.rover = rover;

    const [base, land, plants] = await Promise.all([
      this.fetchModel(baseModelUrl(id as BaseId)),
      this.fetchModel(`/assets/bases/terreno.glb?v=${NAVIGATION_HASH}`, true),
      this.fetchModel(`/assets/bases/plantas.glb?v=${NAVIGATION_HASH}`, true),
      rover.ready.catch(() => {}),
    ]);
    if (!base) throw new Error('Modelo da base ausente');
    this.pooledRoots = [base.scene, ...(land ? [land.scene] : [])];
    if (this.disposed) return;

    const aniso = Math.min(8, this.renderer.capabilities?.getMaxAnisotropy?.() ?? 4);
    const sharpen = (root: THREE.Object3D) =>
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          for (const v of Object.values(mat)) {
            if (v instanceof THREE.Texture) v.anisotropy = aniso;
          }
        }
      });

    if (land) {
      shade(land.scene, false);
      sharpen(land.scene);
      this.scene.add(land.scene);
    }

    const model = base.scene;
    const transform = mapTransform(this.info.bounds);
    model.position.set(transform.x, transform.y, transform.z);
    model.scale.setScalar(transform.scale);
    shade(model);
    sharpen(model);
    this.scene.add(model);

    model.traverse((o) => {
      if (o.name.endsWith('_Nave')) {
        this.ship = o;
        this.shipRest.copy(o.position);
      }
    });
    model.updateMatrixWorld(true);
    land?.scene.updateMatrixWorld(true);

    // O ponto de pouso é o da nave deste modelo (cada base tem o seu)
    if (this.ship) {
      this.ship.getWorldPosition(this.shipRestWorld);
      this.ship.add(this.shipFx.flame);
      this.shipFx.flame.position.set(0, -2.5, 0);
      model.add(this.shipFx.dust);
      // a poeira do motor sai do chão sob a nave (e não da origem do modelo)
      this.shipFx.dust.position.set(this.shipRest.x, 0.1, this.shipRest.z);
      this.ship.position.set(this.shipRest.x, this.shipRest.y + 450, this.shipRest.z);
    } else {
      this.shipRestWorld.copy(grid.getPadWorldPosition());
    }

    this.setupSolarPanels(model);
    this.setupTaskSpots(model);
    this.crops = new CropSystem(model, plants?.scene ?? null, (root) => {
      shade(root);
    });
    model.updateMatrixWorld(true);
    for (const proxy of this.crops.proxies) this.scene.add(proxy);

    const loops = base.animations.filter((c) => /^Scan/.test(c.name));
    if (loops.length) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const clip of loops) this.mixer.clipAction(clip).play();
    }

    this.patchFloorHoles(model);

    // ---- onde o rover fica: do lado de fora da garagem desta base ----
    this.roverPark = { ...navigationData(id).park };

    // ---- colisão: gerada da geometria real (o que bloqueia é o que se vê) ----
    const rocks = land?.scene.getObjectByName('Rocas');
    grid.importMasks(navigationData(id).masks);
    if (new URLSearchParams(location.search).has('nav')) grid.setNavDebug(true, this.scene);
    this.spawnPoints = navigationData(id).spawns.map(
      (p) => new THREE.Vector3(p.x, grid.groundY(p.x, p.z), p.z),
    );
    const park = grid.nearestWalkablePoint(this.roverPark.x, this.roverPark.z, 40, 'vehicle');
    if (park) {
      this.roverPark.x = park.x;
      this.roverPark.z = park.z;
    }
    rover.place(this.roverPark.x, this.roverPark.z, this.roverPark.h, GROUND_Y);
    this.scene.add(rover.root);

    this.integrityVisuals = new IntegrityVisuals(this.scene, model, grid);
    // ---- interior (tetos/paredes transparentes) e portas automáticas ----
    this.interior = new InteriorFader(model, grid);
    this.interior.setRoofsForcedHidden(this.roofsAlwaysHidden);
    this.doors = new DoorSystem(model, () => {
      const { audio } = useGameSettings.getState();
      if (audio.muted || audio.masterVolume <= 0 || audio.sfxVolume <= 0) return;
      const sound = new Audio('/assets/audio/door.mp3');
      sound.volume = (audio.masterVolume * audio.sfxVolume * 0.3) / 10000;
      this.doorSounds.add(sound);
      sound.addEventListener('ended', () => this.doorSounds.delete(sound), { once: true });
      void sound.play().catch(() => this.doorSounds.delete(sound));
    });

    this.lights = new NightLights(this.scene, model, grid);

    // ---- desempenho: mobília fixa vira poucas malhas; matrizes estáticas congeladas ----
    const isProtected = (o: THREE.Object3D) =>
      Boolean(o.userData.pick) ||
      /_Telhado$|_Nave$|_Solar_\d+$|Antena|_Folha(Inf|Sup)$|_FiltroAr_0[12]$|_Sonda$/.test(
        o.name,
      ) ||
      o === this.shipFx.flame ||
      o === this.shipFx.dust;
    const stats = batchStaticMeshes(model, isProtected);
    freezeStatic(
      model,
      (o) =>
        /_Nave$|_Antena_Prato$/.test(o.name) || o === this.shipFx.flame || o === this.shipFx.dust,
    );
    if (import.meta.env.DEV) {
      console.info(
        `[BaseViewer] malhas ${stats.before} → ${stats.after} (portas: ${this.doors.count})`,
      );
    }

    this.setupStations();
    const lifeSupport = new LifeSupportStations();
    lifeSupport.setup(model, this.grid);
    this.lifeSupportStations = lifeSupport;
    this.scene.add(lifeSupport.group);

    this.scene.add(this.rocksGroup);
    this.pickRoots = [
      model,
      ...(land ? [land.scene] : []),
      rover.root,
      this.rocksGroup,
      ...this.crops.proxies,
      ...lifeSupport.proxies,
      ...(this.stationMarkers ? [this.stationMarkers.group] : []),
    ];

    this.lights.collectGlow(this.scene);

    // Poeira/tempestade: aplicada depois de todas as trocas de material
    applyBoundaryFog(this.scene);

    // Contorno: depois do agrupamento de malhas (registra as malhas finais da base)
    this.outline.initBase(model);
    this.outline.addDynamicObject(rover.root, 'vehicle');

    // Coleta antes de adicionar os cascos, que inserem irmãos na árvore de objetos.
    const interactables: THREE.Object3D[] = [];
    model.traverse((o) => {
      if (o.userData.pick) interactables.push(o);
    });
    for (const object of interactables) this.interactionOutline.addObject(object);
    this.interactionOutline.addObject(rover.root, 'vehicle');
    for (const object of interactables) {
      const tag = object.userData.pick as { kind: string; index?: number; id?: number };
      if (tag.kind === 'crop') continue;
      // Usa somente a geometria real, sem os cascos auxiliares de contorno.
      const bounds = new THREE.Box3();
      const vertex = new THREE.Vector3();
      object.updateWorldMatrix(true, true);
      object.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.isOutlineHull) return;
        const positions = mesh.geometry.getAttribute('position');
        if (!positions) return;
        for (let i = 0; i < positions.count; i++) {
          vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          bounds.expandByPoint(vertex);
        }
      });
      if (bounds.isEmpty()) continue;
      const center =
        tag.kind === 'filter' || tag.kind === 'drill'
          ? object.getWorldPosition(new THREE.Vector3())
          : bounds.getCenter(new THREE.Vector3());
      center.y = bounds.max.y + 0.08;
      this.taskMarkerPositions.set(`${tag.kind}:${tag.index ?? 0}`, center);
    }
    const beds = this.crops.slots;
    const center = new THREE.Vector3();
    const greenhouse = this.grid?.layout.rooms.find((room) => room.kind === 'Estufa');
    if (greenhouse && this.grid) {
      const a = this.grid.tileToWorld(greenhouse.tile[0], greenhouse.tile[1]);
      const b = this.grid.tileToWorld(
        greenhouse.tile[0] + greenhouse.size[0] - 1,
        greenhouse.tile[1] + greenhouse.size[1] - 1,
      );
      center.set((a.wx + b.wx) / 2, 0, (a.wz + b.wz) / 2);
    } else if (beds.length) {
      for (const slot of beds) center.add(slot.world);
      center.multiplyScalar(1 / beds.length);
    }
    const spot = this.grid?.nearestWalkablePoint(center.x, center.z, 6);
    if (spot) center.copy(spot);
    center.y += 1.8;
    for (const slot of beds) {
      this.taskMarkerPositions.set(`crop:${slot.index}`, center.clone());
      this.taskMarkerPositions.set(`plant:${slot.index}`, center.clone());
    }

    if (this.disposed) return;
    // shaders e texturas na GPU antes de mostrar (sem engasgo na primeira imagem)
    await this.runtime?.warm(this.scene, this.camera);
  }

  private setupSolarPanels(model: THREE.Object3D) {
    const panels: { overlay: THREE.Mesh; worldPos: THREE.Vector3 }[] = [];
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.isMesh && !Array.isArray(m.material) ? (m.material as THREE.Material) : null;
      if (mat?.name === 'M_Solar_Poeira') {
        const worldPos = new THREE.Vector3();
        m.getWorldPosition(worldPos);
        panels.push({ overlay: m, worldPos });
      }
    });

    if (panels.length === 0) return;
    const baseMat = panels[0]!.overlay.material as THREE.MeshStandardMaterial;
    this.solarDustMats = [0, 1, 2, 3, 4].map((k) => {
      const mm = baseMat.clone();
      if (baseMat.map) {
        const tex = baseMat.map.clone();
        tex.repeat.set(1 / 5, 1);
        tex.offset.set(k / 5, 0);
        tex.needsUpdate = true;
        mm.map = tex;
      }
      mm.transparent = true;
      mm.depthWrite = false;
      return mm;
    });
    this.solarPanels = panels
      .slice(0, GAME_MAX_SOLAR)
      .map((p) => ({ mesh: p.overlay, stage: 0, parentPos: p.worldPos }));
    this.solarDust = this.solarPanels.map(() => 0);

    // marca o nó inteiro do painel: clicar em qualquer parte dele vale como clicar no painel
    this.solarPanels.forEach((p, index) => {
      for (let o: THREE.Object3D | null = p.mesh; o; o = o.parent) {
        if (/_Solar_\d+$/.test(o.name)) {
          o.userData.pick = { kind: 'solar', index };
          break;
        }
      }
    });
  }

  /** Filtros de ar (suporte à vida) e sonda de perfuração: alvos de clique das tarefas. */
  private setupTaskSpots(model: THREE.Object3D) {
    const filters: THREE.Object3D[] = [];
    model.traverse((o) => {
      if (/_FiltroAr_0[12]$/.test(o.name)) filters.push(o);
      else if (/_Sonda$/.test(o.name)) {
        o.userData.pick = { kind: 'drill' };
        this.drillSpot = o.getWorldPosition(new THREE.Vector3());
      }
    });
    const tag = (o: THREE.Object3D, prop: 'bed' | 'bench') => {
      const index = this.propSpots[prop].length;
      o.userData.pick = { kind: 'prop', prop, index };
      o.traverse((c) => {
        c.userData.keepSeparate = true;
      });
      this.propSpots[prop].push(o.getWorldPosition(new THREE.Vector3()));
    };
    model.traverse((o) => {
      if (/_BancadaFerramentas_d+$/.test(o.name)) tag(o, 'bench');
    });
    filters.sort((a, b) => a.name.localeCompare(b.name));
    this.filterSpots = filters.slice(0, 2).map((f, index) => {
      f.userData.pick = { kind: 'filter', index };
      return f.getWorldPosition(new THREE.Vector3());
    });
  }

  /**
   * Os cômodos redondos vêm com um furo no meio (aparece o solo marciano). Descobre o raio do
   * furo por raios verticais e fecha com um disco do mesmo piso.
   */
  private patchFloorHoles(model: THREE.Object3D) {
    const grid = this.grid;
    if (!grid) return;
    let floorMat: THREE.Material | null = null;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (
        !floorMat &&
        m.isMesh &&
        !Array.isArray(m.material) &&
        m.material.name === 'M_Piso_Interno'
      ) {
        floorMat = m.material;
      }
    });
    if (!floorMat) return;
    const rc = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3();
    const topY = (x: number, z: number) => {
      origin.set(x, 20, z);
      rc.set(origin, down);
      const hit = rc.intersectObject(model, true).find((h) => {
        if (!(h.object as THREE.Mesh).isMesh) return false;
        for (let p: THREE.Object3D | null = h.object; p; p = p.parent) {
          if (p.name.endsWith('_Telhado')) return false;
        }
        return true;
      });
      return hit ? hit.point.y : -1;
    };
    for (const r of grid.layout.rooms) {
      const a = grid.tileToWorld(r.tile[0], r.tile[1]);
      const b = grid.tileToWorld(r.tile[0] + r.size[0] - 1, r.tile[1] + r.size[1] - 1);
      const cx = (a.wx + b.wx) / 2;
      const cz = (a.wz + b.wz) / 2;
      if (topY(cx, cz) > 0.15) continue; // já tem piso no meio
      let radius = 0;
      for (let d = 0.25; d <= 4; d += 0.25) {
        if (topY(cx + d, cz) > 0.2) {
          radius = d;
          break;
        }
      }
      if (radius <= 0) continue;
      const geo = new THREE.CircleGeometry(radius + 0.12, 48);
      geo.rotateX(-Math.PI / 2);
      const disc = new THREE.Mesh(geo, floorMat);
      disc.position.set(cx, FLOOR_Y + 0.004, cz);
      disc.receiveShadow = true;
      disc.userData.isInterior = true;
      disc.userData.keepSeparate = true;
      this.scene.add(disc);
    }
  }

  /** Vaga de estacionamento do rover: logo depois da porta da garagem (da JSON da base). */
  // ====================================================================== sala e jogadores

  private async joinRoom() {
    try {
      this.room = await MultiplayerRoom.join({
        roomCode: this.options?.roomCode ?? `MARS-${this.info.id.toUpperCase()}-ROOM`,
        baseId: this.info.id,
        name: getGuestName() || 'Astronauta',
        suit: readSuitPreference(),
      });
    } catch (err) {
      this.handleRoomError(err);
      return;
    }
    const room = this.room;
    if (!room) return;
    if (room.mode === 'online') {
      this.movementClient = new MovementClient(
        this.info.id,
        () => room.self.id,
        (input) => room.sendInput(input),
        () => room.world.storm > 0.25,
      );
      if (room.movement) this.movementClient.accept(room.movement);
      room.onMovement = (snapshot) => this.acceptMovement(snapshot);
    }

    if (this.disposed) {
      room.dispose();
      this.room = null;
      return;
    }
    room.onError = (err) => this.handleRoomError(err);
    room.onStatus = (status) => {
      if (this.disposed) return;
      if (status === 'reconnecting') {
        this.movementClient?.freeze();
        this.keys.clear();
        this.virtualMove.x = this.virtualMove.y = 0;
        this.localAstronaut?.stopMoving();
        this.rover?.stopPath();
        if (BaseViewer.clockOwner === this) GameClock.setFromRemote(true, GameClock.getScale());
        this.options?.onMessage?.('Conexão interrompida. Reconectando à sala…', 'info');
      }
      this.reportPlayers();
    };

    this.options?.onWorldInfo?.(room.persistence);

    // estado compartilhado já existente na sala
    this.stormTarget = room.world.storm;
    this.options?.onStormChange?.(room.world.storm > 0, true);
    this.applySolarStages(room.world.solar);
    this.crops?.apply(room.world.crops);
    const v = room.world.vehicle;
    if (v && this.rover) this.rover.place(v.x, v.z, v.h, GROUND_Y);
    const clock = room.clock();
    this.currentHour = clock.hour;
    this.currentSol = clock.sol;

    // quem já estava na sala aparece na hora, onde está
    const existing = [...room.remotes.values()];
    // Instala os handlers antes de carregar os modelos dos astronautas.

    room.onPlayerJoined = (p, isExisting) => void this.addRemote(p, isExisting);
    room.onPlayerLeft = (id) => this.removeRemote(id);
    room.onPlayerState = (id, s) => {
      const actor = this.remoteAstronauts.get(id);
      if (!actor) return;
      actor.applySnapshot(s);
      this.syncRemoteDriving(actor, s);
    };
    room.onGestureInvite = (fromId, gesture) => this.receiveGestureInvite(fromId, gesture);
    room.onGestureStart = (start) => this.startGesture(start);
    room.onGestureDenied = (reason) => this.options?.onMessage?.(reason, 'info');
    room.onSoil = (kind, eid, q) =>
      kind === 'start' ? this.onSoilStart(eid) : this.onSoilDone(eid, q);
    room.onEventVote = (id, eid, choice) => this.options?.onEventVote?.(id, eid, choice);
    room.onEventResult = (eid, choice, roll) => this.options?.onEventResult?.(eid, choice, roll);
    room.onChat = (id, message) => {
      const player = room.remotes.get(id);
      if (player) this.options?.onChat?.({ name: player.name, message, local: false });
    };
    room.onEmote = (id, index) => {
      const actor = this.remoteAstronauts.get(id);
      const emoji = GAME_EMOTES[index];
      if (!actor || !emoji) return;
      this.showEmote(actor, emoji, index);
      this.options?.onEmote?.({ name: actor.name, emoji, local: false });
    };
    useMission.setState({
      triggerEvent: (id) => {
        if (BASE_EVENTS.some((e) => e.id === id))
          void this.repairAction({ op: 'event', event: id as (typeof BASE_EVENTS)[number]['id'] });
      },
    });
    room.onIntegrity = (state) => this.applyIntegrity(state);
    if (room.world.integrity) this.applyIntegrity(room.world.integrity);
    room.onStorm = (val) => {
      this.stormTarget = val;
      this.options?.onStormChange?.(val > 0, true);
    };
    room.onSolar = (stages) => this.applySolarStages(stages);
    // Plantas de um mundo novo precisam ser irrigadas antes da primeira colheita.
    const startSol = room.clock().sol;
    this.care = room.gameplay?.care ?? {crops:[],filter:0,needsCare:[]};
    room.onCare = (c) => {
      this.care = { crops: [...c.crops], filter: c.filter, needsCare: [...(c.needsCare ?? [])] };
    };
    room.onCrops = (stages) => this.crops?.apply(stages);
    room.onVehicleDenied = (reason) => {
      this.exitRover();
      this.notify(reason, 'info');
    };
    room.onVehicle = (vs) => {
      if (!this.roverDriver) this.rover?.place(vs.x, vs.z, vs.h, GROUND_Y);
    };

    // Pausa e velocidade são da sala: o GameClock (HUD) pede, a sala decide e devolve a todos
    if (BaseViewer.clockOwner === this) {
      GameClock.attachRoom({
        isCoordinator: () => room.isCoordinator,
        playerCount: () => room.playerCount,
        sendTime: (paused, scale) => room.sendTime({ paused, scale }),
      });
      GameClock.setFromRemote(room.world.paused === true, normalizeTimeScale(room.world.timeScale));
    }
    room.onTime = (t) => {
      if (BaseViewer.clockOwner === this) GameClock.setFromRemote(t.paused, t.scale);
      const c = room.clock();
      this.currentHour = c.hour;
      this.currentSol = c.sol;
    };
    room.onGameplay=(state)=>this.acceptGameplay(state);
    if(room.gameplay)this.acceptGameplay(room.gameplay);
    await Promise.all(existing.map((p) => this.addRemote(p, true)));
    if (!this.disposed) this.reportPlayers();
  }

  private acceptGameplay(state: GameplayState) {
    const p=state.players[this.room?.self.id??''];
    if(p){this.playerBlocked=p.blocked;this.playerSpeedScale=p.cold?0.25:1;this.soilCarry=p.carrying;if(p.carrying)this.soil=null;}
    this.care=state.care;
    this.opsSeed=state.mission.seed;
    this.refreshMissions();this.publishMissions();
    state.rocks.forEach(i=>{const r=this.rocks[i];if(r){r.taken=true;r.mesh.visible=false;}});
  }
  private async interactOfficial(kind: Extract<GamePayload,{type:'interact'}>['kind'],target: string) {
    const result=await gameplayCommand({type:'interact',kind,target});
    if(!result.ok)this.notify(result.error,'error');
    else this.playTaskCompleteSound();
  }

  private handleRoomError(err: unknown) {
    if (this.disposed) return;
    if (err instanceof RoomBaseMismatchError) {
      this.options?.onRoomBaseChange?.(err.baseId);
      return;
    }
    this.options?.onRoomError?.(
      err instanceof Error ? err.message : 'Não foi possível entrar na sala.',
    );
    this.options?.onRoomRejected?.();
  }

  /**
   * Avança o relógio em `hours` horas marcianas (ações de teste do painel Dev).
   * Na sala, o pedido passa pelo servidor (só o coordenador); sozinho/offline, é local.
   */
  private skipHours(_hours: number): boolean { return false;
  }



  private reportPlayers() {
    // quem pode pausar depende de quantos estão na sala
    GameClock.refresh();
    this.options?.onPlayersChange?.({
      count: 1 + this.remoteAstronauts.size,
      mode: this.room?.mode ?? 'local',
      status: this.room?.status === 'connecting' ? 'reconnecting' : this.room?.status ?? 'connected',
    });
  }

  private async addRemote(p: RemotePlayer, existing: boolean) {
    if (this.disposed || !this.room?.remotes.has(p.id) || this.remoteAstronauts.has(p.id)) return;
    const actor = new AstronautActor(p.id, p.name, false, p.suit);
    this.remoteAstronauts.set(p.id, actor);
    this.remoteList.push(actor);
    await actor.ready;
    if (this.disposed || this.remoteAstronauts.get(p.id) !== actor) {
      actor.dispose();
      return;
    }
    actor.networkControlled = this.room?.mode === 'online';
    this.scene.add(actor.root);
    applyBoundaryFog(actor.root);
    this.outline.addDynamicObject(actor.root, 'astronaut');
    if (p.motion) actor.applySnapshot(p.motion);

    if (existing) {
      const at = p.motion
        ? new THREE.Vector3(
            p.motion.x,
            this.grid?.groundY(p.motion.x, p.motion.z) ?? 0.05,
            p.motion.z,
          )
        : this.spawnPoint(p.slot);
      actor.reveal(at, p.motion?.h ?? 0);
      if (p.motion) this.syncRemoteDriving(actor, p.motion);
    } else {
      this.queueArrival(actor, p.slot);
    }
    this.reportPlayers();
  }

  /** Outro jogador entrou/saiu do rover: o carro passa a seguir ele (ou fica parado). */
  private syncRemoteDriving(actor: AstronautActor, s: GameMotion) {
    const rover = this.rover;
    if (!rover) return;
    if (s.m === 'drive') {
      if (this.roverDriver === 'local') return; // conflito: quem entrou primeiro (aqui) fica com o carro
      if (!actor.inVehicle) actor.setDriving(true);
      this.roverDriver = actor.id;
      this.roverRemoteTarget = { x: s.x, z: s.z, h: s.h };
      rover.setDriver(actor.name, false);
    } else if (s.m === 'ride') {
      // passageiro: some dentro do carro e vai junto (quem dirige continua sendo o motorista)
      if (!actor.inVehicle) actor.setDriving(true);
    } else if (actor.inVehicle) {
      const at = this.footPointNear(rover.position, rover.heading) ?? rover.position.clone();
      actor.setDriving(false, at, s.h);
      if (this.roverDriver === actor.id) {
        this.roverDriver = null;
        this.roverRemoteTarget = null;
        rover.setDriver(null, false);
        // o motorista saiu: o passageiro daqui desce junto
        if (this.roverRider) this.leaveRoverAsRider();
      }
    }
  }

  private removeRemote(id: string) {
    const actor = this.remoteAstronauts.get(id);
    if (!actor) return;
    this.remoteAstronauts.delete(id);
    const i = this.remoteList.indexOf(actor);
    if (i >= 0) this.remoteList.splice(i, 1);
    const q = this.arrivals.findIndex((a) => a.actor === actor);
    if (q >= 0) this.arrivals.splice(q, 1);
    if (this.shipArrival?.actor === actor) this.shipArrival = null;
    if (this.roverDriver === id) {
      this.roverDriver = null;
      this.roverRemoteTarget = null;
      this.rover?.setDriver(null, false);
      if (this.roverRider) this.leaveRoverAsRider();
    }
    this.outline.removeDynamicObject(actor.root);
    actor.dispose();
    this.reportPlayers();
  }

  private async spawnLocalAstronaut() {
    const suit = readSuitPreference();
    const nickname = getGuestName() || 'Astronauta';
    const actor = new AstronautActor(this.room?.self.id ?? 'local_player', nickname, true, suit);
    this.localAstronaut = actor;
    await actor.ready;
    if (this.disposed) return;
    this.scene.add(actor.root);
    applyBoundaryFog(actor.root);
    this.outline.addDynamicObject(actor.root, 'astronaut');
  }

  // ====================================================================== pouso

  /** Ponto (cru, sem navegação) ao lado da nave, do lado da base. */
  private rawSpawn(slot: number): THREE.Vector3 {
    const ship = this.shipRestWorld;
    const toBase = Math.atan2(-ship.z, -ship.x);
    const a = toBase + ([0, 0.62, -0.62, 1.24][slot % 4] ?? 0);
    return new THREE.Vector3(ship.x + Math.cos(a) * 6.4, GROUND_Y, ship.z + Math.sin(a) * 6.4);
  }

  private spawnPoint(slot: number): THREE.Vector3 {
    return this.spawnPoints[slot % 4]?.clone() ?? this.rawSpawn(slot);
  }

  private queueArrival(actor: AstronautActor, slot: number) {
    const spawn = this.spawnPoint(slot);
    const heading = Math.atan2(-spawn.x, -spawn.z); // de frente para a base
    this.arrivals.push({ actor, spawn, heading });
  }

  // ====================================================================== simulação

  /**
   * Chamado a cada quadro visível e, com a aba escondida, pelo relógio em segundo plano.
   * O tempo decorrido é REAL (não limitado a 0,1 s): voltar à aba não "perde" o que andou.
   */
  private step(visible: boolean) {
    if (this.disposed) return;
    const now = performance.now();
    let elapsed = Math.min(MAX_CATCHUP_SECONDS, (now - this.lastStep) / 1000);
    this.lastStep = now;
    if (elapsed <= 0) return;
    while (elapsed > 0) {
      const dt = Math.min(SIM_STEP, elapsed);
      elapsed -= dt;
      this.simulate(dt, visible);
    }
  }

  private simulate(dt: number, animate: boolean) {
    this.simTime += dt;
    // Tempo do MUNDO (relógio, sobrevivência, canteiros, poeira): segue pausa e 1×/2×/3×.
    // Astronautas, rover e suas animações seguem o mesmo tempo (pausa congela, 3× acelera);
    // só a câmera e a interface continuam em tempo real.
    GameClock.tick(dt);
    this.room?.tickHazards();
    if (this.localAstronaut?.isRevealed && !this.hazardReady && this.room) {
      this.hazardReady = true;
      void this.room.requestRepair({ op: 'ready' });
    }
    const pauseRepair = this.repairOpen && (this.room?.playerCount ?? 1) === 1;
    if (pauseRepair !== this.repairPaused) {
      this.repairPaused = pauseRepair;
      this.room?.repairPause(pauseRepair);
    }
    const worldDt =
      this.repairOpen && (this.room?.playerCount ?? 1) === 1 ? 0 : dt * GameClock.effectiveScale();
    const moveDt = worldDt;

    // Relógio: igual para todos da sala (ou local, se estiver sozinho/offline)
    if (this.room) {
      const c = this.room.clock();
      this.currentHour = c.hour;
      this.currentSol = c.sol;
    } else {
      const prev = this.currentHour;
      this.currentHour = (this.currentHour + worldDt * (24 / MARS_SOL_DURATION_SECONDS)) % 24;
      if (this.currentHour < prev) this.currentSol += 1;
    }

    // A tempestade chega e passa aos poucos
    this.stormCurrent += (this.stormTarget - this.stormCurrent) * Math.min(1, dt * 0.9);
    if (Math.abs(this.stormTarget - this.stormCurrent) < 0.003)
      this.stormCurrent = this.stormTarget;
    this.updateStormAudio();

    this.updateShip(dt);

    const local = this.localAstronaut;
    const colliders: Collider[] = [];
    for (const a of this.remoteList) colliders.push(a);
    if (this.rover) colliders.push(this.roverCollider);
    const ctx: MoveContext = { grid: this.grid, others: colliders };

    const dir = this.keyboardDirection();

    if (local) {
      if (this.room?.mode === 'online') {
        const previousX = local.position.x,
          previousZ = local.position.z;
        this.updateOnlineMovement(dt, dir);
        local.update(moveDt, ctx, animate);
        const moved = Math.hypot(local.position.x - previousX, local.position.z - previousZ);
        if (local.isRevealed && local.motion === 'walk') this.trackOnlineFootsteps(moved);
        if (local.isRevealed && moved > 0.01 && !this.guideMoved) {
          this.guideMoved = true;
          this.options?.onGuideEvent?.({ type: 'moved' });
        }
        this.handlePending(local);
      } else if (this.roverDriver === 'local' && this.rover) {
        this.updateDriving(moveDt, local, dir, this.roverManualInput());
      } else if (this.roverRider && this.rover) {
        // passageiro: vai dentro do rover, sem mexer nos controles
        local.position.copy(this.rover.position);
      } else {
        // teclado: só atualiza quando muda (cancela o caminho do clique uma vez)
        local.setInput(local.isRevealed ? dir : null);
        const previousX = local.position.x;
        const previousZ = local.position.z;
        local.update(moveDt * this.playerSpeedScale, ctx, animate);
        const distance = Math.hypot(local.position.x - previousX, local.position.z - previousZ);
        if (local.isRevealed && distance > 0 && local.motion === 'walk') {
          if (!this.guideMoved) {
            this.guideMoved = true;
            this.options?.onGuideEvent?.({ type: 'moved' });
          }
          this.footstepDistance += distance;
          if (this.footstepDistance >= 1.5) {
            this.footstepDistance %= 1.5;
            const { audio } = useGameSettings.getState();
            if (!audio.muted && audio.masterVolume > 0 && audio.sfxVolume > 0) {
              this.footstepAudio ??= [
                new Audio('/assets/audio/footstep-sand.mp3'),
                new Audio('/assets/audio/footstep-sand-2.mp3'),
              ];
              const onMetal = this.grid?.isInsideBase(local.position.x, local.position.z) ?? false;
              if (onMetal) {
                this.metalFootstepAudio ??= [
                  new Audio('/assets/audio/footstep-metal.mp3'),
                  new Audio('/assets/audio/footstep-metal-2.mp3'),
                ];
              }
              const step = (onMetal ? this.metalFootstepAudio! : this.footstepAudio)[
                this.nextFootstep
              ]!;
              this.nextFootstep = 1 - this.nextFootstep;
              step.volume = (audio.masterVolume * audio.sfxVolume) / 10000;
              step.currentTime = 0;
              void step.play().catch(() => {});
            }
          }
        }
        this.handleRepath(local);
        this.handlePending(local);
      }
    }
    if (local) {
      // rosto LED: dormindo no cochilo, cansado com a moral baixa
      local.setMood('normal');
    }
    for (const a of this.remoteList) a.update(moveDt, ctx, animate);

    // rover de outro jogador / parado: rodas e posição
    if (this.rover && this.room?.mode !== 'online') {
      if (this.roverDriver && this.roverDriver !== 'local' && this.roverRemoteTarget) {
        const t = this.roverRemoteTarget;
        this.rover.follow(moveDt, t.x, t.z, t.h);
      } else if (this.roverDriver !== 'local') {
        this.rover.speed = 0;
      }
      if (animate) this.rover.animate(moveDt);
    }

    // portas e interior
    const positions: Array<{ x: number; z: number }> = [];
    if (local?.isRevealed && this.roverDriver !== 'local' && !this.roverRider) {
      positions.push(local.position);
    }
    for (const a of this.remoteList) if (a.isCollidable) positions.push(a.position);
    const doorsMoved = this.doors?.update(dt, positions) ?? false;
    const faded = this.interior?.update(dt, local?.isRevealed ? local.position : null) ?? false;

    if (doorsMoved || faded || this.shipPhase !== 'away') this.shadowDirty = true;
    if (
      (local && local.motion !== 'idle') ||
      this.rover?.isMoving ||
      this.remoteList.some((a) => a.isRevealed && a.motion !== 'idle')
    ) {
      this.shadowDirty = true;
    }

    this.updateOperations(worldDt);
    this.updateMissions(dt);
    this.broadcastState(dt, local);
    this.checkStormAlert(local);

    if (this.mixer && animate) this.mixer.update(dt);

    // [seam:survival] execução dos sistemas de jogo plugáveis com SystemContext
    this.systems.update(worldDt, this.getSystemContext());
  }

  private updateStormAudio() {
    const { audio } = useGameSettings.getState();
    const inside = this.interior?.insideFactor ?? 0;
    const volume = audio.muted
      ? 0
      : (audio.masterVolume * audio.sfxVolume * 0.5 * this.stormCurrent * (1 - inside * 0.7)) /
        10000;

    if (volume <= 0) {
      this.stormAudio?.pause();
      return;
    }

    if (!this.stormAudio) {
      this.stormAudio = new Audio('/assets/audio/desert-winds.mp3');
      this.stormAudio.loop = true;
    }
    this.stormAudio.volume = Math.min(1, volume);
    if (
      this.stormAudio.paused &&
      !this.stormAudioStarting &&
      performance.now() >= this.stormAudioRetryAt
    ) {
      this.stormAudioStarting = true;
      void this.stormAudio
        .play()
        .catch(() => {
          this.stormAudioRetryAt = performance.now() + 2000;
        })
        .finally(() => {
          this.stormAudioStarting = false;
          if (this.disposed || this.stormCurrent === 0 || useGameSettings.getState().audio.muted) {
            this.stormAudio?.pause();
          }
        });
    }
  }

  private trackOnlineFootsteps(distance: number) {
    this.footstepDistance += distance;
    if (this.footstepDistance < 1.5) return;
    this.footstepDistance %= 1.5;
    const { audio } = useGameSettings.getState();
    if (audio.muted || audio.masterVolume <= 0 || audio.sfxVolume <= 0) return;
    const metal = this.grid?.isInsideBase(
      this.localAstronaut!.position.x,
      this.localAstronaut!.position.z,
    );
    if (metal)
      this.metalFootstepAudio ??= [
        new Audio('/assets/audio/footstep-metal.mp3'),
        new Audio('/assets/audio/footstep-metal-2.mp3'),
      ];
    else
      this.footstepAudio ??= [
        new Audio('/assets/audio/footstep-sand.mp3'),
        new Audio('/assets/audio/footstep-sand-2.mp3'),
      ];
    const step = (metal ? this.metalFootstepAudio! : this.footstepAudio!)[this.nextFootstep]!;
    this.nextFootstep = 1 - this.nextFootstep;
    step.volume = (audio.masterVolume * audio.sfxVolume) / 10000;
    step.currentTime = 0;
    void step.play().catch(() => {});
  }

  private acceptMovement(snapshot: MovementSnapshot) {
    const room = this.room;
    if (!room || this.disposed) return;
    const previousId = this.movementClient?.snapshot?.players.find((p) => p.id === room.self.id);
    if (!previousId && this.movementClient?.snapshot) {
      this.movementClient = new MovementClient(
        this.info.id,
        () => room.self.id,
        (input) => room.sendInput(input),
        () => room.world.storm > 0.25,
      );
    }
    const previous = this.movementClient?.state;
    const old = previous ? { x: previous.x, z: previous.z, revision: previous.revision } : null;
    this.movementClient?.accept(snapshot);
    const next = this.movementClient?.state;
    if (
      old &&
      next &&
      old.revision === next.revision &&
      this.grid?.lineClear(old.x, old.z, next.x, next.z)
    ) {
      this.localAstronaut?.smoothNetworkCorrection(old.x - next.x, old.z - next.z);
    } else this.localAstronaut?.smoothNetworkCorrection(1, 1);
    if (
      this.localAstronaut?.isRevealed &&
      !this.movementClient?.state?.ready &&
      !this.movementActionPending
    )
      void this.requestMovementAction('ready');
  }

  private async requestMovementAction(action: 'enter' | 'exit' | 'infirmary' | 'ready') {
    if (this.movementActionPending || !this.room?.connected) return;
    this.movementActionPending = true;
    try {
      this.localAstronaut?.stopMoving();
      this.rover?.stopPath();
      const result = await this.room.movementAction(action);
      if (!result?.ok && action !== 'ready')
        this.notify(result?.error ?? 'O servidor não confirmou a ação.', 'info');
    } finally {
      this.movementActionPending = false;
    }
  }

  private updateOnlineMovement(dt: number, dir: { x: number; z: number } | null) {
    const wasDriving = this.isDriving;
    const client = this.movementClient,
      local = this.localAstronaut,
      room = this.room;
    if (!client || !local || !room) return;
    local.networkControlled = true;
    const driving = client.rover?.driver === room.self.id;
    const riding = client.rover?.rider === room.self.id;
    if (dir && !local.isBusy) {
      local.stopMoving();
      if (driving) this.rover?.stopPath();
    }
    const blocked = this.playerBlocked || local.inDuoGesture || isGameOverlayOpen();
    const destination = driving ? this.rover?.destination : local.destination;
    const activity = local.taskActivity;
    client.advance(
      dt,
      {
        ...neutralInput(),
        direction: blocked || local.isBusy ? null : dir,
        manual: driving && !blocked ? this.roverManualInput() : null,
        destination: !blocked && destination ? { x: destination.x, z: destination.z } : null,
        sleeping: blocked,
        speedScale: this.playerSpeedScale,
        exitBlocked: this.exitBlocked,
        activity:
          activity === 'plant' || activity === 'harvest' || activity === 'clean'
            ? activity
            : 'idle',
        face: local.heading,
      },
      room.connected && local.isRevealed,
      client.snapshot?.scale ?? 1,
    );
    const state = client.state;
    if (state && local.isRevealed) {
      const inVehicle = state.m === 'drive' || state.m === 'ride';
      if (local.inVehicle !== inVehicle) local.setDriving(inVehicle);
      if (!local.inDuoGesture) local.applyNetworkPose(state, this.grid);
      if (state.destination && !state.path.length && !dir && !driving && state.m === 'idle')
        local.stopMoving();
    }
    const sampled = client.sample(room.serverNow());
    for (const p of sampled?.players ?? []) {
      if (p.id === room.self.id) continue;
      const actor = this.remoteAstronauts.get(p.id);
      if (!actor) continue;
      const inVehicle = p.state.m === 'drive' || p.state.m === 'ride';
      if (actor.inVehicle !== inVehicle) actor.setDriving(inVehicle);
      actor.networkControlled = true;
      if (!p.state.ready) {
        if (actor.isRevealed) actor.hide();
        continue;
      }
      if (!actor.isRevealed)
        actor.reveal(
          new THREE.Vector3(
            p.state.x,
            this.grid?.groundY(p.state.x, p.state.z) ?? GROUND_Y,
            p.state.z,
          ),
          p.state.h,
        );
      actor.applySnapshot(p.state);
    }
    const rover = this.rover;
    const vehicle = driving ? client.rover : sampled?.rover;
    if (rover && vehicle) {
      rover.position.set(vehicle.x, GROUND_Y, vehicle.z);
      rover.heading = vehicle.h;
      rover.root.rotation.y = vehicle.h;
      rover.speed = vehicle.speed;
      const driverId = client.rover?.driver ?? null;
      this.roverDriver = driverId === room.self.id ? 'local' : driverId;
      this.roverRider = client.rover?.rider === room.self.id;
      const name =
        driverId === room.self.id
          ? local.name
          : driverId
            ? (room.remotes.get(driverId)?.name ?? null)
            : null;
      rover.setDriver(name, driverId === room.self.id);
      const nowDriving = driving || riding;
      if (wasDriving !== nowDriving) this.options?.onVehicleChange?.(nowDriving);
    }
  }

  /** Dirige o rover (jogador local). */
  private updateDriving(
    dt: number,
    local: AstronautActor,
    dir: { x: number; z: number } | null,
    manual: { throttle: number; steer: number } | null,
  ) {
    const rover = this.rover!;
    // missão do rover: ele anda sozinho, o teclado fica de fora
    const input = dir;
    const keys = manual;
    if (input || keys) rover.stopPath();
    rover.drive(dt, { dir: input, manual: keys }, this.grid);
    if (rover.needsRepath && rover.destination && this.grid) {
      rover.needsRepath = false;
      if (++this.repathCount > 4) {
        this.repathCount = 0;
        rover.stopPath();
      } else {
        const { path } = this.grid.findPath(
          rover.position,
          rover.destination,
          this.stormCurrent > 0.25,
          undefined,
          'vehicle',
        );
        if (path.length) rover.setPath(path, rover.destination);
        else rover.stopPath();
      }
    }
    // o astronauta "vai dentro": a posição dele acompanha o carro
    local.position.copy(rover.position);
  }

  /** Outro jogador bloqueou o caminho: recalcula desviando dele. */
  private handleRepath(local: AstronautActor) {
    if (!local.needsRepath || !local.destination || !this.grid) return;
    local.needsRepath = false;
    if (++this.repathCount > 4) {
      this.repathCount = 0;
      local.stopMoving();
      return;
    }
    const dest = local.destination.clone();
    const { path } = this.grid.findPath(
      local.position,
      dest,
      this.stormCurrent > 0.25,
      this.dynamicBlocker(),
    );
    if (path.length > 0) local.setPath(path, dest);
    else local.stopMoving();
  }

  /** Círculos em volta de outros jogadores e do rover, para o A* não passar por eles. */
  private dynamicBlocker(): ((x: number, z: number) => boolean) | undefined {
    const list: Array<{ x: number; z: number; r: number }> = [];
    for (const a of this.remoteList) {
      if (a.isCollidable) list.push({ x: a.position.x, z: a.position.z, r: PLAYER_RADIUS * 2.2 });
    }
    if (this.rover && this.roverDriver !== 'local') {
      list.push({ x: this.rover.position.x, z: this.rover.position.z, r: 1.5 + 0.55 });
    }
    if (list.length === 0) return undefined;
    return (x, z) => {
      for (const c of list) {
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz < c.r * c.r) return true;
      }
      return false;
    };
  }

  // ---------------------------------------------------------------- tarefas ao chegar

  /** Chegou ao alvo? Executa a tarefa combinada no clique. */
  private handlePending(local: AstronautActor) {
    const p = this.pending;
    if (!p || local.isBusy || !local.isRevealed) return;
    const d = Math.hypot(local.position.x - p.face.x, local.position.z - p.face.z);

    if (p.kind === 'enter' && d < ENTER_REACH - 0.6 && local.isMoving) {
      // já encostou no rover: entra sem esperar a desaceleração
      this.pending = null;
      this.enterRover();
      return;
    }
    if (local.isMoving) return;

    this.pending = null;
    if (p.kind === 'goto') return;
    if (p.kind === 'enter') {
      if (d <= ENTER_REACH) this.enterRover();
      else this.notify('Não consegui chegar ao rover.', 'error');
      return;
    }
    if (p.kind === 'soilstart') {
      if (d <= ENTER_REACH + 0.8) this.enterRover();
      else this.notify('Não consegui chegar ao rover.', 'error');
      return;
    }
    if (d > TASK_REACH) {
      this.options?.onGuideEvent?.({ type: 'difficulty' });
      this.notify('Não consegui chegar lá.', 'error');
      return;
    }
    if (p.kind === 'station') {
      local.face(p.face);
      this.activateStation(p.site);
      return;
    }
    if (p.kind === 'prop') {
      local.face(p.face);
      this.activateProp(p.prop, p.index);
      return;
    }

    if (p.kind === 'repair') {
      void this.openRepair(p.id);
      return;
    }
    if (p.kind === 'clean') {
      const panel = this.solarPanels[p.index];
      if (!panel) return;
      if (panel.stage === 0) {
        this.notify('Este painel já está limpo. ✨', 'info');
        return;
      }
      local.face(p.face);
      this.options?.onMinigame?.({ kind: 'solar', index: p.index });
      return;
    }

    if (p.kind === 'filter') {
      if (caredToday(this.care.filter, this.currentSol)) {
        this.activateOxygenStation();
        return;
      }
      local.face(p.face);
      this.options?.onMinigame?.({ kind: 'oxygen', index: p.index });
      return;
    }

    if (p.kind === 'oxygen_station') {
      local.face(p.face);
      this.activateOxygenStation();
      return;
    }

    if (p.kind === 'water_station') {
      local.face(p.face);
      this.activateWaterStation();
      return;
    }

    if (p.kind === 'drill') {
      const block = this.drillBlock();
      if (block) {
        this.notify(block, 'info');
        return;
      }
      local.face(p.face);
      this.options?.onMinigame?.({
        kind: 'drill',
        baseId: this.info.id,
        target: targetLayer(this.info.id, this.opsSeed, this.currentSol).id,
        sol: this.currentSol,
      });
      return;
    }

    const slot=this.crops?.slots[p.index];
    if(!slot)return;
    if(slot.stage===0)void this.interactOfficial('plant',String(p.index));
    else if(this.care.needsCare?.[p.index] || !caredToday(this.care.crops[p.index]??0,this.currentSol))this.options?.onMinigame?.({kind:'greenhouse',index:p.index});
    else if(slot.stage===3)void this.interactOfficial('harvest',String(p.index));
    else this.notify('Este canteiro já foi cuidado hoje.','info');
  }

  /** Posição do astronauta na tela para os efeitos de recompensa da HUD. */
  getRewardScreenPosition(): { x: number; y: number } | null {
    if (!this.localAstronaut) return null;
    const point = this.localAstronaut.position.clone();
    point.y += 1.5;
    point.project(this.camera);
    if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + ((point.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - point.y) / 2) * rect.height,
    };
  }

  private notify(msg: string, kind: 'ok' | 'error' | 'info') {
    this.options?.onMessage?.(msg, kind);
  }

  private playTaskCompleteSound() {
    const { audio } = useGameSettings.getState();
    if (audio.muted || audio.masterVolume <= 0 || audio.sfxVolume <= 0) return;
    const sound = new Audio('/assets/audio/task-success.wav');
    sound.volume = (audio.masterVolume * audio.sfxVolume * 0.35) / 10000;
    void sound.play().catch(() => {});
  }

  // ---------------------------------------------------------------- rover

  /** Ponto onde o astronauta pisa ao lado do rover. */
  private footPointNear(center: THREE.Vector3, heading: number): THREE.Vector3 | null {
    const grid = this.grid;
    if (!grid) return null;
    for (const r of [2.5, 3.2, 4]) {
      for (const turn of [Math.PI / 2, -Math.PI / 2, Math.PI, 0, 2.2, -2.2]) {
        const a = heading + turn;
        const x = center.x + Math.sin(a) * r;
        const z = center.z + Math.cos(a) * r;
        if (grid.isWalkable(x, z)) return new THREE.Vector3(x, grid.groundY(x, z), z);
      }
    }
    return grid.nearestWalkablePoint(center.x, center.z, 30);
  }

  /** Entra no rover, se estiver perto e livre. */
  enterRover() {
    if (this.room?.mode === 'online') {
      void this.requestMovementAction('enter');
      return;
    }
    const local = this.localAstronaut;
    const rover = this.rover;
    if (!local?.isRevealed || !rover || local.isBusy || (this.room && !this.room.connected)) return;
    if (this.roverDriver === 'local' || this.roverRider) return;
    const d = Math.hypot(local.position.x - rover.position.x, local.position.z - rover.position.z);
    if (d > ENTER_REACH + 0.8) {
      this.notify('Chegue mais perto do rover (toque nele para ir até lá).', 'info');
      return;
    }
    if (this.roverDriver) {
      // já tem motorista: entra como passageiro (2 lugares)
      if (this.roverSeatsTaken() >= 2) {
        this.notify('O rover está cheio (2 lugares).', 'error');
        return;
      }
      this.pending = null;
      this.roverRider = true;
      local.setDriving(true);
      this.repathCount = 0;
      this.options?.onVehicleChange?.(true);
      this.notify('🚙 Você embarcou como passageiro. Toque em Sair para descer.', 'ok');
      this.lastSent = null;
      return;
    }
    this.pending = null;
    this.roverDriver = 'local';
    local.setDriving(true);
    rover.setDriver(local.name, true);
    rover.stopPath();
    this.repathCount = 0;
    this.options?.onVehicleChange?.(true);
    this.notify('🚙 No rover! Clique no solo ou use WASD. Duplo clique no rover para sair.', 'ok');
    this.lastSent = null; // força o envio imediato
  }

  /** Lugares ocupados no rover (motorista + passageiros), aqui e na sala. */
  private roverSeatsTaken(): number {
    let n = this.roverDriver ? 1 : 0;
    if (this.roverRider) n++;
    for (const a of this.remoteList) if (a.inVehicle && a.id !== this.roverDriver) n++;
    return n;
  }

  /** O passageiro local desce do rover. */
  private leaveRoverAsRider() {
    if (this.room?.mode === 'online') {
      void this.requestMovementAction('exit');
      return;
    }
    const local = this.localAstronaut;
    const rover = this.rover;
    if (!this.roverRider || !local || !rover) return;
    const at = this.footPointNear(rover.position, rover.heading) ?? rover.position.clone();
    local.setDriving(false, at, rover.heading);
    this.roverRider = false;
    this.options?.onVehicleChange?.(false);
    this.lastSent = null;
  }

  /** Sai do rover para o chão ao lado dele. */
  exitRover() {
    if (this.room?.mode === 'online') {
      void this.requestMovementAction('exit');
      return;
    }
    const local = this.localAstronaut;
    const rover = this.rover;
    if (this.roverRider) {
      this.leaveRoverAsRider();
      return;
    }
    if (this.roverDriver !== 'local' || !local || !rover) return;
    const at = this.footPointNear(rover.position, rover.heading) ?? rover.position.clone();
    rover.stopPath();
    rover.speed = 0;
    local.setDriving(false, at, rover.heading);
    rover.setDriver(null, true);
    this.roverDriver = null;
    this.room?.sendVehicle({ x: rover.position.x, z: rover.position.z, h: rover.heading });
    this.options?.onVehicleChange?.(false);
    this.lastSent = null;
  }

  /** Salva o mundo no banco (com o estado da missão deste jogador). */
  saveWorld(mission?: unknown) {
    return this.room
      ? this.room.save(mission)
      : Promise.resolve({ ok: false as const, error: 'Sem sala online.' });
  }

  /** Volta o mundo ao último salvamento (a interface recarrega a base depois). */
  restoreWorld() {
    return this.room
      ? this.room.restore()
      : Promise.resolve({ ok: false as const, error: 'Sem sala online.' });
  }

  /** Mostra um emoji do painel sobre o jogador local (balão com fade) e avisa a sala. */
  sendChat(message: string): boolean {
    const text = message.trim().slice(0, 240);
    if (!text || !this.localAstronaut?.isRevealed) return false;
    this.room?.sendChat(text);
    this.options?.onChat?.({ name: this.localAstronaut.name, message: text, local: true });
    return true;
  }

  sendEmote(index: number): boolean {
    const emoji = GAME_EMOTES[index];
    const local = this.localAstronaut;
    if (!emoji || !local?.isRevealed) return false;
    this.showEmote(local, emoji, index);
    this.room?.sendEmote(index);
    this.options?.onEmote?.({ name: local.name, emoji, local: true });
    return true;
  }

  /** Dentro do rover o balão sobe sobre o carro (sem animação); a pé, sobre a cabeça e com o clipe. */
  private showEmote(actor: AstronautActor, emoji: string, index: number) {
    if (actor.inVehicle && this.rover) this.rover.emote.show(emoji);
    else {
      actor.emote.show(emoji);
      actor.playEmote(index);
    }
  }

  // ------------------------------------------------------------------ gestos em dupla

  private duoInvite: { fromId: string; gesture: DuoGestureId; timer: number } | null = null;

  /** A sala permite gestos em dupla (online, com servidor validando)? */
  get canDuoGesture() {
    return this.room?.supportsDuoGestures === true;
  }

  /** Astronautas a pé que estão perto o bastante para um gesto em dupla. */
  nearbyPlayers(): Array<{ id: string; name: string; distance: number }> {
    const local = this.localAstronaut;
    if (!this.canDuoGesture || !local?.isRevealed || local.inVehicle) return [];
    const out: Array<{ id: string; name: string; distance: number }> = [];
    for (const a of this.remoteList) {
      if (!a.isRevealed || a.inVehicle) continue;
      const d = Math.hypot(a.position.x - local.position.x, a.position.z - local.position.z);
      if (d <= GESTURE_MAX_DISTANCE) out.push({ id: a.id, name: a.name, distance: d });
    }
    return out.sort((x, y) => x.distance - y.distance);
  }

  /** O parceiro tem lugar livre na posição do gesto? (colisões do BaseGrid) */
  private duoSpotFree(gesture: DuoGestureId, a: AstronautActor, b: AstronautActor) {
    const heading = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z);
    const spot = duoPartnerPosition(gesture, a.position.x, a.position.z, heading);
    return !this.grid || this.grid.isWalkable(spot.x, spot.z);
  }

  /** Convida o astronauta `targetId` para um gesto em dupla. */
  inviteGesture(gesture: DuoGestureId, targetId: string): boolean {
    const local = this.localAstronaut;
    const target = this.remoteAstronauts.get(targetId);
    if (!this.canDuoGesture || !local?.isRevealed || !target?.isRevealed) return false;
    if (local.inVehicle || target.inVehicle || local.isBusy) {
      this.options?.onMessage?.('Gestos em dupla só valem a pé, sem estar ocupado.', 'info');
      return false;
    }
    if (!this.nearbyPlayers().some((p) => p.id === targetId)) {
      this.options?.onMessage?.('Chegue mais perto do astronauta para convidar.', 'info');
      return false;
    }
    if (!this.duoSpotFree(gesture, local, target)) {
      this.options?.onMessage?.(
        'Sem espaço livre aqui para esse gesto. Afaste-se de paredes.',
        'info',
      );
      return false;
    }
    this.room?.sendGestureInvite(gesture, targetId);
    this.options?.onMessage?.(
      `Convite enviado a ${target.name}: ${DUO_GESTURES[gesture].label}.`,
      'ok',
    );
    return true;
  }

  private receiveGestureInvite(fromId: string, gesture: DuoGestureId) {
    const from = this.remoteAstronauts.get(fromId);
    if (!from) return;
    this.clearDuoInvite();
    const timer = window.setTimeout(() => this.clearDuoInvite(), GESTURE_INVITE_TTL_MS);
    this.duoInvite = { fromId, gesture, timer };
    this.options?.onGestureInvite?.({ fromId, name: from.name, gesture });
  }

  private clearDuoInvite() {
    if (!this.duoInvite) return;
    window.clearTimeout(this.duoInvite.timer);
    this.duoInvite = null;
    this.options?.onGestureInvite?.(null);
  }

  /** Aceita o convite pendente (botão "Aceitar"). */
  acceptGesture(): boolean {
    const inv = this.duoInvite;
    const local = this.localAstronaut;
    const from = inv ? this.remoteAstronauts.get(inv.fromId) : undefined;
    if (!inv || !local || !from) return false;
    this.clearDuoInvite();
    if (local.inVehicle || local.isBusy) {
      this.options?.onMessage?.('Termine o que está fazendo para aceitar.', 'info');
      return false;
    }
    if (!this.duoSpotFree(inv.gesture, from, local)) {
      this.options?.onMessage?.('Sem espaço livre aqui para esse gesto.', 'info');
      return false;
    }
    this.room?.acceptGesture(inv.fromId);
    return true;
  }

  /** O servidor confirmou: os dois se encaram, deslizam até a posição e tocam o mesmo clipe. */
  private startGesture(s: GestureStart) {
    const selfId = this.room?.self.id;
    const find = (id: string) =>
      id === selfId ? this.localAstronaut : this.remoteAstronauts.get(id);
    const a = find(s.a);
    const b = find(s.b);
    if (!a || !b || !DUO_GESTURES[s.gesture]) return;
    if (a.inVehicle || b.inVehicle) return;
    if (!s.poses && !this.duoSpotFree(s.gesture, a, b)) {
      this.options?.onMessage?.('Sem espaço livre para o gesto em dupla.', 'info');
      return;
    }
    const heading =
      s.poses?.a.h ?? Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z);
    const spot = s.poses?.b ?? duoPartnerPosition(s.gesture, a.position.x, a.position.z, heading);
    a.playDuo(s.gesture, s.poses?.a.x ?? a.position.x, s.poses?.a.z ?? a.position.z, heading);
    b.playDuo(s.gesture, spot.x, spot.z, s.poses?.b.h ?? heading + Math.PI);
    if (s.a === selfId || s.b === selfId) this.clearDuoInvite();
  }

  get isDriving() {
    return this.roverDriver === 'local' || this.roverRider;
  }

  /** Publica o estado do jogador local para a sala (10 Hz em movimento, 1 Hz parado). */
  private broadcastState(dt: number, local: AstronautActor | null) {
    if (!this.room || this.room.mode === 'online' || !local?.isRevealed) return;
    this.netAcc += dt;
    const motion = local.motion;
    const driving = (this.roverDriver === 'local' || this.roverRider) && this.rover;
    const moving = driving ? this.rover!.isMoving : motion !== 'idle';
    const changed = this.lastSent?.m !== (this.roverRider ? 'ride' : motion);
    const interval = moving ? 0.1 : 1;
    if (!changed && this.netAcc < interval) return;
    this.netAcc = 0;
    const x = driving ? this.rover!.position.x : local.position.x;
    const z = driving ? this.rover!.position.z : local.position.z;
    const h = driving ? this.rover!.heading : local.heading;
    const s: GameMotion = {
      x: +x.toFixed(3),
      z: +z.toFixed(3),
      h: +h.toFixed(3),
      m: this.roverRider ? 'ride' : motion,
    };
    this.lastSent = s;
    this.room.sendState(s);
  }

  private checkStormAlert(local: AstronautActor | null) {
    if (!local?.isRevealed) return;
    const storm = this.stormTarget > 0.25;
    if (!storm) {
      this.stormAlertShown = false;
      return;
    }
    const r = Math.hypot(local.position.x, local.position.z);
    if (r > STORM_SAFE_RADIUS && !this.stormAlertShown) {
      this.stormAlertShown = true;
      this.options?.onStormAlert?.(
        '⚠️ Tempestade de poeira! Retorne para o perímetro seguro da base.',
      );
    }
  }

  // ====================================================================== nave

  private updateShip(dt: number) {
    const ship = this.ship;
    const now = this.simTime * 1000;

    if (!ship) {
      while (this.arrivals.length) this.reveal(this.arrivals.shift()!);
      return;
    }

    switch (this.shipPhase) {
      case 'away': {
        this.shipFx.update(now, dt, 0, 450);
        const next = this.arrivals.shift();
        if (next) {
          this.shipArrival = next;
          this.shipPhase = 'landing';
          this.shipT = 0;
        }
        break;
      }
      case 'landing': {
        this.shipT += dt;
        const k = Math.min(1, this.shipT / LANDING_SECONDS);
        const ease = 1 - (1 - k) ** 3;
        const h = (1 - ease) * 65;
        const throttle = k < 0.9 ? 1 - 0.25 * ease : ((1 - k) / 0.1) * 0.75;
        ship.position.set(this.shipRest.x, this.shipRest.y + h, this.shipRest.z);
        ship.rotation.y = 0.3 + (1 - ease) * 1.2;
        ship.updateMatrix();
        this.shipFx.update(now, dt, throttle, h);
        if (k >= 1) {
          // pousou: o astronauta desembarca e a nave se prepara para decolar
          if (this.shipArrival) this.reveal(this.shipArrival);
          this.shipPhase = 'hold';
          this.shipT = 0;
        }
        break;
      }
      case 'hold': {
        this.shipT += dt;
        this.shipFx.update(now, dt, 0.35, 0);
        if (this.shipT >= HOLD_SECONDS) {
          this.shipPhase = 'depart';
          this.shipT = 0;
        }
        break;
      }
      case 'depart': {
        this.shipT += dt;
        const k = Math.min(1, this.shipT / DEPARTURE_SECONDS);
        const h = 180 * k ** 2.4;
        const throttle = Math.min(1, 0.6 + k * 5);
        ship.position.set(this.shipRest.x, this.shipRest.y + h, this.shipRest.z);
        ship.rotation.y = 0.3 + k * k * 1.6;
        ship.updateMatrix();
        this.shipFx.update(now, dt, throttle, h);
        if (k >= 1) {
          ship.position.set(this.shipRest.x, this.shipRest.y + 450, this.shipRest.z);
          ship.updateMatrix();
          this.shipArrival = null;
          this.shipPhase = 'away';
        }
        break;
      }
    }
  }

  private reveal(a: Arrival) {
    if (!a.actor.isLocal && this.room?.mode === 'online') return;
    const own = a.actor.isLocal ? this.movementClient?.state : null;
    const at = own
      ? new THREE.Vector3(own.x, this.grid?.groundY(own.x, own.z) ?? GROUND_Y, own.z)
      : a.actor.isLocal
        ? a.spawn
        : (this.remoteSnapshotPosition(a.actor) ?? a.spawn);
    a.actor.reveal(at, a.heading);
    if (a.actor.isLocal) {
      this.cameraFocus.copy(at);
      if (this.room?.mode === 'online') void this.requestMovementAction('ready');
      this.options?.onGuideEvent?.({ type: 'ready' });
    } else {
      const s = this.room?.remotes.get(a.actor.id)?.motion;
      if (s) this.syncRemoteDriving(a.actor, s);
    }
  }

  private remoteSnapshotPosition(actor: AstronautActor): THREE.Vector3 | null {
    const p = this.room?.remotes.get(actor.id)?.motion;
    if (!p || !this.grid) return null;
    return new THREE.Vector3(p.x, this.grid.groundY(p.x, p.z), p.z);
  }

  // ====================================================================== painéis e plantações

  private solarStages(): number[] {
    const out = new Array<number>(GAME_MAX_SOLAR).fill(0);
    this.solarPanels.forEach((p, i) => {
      out[i] = p.stage;
    });
    return out;
  }

  private applySolarStages(stages: number[]) {
    this.solarPanels.forEach((_, i) => {
      const s = stages[i];
      if (typeof s === 'number') this.setSolarStage(i, s);
    });
  }

  private setSolarStage(index: number, stage: number) {
    const p = this.solarPanels[index];
    if (!p) return;
    p.stage = Math.max(0, Math.min(4, Math.round(stage)));
    // poeira contínua acompanha o estágio vindo da sala (sem apagar a fração local)
    const dust = this.solarDust[index] ?? 0;
    if (dustStage(dust) !== p.stage) this.solarDust[index] = p.stage;
    p.mesh.visible = p.stage > 0;
    const mat = this.solarDustMats[p.stage];
    if (mat) p.mesh.material = mat;
  }

  /**
   * Poeira: cada painel suja no próprio ritmo, e tempestades aceleram muito.
   * Só UM jogador da sala conta o tempo (sem duplicar); os outros recebem os estágios.
   */


  // ====================================================================== operação da base

  /**
   * Rede elétrica, oxigênio, cuidados diários e virada do Sol (chamado a cada passo do mundo).
   * A bateria é a energia da missão: painéis carregam de dia, o suporte à vida consome sempre.
   */
  private updateOperations(dt: number) {
    const official=this.room?.gameplay;
    if(!official)return;
    this.blackout=official.mission.resources.energy.value<=0;
    this.batteryFloat=official.mission.resources.energy.value;
    this.generation=solarGeneration(official.solar,1-this.nightFactor,official.storm);
    if(this.opsSol!==official.board.sol){this.opsSol=official.board.sol;this.layoutRocks(official.board.sol);this.refreshMissions();}
    this.opsTimer+=dt;
    if(this.opsTimer<0.5)return;
    this.opsTimer=0;
    const clogged=filterClogged(official.care.filter,official.board.sol);
    this.publishOperations(!clogged&&!this.blackout,clogged);
  }



  /** Dano (ou reforço, se negativo) na blindagem causado por uma decisão de evento: vira fratura. */
  damageArmor(amount: number) {
    if (!amount || (this.room && !this.room.isCoordinator)) return;
    void this.room?.requestRepair({ op: 'damage', amount });
  }

  /** Quem participa da decisão dos eventos (eu e os outros astronautas da sala). */
  eventParticipants() {
    const selfId = this.room?.self.id ?? 'local';
    const players = [{ id: selfId, name: this.localAstronaut?.name ?? 'Você' }];
    for (const [id, p] of this.room?.remotes ?? []) players.push({ id, name: p.name });
    return {
      selfId,
      players,
      isCoordinator: this.room ? this.room.isCoordinator : true,
      seed: this.opsSeed,
      sol: this.currentSol,
    };
  }

  sendEventVote(eid: string, choice: number) {
    this.room?.sendEventVote(eid, choice);
  }

  sendEventResult(eid: string, choice: number, roll: number) {
    this.room?.sendEventResult(eid, choice, roll);
  }

  /** Anota no diário da missão algo que aconteceu no mundo (sem custo nem ganho). */
  private journal(_title: string, _text: string, _tone: 'good' | 'bad' | 'info' = 'info') {}

  /** Efeitos no mundo das escolhas dos eventos (tempestade, poeira, filtro, canteiros). */
  applyEventEffects(_outcome: EventOutcome) {}





  private publishOperations(producing: boolean, clogged: boolean) {
    const res = useMission.getState().state.resources.energy;
    const crops = this.crops?.slots ?? [];
    publishOps({
      active: true,
      sol: this.currentSol,
      seed: this.opsSeed,
      baseId: this.info.id,
      panelStages: this.solarPanels.map((p) => p.stage),
      panelsCleanedToday: this.panelsCleanedToday,
      cropStages: crops.map((c) => c.stage),
      cropNames: crops.map((c) => c.kind),
      cropCare: crops.map((c) => this.care.crops[c.index] ?? 0),
      cropNeedsCare: crops.map((c) => this.care.needsCare?.[c.index] === true),
      filterSol: this.care.filter,
      filterClogged: clogged,
      drillDoneSol: this.missionDone('drill') ? this.currentSol : 0,
      drillTarget: targetLayer(this.info.id, this.opsSeed, this.currentSol).name,
      generationPerSol: Math.round(this.generation * SOL_SECONDS),
      loadPerSol: GRID.loadPerSol,
      battery: res.value,
      capacity: res.max,
      blackout: this.blackout,
      oxygenProducing: producing,
    });
    this.taskMarkers.sync(tasksFrom(useBaseOps.getState()), (kind, index) => {
      if (kind === 'repair') {
        const f = this.room?.world.integrity?.fractures.find((f) => f.id === index);
        const a = f && this.integrityVisuals?.anchors[f.anchor];
        return a ? a.point.clone().add(new THREE.Vector3(0, 0.6, 0)) : null;
      }
      return this.taskMarkerPositions.get(`${kind}:${index}`) ?? null;
    });
  }

  /** Cuidados mudaram aqui: guarda e avisa a sala. */
  private setCare(next: GameCareState) {
    this.care = {
      crops: [...next.crops],
      filter: next.filter,
      needsCare: [...(next.needsCare ?? [])],
    };
    this.room?.sendCare(this.care);
  }



  // ================================================================ missões de pesquisa

  private playerCount() {
    return 1 + (this.room?.remotes.size ?? 0);
  }

  /** Sorteia as missões do Sol (iguais para a sala toda: depende só da semente e do Sol). */
  private refreshMissions() { this.missionIds=(this.room?.gameplay?.board.ids ?? []) as MissionId[];
  }

  /** Modo de teste (painel Dev): todas as missões ativas, sem custo, sem horário e sem apagão. */
  private missionTestMode = false;

  setMissionTestMode(on: boolean) {
    this.missionTestMode = on;
    this.refreshMissions();
    this.publishMissions();
    this.notify(
      on
        ? '🧪 Teste de missões: todas liberadas, sem custo nem horário.'
        : '🧪 Teste de missões desligado.',
      'info',
    );
  }

  get isMissionTestMode() {
    return this.missionTestMode;
  }

  /** Conclui uma missão agora (painel Dev), aplicando custo e recompensa normais. */
  devCompleteMission(id: MissionId) {
    const def = MISSIONS[id];
    if (!def) return;
    this.completeMission(id, { text: `Concluída pelo painel Dev: ${def.title}.` });
  }

  private missionBoard(): GameMissionBoard | undefined { return this.room?.board;
  }

  /** A missão já foi concluída neste Sol (por qualquer jogador da sala)? */
  private missionDone(id: string): boolean {
    const b = this.missionBoard();
    return !!b && b.sol === this.currentSol && b.done.includes(id);
  }

  private missionContext(): MissionContext {
    const r = useMission.getState().state.resources;
    if (this.missionTestMode) {
      return { energy: 999, supplies: 999, oxygen: 999, night: 0, blackout: false };
    }
    return {
      energy: r.energy.value,
      supplies: r.supplies.value,
      oxygen: r.oxygen.value,
      // madrugada (antes das 06:00) e entardecer (depois das 18:00) contam como noite fechada:
      // a missão do rover é só de dia, mesmo quando o céu já clareou um pouco
      night: this.currentHour < 6 || this.currentHour >= 18 ? 1 : this.nightFactor,
      blackout: this.blackout,
    };
  }

  /** Onde cada missão acontece (painel, marcadores e alerta do Sol). */
  private siteSpot(site: MissionSite): { label: string; x: number; z: number } | null {
    if (site === 'rover') {
      return this.rover
        ? { label: STATION_LABEL.rover, x: this.roverPark.x, z: this.roverPark.z }
        : null;
    }
    if (site === 'soil') {
      return this.soilSite
        ? { label: STATION_LABEL.soil, x: this.soilSite.x, z: this.soilSite.z }
        : null;
    }
    if (site === 'drill') {
      return this.drillSpot
        ? { label: STATION_LABEL.drill, x: this.drillSpot.x, z: this.drillSpot.z }
        : null;
    }
    const st = this.stationInfo.get(site);
    return st ? { label: st.label, x: st.pos.x, z: st.pos.z } : null;
  }

  /** Alerta de início de Sol: diz quais são as missões E ONDE cada uma fica. */
  private announceMissions(sol: number) {
    const here = this.localAstronaut?.position;
    const parts = this.missionIds.map((id) => {
      const def = MISSIONS[id];
      const spot = this.siteSpot(def.site);
      if (!spot) return def.title;
      const dir = here ? `, ${describeDirection(here.x, here.z, spot.x, spot.z).text}` : '';
      return `${def.title} (${spot.label}${dir})`;
    });
    this.notify(
      parts.length
        ? `☀️ Sol ${sol}. Missões: ${parts.join(' · ')}. Siga os feixes de luz ciano na base ou abra a aba Tarefas (T) e use "Ir".`
        : `☀️ Sol ${sol}: confira as tarefas do dia (tecla T).`,
      'info',
    );
    this.publishMissions();
  }

  /** Hologramas das estações: um cômodo por tipo, com fallback quando a base não tem o cômodo. */
  private setupStations() {
    const grid = this.grid;
    if (!grid) return;
    const rooms = grid.layout.rooms ?? [];
    const markers = new StationMarkers();
    this.stationMarkers = markers;
    this.scene.add(markers.group);
    const taken: number[] = [];
    const perRoom = new Map<number, number>();
    for (const site of ['lab', 'comms', 'power', 'medical', 'upload'] as StationSite[]) {
      if (!rooms.length) break;
      const idx = stationRoomIndex(rooms, site, taken);
      taken.push(idx);
      const room = rooms[idx]!;
      const a = grid.tileToWorld(room.tile[0], room.tile[1]);
      const b = grid.tileToWorld(room.tile[0] + room.size[0] - 1, room.tile[1] + room.size[1] - 1);
      const n = perRoom.get(idx) ?? 0;
      perRoom.set(idx, n + 1);
      const cx = (a.wx + b.wx) / 2 + n * 1.3;
      const cz = (a.wz + b.wz) / 2;
      const spot = grid.nearestWalkablePoint(cx, cz, 6);
      const x = spot?.x ?? cx;
      const z = spot?.z ?? cz;
      const pos = new THREE.Vector3(x, grid.groundY(x, z), z);
      this.stationInfo.set(site, { label: roomLabel(room.kind), pos });
      markers.add(site, pos, true);
    }
    if (this.rover) {
      const { x, z } = this.roverPark;
      markers.add('rover', new THREE.Vector3(x, grid.groundY(x, z), z), false);
      this.soilSite = this.findSoilSite();
      if (this.soilSite) {
        const { x: sx, z: sz } = this.soilSite;
        markers.add('soil', new THREE.Vector3(sx, grid.groundY(sx, sz), sz), false);
      }
    }
    if (this.drillSpot) {
      const d = this.drillSpot;
      markers.add('drill', new THREE.Vector3(d.x, grid.groundY(d.x, d.z), d.z), false);
    }
  }

  /** Estação que recebe as amostras de solo (um computador da base). */
  private deliveryStation(): StationSite {
    return this.stationInfo.has('lab') ? 'lab' : 'comms';
  }

  private drillBlock(): string | null {
    if (!this.missionIds.includes('drill')) {
      return 'A ciência não pediu sondagem hoje. Veja as missões do dia (tecla T).';
    }
    if (this.missionDone('drill')) return 'A sondagem de hoje já foi feita. Volte amanhã.';
    return missionBlock(MISSIONS.drill, this.missionContext());
  }

  private updateMissions(dt: number) {
    if (!this.started) return;
    this.stationMarkers?.update(dt);
    this.checkSoilArrival();
    this.updateUtilityMarkers();
    this.missionTimer += dt;
    if (this.missionTimer < 0.5) return;
    this.missionTimer = 0;
    this.publishMissions();
    this.checkLoreProximity();
  }

  /** Perto de um objeto com história real? Pede a janela de curiosidade (uma vez por navegador). */
  private checkLoreProximity() {
    const local = this.localAstronaut;
    if (
      !local?.isRevealed ||
      this.playerBlocked ||
      this.roverDriver === 'local' ||
      this.roverRider
    ) {
      return;
    }
    const { x, z } = local.position;
    const near = (p: THREE.Vector3 | undefined | null, r: number) =>
      !!p && Math.hypot(p.x - x, p.z - z) < r;
    const lore = useLore.getState();
    if (near(this.rover?.position, 6)) lore.request('rover');
    else if (this.crops?.slots.some((c) => near(c.world, 5))) lore.request('garden');
    else if (this.solarPanels.some((p) => near(p.parentPos, 7))) lore.request('solar');
    else if (near(this.lifeSupportStations?.oxygenPos, 5)) lore.request('oxygen');
    else if (near(this.lifeSupportStations?.waterPos, 5)) lore.request('water');
    else if (this.filterSpots.some((p) => near(p, 5))) lore.request('oxygen');
    else if (near(this.drillSpot, 6)) lore.request('drill');
    else if (near(this.stationInfo.get('comms')?.pos, 5)) lore.request('antenna');
    else if (near(this.stationInfo.get('lab')?.pos, 5)) lore.request('lab');
    else if (near(this.stationInfo.get('medical')?.pos, 5)) lore.request('medical');
    else if (near(this.stationInfo.get('power')?.pos, 5)) lore.request('power');
  }

  private publishMissions() {
    if (!this.started) return;
    this.refreshMissions(); // entrou/saiu gente: muda quantas missões o Sol tem
    const ctx = this.missionContext();
    const board = this.missionBoard();
    const done = board && board.sol === this.currentSol ? [...board.done] : [];
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const sites: Partial<Record<MissionSite, { label: string; x: number; z: number }>> = {};
    for (const site of [
      'rover',
      'soil',
      'drill',
      'lab',
      'comms',
      'power',
      'medical',
    ] as MissionSite[]) {
      const s = this.siteSpot(site);
      if (s) sites[site] = { label: s.label, x: r1(s.x), z: r1(s.z) };
    }
    const slots = this.crops?.slots ?? [];
    const planted = slots.filter((c) => c.stage > 0);
    const here = this.localAstronaut?.position;
    publishMissionBoard({
      active: true,
      sol: this.currentSol,
      ids: [...this.missionIds],
      done,
      night: Math.round(ctx.night * 100) / 100,
      blackout: this.blackout,
      sites,
      player: { x: r1(here?.x ?? 0), z: r1(here?.z ?? 0) },
      carrying: this.soilCarry,
      soilPhase: this.soil ? 'sampling' : this.soilCarry > 0 ? 'deliver' : 'idle',
      garden: {
        planted: planted.length,
        cared: planted.filter((c) => (this.care.crops[c.index] ?? 0) >= this.currentSol).length,
        bonusDone: !!board && board.garden >= this.currentSol,
      },
      beacons: this.beaconsOn,
    });

    // marcadores 3D: só onde ainda há missão para fazer (verde = pode, laranja = falta algo)
    const markers = this.stationMarkers;
    if (!markers) return;
    const delivery = this.soilCarry > 0 ? this.deliveryStation() : null;
    for (const site of [
      'rover',
      'soil',
      'drill',
      'lab',
      'comms',
      'power',
      'medical',
    ] as MissionSite[]) {
      let state: 'hidden' | 'ready' | 'blocked' = 'hidden';
      for (const id of this.missionIds) {
        const def = MISSIONS[id];
        if (def.site !== site || done.includes(id)) continue;
        state = missionBlock(def, ctx) ? 'blocked' : 'ready';
        break;
      }
      if (site === 'soil' && (this.soil || this.soilCarry > 0)) state = 'hidden';
      if (site === delivery) state = 'ready';
      markers.set(site, state, this.beaconsOn);
    }
  }

  /** Liga/desliga os marcadores 3D das missões. */
  setMissionBeacons(on: boolean) {
    this.beaconsOn = on;
    this.publishMissions();
  }

  // ------------------------------------------------------------------ concluir e sincronizar

  private makeMissionEvent(
    id: string,
    title: string,
    text: string,
    deltas: Record<string, number>,
  ): GameMissionEvent {
    return {
      eid: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      id,
      sol: this.currentSol,
      by: this.localAstronaut?.name ?? 'Astronauta',
      title,
      text,
      deltas,
    };
  }

  /** Registra no quadro da sala (primeiro a concluir vence) e aplica custo e recompensa. */
  private async commitMissionEvent(_ev: GameMissionEvent): Promise<boolean> { return false;
  }

  /** Custo e recompensa de uma missão: iguais para todos os jogadores da sala. */


  private async completeMission(_id: MissionId, _o: {research?:number;title?:string;text:string}, _costMul=1): Promise<boolean> { return false;
  }

  /** Todos os canteiros plantados foram cuidados hoje: a horta devolve um pouco de oxigênio. */


  // ------------------------------------------------------------------ estações e "Ir"

  private goToStation(site: StationSite) {
    const local = this.localAstronaut;
    if (!local?.isRevealed || local.isBusy) return;
    const st = this.stationInfo.get(site);
    if (!st) return;
    if (this.roverDriver === 'local' || this.roverRider) {
      this.notify('Saia do rover primeiro (duplo clique no rover ou botão Sair).', 'info');
      return;
    }
    this.goInteract(st.pos, { kind: 'station', site, face: st.pos.clone() });
  }

  // ------------------------------------------------------------------ cenário interativo

  /**
   * Toque impreciso: acha o objeto interativo mais perto do dedo (em pixels de tela). No toque a
   * folga é grande; no mouse, pequena (o clique exato continua valendo primeiro).
   */
  private assistPick(clientX: number, clientY: number): PickResult | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const radius = this.lastPointerType === 'mouse' ? 30 : 76;
    let best: { d: number; pick: PickResult } | null = null;
    const v = new THREE.Vector3();
    const consider = (pos: THREE.Vector3 | undefined, lift: number, pick: PickResult) => {
      if (!pos) return;
      v.set(pos.x, pos.y + lift, pos.z).project(this.camera);
      if (v.z > 1) return;
      const sx = rect.left + ((v.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - v.y) / 2) * rect.height;
      const d = Math.hypot(sx - clientX, sy - clientY);
      if (d <= radius && (!best || d < best.d)) best = { d, pick };
    };
    this.solarPanels.forEach((p, i) => {
      consider(p.parentPos, 0.6, { type: 'solar', index: i });
    });
    for (const slot of this.crops?.slots ?? []) {
      consider(slot.world, 0.5, { type: 'crop', index: slot.index });
    }
    this.filterSpots.forEach((p, i) => {
      consider(p, 0.8, { type: 'filter', index: i });
    });
    if (this.lifeSupportStations?.oxygenPos) {
      consider(this.lifeSupportStations.oxygenPos, 0.8, { type: 'oxygen_station' });
    }
    if (this.lifeSupportStations?.waterPos) {
      consider(this.lifeSupportStations.waterPos, 0.8, { type: 'water_station' });
    }
    consider(this.drillSpot ?? undefined, 1, { type: 'drill' });
    for (const [site, st] of this.stationInfo) {
      consider(st.pos, 1.2, { type: 'station', site });
    }
    consider(this.rover?.position, 0.8, { type: 'vehicle' });
    this.propSpots.bench.forEach((p, i) => {
      consider(p, 0.6, { type: 'prop', prop: 'bench', index: i });
    });
    this.rocks.forEach((r, i) => {
      if (!r.taken) consider(r.mesh.position, 0.2, { type: 'prop', prop: 'rock', index: i });
    });
    return best ? (best as { d: number; pick: PickResult }).pick : null;
  }

  private goToProp(prop: SceneryProp, index: number) {
    const local = this.localAstronaut;
    if (!local?.isRevealed || local.isBusy) return;
    if (this.roverDriver === 'local' || this.roverRider) {
      this.notify('Saia do rover primeiro (duplo clique no rover ou botão Sair).', 'info');
      return;
    }
    const pos = prop === 'rock' ? this.rocks[index]?.mesh.position : this.propSpots[prop][index];
    if (!pos) return;
    this.goInteract(pos, { kind: 'prop', prop, index, face: pos.clone() });
  }

  private activateProp(prop: SceneryProp,index: number) { if(prop==='bench'||prop==='rock')void this.interactOfficial(prop,String(index));
  }

  goToOxygenStation() {
    const pos = this.lifeSupportStations?.oxygenPos ?? this.filterSpots[0];
    if (!pos) return;
    this.goInteract(pos, { kind: 'oxygen_station', face: pos.clone() });
  }

  goToWaterStation() {
    const pos = this.lifeSupportStations?.waterPos;
    if (!pos) return;
    this.goInteract(pos, { kind: 'water_station', face: pos.clone() });
  }

  private activateOxygenStation() { void this.interactOfficial('moxie','0');
  }

  private activateWaterStation() { void this.interactOfficial('water','0');
  }

  /** Espalha as amostras de rocha do Sol do lado de fora da base (iguais para a sala toda). */
  private layoutRocks(sol: number) {
    const grid = this.grid;
    if (!grid || this.rocksSol === sol) return;
    this.rocksSol = sol;
    for (const r of this.rocks) {
      r.mesh.removeFromParent();
      r.proxy.removeFromParent();
    }
    this.rocks = [];
    for (let i = 0; i < 4; i++) {
      const a = seeded(this.opsSeed, sol, 900 + i) * Math.PI * 2;
      let spot: THREE.Vector3 | null = null;
      for (let r = 26 + seeded(this.opsSeed, sol, 910 + i) * 12; r < 44 && !spot; r += 5) {
        const p = grid.nearestWalkablePoint(Math.cos(a) * r, Math.sin(a) * r, 6);
        if (p && !grid.isInsideBase(p.x, p.z)) spot = p;
      }
      if (!spot) continue;
      const y = grid.groundY(spot.x, spot.z);
      const mesh = new THREE.Mesh(this.rockGeo, this.rockMat);
      mesh.position.set(spot.x, y + 0.3, spot.z);
      mesh.rotation.set(a, a * 2, 0);
      mesh.scale.set(1.2, 0.8, 1);
      mesh.castShadow = true;
      mesh.raycast = () => {};
      const proxy = new THREE.Mesh(this.rockProxyGeo, this.rockProxyMat);
      proxy.position.copy(mesh.position);
      proxy.userData.pick = { kind: 'prop', prop: 'rock', index: this.rocks.length };
      proxy.updateMatrixWorld(true);
      this.rocksGroup.add(mesh, proxy);
      this.rocks.push({ mesh, proxy, taken: false });
    }
  }


  /** Todos os astronautas presentes na sala (eu incluído). */
  private presentIds(): string[] {
    return this.eventParticipants().players.map((p) => p.id);
  }

  /**
   * Pular a noite: sozinho, dorme na hora; numa sala, TODOS precisam apertar (o ícone do dormitório,
   * a cama, o botão Sono ou a tecla Z). Apertar de novo desiste.
   */






  /** Dados da base ainda não enviados à Terra. */
  private pendingResearch(): number {
    const s = useMission.getState().state;
    return Math.max(0, s.research - (s.secured ?? 0));
  }

  /** No computador de envio: abre o minigame se há dados suficientes. */
  private openUpload() {
    const pending = this.pendingResearch();
    if (pending < UPLOAD_THRESHOLD) {
      this.notify(
        `📡 Ainda não há dados para enviar: ${pending}/${UPLOAD_THRESHOLD} pontos de pesquisa novos.`,
        'info',
      );
      return;
    }
    this.options?.onMinigame?.({ kind: 'upload' });
  }

  /** O envio foi interrompido no meio: o arquivo corrompe e é preciso recomeçar do início. */
  abortUpload() {
    this.notify(
      '⚠️ Envio interrompido: os arquivos corromperam. Recomece o envio do início.',
      'error',
    );
    this.journal(
      'Envio à Terra interrompido',
      'Os arquivos corromperam no meio da transmissão.',
      'bad',
    );
  }

  /** Atualiza os ícones do dormitório (à noite) e do computador (com 10 pontos novos). */
  private updateUtilityMarkers() {
    const markers = this.stationMarkers;
    if (!markers) return;
    const pending = this.pendingResearch();
    markers.set('upload', pending >= UPLOAD_THRESHOLD ? 'ready' : 'hidden', this.beaconsOn);
  }

  /** Chegou ao holograma: entrega amostras ou abre o console da missão do cômodo. */
  private activateStation(site: StationSite) {
    if (site === 'upload') {
      this.openUpload();
      return;
    }
    if (this.soilCarry > 0 && (site === 'lab' || site === 'comms')) {
      this.deliverSoil();
      return;
    }
    const id = this.missionIds.find((m) => MISSIONS[m].site === site);
    if (!id) {
      this.notify(`${STATION_LABEL[site]}: nenhuma missão sua aqui hoje.`, 'info');
      return;
    }
    if (this.missionDone(id)) {
      this.notify('Essa missão já foi concluída hoje. ✨', 'info');
      return;
    }
    const def = MISSIONS[id];
    const block = missionBlock(def, this.missionContext());
    if (block) {
      this.notify(block, 'error');
      return;
    }
    this.options?.onMinigame?.({
      kind: 'station',
      mission: id,
      title: def.title,
      hint: `${def.summary} Custo: ${costText(def.cost)}.`,
    });
  }

  /** "Ir" do painel de missões: anda até o local e começa a missão ao chegar. */
  goToMission(id: MissionId) {
    const local = this.localAstronaut;
    if (!local?.isRevealed || local.isBusy) return;
    if (this.roverDriver === 'local' || this.roverRider) {
      this.notify('Saia do rover primeiro (duplo clique no rover ou botão Sair).', 'info');
      return;
    }
    const def = MISSIONS[id];
    if (id === 'soil_robot' && this.soilCarry > 0) {
      this.goToStation(this.deliveryStation());
      return;
    }
    if (this.missionDone(id)) {
      this.notify('Essa missão já foi concluída hoje. ✨', 'info');
      return;
    }
    const block = missionBlock(def, this.missionContext());
    if (block) {
      this.notify(block, 'error');
      return;
    }
    if (id === 'soil_robot') {
      const rover = this.rover;
      if (!rover || !this.grid) return;
      if (this.roverDriver) {
        this.notify(
          'O rover já tem motorista. Toque nele para entrar como passageiro (coleta em dupla).',
          'info',
        );
        return;
      }
      const rp = rover.position;
      const dx = local.position.x - rp.x;
      const dz = local.position.z - rp.z;
      const dl = Math.hypot(dx, dz) || 1;
      const spot = this.grid.nearestWalkablePoint(
        rp.x + (dx / dl) * 2.3,
        rp.z + (dz / dl) * 2.3,
        10,
      );
      if (spot) {
        this.walkTo(spot, { kind: 'soilstart', face: rp.clone() });
        this.notify('🚙 Entre no rover e dirija até o ponto marcado para colher o solo.', 'info');
      }
      return;
    }
    if (def.site === 'drill') {
      this.goToTask('drill', 0);
      return;
    }
    this.goToStation(def.site as StationSite);
  }

  // ------------------------------------------------------------------ coleta de solo (rover)

  /**
   * Ponto de coleta de solo: longe da base, num lugar que o rover alcança. Fica marcado com um
   * feixe de luz; é preciso DIRIGIR até lá (dentro do rover) para a coleta começar.
   */
  private findSoilSite(): THREE.Vector3 | null { const p=GAMEPLAY_TARGETS[this.info.id as keyof typeof GAMEPLAY_TARGETS]?.points.soil;return p?new THREE.Vector3(p.x,GROUND_Y,p.z):null;
  }

  /** Alguém (além do motorista) está dentro do rover? Então a coleta é em dupla. */
  private soilCoop(): boolean {
    if (this.roverDriver !== 'local') return false;
    return this.remoteList.some((a) => a.inVehicle && a.id !== this.roverDriver);
  }

  /** O motorista chegou ao ponto de coleta, parado: a missão começa (sozinho ou em dupla). */
  private checkSoilArrival() {
    const rover = this.rover;
    const site = this.soilSite;
    if (!rover || !site || this.soil || this.roverDriver !== 'local') return;
    if (!this.soilArmed) {
      if (Math.hypot(rover.position.x - site.x, rover.position.z - site.z) > 9)
        this.soilArmed = true;
      return;
    }
    if (!this.missionIds.includes('soil_robot') || this.missionDone('soil_robot')) return;
    if (this.soilCarry > 0) return;
    const d = Math.hypot(rover.position.x - site.x, rover.position.z - site.z);
    if (d > 5 || Math.abs(rover.speed) > 1.2) return;
    const coop = this.soilCoop();
    const block = missionBlock(
      MISSIONS.soil_robot,
      this.missionContext(),
      coop ? COOP_COST_MULT : 1,
    );
    if (block) {
      if (!this.soilBlockWarned) this.notify(block, 'error');
      this.soilBlockWarned = true;
      return;
    }
    this.soilBlockWarned = false;
    rover.stopPath();
    rover.speed = 0;
    const eid = `${this.currentSol}:${Date.now().toString(36)}`;
    this.soilArmed = false;
    this.soil = { eid, coop, mine: null, partner: null };
    useSoilCoop.getState().reset(coop);
    if (coop) this.room?.sendSoil('start', eid, 0);
    publishMissionBoard({ soilPhase: 'sampling' });
    this.notify(
      coop
        ? '🤝 Coleta em dupla! Cada um colhe a sua parte: custa o dobro e rende o triplo de pontos.'
        : '⛏ Chegou ao ponto de coleta. Colha as amostras!',
      'ok',
    );
    this.options?.onMinigame?.({ kind: 'soil', coop, role: 'driver' });
  }

  /** O parceiro (dentro do rover) mandou abrir a coleta em dupla. */
  private onSoilStart(eid: string) {
    if (!this.roverRider || this.soil) return;
    this.soil = { eid, coop: true, mine: null, partner: null };
    useSoilCoop.getState().reset(true);
    this.options?.onMinigame?.({ kind: 'soil', coop: true, role: 'passenger' });
  }

  /** O parceiro terminou a parte dele (ou cancelou, com nota 0). */
  private onSoilDone(eid: string, quality: number) {
    const s = this.soil;
    if (!s || s.eid !== eid) return;
    s.partner = Math.max(0, Math.min(1, quality));
    useSoilCoop.getState().setPartnerDone(true);
  }

  /** Terminei a minha parte das amostras: avisa o parceiro (o minigame segue aberto até os dois). */
  soilPartReady(quality: number) {
    const s = this.soil;
    if (!s) return;
    s.mine = Math.max(0, Math.min(1, quality));
    if (s.coop) this.room?.sendSoil('done', s.eid, s.mine);
  }

  /** Fecha a coleta com sucesso: o motorista leva as amostras; o passageiro só encerra. */
  private finishSoilSampling(quality: number) {
    const s = this.soil;
    if (!s) return;
    const mine = s.mine ?? quality;
    this.soil = null;
    useSoilCoop.getState().reset(false);
    if (this.roverRider) {
      publishMissionBoard({ soilPhase: 'idle' });
      this.notify('🤝 Coleta em dupla concluída. O motorista leva as amostras.', 'ok');
      return;
    }
    const q = s.coop && s.partner !== null ? (mine + s.partner) / 2 : mine;
    this.soilCarry = soilSamples(q) * (s.coop ? 2 : 1);
    this.soilQuality = q;
    this.soilCoopRun = s.coop;
    publishMissionBoard({ soilPhase: 'deliver' });
    this.notify(
      `📦 ${this.soilCarry} amostras de solo! Volte à base, saia do rover e leve-as a um computador (${this.stationInfo.get(this.deliveryStation())?.label ?? 'laboratório'}).`,
      'ok',
    );
    this.publishMissions();
  }

  /** O jogador fechou a coleta sem terminar: nada foi gasto e dá para tentar de novo. */
  abortSoilRun() {
    const s = this.soil;
    if (!s) return;
    this.soil = null;
    if (s.coop) this.room?.sendSoil('done', s.eid, 0);
    useSoilCoop.getState().reset(false);
    publishMissionBoard({ soilPhase: 'idle' });
    this.notify('Coleta cancelada: nada foi gasto. Dirija ao ponto de novo para tentar.', 'info');
  }

  /** Teletransporte (respawn) no meio da coleta: encerra sem gastar nada. */
  private cancelSoilNow() {
    if (!this.soil) return;
    this.soil = null;
    useSoilCoop.getState().reset(false);
    publishMissionBoard({ soilPhase: 'idle' });
  }

  /** As amostras chegaram ao computador: a missão termina e rende os pontos de pesquisa. */
  private deliverSoil() { void this.interactOfficial('deliver','0');
  }

  /** Leva o astronauta até a tarefa (painel, canteiro, filtro ou sonda) e a abre ao chegar. */
  goToTask(kind: 'solar' | 'crop' | 'plant' | 'filter' | 'drill' | 'repair', index: number) {
    const local = this.localAstronaut;
    if (!local?.isRevealed || local.isBusy) return;
    if (this.roverDriver === 'local' || this.roverRider) {
      this.notify('Saia do rover primeiro (duplo clique no rover ou botão Sair).', 'info');
      return;
    }
    if (kind === 'repair') {
      const f = this.room?.world.integrity?.fractures.find((f) => f.id === index);
      const a = f && this.integrityVisuals?.anchors[f.anchor];
      if (a) this.goInteract(a.approach, { kind: 'repair', id: index, face: a.approach.clone() });
    } else if (kind === 'solar') {
      const panel = this.solarPanels[index];
      if (panel)
        this.goInteract(panel.parentPos, { kind: 'clean', index, face: panel.parentPos.clone() });
    } else if (kind === 'crop' || kind === 'plant') {
      const slot = this.crops?.slots[index];
      const center = this.taskMarkerPositions.get(`${kind}:${index}`)?.clone();
      if (slot && center) {
        center.y -= 1.8;
        this.goInteract(center, { kind: 'crop', index, face: center.clone() });
      }
    } else if (kind === 'filter') {
      const spot = this.filterSpots[index] ?? this.filterSpots[0];
      if (spot) this.goInteract(spot, { kind: 'filter', index, face: spot.clone() });
      else this.notify('Esta base não tem filtro de ar acessível.', 'error');
    } else if (kind === 'drill') {
      if (this.drillSpot)
        this.goInteract(this.drillSpot, { kind: 'drill', face: this.drillSpot.clone() });
      else this.notify('Esta base não tem sonda de perfuração.', 'error');
    }
  }

  /** O minigame terminou com sucesso: aplica o efeito no mundo e na missão. */
  completeMinigame(_req: MinigameRequest,_result: MinigameResult={}) { this.soil=null; this.playTaskCompleteSound(); this.publishMissions();
  }

  /** As plantas crescem; também só um jogador da sala conta o tempo. */


  // ====================================================================== entrada

  private bindEvents() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.lastPointerType = e.pointerType;
      this.clickDownPos.set(e.clientX, e.clientY);
    });
    el.addEventListener('pointerup', (e) => {
      this.lastPointerType = e.pointerType;
      const dist = Math.hypot(e.clientX - this.clickDownPos.x, e.clientY - this.clickDownPos.y);
      if (dist < 6) this.handleCanvasClick(e.clientX, e.clientY);
    });
    el.addEventListener('pointermove', (e) => this.handlePointerMove(e.clientX, e.clientY));
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  private static readonly KEY_MAP: Record<string, 'up' | 'down' | 'left' | 'right'> = {
    w: 'up',
    arrowup: 'up',
    s: 'down',
    arrowdown: 'down',
    a: 'left',
    arrowleft: 'left',
    d: 'right',
    arrowright: 'right',
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof Element && e.target.closest('.bit-guide')) return;
    if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    // minigame aberto por cima: setas/Espaço são dele, o astronauta não anda
    if (isGameOverlayOpen()) return;
    const k = e.key.toLowerCase();
    if (k in BaseViewer.KEY_MAP) {
      this.keys.add(BaseViewer.KEY_MAP[k]!);
      e.preventDefault();
    } else if (k === 'escape') {
      this.pending = null;
      this.localAstronaut?.stopMoving();
      this.rover?.stopPath();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k in BaseViewer.KEY_MAP) this.keys.delete(BaseViewer.KEY_MAP[k]!);
  };

  private onBlur = () => {
    this.keys.clear();
  };

  /** Joystick virtual da tela de toque: x para a direita, y para cima (-1..1). */
  setVirtualMove(x: number, y: number) {
    this.virtualMove.x = x;
    this.virtualMove.y = y;
  }

  /** Controle de carro (só com as teclas): W/S acelera e dá ré, A/D esterça. */
  private roverManualInput(): { throttle: number; steer: number } | null {
    if (this.playerBlocked || this.keys.size === 0) return null;
    const throttle = (this.keys.has('up') ? 1 : 0) - (this.keys.has('down') ? 1 : 0);
    const steer = (this.keys.has('left') ? 1 : 0) - (this.keys.has('right') ? 1 : 0);
    if (throttle === 0 && steer === 0) return null;
    return { throttle, steer };
  }

  /** Setas/WASD -> direção no mundo, relativa à câmera (cima = para o fundo da tela). */
  private keyboardDirection(): { x: number; z: number } | null {
    // [seam:survival] jogador dormindo não se move
    if (this.playerBlocked) return null;
    let up = (this.keys.has('up') ? 1 : 0) - (this.keys.has('down') ? 1 : 0);
    let right = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0);
    if (up === 0 && right === 0) {
      // joystick virtual (toque): mesma lógica, só que analógica
      const j = this.virtualMove;
      if (Math.hypot(j.x, j.y) < 0.18) return null;
      up = j.y;
      right = j.x;
    }
    return mapDirection(this.controls.getAzimuthalAngle(), up, right);
  }

  private setRay(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  /** Ponto do chão sob o cursor (só para a leitura de coordenadas). */
  private pickGroundPlane(): THREE.Vector3 | null {
    const hit = new THREE.Vector3();
    if (this.grid && this.raycaster.ray.intersectPlane(this.planeFloor, hit)) {
      if (this.grid.isInsideBase(hit.x, hit.z)) return hit;
    }
    return this.raycaster.ray.intersectPlane(this.planeGround, hit) ? hit : null;
  }

  private handlePointerMove(clientX: number, clientY: number) {
    if (!this.grid) return;
    this.setRay(clientX, clientY);
    const hit = this.pickGroundPlane();
    if (!hit) return;
    const coords = this.grid.worldToGridCoords(hit.x, hit.z);
    this.options?.onCoordinateUpdate?.({
      gx: coords.gx,
      gy: coords.gy,
      inside: this.grid.isInsideRoom(hit.x, hit.z),
    });
  }

  /**
   * O que foi clicado, de verdade: raio contra a geometria visível (não contra um plano).
   *  - máquinas (painel, canteiro, rover) são reconhecidas pelas marcas `userData.pick`;
   *  - superfícies viradas para cima e rente ao chão são piso; as de lado (parede, móvel) devolvem
   *    a normal, e é ela que diz DE QUAL LADO da parede foi o clique (dentro ou fora).
   */
  private pickScene(): PickResult {
    const hits = this.raycaster.intersectObjects(
      [...this.pickRoots, ...(this.integrityVisuals?.proxies ?? [])],
      true,
    );
    const normal = new THREE.Vector3();
    let first: PickResult | null = null;
    for (const h of hits) {
      // marca de máquina em qualquer ancestral
      let tag: {
        kind: string;
        index?: number;
        id?: number;
        site?: string;
        prop?: SceneryProp;
      } | null = null;
      let visible = true;
      for (let o: THREE.Object3D | null = h.object; o; o = o.parent) {
        const t = o.userData?.pick as
          | { kind: string; index?: number; id?: number; site?: string; prop?: SceneryProp }
          | undefined;
        if (t && !tag) tag = t;
        if (!o.visible) visible = false;
      }
      if (!visible) continue; // teto escondido, plantas de outros estágios…
      // máquinas vencem paredes translúcidas (só uma parede OPACA esconde a máquina)
      if (tag?.kind === 'repair') return { type: 'repair', id: tag.id! };
      if (tag?.kind === 'solar') return { type: 'solar', index: tag.index ?? 0 };
      if (tag?.kind === 'crop') return { type: 'crop', index: tag.index ?? 0 };
      if (tag?.kind === 'filter') return { type: 'filter', index: tag.index ?? 0 };
      if (tag?.kind === 'oxygen_station') return { type: 'oxygen_station' };
      if (tag?.kind === 'water_station') return { type: 'water_station' };
      if (tag?.kind === 'drill') return { type: 'drill' };
      if (tag?.kind === 'station') {
        return { type: 'station', site: (tag.site as StationSite | undefined) ?? 'lab' };
      }
      if (tag?.kind === 'vehicle') return { type: 'vehicle' };
      if (tag?.kind === 'prop' && tag.prop) {
        return { type: 'prop', prop: tag.prop, index: tag.index ?? 0 };
      }
      if (!visible) continue; // teto escondido, folhas originais das portas…
      if (
        h.object.type === 'Points' ||
        h.object.type === 'Line' ||
        h.object.type === 'LineSegments'
      ) {
        continue;
      }
      if (!h.face) continue;

      if (!first) {
        normal.copy(h.face.normal).transformDirection(h.object.matrixWorld);
        // face de trás de um polígono simples: vira para o lado de quem olha
        if (normal.dot(this.raycaster.ray.direction) > 0) normal.negate();
        const p = h.point;
        if (this.isRoofObject(h.object)) first = { type: 'roof', point: p.clone() };
        else if (normal.y > 0.7 && p.y < 0.6) first = { type: 'floor', point: p.clone() };
        else first = { type: 'surface', point: p.clone(), normal: normal.clone() };
      }
      // parede translúcida (cômodo ocupado): continua procurando uma máquina atrás dela
      if (!this.isTranslucent(h.object)) break;
    }
    return first ?? { type: 'none' };
  }

  private isTranslucent(o: THREE.Object3D): boolean {
    const m = (o as THREE.Mesh).material;
    const mat = Array.isArray(m) ? m[0] : m;
    return !!mat && mat.transparent && mat.opacity < 0.9;
  }

  private isRoofObject(o: THREE.Object3D): boolean {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) {
      if (p.name.endsWith('_Telhado')) return true;
    }
    return false;
  }

  /**
   * Piso para onde o clique manda andar. Se o ponto é sólido (parede, móvel, painel) NÃO vai:
   * clicar fora de piso não leva a lugar nenhum. Perto de obstáculos (só a folga do corpo),
   * ajusta para o piso livre mais próximo.
   */
  private floorTarget(x: number, z: number, profile: 'foot' | 'vehicle'): THREE.Vector3 | null {
    const grid = this.grid;
    if (!grid) return null;
    if (grid.isWalkable(x, z, profile)) return new THREE.Vector3(x, grid.groundY(x, z), z);
    if (profile === 'foot' && grid.isSolid(x, z)) return null;
    return grid.nearestWalkablePoint(x, z, profile === 'foot' ? 2 : 6, profile);
  }

  /** Ponto de piso ao lado de uma superfície, do lado para onde ela está virada. */
  private sideTarget(p: THREE.Vector3, n: THREE.Vector3): THREE.Vector3 | null {
    const grid = this.grid;
    if (!grid) return null;
    const hx = Math.hypot(n.x, n.z);
    const ux = hx > 0.05 ? n.x / hx : 0;
    const uz = hx > 0.05 ? n.z / hx : 0;
    for (const dist of [0.8, 1.2, 1.7]) {
      const cx = p.x + ux * dist;
      const cz = p.z + uz * dist;
      const q = grid.nearestWalkablePoint(cx, cz, 3);
      if (!q) continue;
      // tem de ficar do mesmo lado (dentro/fora) da superfície clicada
      if ((q.x - p.x) * ux + (q.z - p.z) * uz > -0.15) return q;
    }
    return null;
  }

  private flashRing(at: THREE.Vector3, ok: boolean) {
    if (!ok) return; // clique inválido: sem aviso, o jogador só não vai
    this.destinationRing.position.set(
      at.x,
      (this.grid?.groundY(at.x, at.z) ?? GROUND_Y) + 0.05,
      at.z,
    );
    this.destinationRing.scale.set(1, 1, 1);
    const mat = this.destinationRing.material as THREE.MeshBasicMaterial;
    mat.color.set(ok ? 0xffb511 : 0xff4d4d);
    mat.opacity = 0.9;
    this.ringFade = 1;
  }

  private handleCanvasClick(clientX: number, clientY: number) {
    const local = this.localAstronaut;
    if (!local?.isRevealed || !this.grid) return;
    this.setRay(clientX, clientY);
    const markerTask = this.taskMarkers.pick(this.raycaster);
    if (markerTask) {
      this.hideDestinationRing();
      this.goToTask(markerTask.kind, markerTask.index);
      return;
    }
    let pick = this.pickScene();
    if (
      pick.type === 'repair' ||
      pick.type === 'solar' ||
      pick.type === 'crop' ||
      pick.type === 'filter' ||
      pick.type === 'drill' ||
      pick.type === 'vehicle'
    ) {
      this.hideDestinationRing();
    }

    // ---- passageiro: só desce (o motorista é quem manda o rover) ----
    if (this.roverRider) {
      this.notify('Você é passageiro. Toque em Sair para descer do rover.', 'info');
      return;
    }

    // ---- dirigindo: o clique manda o rover para o solo; duplo clique no rover sai dele ----
    if (this.roverDriver === 'local' && this.rover) {
      if (pick.type === 'vehicle') {
        const now = performance.now();
        if (now - this.lastRoverClick < DOUBLE_CLICK_MS) {
          this.lastRoverClick = 0;
          this.exitRover();
        } else {
          this.lastRoverClick = now;
        }
        return;
      }
      this.lastRoverClick = 0;
      let spot: THREE.Vector3 | null = null;
      if (pick.type === 'floor') spot = this.floorTarget(pick.point.x, pick.point.z, 'vehicle');
      else if (pick.type === 'surface' && pick.normal.y > 0.7) {
        spot = this.floorTarget(pick.point.x, pick.point.z, 'vehicle');
      }
      if (!spot) {
        const g = this.pickGroundPlane();
        if (g) this.flashRing(g, false);
        this.notify('O rover não vai para lá (a base e os obstáculos bloqueiam).', 'error');
        return;
      }
      const { path } = this.grid.findPath(
        this.rover.position,
        spot,
        this.stormCurrent > 0.25,
        undefined,
        'vehicle',
      );
      if (!path.length) {
        this.flashRing(spot, false);
        return;
      }
      this.repathCount = 0;
      this.rover.setPath(path, path[path.length - 1]);
      this.flashRing(path[path.length - 1]!, true);
      return;
    }

    if (local.isBusy) return;

    // toque impreciso: se o dedo caiu perto de um objeto interativo, vai até ele e usa
    if (
      pick.type === 'floor' ||
      pick.type === 'surface' ||
      pick.type === 'roof' ||
      pick.type === 'none'
    ) {
      const near = this.assistPick(clientX, clientY);
      if (near) pick = near;
    }

    switch (pick.type) {
      case 'prop': {
        this.goToProp(pick.prop, pick.index);
        return;
      }
      case 'repair':
        this.goToTask('repair', pick.id);
        return;
      case 'solar': {
        const panel = this.solarPanels[pick.index];
        if (panel)
          this.goInteract(panel.parentPos, {
            kind: 'clean',
            index: pick.index,
            face: panel.parentPos.clone(),
          });
        return;
      }
      case 'crop': {
        const task = tasksFrom(useBaseOps.getState()).find(
          (task) => (task.kind === 'crop' || task.kind === 'plant') && !task.done,
        );
        if (task) this.goToTask(task.kind, task.index);
        else this.notify('🌿 A estufa já está cuidada.', 'info');
        return;
      }
      case 'filter': {
        this.goToTask('filter', pick.index);
        return;
      }
      case 'oxygen_station': {
        this.goToOxygenStation();
        return;
      }
      case 'water_station': {
        this.goToWaterStation();
        return;
      }
      case 'drill': {
        this.goToTask('drill', 0);
        return;
      }
      case 'station': {
        this.goToStation(pick.site);
        return;
      }
      case 'vehicle': {
        if (!this.rover) return;
        if (this.roverDriver && this.roverSeatsTaken() >= 2) {
          this.notify('O rover está cheio (2 lugares).', 'error');
          return;
        }
        // vai até o lado do rover mais próximo de quem clicou
        const rp = this.rover.position;
        const lp = local.position;
        const dx = lp.x - rp.x;
        const dz = lp.z - rp.z;
        const dl = Math.hypot(dx, dz) || 1;
        const spot = this.grid.nearestWalkablePoint(
          rp.x + (dx / dl) * 2.3,
          rp.z + (dz / dl) * 2.3,
          10,
        );
        if (!spot) return;
        if (!this.walkTo(spot, { kind: 'enter', face: rp.clone() })) return;
        return;
      }
      case 'roof': {
        // clicar no teto manda para o piso logo abaixo (é assim que se entra na base por fora)
        const t =
          this.floorTarget(pick.point.x, pick.point.z, 'foot') ??
          this.grid.nearestWalkablePoint(pick.point.x, pick.point.z, 5);
        if (t) this.walkTo(t, null);
        return;
      }
      case 'floor': {
        const t = this.floorTarget(pick.point.x, pick.point.z, 'foot');
        if (!t) {
          this.flashRing(pick.point, false);
          return;
        }
        this.walkTo(t, null);
        return;
      }
      case 'surface': {
        let t: THREE.Vector3 | null = null;
        if (pick.normal.y > 0.7) {
          // topo de um móvel/parede: vai até a base dele
          t = this.grid.nearestWalkablePoint(pick.point.x, pick.point.z, 8);
        } else {
          t = this.sideTarget(pick.point, pick.normal);
        }
        if (!t) {
          this.flashRing(pick.point, false);
          return;
        }
        this.walkTo(t, { kind: 'goto', face: pick.point.clone() });
        return;
      }
      default:
        return;
    }
  }

  /** Anda até uma máquina e executa a tarefa ao chegar. */
  private goInteract(machinePos: THREE.Vector3, task: PendingTask) {
    if (!this.grid) return;
    const spot = this.grid.nearestWalkablePoint(machinePos.x, machinePos.z, 30);
    if (!spot) {
      this.notify('Não há caminho até lá.', 'error');
      return;
    }
    this.walkTo(spot, task);
  }

  /** Calcula o caminho (desviando de paredes, móveis e jogadores) e começa a andar. */
  private walkTo(target: THREE.Vector3, task: PendingTask | null): boolean {
    const local = this.localAstronaut;
    if (!local || !this.grid) return false;
    // [seam:survival] não permite traçar caminho para fora da base se bloqueado por frio noturno
    if (
      this.exitBlocked &&
      this.grid.isInsideBase(local.position.x, local.position.z) &&
      !this.grid.isInsideBase(target.x, target.z)
    ) {
      this.flashRing(target, false);
      this.options?.onMessage?.('Frio extremo lá fora', 'error');
      return false;
    }
    const { path, clampedByStorm } = this.grid.findPath(
      local.position,
      target,
      this.stormCurrent > 0.25,
      this.dynamicBlocker(),
    );
    if (clampedByStorm) {
      this.options?.onStormAlert?.(
        '⚠️ Tempestade de poeira! Retorne para o perímetro seguro da base.',
      );
    }
    if (path.length === 0) {
      this.flashRing(target, false);
      return false;
    }
    this.repathCount = 0;
    this.pending = task;
    local.setPath(path, path[path.length - 1]);
    if (task && task.kind !== 'goto') this.hideDestinationRing();
    else this.flashRing(path[path.length - 1]!, true);
    return true;
  }

  private hideDestinationRing() {
    this.ringFade = 0;
    (this.destinationRing.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  // ====================================================================== API para a interface

  toggleCameraMode() {
    this.setCameraMode(this.cameraMode === 'follow' ? 'free' : 'follow');
  }

  setCameraMode(mode: 'follow' | 'free') {
    this.cameraMode = mode;
    this.options?.onCameraModeChange?.(mode);
  }

  setGridVisible(visible: boolean) {
    if (this.grid) this.grid.gridMesh.visible = visible;
  }

  // [seam:hud-paineis]
  setNavDebug(visible: boolean) {
    if (this.grid) this.grid.setNavDebug(visible, this.scene);
  }

  /** `true`: os tetos ficam sempre ocultos (visão de corte). Padrão: somem sozinhos ao entrar. */
  setRoofsAlwaysHidden(hidden: boolean) {
    this.roofsAlwaysHidden = hidden;
    this.interior?.setRoofsForcedHidden(hidden);
  }

  async repairEmergency() {
    return this.repairAction({ op: 'emergency' });
  }
  async repairAction(intent: RepairIntent) {
    const ok = (await this.room?.requestRepair(intent)) ?? false;
    if (ok && (intent.op === 'plate' || intent.op === 'screw')) {
      const { audio } = useGameSettings.getState();
      if (!audio.muted) {
        const sound = new Audio('/assets/audio/oxygen-metal-clang.mp3');
        sound.volume = ((audio.masterVolume * audio.sfxVolume) / 10000) * 0.12;
        this.doorSounds.add(sound);
        sound.addEventListener('ended', () => this.doorSounds.delete(sound), { once: true });
        void sound.play().catch(() => this.doorSounds.delete(sound));
      }
    }
    return ok;
  }
  setRepairOpen(open: boolean) {
    this.repairOpen = open;
  }
  repairFinished() {
    this.playTaskCompleteSound();
  }
  private async openRepair(id: number) {
    if (await this.repairAction({ op: 'reserve', fracture: id }))
      this.options?.onMinigame?.({ kind: 'repair', id });
    else this.notify('Outro astronauta está reparando esta fratura.', 'info');
  }
  private applyIntegrity(state: IntegrityState) {
    for(const proxy of this.integrityOutlines)this.interactionOutline.removeObject(proxy);
    this.integrityOutlines.clear();this.integrityVisuals?.sync(state);
    for(const proxy of this.integrityVisuals?.proxies??[]){this.interactionOutline.addObject(proxy);this.integrityOutlines.add(proxy);}
    publishOps({integrity:structuredClone(state)});
  }

  setStormStrength(val: number) {
    this.stormTarget = Math.max(0, Math.min(1, val));
    this.room?.sendStorm(this.stormTarget);
    this.options?.onStormChange?.(this.stormTarget > 0, false);
  }

  setQualitySettings(video: VideoSettings) {
    this.currentReducedMotion = video.reducedMotion;
    this.controls.enableDamping = !video.reducedMotion;

    if (video.quality === 'low') {
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
      this.skyDome.mesh.visible = false;
      this.skyDome.setStarsVisible(false);
      this.renderer.toneMapping = THREE.LinearToneMapping;
      this.renderer.toneMappingExposure = 1.0;
    } else if (video.quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
      this.renderer.shadowMap.enabled = true;
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.setScalar(1024);
      this.skyDome.mesh.visible = true;
      this.skyDome.setStarsVisible(false);
      this.renderer.toneMapping = video.postProcessing
        ? THREE.ACESFilmicToneMapping
        : THREE.LinearToneMapping;
      this.renderer.toneMappingExposure = 1.15;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.setScalar(4096);
      this.skyDome.mesh.visible = true;
      this.skyDome.setStarsVisible(true);
      this.renderer.toneMapping = video.postProcessing
        ? THREE.ACESFilmicToneMapping
        : THREE.LinearToneMapping;
      this.renderer.toneMappingExposure = 1.2;
    }

    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      (this.sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
    this.outline.setQuality(video.quality, video.reducedMotion);
    this.shadowDirty = true;
    this.resize();
    this.updateAtmosphere(true);
  }

  /** Liga/desliga e ajusta a linha de contorno (configurações de vídeo). */
  setOutlineSettings(outline: Pick<OutlineOptions, 'enabled' | 'strength' | 'color'>) {
    this.outline.updateOptions(outline);
  }

  // ====================================================================== atmosfera

  /**
   * Cor do céu, luz e relógio. O céu muda devagar: recalculamos só quando a hora andou um pouco
   * (ou a tempestade mudou), em vez de a cada quadro.
   */
  private updateAtmosphere(force = false) {
    const hourMoved = Math.abs(this.currentHour - this.lastAtmosphereHour) > 0.012;
    const stormMoved = Math.abs(this.stormCurrent - this.lastAtmosphereStorm) > 0.004;
    if (force || hourMoved || stormMoved) {
      this.lastAtmosphereHour = this.currentHour;
      this.lastAtmosphereStorm = this.stormCurrent;
      const sky = marsSky(this.currentHour, this.stormCurrent);
      this.skyDome.update(sky);
      this.nightFactor = sky.night;

      // A direção do sol (e o mapa de sombras) muda em passos maiores que o resto do céu:
      // mexer nela a cada quadro faz as bordas das sombras "piscarem" enquanto o tempo corre.
      if (force || Math.abs(this.currentHour - this.lastSunHour) > 0.08) {
        this.lastSunHour = this.currentHour;
        this.sun.position.copy(sky.sunDir).multiplyScalar(160);
        this.shadowDirty = true;
      }
      this.sun.color.copy(sky.sunColor);
      this.sun.intensity = sky.sunIntensity;
      this.hemiLight.color.copy(sky.hemiSky);
      this.hemiLight.groundColor.copy(sky.hemiGround);
      this.hemiLight.intensity = sky.hemiIntensity;

      this.scene.background = sky.horizon.clone();
      (this.scene.fog as THREE.Fog).color.copy(sky.horizon);
    }
    this.skyDome.mesh.position.copy(this.camera.position);

    const totalMinutes = Math.floor(this.currentHour * 60);
    if (totalMinutes !== this.lastReportedMinute) {
      this.lastReportedMinute = totalMinutes;
      this.options?.onTimeUpdate?.({
        hour: this.currentHour,
        sol: this.currentSol,
        isDay: this.currentHour >= 6 && this.currentHour < 18,
        // relógio do Sol marciano: de 00:00 até 24:39 (o dia de Marte é mais longo que o da Terra)
        formatted: formatSolClock(this.currentHour),
      });
    }
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    if (this.controls.enabled || !this.runtime) this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.left = -this.view * aspect;
    this.camera.right = this.view * aspect;
    this.camera.top = this.view;
    this.camera.bottom = -this.view;
    this.camera.updateProjectionMatrix();
    this.dustOverlay?.resize();
    this.outline.syncSize();
  }

  // ====================================================================== quadro

  private tick = () => {
    if (this.disposed) return;
    this.frame = this.schedule(this.tick);
    this.lastFrame = performance.now();
    this.step(true);
    this.render();
  };

  private render() {
    const nowMs = performance.now();
    const dt = Math.min(0.1, (nowMs - this.lastRender) / 1000);
    this.lastRender = nowMs;
    const inside = this.interior?.insideFactor ?? 0;
    const outside = 1 - inside;

    // poeira: a tempestade enche a tela fora da base e some (quase) por completo lá dentro
    this.dustStorm.update(
      this.stormCurrent * (0.3 + 0.7 * outside),
      this.simTime,
      this.currentReducedMotion,
      inside,
    );
    this.dustOverlay?.update(dt, this.stormCurrent * outside, this.currentReducedMotion);
    this.updateAtmosphere();
    {
      const focus = this.localAstronaut?.isRevealed
        ? this.localAstronaut.position
        : this.cameraFocus;
      this.lights?.update(dt, focus, this.nightFactor, this.stormCurrent, inside);
    }

    if (this.ringFade > 0) {
      this.ringFade -= dt * 1.8;
      (this.destinationRing.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        this.ringFade,
      );
      this.destinationRing.scale.addScalar(dt * 0.8);
    }

    // Câmera: acompanha o astronauta/rover (ou a nave, enquanto ele não desembarcou)
    if (this.cameraMode === 'follow') {
      const local = this.localAstronaut;
      const p =
        (this.roverDriver === 'local' || this.roverRider) && this.rover
          ? this.rover.position
          : local?.isRevealed
            ? local.position
            : this.cameraFocus;
      const k = 1 - Math.exp(-dt * 6);
      this.controls.target.x += (p.x - this.controls.target.x) * k;
      this.controls.target.z += (p.z - this.controls.target.z) * k;
      this.controls.target.y += (0 - this.controls.target.y) * k;
    }
    this.controls.update();

    // Sombras sob demanda: sem nada em movimento o mapa é reaproveitado (a cena é quase toda fixa)
    if (this.shadowDirty || nowMs - this.lastShadowUpdate > 250) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowUpdate = nowMs;
      this.shadowDirty = false;
    }

    this.interactionOutline.update();
    this.lifeSupportStations?.update(dt);
    const player = this.localAstronaut;
    this.taskMarkers.update(
      dt,
      Boolean(player && this.grid?.isInsideBase(player.position.x, player.position.z)),
      Boolean(player?.isRevealed && this.grid),
      (x, z) => this.grid?.isInsideBase(x, z) ?? true,
    );
    this.integrityVisuals?.update(
      (this.room?.clock().elapsedMs ?? this.simTime * 1000) / 1000,
      this.room?.world.integrity,
      this.currentSol,
      this.currentReducedMotion,
    );
    this.renderer.render(this.scene, this.camera);
    this.outline.render();
  }

  dispose() {
    if (this.disposed) return;
    this.stopIntegritySubscription?.();
    this.room?.repairPause(false);
    this.integrityVisuals?.dispose();
    this.stormAudio?.pause();
    for (const sound of this.doorSounds) sound.pause();
    this.doorSounds.clear();
    this.metalFootstepAudio?.forEach((step) => step.pause());
    this.metalFootstepAudio = null;
    this.footstepAudio?.forEach((step) => step.pause());
    this.footstepAudio = null;
    if (this.disposed) return;
    this.disposed = true;
    if (this.duoInvite) window.clearTimeout(this.duoInvite.timer);
    // [seam:survival]
    if (this.fadeOverlay) {
      this.fadeOverlay.remove();
      this.fadeOverlay = null;
    }
    this.systems.dispose();
    this.rockGeo.dispose();
    this.rockMat.dispose();
    this.rockProxyGeo.dispose();
    this.rockProxyMat.dispose();
    // o Game ativa o viewer novo ANTES de descartar o antigo: só limpa o relógio se ainda é nosso
    if (BaseViewer.clockOwner === this) {
      BaseViewer.clockOwner = null;
      GameClock.setTimeSkipper(null, null);
      GameClock.reset();
    }
    cancelAnimationFrame(this.frame);
    this.stopTicker?.();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.skyDome.dispose();
    this.dustOverlay?.dispose();
    this.groundSkirt.geometry.dispose();
    (this.groundSkirt.material as THREE.Material).dispose();
    this.localAstronaut?.dispose();
    for (const a of this.remoteAstronauts.values()) a.dispose();
    this.taskMarkers.dispose();
    this.interactionOutline.dispose();
    this.outline.dispose();
    if (BaseViewer.clockOwner === null) {
      resetOps();
      resetMissionBoard();
    }
    this.lights?.dispose();
    this.rover?.dispose();
    this.crops?.dispose();
    this.lifeSupportStations?.dispose();
    this.lifeSupportStations = null;
    this.stationMarkers?.dispose();
    this.stationMarkers = null;
    this.room?.dispose();
    this.shipFx.dispose();
    this.grid?.dispose();

    // sombras: o mapa e o passe são nossos mesmo com o renderer compartilhado
    this.sun.shadow.map?.dispose();
    this.sun.shadow.mapPass?.dispose();

    if (this.assets) {
      // modelos do pool: o pool libera (contagem de referências); só soltamos o que criamos
      for (const root of this.pooledRoots) this.scene.remove(root);
      disposeTree(this.scene);
      for (const url of this.urls) this.assets.release(url);
    } else {
      disposeTree(this.scene);
    }
    if (!this.runtime) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    if (import.meta.env.DEV) {
      const w = window as unknown as { __marsViewer?: BaseViewer };
      if (w.__marsViewer === this) w.__marsViewer = undefined;
    }
  }

  // [seam:survival] métodos de suporte ao SystemContext
  private fadeScreen(opacity: number, ms: number): void {
    if (!this.container) return;
    if (!this.fadeOverlay) {
      const el = document.createElement('div');
      el.setAttribute('data-seam', 'survival-fade');
      Object.assign(el.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0ms ease',
        zIndex: '85',
      });
      this.container.appendChild(el);
      this.fadeOverlay = el;
    }
    const clamped = Math.max(0, Math.min(1, opacity));
    const duration = Math.max(0, ms);
    this.fadeOverlay.style.transition = `opacity ${duration}ms ease`;
    this.fadeOverlay.style.opacity = String(clamped);
  }

  private teleportPlayerTo(point: { x: number; y?: number; z: number }): void {
    if (this.room?.mode === 'online') {
      this.cancelSoilNow();
      void this.requestMovementAction('infirmary');
      return;
    }
    this.cancelSoilNow();
    if (this.roverDriver === 'local') {
      this.exitRover();
    }
    const local = this.localAstronaut;
    if (!local) return;
    const fx = point.x;
    const fz = point.z;
    const fy = point.y ?? this.grid?.groundY(fx, fz) ?? FLOOR_Y;
    local.stopMoving();
    local.root.position.set(fx, fy, fz);
  }

  getInfirmaryPoint(): THREE.Vector3 {
    const grid = this.grid;
    if (!grid) return new THREE.Vector3(0, FLOOR_Y, 0);
    const rooms = grid.layout.rooms ?? [];
    let room = rooms.find((r) => r.kind?.toLowerCase().includes('medicina'));
    if (!room) {
      room = rooms.find((r) => r.kind?.toLowerCase().includes('habitacao'));
    }
    if (!room && rooms.length > 0) {
      room = rooms[0];
    }
    if (!room) return new THREE.Vector3(0, FLOOR_Y, 0);

    const a = grid.tileToWorld(room.tile[0], room.tile[1]);
    const b = grid.tileToWorld(room.tile[0] + room.size[0] - 1, room.tile[1] + room.size[1] - 1);
    const cx = (a.wx + b.wx) / 2;
    const cz = (a.wz + b.wz) / 2;
    const cy = grid.groundY(cx, cz);
    return new THREE.Vector3(cx, cy, cz);
  }

  private getSystemContext(): SystemContext {
    if (!this.systemContext) {
      const viewer = this;
      this.systemContext = {
        get playerPosition() {
          const p = viewer.localAstronaut?.position;
          return p ? { x: p.x, y: p.y, z: p.z } : { x: 0, y: 0, z: 0 };
        },
        get insideBase() {
          const p = viewer.localAstronaut?.position;
          return Boolean(p && viewer.grid?.isInsideBase(p.x, p.z));
        },
        get driving() {
          return viewer.roverDriver === 'local' || viewer.roverRider;
        },
        get sheltered() {
          return viewer.soil !== null;
        },
        get night() {
          return viewer.nightFactor;
        },
        get storm() {
          return viewer.stormCurrent;
        },
        get cameraMode() {
          return viewer.cameraMode;
        },
        teleportPlayerTo: (point) => viewer.teleportPlayerTo(point),
        setPlayerSpeedScale: (scale) => {
          viewer.playerSpeedScale = scale;
        },
        blockExitFromBase: (on) => {
          viewer.exitBlocked = on;
        },
        setPlayerBlocked: (on) => {
          viewer.playerBlocked = on;
          if (on) viewer.localAstronaut?.stopMoving();
        },
        fadeScreen: (opacity, ms) => viewer.fadeScreen(opacity, ms),
        getInfirmaryPoint: () => viewer.getInfirmaryPoint(),
      };
    }
    return this.systemContext;
  }
}
