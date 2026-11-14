import * as THREE from 'three';
import type { BaseGrid } from './BaseGrid';

/** Opacidade das paredes do cômodo em que o jogador está. */
const WALL_OPACITY = 0.36;
/** Duração do sumiço do teto (rápido) e da transparência das paredes, em segundos. */
const ROOF_FADE_TIME = 0.2;
const WALL_FADE_TIME = 0.3;

interface FadeMat {
  mat: THREE.Material;
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
}

interface FadeSet {
  root: THREE.Object3D | null;
  mats: FadeMat[];
  opacity: number;
}

function collectMaterials(meshes: THREE.Mesh[], skipFloor: boolean): FadeMat[] {
  const out: FadeMat[] = [];
  for (const mesh of meshes) {
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = list.map((m) => {
      // piso, molduras vermelhas das portas e luzes continuam sólidos: só as paredes ficam translúcidas
      if (skipFloor && /^M_(Piso_Interno|NASA_Vermelho|Glow_|Janela_Luz)/.test(m.name)) return m;
      const c = m.clone(); // material próprio: cada cômodo/teto escurece sozinho
      out.push({
        mat: c,
        baseOpacity: c.opacity,
        baseTransparent: c.transparent,
        baseDepthWrite: c.depthWrite,
      });
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
  }
  return out;
}

function applyOpacity(set: FadeSet, o: number) {
  if (Math.abs(set.opacity - o) < 0.0005) return;
  set.opacity = o;
  const solid = o >= 0.999;
  for (const f of set.mats) {
    const wasTransparent = f.mat.transparent;
    f.mat.opacity = f.baseOpacity * o;
    f.mat.transparent = solid ? f.baseTransparent : true;
    f.mat.depthWrite = solid ? f.baseDepthWrite : false;
    if (wasTransparent !== f.mat.transparent) f.mat.needsUpdate = true;
  }
}

function meshesUnder(root: THREE.Object3D, skip: (o: THREE.Object3D) => boolean): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    if (skip(o)) return;
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
    for (const c of o.children) walk(c);
  };
  walk(root);
  return out;
}

const isRoofNode = (o: THREE.Object3D) => o.name.endsWith('_Telhado');

/**
 * Gerencia o que o jogador vê quando está dentro da base:
 *  - os tetos somem rapidamente (fade de ~0,2 s) e voltam ao sair;
 *  - as paredes do cômodo/corredor ocupado ficam um pouco transparentes;
 *  - `insideFactor` (0..1) alimenta a poeira: dentro da base o ar é limpo.
 */
export class InteriorFader {
  private readonly roofs: FadeSet[] = [];
  private readonly shells = new Map<string, FadeSet>();
  private inside = 0;
  private roofsForcedHidden = false;
  private roofTarget = 1;

  constructor(
    model: THREE.Object3D,
    private readonly grid: BaseGrid,
  ) {
    const wp = new THREE.Vector3();
    model.updateMatrixWorld(true);

    // tetos
    model.traverse((o) => {
      if (!isRoofNode(o)) return;
      const meshes = meshesUnder(o, () => false);
      this.roofs.push({ root: o, mats: collectMaterials(meshes, false), opacity: 1 });
    });

    // cômodos e corredores: paredes (sem piso, sem teto) e marca de "interior" para a poeira
    const consider = (group: THREE.Object3D, key: string) => {
      const meshes = meshesUnder(group, (o) => isRoofNode(o) || /_Porta/.test(o.name));
      const shellMeshes = meshes.filter((m) => /^(COMODO|CORREDOR)_/.test(m.name));
      for (const m of meshes) m.userData.isInterior = true;
      if (shellMeshes.length === 0) return;
      this.shells.set(key, {
        root: null,
        mats: collectMaterials(shellMeshes, true),
        opacity: 1,
      });
    };

    const roomIds = new Set(grid.layout.rooms.map((r) => r.id));
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || o.children.length === 0) return;
      for (const id of roomIds) {
        if (o.name.endsWith(`_${id}`)) {
          consider(o, `r:${id}`);
          return;
        }
      }
      if (/_Corredor_\d+$/.test(o.name)) {
        o.getWorldPosition(wp);
        const { tx, ty } = grid.worldToTile(wp.x, wp.z);
        consider(o, `c:${tx},${ty}`);
      }
    });
  }

  /** Teto sempre oculto (visão de corte) ou automático. */
  setRoofsForcedHidden(hidden: boolean) {
    this.roofsForcedHidden = hidden;
  }

  get insideFactor() {
    return this.inside;
  }

  /** `true` enquanto algum fade está acontecendo (as sombras precisam acompanhar). */
  update(dt: number, player: THREE.Vector3 | null): boolean {
    let insideBase = false;
    let key: string | null = null;
    if (player) {
      const kind = this.grid.tileKindAt(player.x, player.z);
      insideBase = kind !== 'out';
      if (insideBase) {
        const roomId = this.grid.roomIdAt(player.x, player.z);
        if (roomId) key = `r:${roomId}`;
        else {
          const { tx, ty } = this.grid.worldToTile(player.x, player.z);
          key = `c:${tx},${ty}`;
        }
      }
    }

    this.inside += ((insideBase ? 1 : 0) - this.inside) * Math.min(1, dt * 6);
    if (Math.abs(this.inside - (insideBase ? 1 : 0)) < 0.01) this.inside = insideBase ? 1 : 0;

    this.roofTarget = insideBase || this.roofsForcedHidden ? 0 : 1;

    let changed = false;
    for (const roof of this.roofs) {
      const next = approach(roof.opacity, this.roofTarget, dt / ROOF_FADE_TIME);
      if (next !== roof.opacity) {
        changed = true;
        applyOpacity(roof, next);
        if (roof.root) roof.root.visible = next > 0.01;
      }
    }
    for (const [k, shell] of this.shells) {
      const target = key === k ? WALL_OPACITY : 1;
      const next = approach(shell.opacity, target, dt / WALL_FADE_TIME);
      if (next !== shell.opacity) {
        changed = true;
        applyOpacity(shell, next);
      }
    }
    return changed;
  }

  get roofsHidden() {
    return this.roofTarget === 0;
  }
}

function approach(cur: number, target: number, step: number) {
  if (cur === target) return cur;
  const d = target - cur;
  return Math.abs(d) <= step ? target : cur + Math.sign(d) * step;
}
