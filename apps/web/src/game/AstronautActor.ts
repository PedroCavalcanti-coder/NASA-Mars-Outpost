import {
  cloneSuit,
  DEFAULT_SUIT,
  DUO_GESTURES,
  type DuoGestureId,
  EMOTE_ANIMATIONS,
  type SuitConfig,
} from '@mars/shared';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  ASTRONAUT_MODEL_URL,
  applySuitAppearance,
  type ModelTextures,
  meshMaterials,
  prepareModel,
  setFaceExpression,
} from './astronautModel';
import type { BaseGrid } from './BaseGrid';
import { PLAYER_RADIUS } from './BaseGrid';
import { createNametag, disposeNametag, EmoteBubble } from './nametag';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

let cachedGltf: Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> | null = null;

/** O GLB do astronauta é baixado e decodificado uma única vez; cada jogador recebe um clone. */
function loadAstronautGLTF() {
  cachedGltf ??= loader.loadAsync(ASTRONAUT_MODEL_URL).then((g) => ({
    scene: g.scene,
    animations: g.animations,
  }));
  return cachedGltf;
}

/** O que o astronauta está fazendo (viaja pela rede para animar o astronauta remoto). */
export type ActorMotion = 'idle' | 'walk' | 'clean' | 'plant' | 'harvest' | 'drive';

/** Tarefas de campo: cada uma tem animação, ferramenta e duração próprias. */
export type ActorTask = 'clean' | 'plant' | 'harvest';

const TASKS: Record<ActorTask, { clip: string; tool: string; seconds: number }> = {
  clean: { clip: 'Clean', tool: 'tool_cleaning', seconds: 2.4 },
  plant: { clip: 'Plant', tool: 'tool_botany', seconds: 2.0 },
  harvest: { clip: 'Harvest', tool: 'tool_harvest', seconds: 2.2 },
};

/** Clipe de reserva quando o modelo não tem o clipe pedido (o v2 não tem Clean/Plant/Harvest). */
const CLIP_FALLBACK: Record<string, string> = {
  Clean: 'Work',
  Plant: 'Work',
  Harvest: 'Work',
};

/** Expressões do rosto LED (células do atlas). */
const FACE_HAPPY = 0;
const FACE_TIRED = 3;
const FACE_SLEEPING = 5;
const FACE_BLINK = 7;

/** Humor do astronauta, vindo dos sistemas de sobrevivência. */
export type ActorMood = 'normal' | 'tired' | 'sleeping';

/** Tempo para deslizar até a posição de um gesto em dupla. */
const DUO_SLIDE_SECONDS = 0.25;

export interface ActorSnapshot {
  x: number;
  z: number;
  /** direção (rad) */
  h: number;
  m: ActorMotion;
}

/** Qualquer coisa sólida com a qual o astronauta não pode se sobrepor (outros jogadores, rover). */
export interface Collider {
  readonly position: THREE.Vector3;
  readonly radius: number;
  readonly isCollidable: boolean;
}

/** O que o astronauta precisa saber do mundo para andar sem atravessar nada. */
export interface MoveContext {
  grid: BaseGrid | null;
  others: Iterable<Collider>;
}

/** Locomoção: velocidades em unidades de mundo por segundo. */
const MAX_SPEED = 3.8;
const ACCEL = 20;
const DECEL = 26;
const TURN_SPEED = 14; // rad/s
const CORNER_BLEND = 1.3; // distância (u) em que a curva começa a ser suavizada

export class AstronautActor implements Collider {
  readonly root = new THREE.Group();
  readonly id: string;
  readonly name: string;
  readonly isLocal: boolean;
  readonly radius = PLAYER_RADIUS;

  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentClip = 'Idle';
  private tools = new Map<string, THREE.Object3D>();
  private model: THREE.Object3D | null = null;

