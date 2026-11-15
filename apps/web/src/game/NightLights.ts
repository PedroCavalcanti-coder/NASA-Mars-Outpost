import * as THREE from 'three';
import type { BaseGrid } from './BaseGrid';

interface Source {
  pos: THREE.Vector3;
  indoor: boolean;
}

const POOL_INDOOR = 5;
const POOL_OUTDOOR = 3;
/** Fica de olho só nas fontes mais próximas do jogador: um número FIXO de luzes (sem recompilar shaders). */
const INDOOR_INTENSITY = 30;
const OUTDOOR_INTENSITY = 55;

/**
 * Iluminação artificial:
 *  - dentro da base, as luzes dos cômodos acendem à noite e durante tempestades de areia;
 *  - fora, os postes e as luzes do heliponto acendem à noite;
 *  - as janelas e luzes de sinalização brilham mais quando escurece.
 * Usa um conjunto pequeno de PointLights que acompanha as fontes mais próximas do jogador.
 */
export class NightLights {
  private readonly sources: Source[] = [];
  private readonly indoorPool: THREE.PointLight[] = [];
  private readonly outdoorPool: THREE.PointLight[] = [];
  private readonly glow: Array<{ mat: THREE.MeshStandardMaterial; base: number }> = [];
  private acc = 0;
  /** uma lâmpada visível por cômodo/corredor: acesas à noite, mesmo longe do jogador */
  private lamps: THREE.InstancedMesh | null = null;
  private readonly lampMat = new THREE.MeshBasicMaterial({ color: 0x777777, toneMapped: false });
  private readonly lampOff = new THREE.Color(0x77716a);
  private readonly lampOn = new THREE.Color(0xffe2a0);

  constructor(
    private readonly scene: THREE.Scene,
    model: THREE.Object3D,
    grid: BaseGrid,
  ) {
    // cômodos e corredores: uma luz no centro, no alto
    for (const r of grid.layout.rooms) {
      const a = grid.tileToWorld(r.tile[0], r.tile[1]);
      const b = grid.tileToWorld(r.tile[0] + r.size[0] - 1, r.tile[1] + r.size[1] - 1);
      this.sources.push({
        pos: new THREE.Vector3((a.wx + b.wx) / 2, 2.1, (a.wz + b.wz) / 2),
        indoor: true,
      });
    }
    for (const c of grid.layout.corridors) {
      const w = grid.tileToWorld(c.tile[0], c.tile[1]);
      this.sources.push({ pos: new THREE.Vector3(w.wx, 2.0, w.wz), indoor: true });
    }
    // lâmpada visível em cada cômodo e corredor
    const indoor = this.sources.filter((s) => s.indoor);
    if (indoor.length) {
      const bulb = new THREE.SphereGeometry(0.22, 10, 8);
      this.lamps = new THREE.InstancedMesh(bulb, this.lampMat, indoor.length);
      const m = new THREE.Matrix4();
      indoor.forEach((s, i) => {
        m.makeTranslation(s.pos.x, s.pos.y + 0.35, s.pos.z);
        this.lamps?.setMatrixAt(i, m);
      });
      this.lamps.frustumCulled = false;
      this.lamps.matrixAutoUpdate = false;
      this.lamps.userData.keepSeparate = true;
      scene.add(this.lamps);
    }
    // postes e luzes de pouso
    const wp = new THREE.Vector3();
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (/_(Poste|PadLuz)_\d+$/.test(o.name)) {
        o.getWorldPosition(wp);
        this.sources.push({ pos: new THREE.Vector3(wp.x, 2.4, wp.z), indoor: false });
      }
    });

    for (let i = 0; i < POOL_INDOOR; i++) {
      const l = new THREE.PointLight(0xffe3b8, 0, 11, 1.6);
      this.indoorPool.push(l);
      scene.add(l);
    }
    for (let i = 0; i < POOL_OUTDOOR; i++) {
      const l = new THREE.PointLight(0xffb36b, 0, 20, 1.5);
      this.outdoorPool.push(l);
      scene.add(l);
    }
  }

  /** Registra os materiais brilhantes (janelas, luzes) depois de todas as trocas de material. */
  collectGlow(root: THREE.Object3D) {
    const seen = new Set<THREE.Material>();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if (seen.has(mat)) continue;
        if (
          /^M_(Janela_Luz|Glow_)/.test(mat.name) &&
          (mat as THREE.MeshStandardMaterial).emissive
        ) {
          seen.add(mat);
          const std = mat as THREE.MeshStandardMaterial;
          this.glow.push({ mat: std, base: std.emissiveIntensity });
        }
      }
    });
  }

  /**
   * @param dark  0..1: o quanto está escuro lá fora (noite)
   * @param storm 0..1: tempestade de areia (escurece o ambiente fechado também)
   * @param inside 0..1: jogador dentro da base
   */
  update(dt: number, focus: THREE.Vector3, dark: number, storm: number, inside: number) {
    // reatribui as luzes às fontes mais próximas ~5 vezes por segundo
    this.acc += dt;
    if (this.acc > 0.2) {
      this.acc = 0;
      this.assign(this.indoorPool, true, focus);
      this.assign(this.outdoorPool, false, focus);
    }

    const indoorDark = Math.max(dark, storm * 0.85);
    const kIn = indoorDark * inside * INDOOR_INTENSITY;
    const kOut = dark * (1 - inside * 0.8) * OUTDOOR_INTENSITY;
    const k = Math.min(1, dt * 5);
    for (const l of this.indoorPool) l.intensity += (kIn - l.intensity) * k;
    for (const l of this.outdoorPool) l.intensity += (kOut - l.intensity) * k;

    // lâmpadas das salas: apagadas de dia, acesas à noite e na tempestade
    const lampOn = Math.min(1, indoorDark * 1.4);
    this.lampMat.color.copy(this.lampOff).lerp(this.lampOn, lampOn);

    // janelas e luzes de sinalização brilham mais no escuro
    const boost = 1 + Math.max(dark, storm * 0.6) * 1.8;
    for (const g of this.glow) g.mat.emissiveIntensity = g.base * boost;
  }

  private assign(pool: THREE.PointLight[], indoor: boolean, focus: THREE.Vector3) {
    const candidates = this.sources
      .filter((s) => s.indoor === indoor)
      .map((s) => ({ s, d: (s.pos.x - focus.x) ** 2 + (s.pos.z - focus.z) ** 2 }))
      .sort((a, b) => a.d - b.d);
    pool.forEach((light, i) => {
      const c = candidates[i];
      if (c) light.position.copy(c.s.pos);
    });
  }

  dispose() {
    if (this.lamps) {
      this.scene.remove(this.lamps);
      this.lamps.geometry.dispose();
    }
    this.lampMat.dispose();
    for (const l of [...this.indoorPool, ...this.outdoorPool]) {
      this.scene.remove(l);
      l.dispose();
    }
  }
}
