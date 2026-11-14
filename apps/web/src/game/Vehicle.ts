import * as THREE from 'three';
import { loadGLB } from '../lib/modelCache';
import type { BaseGrid } from './BaseGrid';
import { VEHICLE_RADIUS } from './BaseGrid';
import { createNametag, disposeNametag, EmoteBubble } from './nametag';

const SCALE = 0.75;
/** Velocidade máxima (unidades de mundo por segundo): o rover é bem mais rápido que a pé. */
export const ROVER_MAX_SPEED = 8.5;
const ACCEL = 7;
const BRAKE = 12;
const MIN_TURN_RADIUS = 2.4; // raio de curva mínimo (u): o carro não gira no lugar
const WHEEL_RADIUS = 0.5 * SCALE;

export interface DriveInput {
  /** direção desejada no mundo (já relativa à câmera), ou null para frear */
  dir: { x: number; z: number } | null;
}

/**
 * Rover pilotável. `root` carrega posição e direção (0 = +Z, como os astronautas); o modelo
 * original tem o comprimento no eixo X, então um pivô o alinha.
 */
export class Rover {
  readonly root = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private wheels: THREE.AnimationAction | null = null;

  /** emoji de quem está dirigindo (o astronauta fica escondido dentro do carro) */
  readonly emote = new EmoteBubble(4.1);

  heading = 0;
  /** velocidade com sinal ao longo da direção */
  speed = 0;
  /** quem está dentro (nome) ou null */
  driverName: string | null = null;
  private tag: THREE.Sprite | null = null;

  private waypoints: THREE.Vector3[] = [];
  private index = 0;
  destination: THREE.Vector3 | null = null;
  private stuck = 0;
  /** manobra de desencalhe: inverte o sentido por um instante (ré se bateu de frente) */
  private unstick = 0;
  /** quanto já andou de ré seguido: ré é para manobrar, não para viajar */
  private reverseTravel = 0;
  private unstickDir: 1 | -1 = 1;
  needsRepath = false;

  readonly radius = VEHICLE_RADIUS;
  readonly ready: Promise<void>;

  constructor() {
    this.root.add(this.pivot);
    this.emote.attach(this.root);
    this.root.userData.pick = { kind: 'vehicle' };
    this.ready = this.load();
  }

  get position() {
    return this.root.position;
  }

  get isMoving() {
    return Math.abs(this.speed) > 0.05;
  }

