import { GAME_EMOTES, GAME_MAX_SOLAR, type GameMotion } from '@mars/shared';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { VideoSettings } from '../app/components/SettingsModal';
import { type BaseId, type BaseInfo, baseModelUrl } from '../lib/bases';
import { getGuestName } from '../lib/guest';
import { loadGLB } from '../lib/modelCache';
import { readSuitPreference } from '../lib/suitPreference';
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
import { InteriorFader } from './InteriorFader';
import {
  MultiplayerRoom,
  type RemotePlayer,
  type RoomMode,
  RoomRejectedError,
} from './MultiplayerRoom';
import { NightLights } from './NightLights';
import { Propulsion } from './Propulsion';
import type { AssetPool } from './runtime/assets';
import type { GameRuntime } from './runtime/expedition';
import { batchStaticMeshes, freezeStatic } from './StaticBatcher';
import { Rover } from './Vehicle';
// [seam:survival]
import type { SystemContext } from './systems/context';
import { GameSystemRegistry } from './systems/registry';
import './survival';

const SCALE = 0.75;
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
  roomCode?: string;
  initialHour?: number;
  initialSol?: number;
  videoSettings?: VideoSettings;
  onTimeUpdate?: (info: { hour: number; sol: number; isDay: boolean; formatted: string }) => void;
  onCoordinateUpdate?: (info: { gx: number; gy: number; inside: boolean }) => void;
  onStormAlert?: (msg: string) => void;
  onStormChange?: (active: boolean, remote: boolean) => void;
  onSolarCleaned?: () => void;
  onCameraModeChange?: (mode: 'follow' | 'free') => void;
  onPlayersChange?: (info: { count: number; mode: RoomMode }) => void;
  onRoomError?: (msg: string) => void;
  /** avisos do jogo (tarefa concluída, alvo inválido…) */
  onMessage?: (msg: string, kind: 'ok' | 'error' | 'info') => void;
  /** um emoji foi enviado (por mim ou por outro jogador): alimenta o chat */
  onEmote?: (info: { name: string; emoji: string; local: boolean }) => void;
  /** a sala recusou a entrada (apelido em uso, sala cheia): a interface deve voltar ao início */
  onRoomRejected?: () => void;
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
  | { kind: 'enter'; face: THREE.Vector3 }
  | { kind: 'goto'; face: THREE.Vector3 };