  // locomoção do jogador local
  private waypoints: THREE.Vector3[] = [];
  private currentTargetIndex = 0;
  private currentHeading = 0;
  private readonly vel = new THREE.Vector2();
  /** direção pedida pelo teclado (já relativa à câmera), ou null */
  private input: { x: number; z: number } | null = null;
  private pathActive = false;
  private taskLeft = 0;
  private onTaskDone: (() => void) | null = null;
  private stuckTime = 0;
  /** destino final do caminho atual (para recalcular quando algo bloqueia) */
  destination: THREE.Vector3 | null = null;
  /** o astronauta ficou preso (jogador na frente): o dono deve recalcular o caminho */
  needsRepath = false;

  // astronauta remoto: interpola até o último estado recebido
  private remoteTarget: ActorSnapshot | null = null;
  private remoteMotion: ActorMotion = 'idle';

  private textures: ModelTextures = { face: [], all: [] };
  private mood: ActorMood = 'normal';
  private faceCell = -1;
  private blinkIn = 3 + Math.random() * 3;
  private blinkLeft = 0;
  /** emote em andamento (segundos restantes) e a expressão que ele pediu */
  private emoteLeft = 0;
  private emoteFace: number | null = null;
  /** gesto em dupla: tempo restante e deslize até a posição combinada */
  private duoLeft = 0;
  private duoFace: number | null = null;
  private slide: {
    t: number;
    from: THREE.Vector2;
    to: THREE.Vector2;
    h0: number;
    h1: number;
  } | null = null;

  private nametag: THREE.Sprite | null = null;
  readonly emote = new EmoteBubble(2.95);
  private appearT = 1;
  private revealed = false;
  /** dentro do rover: o modelo some e o carro leva o nome */
  private driving = false;

  readonly ready: Promise<void>;

  constructor(id: string, name: string, isLocal: boolean, suit: SuitConfig = DEFAULT_SUIT) {
    this.id = id;
    this.name = name;
    this.isLocal = isLocal;
    this.root.visible = false;
    this.ready = this.init(suit);
  }

  get isRevealed() {
    return this.revealed;
  }

  get inVehicle() {
    return this.driving;
  }

  get isCollidable() {
    return this.revealed && !this.driving;
  }

  get position() {
    return this.root.position;
  }

  get heading() {
    return this.currentHeading;
  }

  get speed() {
    return this.vel.length();
  }

  get motion(): ActorMotion {
    if (this.driving) return 'drive';
    if (this.taskLeft > 0)
      return this.taskKind === 'plant'
        ? 'plant'
        : this.taskKind === 'harvest'
          ? 'harvest'
          : 'clean';
    return this.isMoving ? 'walk' : 'idle';
  }

  private taskKind: ActorTask = 'clean';

  /** Está se deslocando (ou tem um caminho/tecla ativos)? */
  get isMoving() {
    return this.pathActive || this.input !== null || this.vel.lengthSq() > 0.04;
  }

  get isBusy() {
    return this.taskLeft > 0 || this.duoLeft > 0;
  }

  /** Está no meio de um gesto em dupla (movimento bloqueado)? */
  get inDuoGesture() {
    return this.duoLeft > 0;
  }

  get isEmoting() {
    return this.emoteLeft > 0;
  }

