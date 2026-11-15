import { GAME_MAX_CROPS } from '@mars/shared';
import * as THREE from 'three';

/** Estágios de um canteiro: 0 vazio, 1 muda, 2 crescendo, 3 pronto para colher. */
export type CropStage = 0 | 1 | 2 | 3;

type CropKind = 'Batata' | 'Alface' | 'Tomate';

/** Modelo de planta (em `plantas.glb`) de cada estágio visível. */
const STAGE_MODELS: Record<CropKind, [string, string, string]> = {
  Batata: ['PLANTA_Batata_2_Broto', 'PLANTA_Batata_4_Crescida', 'PLANTA_Batata_5_Colheita'],
  Alface: ['PLANTA_Alface_1_Muda', 'PLANTA_Alface_3_Media', 'PLANTA_Alface_4_Colheita'],
  Tomate: ['PLANTA_Tomate_1_Muda', 'PLANTA_Tomate_3_Florada', 'PLANTA_Tomate_5_Colheita'],
};
const KINDS: CropKind[] = ['Batata', 'Alface', 'Tomate'];
const INITIAL_BY_NAME: Record<string, CropStage> = { Vazio: 0, Broto: 1, Crescida: 2, Colheita: 3 };

/**
 * Tempo (s de mundo) para cada fase de crescimento, com pequena variação por canteiro.
 * Da muda à colheita são 2 fases: 2 × 2,5 Sols = 5 dias marcianos (1 Sol = 600 s).
 */
const SOL_SECONDS = 600;
const GROW_MIN = 2.4 * SOL_SECONDS;
const GROW_SPREAD = 0.2 * SOL_SECONDS;

export interface CropSlot {
  index: number;
  kind: CropKind;
  world: THREE.Vector3;
  stage: CropStage;
  visuals: Array<THREE.Object3D | null>;
  proxy: THREE.Mesh;
  /** segundos acumulados no estágio atual (só quem coordena a sala conta) */
  timer: number;
  growTime: number;
}

/**
 * Canteiros da estufa. Os marcadores `*_Batata_<n>_<Estágio>_<k>` do modelo viram canteiros
 * com plantas que crescem sozinhas (coordenado por um jogador da sala) e podem ser plantadas e
 * colhidas pelos astronautas. Cada canteiro tem um volume invisível para receber o clique.
 */
