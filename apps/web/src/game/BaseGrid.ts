import * as THREE from 'three';
import { NavigationGrid, TILE_SIZE } from '@mars/shared';
import type { BaseFullLayout, NavBuildOptions } from '@mars/shared';
export {
  FLOOR_Y,
  PAD_Y,
  GROUND_Y,
  PLAYER_RADIUS,
  STORM_SAFE_RADIUS,
  TILE_SIZE,
  VEHICLE_RADIUS,
} from '@mars/shared';
export type { BaseFullLayout, NavBuildOptions, NavProfile, PathResult } from '@mars/shared';

/** Rendering and offline geometry adapter around the shared navigation core. */
export class BaseGrid extends NavigationGrid {
  readonly gridMesh: THREE.GridHelper;
  private debugMesh: THREE.Mesh | null = null;
  constructor(layout: BaseFullLayout) {
    super(layout);
    this.gridMesh = new THREE.GridHelper(120, Math.round(120 / TILE_SIZE), 0xffb511, 0x4876a8);
    this.gridMesh.position.set(0, 0.02, 0);
    this.gridMesh.renderOrder = 1;
    (this.gridMesh.material as THREE.Material).transparent = true;
    (this.gridMesh.material as THREE.Material).opacity = 0.22;
  }
  buildNavigation(root: THREE.Object3D, opts: NavBuildOptions) {
    const triangles: number[][] = [];
    root.updateMatrixWorld(true);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();

    const visit = (mesh: THREE.Mesh) => {
      const geo = mesh.geometry;
      const pos = geo.getAttribute('position');
      if (!pos) return;
      const index = geo.getIndex();
      const count = index ? index.count : pos.count;
      const m = mesh.matrixWorld;
      for (let k = 0; k + 2 < count; k += 3) {
        const i0 = index ? index.getX(k) : k;
        const i1 = index ? index.getX(k + 1) : k + 1;
        const i2 = index ? index.getX(k + 2) : k + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m);
        b.fromBufferAttribute(pos, i1).applyMatrix4(m);
        c.fromBufferAttribute(pos, i2).applyMatrix4(m);
        const yMin = Math.min(a.y, b.y, c.y);
        const yMax = Math.max(a.y, b.y, c.y);
        if (yMax < 0.45 || yMin > 1.7) continue;
        triangles.push([a.x, a.z, b.x, b.z, c.x, c.z]);
      }
    };

    const walk = (o: THREE.Object3D) => {
      if (opts.skip(o.name)) return;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) visit(mesh);
      for (const child of o.children) walk(child);
    };
    walk(root);
    for (const extra of opts.extraObstacles ?? []) walk(extra);

    this.buildFromTriangles(triangles, opts);
  }
  // ------------------------------------------------------------------ depuração visual

  /** Mostra (ou esconde) as células bloqueadas: útil para conferir a colisão. */
  setNavDebug(visible: boolean, scene: THREE.Scene) {
    if (!visible) {
      if (this.debugMesh) this.debugMesh.visible = false;
      return;
    }
    if (!this.debugMesh) this.refreshDebugMesh();
    if (this.debugMesh) {
      this.debugMesh.visible = true;
      if (!this.debugMesh.parent) scene.add(this.debugMesh);
    }
  }

  protected override refreshDebugMesh() {
    if (!this.navReady) return;
    const s = this.size;
    const positions: number[] = [];
    const colors: number[] = [];
    const push = (i: number, j: number, r: number, g: number, b: number) => {
      const x0 = this.originX + i * 0.3;
      const z0 = this.originZ + j * 0.3;
      const x1 = x0 + 0.3;
      const z1 = z0 + 0.3;
      const y = 0.9;
      positions.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
      for (let n = 0; n < 6; n++) colors.push(r, g, b);
    };
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        const x = this.originX + (i + 0.5) * 0.3;
        const z = this.originZ + (j + 0.5) * 0.3;
        if (Math.abs(x) > 50 || Math.abs(z) > 56) continue;
        const k = j * s + i;
        if (this.blocked[k]) push(i, j, 1, this.raw[k] ? 0.1 : 0.55, 0.1);
        else if (this.reach[k]) push(i, j, 0.1, 0.8, 0.3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const prevVisible = this.debugMesh?.visible ?? false;
    const parent = this.debugMesh?.parent ?? null;
    this.debugMesh?.geometry.dispose();
    this.debugMesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    this.debugMesh.renderOrder = 5;
    this.debugMesh.visible = prevVisible;
    parent?.add(this.debugMesh);
  }

  dispose() {
    if (this.debugMesh) {
      this.debugMesh.geometry.dispose();
      (this.debugMesh.material as THREE.Material).dispose();
      this.debugMesh.removeFromParent();
    }
    this.gridMesh.geometry.dispose();
    (this.gridMesh.material as THREE.Material).dispose();
  }
}