  private async init(suit: SuitConfig) {
    const { scene, animations } = await loadAstronautGLTF();
    // SkeletonUtils: um clone comum de modelo com esqueleto ficaria preso ao esqueleto original
    const model = cloneSkinned(scene);
    model.scale.setScalar(0.75);
    this.model = model;

    // materiais e texturas do rosto/marcas próprios deste ator; acessórios `acc_*` escondidos
    this.textures = prepareModel(model);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // malhas skinadas têm a caixa calculada na pose de repouso: não deixe o frustum cortá-las
        mesh.frustumCulled = false;
        mesh.userData.isInterior = true; // a poeira não entra quando o teto está aberto
      }
      // ferramentas ficam guardadas até a tarefa pedir
      if (/^tool_[a-z]+$/.test(o.name)) {
        this.tools.set(o.name, o);
        o.visible = false;
      }
    });

    applySuitAppearance(model, cloneSuit(suit));
    this.setExpression(FACE_HAPPY);
    this.root.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.actions.get('Idle')?.play();
    this.currentClip = 'Idle';

    this.emote.attach(this.root);
    this.nametag = createNametag(this.name, this.isLocal);
    if (this.nametag) {
      this.nametag.position.set(0, 2.15, 0);
      this.root.add(this.nametag);
    }
  }

  // ------------------------------------------------------------------ rosto LED

  /** Troca a expressão do rosto (0 feliz ... 7 piscada). */
  setExpression(cell: number) {
    if (cell === this.faceCell) return;
    this.faceCell = cell;
    setFaceExpression(this.textures, cell);
  }

  /** Sobrevivência: cansado ou dormindo muda o rosto padrão. */
  setMood(mood: ActorMood) {
    this.mood = mood;
  }

  private baseFace() {
    if (this.mood === 'sleeping') return FACE_SLEEPING;
    return this.mood === 'tired' ? FACE_TIRED : FACE_HAPPY;
  }

  /** Rosto do momento: gesto > humor, com uma piscada curta a cada 3–6 s. */
  private updateFace(dt: number) {
    if (this.textures.face.length === 0) return;
    const forced = this.duoFace ?? this.emoteFace;
    if (forced !== null) {
      this.blinkLeft = 0;
      this.setExpression(forced);
      return;
    }
    const base = this.baseFace();
    if (base === FACE_SLEEPING) {
      this.setExpression(base);
      return;
    }
    if (this.blinkLeft > 0) {
      this.blinkLeft -= dt;
      this.setExpression(this.blinkLeft > 0 ? FACE_BLINK : base);
      return;
    }
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkIn = 3 + Math.random() * 3;
      this.blinkLeft = 0.14;
      this.setExpression(FACE_BLINK);
    } else this.setExpression(base);
  }

  // ------------------------------------------------------------------ emotes e gestos

  /**
   * Toca o clipe do emote `index` (tabela `EMOTE_ANIMATIONS`). Não interrompe tarefas, não
   * toca dentro do rover nem durante um gesto em dupla; andar cancela. Devolve se tocou.
   */
  playEmote(index: number): boolean {
    const def = EMOTE_ANIMATIONS[index];
    if (!def || !this.revealed || this.driving || this.taskLeft > 0 || this.duoLeft > 0)
      return false;
    const action = this.actions.get(def.clip);
    if (!action) return false;
    this.stopMoving();
    this.vel.set(0, 0);
    const seconds = def.loop ? (def.seconds ?? 4) : action.getClip().duration;
    this.emoteLeft = seconds;
    this.emoteFace = def.expression;
    this.playOneShot(def.clip, def.loop === true, 0.2);
    return true;
  }

  /** Para o emote (o jogador andou, a tarefa começou...) e volta ao clipe de base. */
  cancelEmote() {
    if (this.emoteLeft <= 0) return;
    this.emoteLeft = 0;
    this.emoteFace = null;
    this.crossfadeTo(this.isMoving ? 'Walk' : 'Idle', 0.2);
  }

  /**
   * Gesto em dupla: gira, desliza até (x, z) olhando para `heading` e toca o clipe.
   * O movimento fica bloqueado até o fim. Devolve a duração (s) ou 0 se não foi possível.
   */
  playDuo(gesture: DuoGestureId, x: number, z: number, heading: number): number {
    const def = DUO_GESTURES[gesture];
    const action = this.actions.get(def.clip);
    if (!action || !this.revealed || this.driving) return 0;
    this.cancelEmote();
    this.stopMoving();
    this.vel.set(0, 0);
    this.taskLeft = 0;
    this.onTaskDone = null;
    const pos = this.root.position;
    this.slide = {
      t: 0,
      from: new THREE.Vector2(pos.x, pos.z),
      to: new THREE.Vector2(x, z),
      h0: this.currentHeading,
      h1: heading,
    };
    this.duoFace = def.expression;
    this.duoLeft = DUO_SLIDE_SECONDS + action.getClip().duration;
    // o clipe começa junto com o deslize, para os dois jogadores terminarem juntos
    this.playOneShot(def.clip, false, 0.12);
    return this.duoLeft;
  }

  private tickDuo(dt: number) {
    const s = this.slide;
    if (s) {
      s.t = Math.min(1, s.t + dt / DUO_SLIDE_SECONDS);
      const k = s.t * s.t * (3 - 2 * s.t);
      this.root.position.x = s.from.x + (s.to.x - s.from.x) * k;
      this.root.position.z = s.from.y + (s.to.y - s.from.y) * k;
      let d = s.h1 - s.h0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.currentHeading = s.h0 + d * k;
      this.root.rotation.y = this.currentHeading;
      if (s.t >= 1) this.slide = null;
    }
    this.duoLeft -= dt;
    if (this.duoLeft <= 0) {
      this.duoLeft = 0;
      this.slide = null;
      this.duoFace = null;
      this.crossfadeTo('Idle', 0.25);
    }
  }

  /** Clipe de uma vez só (ou em loop) com entrada suave. */
  private playOneShot(name: string, loop: boolean, fade: number) {
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.currentClip);
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Number.POSITIVE_INFINITY : 1);
    next.clampWhenFinished = !loop;
    next.setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.currentClip = name;
  }

  /** Faz o astronauta surgir (com um pequeno "pop") na posição indicada. */
  reveal(at: THREE.Vector3, heading = 0) {
    this.root.position.copy(at);
    this.currentHeading = heading;
    this.root.rotation.y = heading;
    this.revealed = true;
    this.driving = false;
    this.root.visible = true;
    this.appearT = 0;
    this.root.scale.setScalar(0.001);
    this.vel.set(0, 0);
  }

  hide() {
    this.revealed = false;
    this.root.visible = false;
    this.stopMoving();
  }

  /** Entra no rover (o modelo some) ou sai dele (reaparece em `at`). */
  setDriving(on: boolean, at?: THREE.Vector3, heading?: number) {
    this.driving = on;
    this.root.visible = this.revealed && !on;
    this.vel.set(0, 0);
    this.stopMoving();
    if (!on && at) {
      this.root.position.copy(at);
      if (heading !== undefined) {
        this.currentHeading = heading;
        this.root.rotation.y = heading;
      }
      this.appearT = 0;
      this.root.scale.setScalar(0.001);
    }
  }

  // ------------------------------------------------------------------ comandos (jogador local)

  setPath(waypoints: THREE.Vector3[], destination?: THREE.Vector3) {
    if (!waypoints.length || this.taskLeft > 0 || this.duoLeft > 0 || this.driving) return;
    this.waypoints = [...waypoints];
    this.currentTargetIndex = 0;
    this.destination = destination ? destination.clone() : waypoints[waypoints.length - 1]!.clone();
    this.pathActive = true;
    this.stuckTime = 0;
    this.needsRepath = false;
  }

  /** Teclado: direção no mundo (vetor unitário) ou null para soltar. Cancela o caminho do clique. */
  setInput(dir: { x: number; z: number } | null) {
    if (this.taskLeft > 0 || this.duoLeft > 0 || this.driving) {
      this.input = null;
      return;
    }
    this.input = dir;
    if (dir) {
      this.waypoints = [];
      this.pathActive = false;
      this.destination = null;
    }
  }

  stopMoving() {
    this.waypoints = [];
    this.pathActive = false;
    this.destination = null;
    this.needsRepath = false;
    this.input = null;
  }

  /** Vira de frente para um ponto (ao abrir um minigame numa máquina, por exemplo). */
  face(facePos: THREE.Vector3) {
    this.currentHeading = Math.atan2(
      facePos.x - this.root.position.x,
      facePos.z - this.root.position.z,
    );
    this.root.rotation.y = this.currentHeading;
  }

  /** Executa uma tarefa de campo parado, de frente para o alvo. */
  startTask(task: ActorTask, facePos: THREE.Vector3, onFinished: () => void) {
    this.stopMoving();
    this.vel.set(0, 0);
    const def = TASKS[task];
    this.taskKind = task;
    this.taskLeft = def.seconds;
    this.onTaskDone = onFinished;
    this.currentHeading = Math.atan2(
      facePos.x - this.root.position.x,
      facePos.z - this.root.position.z,
    );
    this.root.rotation.y = this.currentHeading;
    for (const [name, tool] of this.tools) tool.visible = name === def.tool;
    this.cancelEmote();
    this.crossfadeTo(def.clip, 0.15);
  }

  private crossfadeTo(requested: string, duration: number, timeScale = 1) {
    // o v2 não tem Clean/Plant/Harvest: usa `Work`; sem nada disso, volta para `Idle`
    let name = requested;
    if (!this.actions.has(name)) name = CLIP_FALLBACK[name] ?? 'Idle';
    if (!this.actions.has(name)) name = 'Idle';
    const next = this.actions.get(name);
    if (!next) return;
    if (this.currentClip === name && next.isRunning()) {
      next.setEffectiveTimeScale(timeScale);
      return;
    }
    const prev = this.actions.get(this.currentClip);
    next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1);
    next.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
    next.clampWhenFinished = false;
    next.fadeIn(duration).play();
    prev?.fadeOut(duration);
    this.currentClip = name;
    if (name === 'Idle' || name === 'Walk') for (const t of this.tools.values()) t.visible = false;
  }

  // ------------------------------------------------------------------ rede (jogador remoto)

  applySnapshot(s: ActorSnapshot) {
    this.remoteTarget = s;
  }

  // ------------------------------------------------------------------ simulação

  /**
   * Avança a simulação. `animate` é falso com a aba em segundo plano: o jogador continua
   * andando (movimento é posição, não animação), mas não gastamos tempo animando o esqueleto.
   */
  update(dt: number, ctx: MoveContext, animate = true) {
    if (!this.revealed) return;
    this.emote.update(dt);
    if (animate) this.mixer?.update(dt);
    this.updateFace(dt);
    if (this.emoteLeft > 0) {
      this.emoteLeft -= dt;
      if (this.emoteLeft <= 0) this.cancelEmote();
    }

    if (this.appearT < 1) {
      this.appearT = Math.min(1, this.appearT + dt / 0.45);
      const t = this.appearT;
      const s = 1 + 0.18 * Math.sin(t * Math.PI) * (1 - t);
      this.root.scale.setScalar(t < 1 ? Math.max(0.001, Math.min(1, t * 2.2) * s) : 1);
    }

    if (this.driving) return;
    if (this.duoLeft > 0) {
      this.tickDuo(dt);
      return;
    }
    if (this.isLocal) this.updateLocal(dt, ctx);
    else this.updateRemote(dt, ctx.grid);
  }

  private updateLocal(dt: number, ctx: MoveContext) {
    const pos = this.root.position;
    const grid = ctx.grid;

    if (this.taskLeft > 0) {
      this.taskLeft -= dt;
      if (this.taskLeft <= 0) {
        this.taskLeft = 0;
        this.crossfadeTo('Idle', 0.25);
        const done = this.onTaskDone;
        this.onTaskDone = null;
        done?.();
      }
      return;
    }

    // ---- 1. direção desejada (teclado ou caminho) ----
    let wantX = 0;
    let wantZ = 0;
    let speedLimit = MAX_SPEED;
    let intended = 0;

    if (this.input) {
      wantX = this.input.x;
      wantZ = this.input.z;
    } else if (this.pathActive && this.waypoints.length > 0) {
      let target = this.waypoints[this.currentTargetIndex];
      // pula pontos que já estão colados (curvas sem "engasgo")
      while (target && this.currentTargetIndex < this.waypoints.length - 1) {
        if (Math.hypot(target.x - pos.x, target.z - pos.z) > 0.3) break;
        this.currentTargetIndex++;
        target = this.waypoints[this.currentTargetIndex];
      }
      if (!target) {
        this.stopMoving();
      } else {
        const last = this.currentTargetIndex >= this.waypoints.length - 1;
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const dist = Math.hypot(dx, dz);

        if (last) {
          if (dist < 0.1) {
            this.stopMoving();
          } else {
            // freia suavemente até o destino
            speedLimit = Math.min(MAX_SPEED, Math.sqrt(2 * DECEL * 0.55 * dist) + 0.35);
          }
        } else if (dist < CORNER_BLEND && grid) {
          // "olha adiante": se já dá para ir direto ao ponto seguinte sem tocar em nada, corta a
          // curva; senão segue até o ponto atual (nunca mira numa direção que bate na parede)
          const next = this.waypoints[this.currentTargetIndex + 1]!;
          if (grid.lineClear(pos.x, pos.z, next.x, next.z)) this.currentTargetIndex++;
        }
        if (this.pathActive && !(wantX || wantZ)) {
          const l = dist || 1;
          wantX = dx / l;
          wantZ = dz / l;
        }
      }
    }

    // ---- 2. velocidade com aceleração (sem arranques secos) ----
    const wantLen = Math.hypot(wantX, wantZ);
    let targetVx = 0;
    let targetVz = 0;
    if (wantLen > 0.001) {
      wantX /= wantLen;
      wantZ /= wantLen;
      // curva fechada: reduz a velocidade para o corpo acompanhar
      const curSpeed = this.vel.length();
      let slow = 1;
      if (curSpeed > 0.5) {
        const cos = (this.vel.x * wantX + this.vel.y * wantZ) / curSpeed;
        slow = 0.5 + 0.5 * Math.max(0, cos);
      }
      targetVx = wantX * speedLimit * slow;
      targetVz = wantZ * speedLimit * slow;
      intended = speedLimit * slow;
    }
    const ax = targetVx - this.vel.x;
    const az = targetVz - this.vel.y;
    const al = Math.hypot(ax, az);
    const rate = wantLen > 0.001 ? ACCEL : DECEL;
    if (al > 0.0001) {
      const k = Math.min(al, rate * dt) / al;
      this.vel.x += ax * k;
      this.vel.y += az * k;
    }

    // ---- 3. deslocamento com colisão ----
    let nx = pos.x + this.vel.x * dt;
    let nz = pos.z + this.vel.y * dt;
    [nx, nz] = this.separate(nx, nz, ctx.others, pos.x, pos.z);

    if (grid && !grid.isWalkable(nx, nz)) {
      // desliza pelo obstáculo (parede, móvel): tenta cada eixo e mantém a parte livre
      if (grid.isWalkable(nx, pos.z)) {
        nz = pos.z;
        this.vel.y = 0;
      } else if (grid.isWalkable(pos.x, nz)) {
        nx = pos.x;
        this.vel.x = 0;
      } else {
        nx = pos.x;
        nz = pos.z;
        this.vel.set(0, 0);
      }
    }

    const moved = Math.hypot(nx - pos.x, nz - pos.z);
    if (this.pathActive && intended > 0.5 && moved < intended * dt * 0.25) {
      this.stuckTime += dt;
      if (this.stuckTime > 0.45) {
        this.stuckTime = 0;
        this.needsRepath = true;
      }
    } else {
      this.stuckTime = 0;
    }

    pos.x = nx;
    pos.z = nz;
    if (grid) pos.y += (grid.groundY(pos.x, pos.z) - pos.y) * Math.min(1, dt * 12);

    // ---- 4. orientação e animação ----
    const speed = this.vel.length();
    if (this.emoteLeft > 0) {
      // andar (ou pedir para andar) cancela o emote; parado, o clipe segue até o fim
      if (this.input || this.pathActive || speed > 0.3) this.cancelEmote();
      else return;
    }
    // só gira com velocidade de verdade (evita "rodopiar" ao raspar na parede)
    if (speed > 0.7) this.turnTowards(Math.atan2(this.vel.x, this.vel.y), dt);
    if (speed > 0.3 || (this.input && speed > 0.1)) {
      // passada proporcional à velocidade real
      this.crossfadeTo('Walk', 0.15, Math.max(0.6, Math.min(1.35, speed / 3.1)));
    } else if (!this.pathActive && !this.input) {
      this.crossfadeTo('Idle', 0.2);
    }
  }

  /** Afasta (nx, nz) de qualquer coisa sólida com a qual estaria sobreposta. */
  private separate(
    nx: number,
    nz: number,
    others: Iterable<Collider>,
    fromX: number,
    fromZ: number,
  ): [number, number] {
    for (const o of others) {
      if (o === (this as Collider) || !o.isCollidable) continue;
      const min = PLAYER_RADIUS + o.radius;
      const ox = o.position.x;
      const oz = o.position.z;
      const dx = nx - ox;
      const dz = nz - oz;
      const d = Math.hypot(dx, dz);
      if (d >= min) continue;
      // só impede de se aproximar: quem já está encostado pode se afastar livremente
      const before = Math.hypot(fromX - ox, fromZ - oz);
      if (d > before && before < min) continue;
      const ux = d > 0.0001 ? dx / d : 1;
      const uz = d > 0.0001 ? dz / d : 0;
      const push = min - d;
      nx += ux * push;
      nz += uz * push;
    }
    return [nx, nz];
  }

  private turnTowards(target: number, dt: number) {
    let diff = target - this.currentHeading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.currentHeading += Math.sign(diff) * Math.min(Math.abs(diff), TURN_SPEED * dt);
    this.root.rotation.y = this.currentHeading;
  }

  private updateRemote(dt: number, grid: BaseGrid | null) {
    const t = this.remoteTarget;
    if (!t) return;
    const pos = this.root.position;
    const dx = t.x - pos.x;
    const dz = t.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 6) {
      pos.x = t.x;
      pos.z = t.z;
    } else {
      const k = 1 - Math.exp(-dt * 14);
      pos.x += dx * k;
      pos.z += dz * k;
    }
    if (grid) pos.y += (grid.groundY(pos.x, pos.z) - pos.y) * Math.min(1, dt * 12);

    this.turnTowards(dist > 0.15 ? Math.atan2(dx, dz) : t.h, dt);

    if (this.emoteLeft > 0 && (t.m !== 'idle' || dist > 0.15)) this.cancelEmote();
    if (t.m !== this.remoteMotion) {
      this.remoteMotion = t.m;
      const clip =
        t.m === 'walk'
          ? 'Walk'
          : t.m === 'clean'
            ? 'Clean'
            : t.m === 'plant'
              ? 'Plant'
              : t.m === 'harvest'
                ? 'Harvest'
                : 'Idle';
      const tool =
        t.m === 'clean'
          ? 'tool_cleaning'
          : t.m === 'plant'
            ? 'tool_botany'
            : t.m === 'harvest'
              ? 'tool_harvest'
              : '';
      this.crossfadeTo(clip, 0.2);
      for (const [name, obj] of this.tools) obj.visible = name === tool;
    }
  }

  dispose() {
    this.mixer?.stopAllAction();
    disposeNametag(this.nametag);
    this.emote.dispose();
    // Geometrias e texturas de cor são compartilhadas: só materiais e texturas clonadas são nossos.
    this.model?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of meshMaterials(m)) mat.dispose();
    });
    for (const t of this.textures.all) t.dispose();
    this.root.removeFromParent();
  }
}
