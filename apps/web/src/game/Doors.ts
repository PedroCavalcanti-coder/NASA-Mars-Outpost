import * as THREE from 'three';

interface LeafPart {
  instanced: THREE.InstancedMesh;
  index: number;
  /** matriz da peça com a porta fechada, no referencial do modelo */
  closed: THREE.Matrix4;
  /** -1: a folha desce (inferior); +1: sobe (superior) */
  dir: 1 | -1;
  travel: number;
}

interface Door {
  parts: LeafPart[];
  x: number;
  z: number;
  radius: number;
  /** 0 = fechada, 1 = aberta */
  k: number;
  opening: boolean;
}

const OPEN_SPEED = 4; // 1 / 0,25 s
const DOOR_RADIUS = 2.3;
const GARAGE_RADIUS = 3.6;

/**
 * Portas automáticas: a folha inferior desce até o piso e a superior sobe quando um astronauta
 * chega perto, fechando de novo depois que todos se afastam. Funciona para o jogador local e
 * para os remotos (a posição de todos entra em `update`).
 *
 * As folhas de todas as portas são desenhadas por INSTANCIAMENTO: uma chamada à GPU por
 * material, em vez de uma por folha/material de cada porta.
 */
export class DoorSystem {
  private readonly doors: Door[] = [];
  private readonly instanced: THREE.InstancedMesh[] = [];
  private readonly tmp = new THREE.Matrix4();
  private readonly box = new THREE.Box3();

  constructor(
    model: THREE.Object3D,
    private readonly onOpen?: () => void,
  ) {
    model.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const wp = new THREE.Vector3();

    type Entry = {
      mesh: THREE.Mesh;
      closed: THREE.Matrix4;
      door: Door;
      dir: 1 | -1;
      travel: number;
    };
    const buckets = new Map<string, Entry[]>();

    model.traverse((o) => {
      if (!/_(Porta|PortaGaragem)$/.test(o.name) || (o as THREE.Mesh).isMesh) return;
      const inf = o.children.find((c) => c.name.endsWith('_FolhaInf'));
      const sup = o.children.find((c) => c.name.endsWith('_FolhaSup'));
      if (!inf || !sup) return;
      o.getWorldPosition(wp);
      const door: Door = {
        parts: [],
        x: wp.x,
        z: wp.z,
        radius: o.name.endsWith('PortaGaragem') ? GARAGE_RADIUS : DOOR_RADIUS,
        k: 0,
        opening: false,
      };
      this.doors.push(door);

      for (const [leaf, dir] of [
        [inf, -1],
        [sup, 1],
      ] as const) {
        // a folha inferior afunda um pouco além da própria altura: lá fora o solo é mais baixo que o
        // piso interno e a ponta apareceria como uma placa saindo do chão
        const travel = this.localHeight(leaf, model) + (dir < 0 ? 0.6 : 0);
        leaf.traverse((m) => {
          const mesh = m as THREE.Mesh;
          if (!mesh.isMesh || Array.isArray(mesh.material)) return;
          const key = `${mesh.geometry.uuid}|${mesh.material.uuid}`;
          const closed = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
          let list = buckets.get(key);
          if (!list) {
            list = [];
            buckets.set(key, list);
          }
          list.push({ mesh, closed, door, dir, travel });
        });
      }
    });

    for (const list of buckets.values()) {
      const first = list[0]!.mesh;
      const inst = new THREE.InstancedMesh(first.geometry, first.material, list.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.frustumCulled = false; // a caixa é calculada só uma vez; a base inteira cabe na tela
      inst.name = 'DOOR_LEAVES';
      // o agrupador de malhas fixas não pode fundir as folhas (ele ignora as matrizes de instância)
      inst.userData.keepSeparate = true;
      list.forEach((e, i) => {
        inst.setMatrixAt(i, e.closed);
        e.door.parts.push({
          instanced: inst,
          index: i,
          closed: e.closed,
          dir: e.dir,
          travel: e.travel,
        });
        e.mesh.visible = false; // a peça original sai de cena (a instância a substitui)
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.matrixAutoUpdate = false;
      model.add(inst);
      this.instanced.push(inst);
    }
  }

  get count() {
    return this.doors.length;
  }

  /** Altura da folha em unidades do modelo (o modelo inteiro é escalado). */
  private localHeight(leaf: THREE.Object3D, model: THREE.Object3D): number {
    this.box.setFromObject(leaf);
    const scale = model.getWorldScale(new THREE.Vector3()).y || 1;
    return (this.box.max.y - this.box.min.y) / scale;
  }

  /**
   * @param positions posição (x, z) de todos os astronautas visíveis
   * @returns `true` se alguma porta está em movimento (as sombras precisam ser refeitas)
   */
  update(dt: number, positions: Array<{ x: number; z: number }>): boolean {
    let moving = false;
    const touched = new Set<THREE.InstancedMesh>();
    for (const d of this.doors) {
      let near = false;
      const r2 = d.radius * d.radius;
      for (const p of positions) {
        const dx = p.x - d.x;
        const dz = p.z - d.z;
        if (dx * dx + dz * dz <= r2) {
          near = true;
          break;
        }
      }
      if (near && !d.opening) this.onOpen?.();
      d.opening = near;
      const target = near ? 1 : 0;
      if (d.k === target) continue;
      d.k += Math.sign(target - d.k) * Math.min(Math.abs(target - d.k), OPEN_SPEED * dt);
      const e = d.k * d.k * (3 - 2 * d.k);
      for (const p of d.parts) {
        this.tmp.makeTranslation(0, p.dir * p.travel * e, 0).multiply(p.closed);
        p.instanced.setMatrixAt(p.index, this.tmp);
        touched.add(p.instanced);
      }
      moving = true;
    }
    for (const inst of touched) inst.instanceMatrix.needsUpdate = true;
    return moving;
  }
}