  private async load() {
    const gltf = await loadGLB('/assets/modelos/rover.glb');
    const model = gltf.scene;
    model.scale.setScalar(SCALE);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
      }
    });
    // o modelo já vem com a frente (faróis) em +Z, como os astronautas: sem giro extra
    this.pivot.rotation.y = 0;
    this.pivot.add(model);
    const clip = gltf.animations.find((c) => c.name === 'Drive');
    if (clip) {
      this.mixer = new THREE.AnimationMixer(model);
      this.wheels = this.mixer.clipAction(clip);
      this.wheels.play();
      this.wheels.timeScale = 0;
    }
  }

  place(x: number, z: number, heading: number, y = 0.04) {
    this.root.position.set(x, y, z);
    this.heading = heading;
    this.root.rotation.y = heading;
    this.speed = 0;
    this.waypoints = [];
    this.destination = null;
  }

  /** Mostra o nome de quem está dirigindo sobre o carro. */
  setDriver(name: string | null, isLocal: boolean) {
    if (name === this.driverName && (name === null || this.tag)) return;
    this.driverName = name;
    disposeNametag(this.tag);
    this.tag = null;
    if (name) {
      this.tag = createNametag(name, isLocal);
      if (this.tag) {
        this.tag.position.set(0, 3.1, 0);
        this.root.add(this.tag);
      }
    }
  }

  setPath(path: THREE.Vector3[], destination?: THREE.Vector3) {
    this.waypoints = [...path];
    this.index = 0;
    this.destination = destination ? destination.clone() : (path[path.length - 1]?.clone() ?? null);
    this.stuck = 0;
    this.needsRepath = false;
  }

  stopPath() {
    this.waypoints = [];
    this.destination = null;
    this.needsRepath = false;
  }

  get hasPath() {
    return this.waypoints.length > 0;
  }

  /**
   * Simula o carro (dono). `input.dir` vem do teclado; sem teclas, segue o caminho do clique.
   * Colisão: o centro do carro nunca entra numa célula proibida (paredes, base, rochas…).
   */
  drive(dt: number, input: DriveInput, grid: BaseGrid | null) {
    let desired = input.dir;
    let remaining = Number.POSITIVE_INFINITY; // distância até o ponto do caminho
    let limit = ROVER_MAX_SPEED;

    if (!desired && this.waypoints.length > 0) {
      const t = this.waypoints[this.index];
      if (t) {
        const dx = t.x - this.root.position.x;
        const dz = t.z - this.root.position.z;
        const d = Math.hypot(dx, dz);
        const last = this.index >= this.waypoints.length - 1;
        if (d < (last ? 1.0 : 2.4)) {
          this.index++;
          if (this.index >= this.waypoints.length) this.stopPath();
        } else {
          desired = { x: dx / d, z: dz / d };
          // distância que falta até o DESTINO (não só até o próximo ponto)
          remaining = d;
          for (let i = this.index; i < this.waypoints.length - 1; i++) {
            remaining += this.waypoints[i]!.distanceTo(this.waypoints[i + 1]!);
          }
          // freia ao chegar ao destino
          if (last)
            limit = Math.min(limit, Math.sqrt(2 * BRAKE * 0.7 * Math.max(0, d - 0.4)) + 0.8);
        }
      }
    }

    // Direção como a de um carro: o esterço só vira o carro enquanto ele anda (sem girar parado).
    // Se o destino está atrás, o carro dá ré em vez de dar a volta no lugar.
    let targetSpeed = 0;
    let curvature = 0;
    if (desired) {
      const want = Math.atan2(desired.x, desired.z);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // dá ré só para manobras curtas (ou com a tecla S); longe, o carro faz a volta andando para a frente
      let reverse = Math.cos(diff) < -0.25 && (!!input.dir || remaining < 18);
      if (reverse && !input.dir && this.reverseTravel > 14) reverse = false;
      if (this.unstick > 0) reverse = this.unstickDir < 0;
      if (reverse) {
        diff += diff > 0 ? -Math.PI : Math.PI; // ângulo em relação à traseira
      }
      const dir = reverse ? -1 : 1;
      const maxK = 1 / MIN_TURN_RADIUS;
      curvature = dir * Math.max(-maxK, Math.min(maxK, diff * 1.4));
      // devagar o bastante para fazer a curva, mas nunca parado (senão não consegue virar)
      const align = Math.max(0.3, Math.cos(diff));
      targetSpeed = dir * (reverse ? Math.min(limit, 3) : limit) * align;
    }

    const a = Math.abs(targetSpeed) > Math.abs(this.speed) ? ACCEL : BRAKE;
    this.speed +=
      Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), a * dt);
    this.heading += this.speed * curvature * dt;
    if (this.speed < -0.1) this.reverseTravel += -this.speed * dt;
    else if (this.speed > 0.8) this.reverseTravel = 0;

    const pos = this.root.position;
    let nx = pos.x + Math.sin(this.heading) * this.speed * dt;
    let nz = pos.z + Math.cos(this.heading) * this.speed * dt;
    if (grid && !grid.isWalkable(nx, nz, 'vehicle')) {
      // desliza ao longo do obstáculo; se não der, para
      if (grid.isWalkable(nx, pos.z, 'vehicle')) nz = pos.z;
      else if (grid.isWalkable(pos.x, nz, 'vehicle')) nx = pos.x;
      else {
        nx = pos.x;
        nz = pos.z;
      }
      this.speed *= 0.5;
    }
    const moved = Math.hypot(nx - pos.x, nz - pos.z);
    if (
      this.waypoints.length > 0 &&
      Math.abs(targetSpeed) > 1 &&
      moved < Math.abs(targetSpeed) * dt * 0.25
    ) {
      this.stuck += dt;
      if (this.stuck > 0.45 && this.unstick <= 0) {
        // encalhou: dá ré (ou avança, se estava de ré) um pouco e tenta de novo
        this.unstick = 1.1;
        this.unstickDir = targetSpeed >= 0 ? -1 : 1;
      }
      if (this.stuck > 1.6) {
        this.stuck = 0;
        this.needsRepath = true;
      }
    } else this.stuck = 0;
    if (this.unstick > 0) this.unstick -= dt;

    pos.x = nx;
    pos.z = nz;
    pos.y += ((grid ? grid.groundY(nx, nz) : 0.04) - pos.y) * Math.min(1, dt * 10);
    this.root.rotation.y = this.heading;
  }

  /** Rover de outro jogador: segue o estado recebido. */
  follow(dt: number, x: number, z: number, h: number) {
    const pos = this.root.position;
    const dx = x - pos.x;
    const dz = z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 8) {
      pos.x = x;
      pos.z = z;
      this.speed = 0;
    } else {
      const k = 1 - Math.exp(-dt * 12);
      pos.x += dx * k;
      pos.z += dz * k;
      // velocidade (com sinal) estimada pelo deslocamento: move as rodas do carro remoto
      const along = (dx * Math.sin(this.heading) + dz * Math.cos(this.heading)) * k;
      this.speed = Math.max(
        -ROVER_MAX_SPEED,
        Math.min(ROVER_MAX_SPEED, along / Math.max(dt, 0.001)),
      );
    }
    let diff = h - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * (1 - Math.exp(-dt * 10));
    this.root.rotation.y = this.heading;
  }

  /** Gira as rodas de acordo com a velocidade. */
  animate(dt: number) {
    this.emote.update(dt);
    if (!this.mixer || !this.wheels) return;
    // 1 volta por segundo com timeScale 1 (roda de raio 0,5 m)
    this.wheels.timeScale = this.speed / (2 * Math.PI * WHEEL_RADIUS);
    this.mixer.update(dt);
  }

  dispose() {
    disposeNametag(this.tag);
    this.emote.dispose();
    this.mixer?.stopAllAction();
    this.root.removeFromParent();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
    });
  }
}
