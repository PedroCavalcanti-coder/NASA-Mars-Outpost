import * as THREE from 'three';
import { applyBoundaryFog, setEdgeFog } from '../boundaryFog';
import { dustUniforms } from '../DustStorm';

/**
 * Efeitos da expedição com o rover: neblina cobrindo o mapa, faróis do rover (e uma lanterna do
 * traje) que afastam a neblina que está perto, e as 3 pedras no chão.
 *
 * A neblina é calculada no mesmo shader da poeira do jogo (`boundaryFog.ts`): ligar a expedição é
 * só mudar uns uniforms compartilhados (sem recompilar materiais).
 */

/** raio (m) em que os faróis do rover afastam a neblina (o centro fica um pouco à frente) */
const CAR_CLEAR = 24;
/** raio da lanterna do traje, quando o astronauta anda a pé */
const SUIT_CLEAR = 8;
/** a poeira de borda do mapa fica bem longe: a neblina da expedição é quem manda */
const EDGE_DURING = { near: 140, far: 190 };
const EDGE_NORMAL = { near: 55, far: 90 };

export interface ExpeditionRock {
  x: number;
  z: number;
  by: string | null;
  loaded: boolean;
  kind?: 'rock' | 'pit';
}

export class ExpeditionFx {
  private active = false;
  private readonly rocks = new THREE.Group();
  private rockMeshes: THREE.Group[] = [];
  private readonly lights = new THREE.Group();
  private readonly headlight = new THREE.SpotLight(0xfff1cf, 0, 60, Math.PI / 4.2, 0.55, 1.4);
  private readonly glow = new THREE.PointLight(0xffe6b8, 0, 20, 1.6);
  private readonly lamp = new THREE.PointLight(0xcfe6ff, 0, 10, 1.8);

  constructor(private readonly scene: THREE.Scene) {
    this.lights.add(this.headlight, this.headlight.target, this.glow, this.lamp);
    this.lights.visible = false;
    this.rocks.visible = false;
    scene.add(this.lights, this.rocks);
  }

  get isActive() {
    return this.active;
  }

  /** Liga a neblina e as luzes (o jogador local está na expedição). */
  enable() {
    if (this.active) return;
    this.active = true;
    setEdgeFog(EDGE_DURING.near, EDGE_DURING.far);
    dustUniforms.expeditionFog.value = 1;
    this.lights.visible = true;
    this.rocks.visible = true;
  }

  /** Desliga tudo e devolve a névoa normal do mapa. */
  disable() {
    if (!this.active) return;
    this.active = false;
    setEdgeFog(EDGE_NORMAL.near, EDGE_NORMAL.far);
    dustUniforms.expeditionFog.value = 0;
    this.headlight.intensity = 0;
    this.glow.intensity = 0;
    this.lamp.intensity = 0;
    this.lights.visible = false;
    this.rocks.visible = false;
  }

  /** Cria (uma vez) as pedras e as leva ao estado atual do servidor a cada quadro. */
  syncRocks(
    list: readonly ExpeditionRock[],
    groundY: (x: number, z: number) => number,
    carrierPosition: (id: string) => THREE.Vector3 | null,
    time: number,
  ) {
    while (this.rockMeshes.length < list.length) {
      const g = new THREE.Group();
      if (list[this.rockMeshes.length]?.kind === 'pit') {
        // poço de escavação: cratera escura com um monte de terra ao lado
        const hole = new THREE.Mesh(
          new THREE.CircleGeometry(1.1, 24),
          new THREE.MeshBasicMaterial({ color: 0x2a160c }),
        );
        hole.rotation.x = -Math.PI / 2;
        hole.position.y = 0.05;
        const mound = new THREE.Mesh(
          new THREE.TorusGeometry(1.15, 0.28, 8, 24),
          new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 1, flatShading: true }),
        );
        mound.rotation.x = Math.PI / 2;
        mound.position.y = 0.12;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.5, 1.7, 28),
          new THREE.MeshBasicMaterial({ color: 0x6fe58e, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.06;
        ring.name = 'ring';
        g.add(hole, mound, ring);
        applyBoundaryFog(g);
        this.rocks.add(g);
        this.rockMeshes.push(g);
        continue;
      }
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.62, 0),
        new THREE.MeshStandardMaterial({
          color: 0x8a6a55,
          roughness: 0.9,
          emissive: 0x3a2412,
          emissiveIntensity: 0.6,
          flatShading: true,
        }),
      );
      rock.scale.set(1.15, 0.8, 0.95);
      rock.position.y = 0.4;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.1, 28),
        new THREE.MeshBasicMaterial({
          color: 0xffd34d,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      ring.name = 'ring';
      g.add(rock, ring);
      applyBoundaryFog(g);
      this.rocks.add(g);
      this.rockMeshes.push(g);
    }
    list.forEach((r, i) => {
      const g = this.rockMeshes[i]!;
      g.visible = !r.loaded;
      if (r.loaded) return;
      const carrier = r.by && r.kind !== 'pit' ? carrierPosition(r.by) : null;
      const ring = g.getObjectByName('ring') as THREE.Mesh | undefined;
      if (carrier) {
        g.position.set(carrier.x, carrier.y + 2.15, carrier.z);
        g.scale.setScalar(0.55);
        if (ring) ring.visible = false;
      } else {
        g.position.set(r.x, groundY(r.x, r.z), r.z);
        g.scale.setScalar(1);
        if (ring) {
          ring.visible = true;
          ring.scale.setScalar(1 + 0.12 * Math.sin(time * 3 + i));
        }
      }
    });
  }

  /** Posiciona os faróis do rover e a lanterna do traje e atualiza as áreas sem neblina. */
  update(car: THREE.Vector3, carHeading: number, me: THREE.Vector3 | null) {
    if (!this.active) return;
    const fx = Math.sin(carHeading);
    const fz = Math.cos(carHeading);
    this.headlight.position.set(car.x, car.y + 1.1, car.z);
    this.headlight.target.position.set(car.x + fx * 14, car.y, car.z + fz * 14);
    this.headlight.intensity = 90;
    this.glow.position.set(car.x, car.y + 2, car.z);
    this.glow.intensity = 14;
    dustUniforms.expeditionCar.value.set(car.x + fx * 5, car.y, car.z + fz * 5, CAR_CLEAR);
    if (me) {
      this.lamp.position.set(me.x, me.y + 2.2, me.z);
      this.lamp.intensity = 6;
      dustUniforms.expeditionMe.value.set(me.x, me.y, me.z, SUIT_CLEAR);
    } else {
      this.lamp.intensity = 0;
      dustUniforms.expeditionMe.value.set(car.x, car.y, car.z, SUIT_CLEAR);
    }
  }

  dispose() {
    this.disable();
    this.scene.remove(this.lights, this.rocks);
    this.rocks.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
  }
}