/** Resultado de um clique no cenário. */
type PickResult =
  | { type: 'solar'; index: number }
  | { type: 'crop'; index: number }
  | { type: 'vehicle' }
  | { type: 'floor'; point: THREE.Vector3 }
  | { type: 'surface'; point: THREE.Vector3; normal: THREE.Vector3 }
  | { type: 'roof'; point: THREE.Vector3 }
  | { type: 'none' };

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
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
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
  private readonly remoteAstronauts = new Map<string, AstronautActor>();
  private readonly remoteList: AstronautActor[] = [];
  private pending: PendingTask | null = null;
  private repathCount = 0;

  // [seam:survival] subsistemas de simulação e controle de estado
  readonly systems = new GameSystemRegistry();
  private exitBlocked = false;
  private playerSleeping = false;
  private playerSpeedScale = 1;
  private fadeOverlay: HTMLDivElement | null = null;
  private systemContext: SystemContext | null = null;

  // Teclado
  private readonly keys = new Set<string>();
  private lastInputKey = '';

  // Rover
  private rover: Rover | null = null;
  private roverDriver: 'local' | string | null = null;
  private roverRemoteTarget: { x: number; z: number; h: number } | null = null;
  private readonly roverCollider: Collider;
  private roverPark = { x: 0, z: 0, h: 0 };

  // Plantações
  private crops: CropSystem | null = null;

  // Multiplayer
  private room: MultiplayerRoom | null = null;
  private netAcc = 0;
  private lastSent: GameMotion | null = null;

  // Painéis solares e poeira
  private solarPanels: Array<{ mesh: THREE.Mesh; stage: number; parentPos: THREE.Vector3 }> = [];
  private solarDustMats: THREE.MeshStandardMaterial[] = [];
  private stormDustTimer = 0;

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
    this.sun.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
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
    this.controls.maxZoom = 3.6;
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
      this.fetchModel('/assets/bases/terreno.glb', true),
      this.fetchModel('/assets/bases/plantas.glb', true),
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

    const cx = (this.info.bounds.x0 + this.info.bounds.x1) / 2;
    const cy = (this.info.bounds.y0 + this.info.bounds.y1) / 2;
    const model = base.scene;
    model.position.set(-cx * 3, 0.01, cy * 3);
    model.scale.setScalar(SCALE);
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
    this.roverPark = this.computeRoverPark();

    // ---- colisão: gerada da geometria real (o que bloqueia é o que se vê) ----
    const rocks = land?.scene.getObjectByName('Rocas');
    grid.buildNavigation(model, {
      skip: (name) =>
        /_Telhado$|_Nave$|_Folha(Inf|Sup)$|_Antena_Prato$|_Pad(Luz)?_\d+$|_Rampa$/.test(name),
      extraObstacles: rocks ? [rocks] : [],
      seed: this.rawSpawn(0),
      vehicleSeed: new THREE.Vector3(this.roverPark.x, 0, this.roverPark.z),
    });
    if (new URLSearchParams(location.search).has('nav')) grid.setNavDebug(true, this.scene);
    this.spawnPoints = this.computeSpawnPoints();
    const park = grid.nearestWalkablePoint(this.roverPark.x, this.roverPark.z, 40, 'vehicle');
    if (park) {
      this.roverPark.x = park.x;
      this.roverPark.z = park.z;
    }
    rover.place(this.roverPark.x, this.roverPark.z, this.roverPark.h, GROUND_Y);
    this.scene.add(rover.root);

    // ---- interior (tetos/paredes transparentes) e portas automáticas ----
    this.interior = new InteriorFader(model, grid);
    this.interior.setRoofsForcedHidden(this.roofsAlwaysHidden);
    this.doors = new DoorSystem(model);

    this.lights = new NightLights(this.scene, model, grid);

    // ---- desempenho: mobília fixa vira poucas malhas; matrizes estáticas congeladas ----
    const isProtected = (o: THREE.Object3D) =>
      /_Telhado$|_Nave$|_Solar_\d+$|Antena|_Folha(Inf|Sup)$/.test(o.name) ||
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

    this.pickRoots = [model, ...(land ? [land.scene] : []), rover.root, ...this.crops.proxies];

    this.lights.collectGlow(this.scene);

    // Poeira/tempestade: aplicada depois de todas as trocas de material
    applyBoundaryFog(this.scene);

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
  private computeRoverPark() {
    const grid = this.grid!;
    const bay = this.info.bay;
    if (bay?.crew.path.length) {
      const door = bay.crew.path[bay.crew.path.length - 1]!;
      const [ex, ey] = bay.crew.exit;
      const w = grid.modelMetersToWorld(door[0] + ex * 6.5, door[1] + ey * 6.5);
      return { x: w.wx, z: w.wz, h: Math.atan2(ex, -ey) };
    }
    // sem garagem: ao lado do heliponto, longe da base
    const away = Math.atan2(this.shipRestWorld.z, this.shipRestWorld.x);
    return {
      x: this.shipRestWorld.x + Math.cos(away + 1.2) * 9,
      z: this.shipRestWorld.z + Math.sin(away + 1.2) * 9,
      h: 0,
    };
  }

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
      this.options?.onRoomError?.(
        err instanceof RoomRejectedError ? err.message : 'Não foi possível entrar na sala.',
      );
      this.room = null;
      if (err instanceof RoomRejectedError) this.options?.onRoomRejected?.();
    }
    const room = this.room;
    if (!room || this.disposed) return;

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
    await Promise.all(existing.map((p) => this.addRemote(p, true)));

    room.onPlayerJoined = (p, isExisting) => void this.addRemote(p, isExisting);
    room.onPlayerLeft = (id) => this.removeRemote(id);
    room.onPlayerState = (id, s) => {
      const actor = this.remoteAstronauts.get(id);
      if (!actor) return;
      actor.applySnapshot(s);
      this.syncRemoteDriving(actor, s);
    };
    room.onEmote = (id, index) => {
      const actor = this.remoteAstronauts.get(id);
      const emoji = GAME_EMOTES[index];
      if (!actor || !emoji) return;
      this.showEmote(actor, emoji);
      this.options?.onEmote?.({ name: actor.name, emoji, local: false });
    };
    room.onStorm = (val) => {
      this.stormTarget = val;
      this.options?.onStormChange?.(val > 0, true);
    };
    room.onSolar = (stages) => this.applySolarStages(stages);
    room.onCrops = (stages) => this.crops?.apply(stages);
    room.onVehicle = (vs) => {
      if (!this.roverDriver) this.rover?.place(vs.x, vs.z, vs.h, GROUND_Y);
    };
    this.reportPlayers();
  }

  private reportPlayers() {
    this.options?.onPlayersChange?.({
      count: 1 + this.remoteAstronauts.size,
      mode: this.room?.mode ?? 'local',
    });
  }

  private async addRemote(p: RemotePlayer, existing: boolean) {
    if (this.remoteAstronauts.has(p.id)) return;
    const actor = new AstronautActor(p.id, p.name, false, p.suit);
    this.remoteAstronauts.set(p.id, actor);
    this.remoteList.push(actor);
    await actor.ready;
    if (this.disposed || this.remoteAstronauts.get(p.id) !== actor) {
      actor.dispose();
      return;
    }
    this.scene.add(actor.root);
    applyBoundaryFog(actor.root);
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
    } else if (actor.inVehicle) {
      const at = this.footPointNear(rover.position, rover.heading) ?? rover.position.clone();
      actor.setDriving(false, at, s.h);
      if (this.roverDriver === actor.id) {
        this.roverDriver = null;
        this.roverRemoteTarget = null;
        rover.setDriver(null, false);
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
    }
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
  }

  // ====================================================================== pouso

  /** Ponto (cru, sem navegação) ao lado da nave, do lado da base. */
  private rawSpawn(slot: number): THREE.Vector3 {
    const ship = this.shipRestWorld;
    const toBase = Math.atan2(-ship.z, -ship.x);
    const a = toBase + ([0, 0.62, -0.62, 1.24][slot % 4] ?? 0);
    return new THREE.Vector3(ship.x + Math.cos(a) * 6.4, GROUND_Y, ship.z + Math.sin(a) * 6.4);
  }

  /**
   * Quatro pontos de desembarque (um por vaga) ao redor da nave DESTA base: livres, com folga
   * para o corpo e afastados entre si. Todos os clientes calculam o mesmo resultado.
   */
  private computeSpawnPoints(): THREE.Vector3[] {
    const grid = this.grid!;
    const ship = this.shipRestWorld;
    const toBase = Math.atan2(-ship.z, -ship.x);
    const roomy = (x: number, z: number) => {
      if (!grid.isWalkable(x, z)) return false;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (!grid.isWalkable(x + Math.cos(a) * 0.9, z + Math.sin(a) * 0.9)) return false;
      }
      return true;
    };
    const picks: THREE.Vector3[] = [];
    for (let slot = 0; slot < 4; slot++) {
      let chosen: THREE.Vector3 | null = null;
      for (const r of [6.4, 7.6, 5.4, 9]) {
        for (let k = 0; k < 28 && !chosen; k++) {
          const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.24;
          const a = toBase + off;
          const x = ship.x + Math.cos(a) * r;
          const z = ship.z + Math.sin(a) * r;
          if (!roomy(x, z)) continue;
          if (picks.some((p) => Math.hypot(p.x - x, p.z - z) < 1.5)) continue;
          chosen = new THREE.Vector3(x, grid.groundY(x, z), z);
        }
        if (chosen) break;
      }
      picks.push(
        chosen ??
          grid.nearestWalkablePoint(ship.x, ship.z + 6, 60) ??
          new THREE.Vector3(ship.x, GROUND_Y, ship.z),
      );
    }
    return picks;
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

    // Relógio: igual para todos da sala (ou local, se estiver sozinho/offline)
    if (this.room) {
      const c = this.room.clock();
      this.currentHour = c.hour;
      this.currentSol = c.sol;
    } else {
      const prev = this.currentHour;
      this.currentHour = (this.currentHour + dt * (24 / MARS_SOL_DURATION_SECONDS)) % 24;
      if (this.currentHour < prev) this.currentSol += 1;
    }

    // A tempestade chega e passa aos poucos
    this.stormCurrent += (this.stormTarget - this.stormCurrent) * Math.min(1, dt * 0.9);
    if (Math.abs(this.stormTarget - this.stormCurrent) < 0.003)
      this.stormCurrent = this.stormTarget;

    this.updateShip(dt);

    const local = this.localAstronaut;
    const colliders: Collider[] = [];
    for (const a of this.remoteList) colliders.push(a);
    if (this.rover) colliders.push(this.roverCollider);
    const ctx: MoveContext = { grid: this.grid, others: colliders };

    const dir = this.keyboardDirection();

    if (local) {
      if (this.roverDriver === 'local' && this.rover) {
        this.updateDriving(dt, local, dir);
      } else {
        // teclado: só atualiza quando muda (cancela o caminho do clique uma vez)
        local.setInput(local.isRevealed ? dir : null);
        local.update(dt * this.playerSpeedScale, ctx, animate);
        this.handleRepath(local);
        this.handlePending(local);
      }
    }
    for (const a of this.remoteList) a.update(dt, ctx, animate);

    // rover de outro jogador / parado: rodas e posição
    if (this.rover) {
      if (this.roverDriver && this.roverDriver !== 'local' && this.roverRemoteTarget) {
        const t = this.roverRemoteTarget;
        this.rover.follow(dt, t.x, t.z, t.h);
      } else if (this.roverDriver !== 'local') {
        this.rover.speed = 0;
      }
      if (animate) this.rover.animate(dt);
    }

    // portas e interior
    const positions: Array<{ x: number; z: number }> = [];
    if (local?.isRevealed && this.roverDriver !== 'local') positions.push(local.position);
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

    this.accumulateSolarDust(dt);
    this.growCrops(dt);
    this.broadcastState(dt, local);
    this.checkStormAlert(local);

    if (this.mixer && animate) this.mixer.update(dt);

    // [seam:survival] execução dos sistemas de jogo plugáveis com SystemContext
    this.systems.update(dt, this.getSystemContext());
  }

  /** Dirige o rover (jogador local). */
  private updateDriving(dt: number, local: AstronautActor, dir: { x: number; z: number } | null) {
    const rover = this.rover!;
    if (dir) rover.stopPath();
    rover.drive(dt, { dir }, this.grid);
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
    if (d > TASK_REACH) {
      this.notify('Não consegui chegar lá.', 'error');
      return;
    }

    if (p.kind === 'clean') {
      const panel = this.solarPanels[p.index];
      if (!panel) return;
      if (panel.stage === 0) {
        this.notify('Este painel já está limpo. ✨', 'info');
        return;
      }
      local.startTask('clean', p.face, () => {
        this.setSolarStage(p.index, 0);
        this.room?.sendSolar(this.solarStages());
        this.options?.onSolarCleaned?.();
      });
      return;
    }

    // canteiro
    const slot = this.crops?.slots[p.index];
    if (!slot || !this.crops) return;
    if (slot.stage === 0) {
      local.startTask('plant', p.face, () => {
        this.crops?.setStage(p.index, 1);
        this.room?.sendCrops(this.crops?.stages() ?? []);
        this.notify('🌱 Muda plantada! Volte quando estiver pronta.', 'ok');
      });
    } else if (slot.stage === 3) {
      local.startTask('harvest', p.face, () => {
        this.crops?.setStage(p.index, 0);
        this.room?.sendCrops(this.crops?.stages() ?? []);
        const label =
          slot.kind === 'Batata' ? 'batatas' : slot.kind === 'Alface' ? 'alfaces' : 'tomates';
        this.notify(`🧺 Colheita feita: ${label} frescas para a base!`, 'ok');
      });
    } else {
      this.notify('🌿 Ainda está crescendo. Volte daqui a pouco.', 'info');
    }
  }

  private notify(msg: string, kind: 'ok' | 'error' | 'info') {
    this.options?.onMessage?.(msg, kind);
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
    const local = this.localAstronaut;
    const rover = this.rover;
    if (!local?.isRevealed || !rover || local.isBusy || this.roverDriver === 'local') return;
    if (this.roverDriver) {
      this.notify('O rover está sendo usado por outro astronauta.', 'error');
      return;
    }
    const d = Math.hypot(local.position.x - rover.position.x, local.position.z - rover.position.z);
    if (d > ENTER_REACH + 0.8) {
      this.notify('Chegue mais perto do rover (clique nele para ir até lá).', 'info');
      return;
    }
    this.pending = null;
    this.roverDriver = 'local';
    local.setDriving(true);
    rover.setDriver(local.name, true);
    rover.stopPath();
    this.repathCount = 0;
    this.options?.onVehicleChange?.(true);
    this.notify('🚙 No rover! Clique no solo ou use WASD. E para sair.', 'ok');
    this.lastSent = null; // força o envio imediato
  }

  /** Sai do rover para o chão ao lado dele. */
  exitRover() {
    const local = this.localAstronaut;
    const rover = this.rover;
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

  /** Mostra um emoji do painel sobre o jogador local (balão com fade) e avisa a sala. */
  sendEmote(index: number): boolean {
    const emoji = GAME_EMOTES[index];
    const local = this.localAstronaut;
    if (!emoji || !local?.isRevealed) return false;
    this.showEmote(local, emoji);
    this.room?.sendEmote(index);
    this.options?.onEmote?.({ name: local.name, emoji, local: true });
    return true;
  }

  /** Dentro do rover o balão sobe sobre o carro; a pé, sobre a cabeça. */
  private showEmote(actor: AstronautActor, emoji: string) {
    if (actor.inVehicle && this.rover) this.rover.emote.show(emoji);
    else actor.emote.show(emoji);
  }

  get isDriving() {
    return this.roverDriver === 'local';
  }

  /** Publica o estado do jogador local para a sala (10 Hz em movimento, 1 Hz parado). */
  private broadcastState(dt: number, local: AstronautActor | null) {
    if (!this.room || !local?.isRevealed) return;
    this.netAcc += dt;
    const motion = local.motion;
    const driving = this.roverDriver === 'local' && this.rover;
    const moving = driving ? this.rover!.isMoving : motion !== 'idle';
    const changed = this.lastSent?.m !== motion;
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
      m: motion,
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
    const at = a.actor.isLocal ? a.spawn : (this.remoteSnapshotPosition(a.actor) ?? a.spawn);
    a.actor.reveal(at, a.heading);
    if (a.actor.isLocal) this.cameraFocus.copy(a.spawn);
    else {
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
    p.mesh.visible = p.stage > 0;
    const mat = this.solarDustMats[p.stage];
    if (mat) p.mesh.material = mat;
  }

  /** A poeira da tempestade suja os painéis; só UM jogador da sala conta o tempo (sem duplicar). */
  private accumulateSolarDust(dt: number) {
    if (this.stormCurrent < 0.1) return;
    if (this.room && !this.room.isCoordinator) return;
    this.stormDustTimer += dt * this.stormCurrent;
    if (this.stormDustTimer < 5) return;
    this.stormDustTimer = 0;
    this.solarPanels.forEach((p, idx) => {
      if (p.stage < 4) this.setSolarStage(idx, p.stage + 1);
    });
    this.room?.sendSolar(this.solarStages());
  }

  /** As plantas crescem; também só um jogador da sala conta o tempo. */
  private growCrops(dt: number) {
    if (!this.crops) return;
    if (this.room && !this.room.isCoordinator) return;
    if (this.crops.grow(dt)) this.room?.sendCrops(this.crops.stages());
  }

  // ====================================================================== entrada

  private bindEvents() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this.clickDownPos.set(e.clientX, e.clientY));
    el.addEventListener('pointerup', (e) => {
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
    if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k in BaseViewer.KEY_MAP) {
      this.keys.add(BaseViewer.KEY_MAP[k]!);
      e.preventDefault();
    } else if (k === 'e' && !e.repeat) {
      if (this.roverDriver === 'local') this.exitRover();
      else this.tryEnterNearestRover();
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

  /** Tecla E perto do rover: entra. */
  private tryEnterNearestRover() {
    const local = this.localAstronaut;
    const rover = this.rover;
    if (!local?.isRevealed || !rover) return;
    const d = Math.hypot(local.position.x - rover.position.x, local.position.z - rover.position.z);
    if (d <= ENTER_REACH + 0.8) this.enterRover();
    else this.notify('Chegue perto do rover e aperte E (ou clique nele).', 'info');
  }

  /** Setas/WASD -> direção no mundo, relativa à câmera (cima = para o fundo da tela). */
  private keyboardDirection(): { x: number; z: number } | null {
    // [seam:survival] jogador dormindo não se move
    if (this.playerSleeping || this.keys.size === 0) return null;
    const up = (this.keys.has('up') ? 1 : 0) - (this.keys.has('down') ? 1 : 0);
    const right = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0);
    if (up === 0 && right === 0) return null;
    const theta = this.controls.getAzimuthalAngle();
    const fx = -Math.sin(theta);
    const fz = -Math.cos(theta);
    const x = fx * up + -fz * right;
    const z = fz * up + fx * right;
    const l = Math.hypot(x, z) || 1;
    return { x: x / l, z: z / l };
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
    const hits = this.raycaster.intersectObjects(this.pickRoots, true);
    const normal = new THREE.Vector3();
    let first: PickResult | null = null;
    for (const h of hits) {
      // marca de máquina em qualquer ancestral
      let tag: { kind: string; index?: number } | null = null;
      let visible = true;
      for (let o: THREE.Object3D | null = h.object; o; o = o.parent) {
        const t = o.userData?.pick as { kind: string; index?: number } | undefined;
        if (t && !tag) tag = t;
        if (!o.visible) visible = false;
      }
      // máquinas vencem paredes translúcidas (só uma parede OPACA esconde a máquina)
      if (tag?.kind === 'solar') return { type: 'solar', index: tag.index ?? 0 };
      if (tag?.kind === 'crop') return { type: 'crop', index: tag.index ?? 0 };
      if (tag?.kind === 'vehicle') return { type: 'vehicle' };
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
    const pick = this.pickScene();

    // ---- dirigindo: o clique manda o rover para o solo ----
    if (this.roverDriver === 'local' && this.rover) {
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

    switch (pick.type) {
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
        const slot = this.crops?.slots[pick.index];
        if (slot)
          this.goInteract(slot.world, {
            kind: 'crop',
            index: pick.index,
            face: slot.world.clone(),
          });
        return;
      }
      case 'vehicle': {
        if (!this.rover) return;
        if (this.roverDriver) {
          this.notify('O rover está sendo usado por outro astronauta.', 'error');
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
    this.flashRing(path[path.length - 1]!, true);
    return true;
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
      this.sun.shadow.mapSize.setScalar(2048);
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
    this.shadowDirty = true;
    this.resize();
    this.updateAtmosphere(true);
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

      this.sun.position.copy(sky.sunDir).multiplyScalar(160);
      this.sun.color.copy(sky.sunColor);
      this.sun.intensity = sky.sunIntensity;
      this.hemiLight.color.copy(sky.hemiSky);
      this.hemiLight.groundColor.copy(sky.hemiGround);
      this.hemiLight.intensity = sky.hemiIntensity;

      this.scene.background = sky.horizon.clone();
      (this.scene.fog as THREE.Fog).color.copy(sky.horizon);
      this.shadowDirty = true;
    }
    this.skyDome.mesh.position.copy(this.camera.position);

    const totalMinutes = Math.floor(this.currentHour * 60);
    if (totalMinutes !== this.lastReportedMinute) {
      this.lastReportedMinute = totalMinutes;
      const h = Math.floor(this.currentHour);
      const m = Math.floor((this.currentHour % 1) * 60);
      this.options?.onTimeUpdate?.({
        hour: this.currentHour,
        sol: this.currentSol,
        isDay: this.currentHour >= 6 && this.currentHour < 18,
        formatted: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
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
        this.roverDriver === 'local' && this.rover
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

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    // [seam:survival]
    if (this.fadeOverlay) {
      this.fadeOverlay.remove();
      this.fadeOverlay = null;
    }
    this.systems.dispose();
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
    this.lights?.dispose();
    this.rover?.dispose();
    this.crops?.dispose();
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
    if (this.roverDriver === 'local') {
      this.exitRover();
    }
    const local = this.localAstronaut;
    if (!local) return;
    const fx = point.x;
    const fz = point.z;
    const fy = point.y ?? (this.grid?.groundY(fx, fz) ?? FLOOR_Y);
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
          return viewer.roverDriver === 'local';
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
        setPlayerSleeping: (on) => {
          viewer.playerSleeping = on;
          if (on) viewer.localAstronaut?.stopMoving();
        },
        fadeScreen: (opacity, ms) => viewer.fadeScreen(opacity, ms),
        getInfirmaryPoint: () => viewer.getInfirmaryPoint(),
      };
    }
    return this.systemContext;
  }
}