export class CropSystem {
  readonly slots: CropSlot[] = [];
  /** volumes de clique (adicionados à cena pelo chamador) */
  readonly proxies: THREE.Mesh[] = [];
  private readonly proxyGeo = new THREE.BoxGeometry(0.9, 1.3, 0.9);
  private readonly proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  private readonly moundGeo = new THREE.CylinderGeometry(0.26, 0.34, 0.1, 10);
  private readonly moundMat = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 1 });
  private readonly emptyOutlineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.45, 0, -0.45),
    new THREE.Vector3(0.45, 0, -0.45),
    new THREE.Vector3(0.45, 0, 0.45),
    new THREE.Vector3(-0.45, 0, 0.45),
  ]);
  private readonly emptyOutlineMat = new THREE.LineBasicMaterial({ color: '#ffffff' });

  constructor(
    model: THREE.Object3D,
    plants: THREE.Object3D | null,
    onPlantMesh: (root: THREE.Object3D) => void,
  ) {
    const markers: THREE.Object3D[] = [];
    model.traverse((o) => {
      if (/_Batata_\d_[A-Za-z]+_\d+$/.test(o.name)) markers.push(o);
    });
    model.updateMatrixWorld(true);

    markers.forEach((marker, i) => {
      if (i >= GAME_MAX_CROPS || !marker.parent) return;
      const kind = KINDS[i % KINDS.length]!;
      const word = /_Batata_\d_([A-Za-z]+)_\d+$/.exec(marker.name)?.[1] ?? 'Vazio';
      const stage = INITIAL_BY_NAME[word] ?? 0;
      const world = new THREE.Vector3();
      marker.getWorldPosition(world);

      // canteiro vazio: a caixa de terra do modelo (`PLANTA_<planta>_0_Vazio`), para o bloco nunca
      // "sumir" antes de plantar nem depois de a planta morrer; sem o modelo, um montinho de terra
      let empty: THREE.Object3D | null = null;
      const bed = plants?.getObjectByName(`PLANTA_${kind}_0_Vazio`);
      if (bed) {
        empty = bed.clone(true);
        empty.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.userData.keepSeparate = true;
          }
        });
        onPlantMesh(empty);
      } else {
        empty = new THREE.Mesh(this.moundGeo, this.moundMat);
        (empty as THREE.Mesh).receiveShadow = true;
        empty.userData.keepSeparate = true;
      }
      empty.position.copy(marker.position);
      empty.quaternion.copy(marker.quaternion);
      empty.scale.copy(marker.scale);
      empty.visible = false;
      marker.parent.add(empty);
      const visuals: Array<THREE.Object3D | null> = [empty];
      for (let s = 1; s <= 3; s++) {
        const src = plants?.getObjectByName(STAGE_MODELS[kind][s - 1]!);
        if (!src) {
          visuals.push(null);
          continue;
        }
        const plant = src.clone(true);
        plant.userData.pick = { kind: 'crop', index: this.slots.length };
        plant.position.copy(marker.position);
        plant.quaternion.copy(marker.quaternion);
        plant.scale.copy(marker.scale);
        plant.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.userData.keepSeparate = true; // some/aparece: não pode virar parte de um lote fixo
          }
        });
        onPlantMesh(plant);
        plant.visible = false;
        marker.parent.add(plant);
        visuals.push(plant);
      }
      marker.visible = false;

      const proxy = new THREE.Mesh(this.proxyGeo, this.proxyMat);
      proxy.position.set(world.x, world.y + 0.65, world.z);
      proxy.userData.pick = { kind: 'crop', index: this.slots.length };
      // O canteiro vazio também precisa indicar onde é possível plantar.
      const emptyOutline = new THREE.LineLoop(this.emptyOutlineGeo, this.emptyOutlineMat);
      emptyOutline.position.y = -0.63;
      emptyOutline.raycast = () => {};
      proxy.add(emptyOutline);
      visuals[0] = emptyOutline;
      proxy.updateMatrix();
      proxy.matrixWorld.copy(proxy.matrix);
      proxy.matrixAutoUpdate = false; // posição fixa: a matriz já está pronta para o clique
      this.proxies.push(proxy);

      const slot: CropSlot = {
        index: this.slots.length,
        kind,
        world,
        stage,
        visuals,
        proxy,
        timer: 0,
        growTime: GROW_MIN + (((i * 7919) % 100) / 100) * GROW_SPREAD,
      };
      this.slots.push(slot);
      this.show(slot);
    });
  }

  private show(slot: CropSlot) {
    const hint = slot.proxy.children.find((c) => c.userData.emptyHint);
    if (hint) hint.visible = slot.stage === 0;
    slot.visuals.forEach((v, s) => {
      if (v) v.visible = s === slot.stage;
    });
  }

  setStage(index: number, stage: number) {
    const slot = this.slots[index];
    if (!slot) return;
    const next = Math.max(0, Math.min(3, Math.round(stage))) as CropStage;
    if (next === slot.stage) return;
    slot.stage = next;
    slot.timer = 0;
    this.show(slot);
  }

  /** Estágios atuais, na ordem dos canteiros (para sincronizar com a sala). */
  stages(): number[] {
    return this.slots.map((s) => s.stage);
  }

  /** Aplica os estágios recebidos da sala (lista vazia = ninguém mexeu ainda). */
  apply(stages: number[]) {
    if (stages.length === 0) return;
    this.slots.forEach((slot, i) => {
      const s = stages[i];
      if (typeof s === 'number') this.setStage(i, s);
    });
  }

  /** Faz as plantas crescerem. Devolve `true` se algum canteiro mudou de estágio. */
  grow(dt: number): boolean {
    let changed = false;
    for (const slot of this.slots) {
      if (slot.stage === 0 || slot.stage === 3) continue;
      slot.timer += dt;
      if (slot.timer >= slot.growTime) {
        this.setStage(slot.index, slot.stage + 1);
        changed = true;
      }
    }
    return changed;
  }

  dispose() {
    this.proxyGeo.dispose();
    this.proxyMat.dispose();
    this.moundGeo.dispose();
    this.moundMat.dispose();
    this.emptyOutlineGeo.dispose();
    this.emptyOutlineMat.dispose();
  }
}
