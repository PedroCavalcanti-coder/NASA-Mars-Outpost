import * as THREE from 'three';
import type { BaseGrid } from './BaseGrid';

export interface StationData {
  kind: 'oxygen' | 'water';
  pos: THREE.Vector3;
  proxy: THREE.Mesh;
  outline: THREE.LineLoop;
  innerOutline: THREE.LineLoop;
  mat: THREE.LineBasicMaterial;
  innerMat: THREE.LineBasicMaterial;
}

/**
 * Pontos de suporte à vida na nave/base marciana:
 * 1. Usina de Oxigênio (MOXIE)
 * 2. Estação de Extração/Reciclagem de Água (ISRU)
 *
 * Possuem indicativos no piso no mesmo estilo dos canteiros de plantações (LineLoop holográfico),
 * caixas de colisão invisíveis para cliques e atualização com leve pulsação visual.
 */
export class LifeSupportStations {
  readonly group = new THREE.Group();
  readonly proxies: THREE.Mesh[] = [];
  private readonly stations: StationData[] = [];
  private time = 0;

  oxygenPos: THREE.Vector3 | null = null;
  waterPos: THREE.Vector3 | null = null;

  constructor() {
    this.group.name = 'LifeSupportStations';
  }

  setup(model: THREE.Object3D, grid: BaseGrid | null) {
    let filterMesh: THREE.Object3D | null = null;
    let tankMesh: THREE.Object3D | null = null;

    model.traverse((o) => {
      if (!filterMesh && /_FiltroAr_01$/.test(o.name)) {
        filterMesh = o;
      }
      if (!tankMesh && /_TanqueSuporteVida(_\d+)?$/.test(o.name)) {
        tankMesh = o;
      }
    });

    // Posição de oxigênio (Filtro de ar / Usina MOXIE)
    let oPos: THREE.Vector3;
    if (filterMesh) {
      oPos = (filterMesh as THREE.Object3D).getWorldPosition(new THREE.Vector3());
      (filterMesh as THREE.Object3D).userData.pick = { kind: 'oxygen_station' };
    } else {
      oPos = this.fallbackPosition(grid, 1.2);
    }
    const oFloorY = grid?.groundY(oPos.x, oPos.z) ?? 0.24;
    oPos.y = oFloorY;
    this.oxygenPos = oPos.clone();

    // Posição de água (Tanques de suporte à vida / ISRU de água)
    let wPos: THREE.Vector3;
    if (tankMesh) {
      wPos = (tankMesh as THREE.Object3D).getWorldPosition(new THREE.Vector3());
      (tankMesh as THREE.Object3D).userData.pick = { kind: 'water_station' };
    } else {
      wPos = this.fallbackPosition(grid, -1.2);
    }
    const wFloorY = grid?.groundY(wPos.x, wPos.z) ?? 0.24;
    wPos.y = wFloorY;
    this.waterPos = wPos.clone();

    // Cria os indicativos no piso parecidos com os das plantações (Crops LineLoop)
    this.createStation('oxygen', oPos, 1.3, 1.0, 0x5df2c0, 0xffffff);
    this.createStation('water', wPos, 2.1, 1.1, 0x38bdf8, 0x93c5fd);
  }

  private fallbackPosition(grid: BaseGrid | null, offset: number): THREE.Vector3 {
    if (!grid) return new THREE.Vector3(offset, 0.24, 0);
    const rooms = grid.layout.rooms ?? [];
    const room = rooms.find((r) => r.kind === 'SuporteVida') ?? rooms[0];
    if (!room) return new THREE.Vector3(offset, 0.24, 0);
    const a = grid.tileToWorld(room.tile[0], room.tile[1]);
    const b = grid.tileToWorld(room.tile[0] + room.size[0] - 1, room.tile[1] + room.size[1] - 1);
    const cx = (a.wx + b.wx) / 2 + offset;
    const cz = (a.wz + b.wz) / 2;
    const spot = grid.nearestWalkablePoint(cx, cz, 6);
    const x = spot?.x ?? cx;
    const z = spot?.z ?? cz;
    return new THREE.Vector3(x, grid.groundY(x, z), z);
  }

  private createStation(
    kind: 'oxygen' | 'water',
    pos: THREE.Vector3,
    width: number,
    depth: number,
    colorHex: number,
    accentHex: number,
  ) {
    const hw = width / 2;
    const hd = depth / 2;

    // Indicativo no piso: contorno retangular exato, idêntico ao modelo dos canteiros de plantação
    const outlineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-hw, 0, -hd),
      new THREE.Vector3(hw, 0, -hd),
      new THREE.Vector3(hw, 0, hd),
      new THREE.Vector3(-hw, 0, hd),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const outline = new THREE.LineLoop(outlineGeo, mat);
    outline.position.set(pos.x, pos.y + 0.04, pos.z);
    outline.raycast = () => {};

    // Linha interna holográfica técnica
    const ihw = hw * 0.78;
    const ihd = hd * 0.78;
    const innerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-ihw, 0, -ihd),
      new THREE.Vector3(ihw, 0, -ihd),
      new THREE.Vector3(ihw, 0, ihd),
      new THREE.Vector3(-ihw, 0, ihd),
    ]);
    const innerMat = new THREE.LineBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const innerOutline = new THREE.LineLoop(innerGeo, innerMat);
    innerOutline.position.set(pos.x, pos.y + 0.04, pos.z);
    innerOutline.raycast = () => {};

    // Volume invisível de colisão / clique
    const proxyGeo = new THREE.BoxGeometry(width + 0.3, 1.8, depth + 0.3);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const proxy = new THREE.Mesh(proxyGeo, proxyMat);
    proxy.position.set(pos.x, pos.y + 0.9, pos.z);
    proxy.userData.pick = { kind: kind === 'oxygen' ? 'oxygen_station' : 'water_station' };
    proxy.updateMatrix();
    proxy.matrixWorld.copy(proxy.matrix);

    this.group.add(outline);
    this.group.add(innerOutline);
    this.group.add(proxy);
    this.proxies.push(proxy);

    this.stations.push({
      kind,
      pos: pos.clone(),
      proxy,
      outline,
      innerOutline,
      mat,
      innerMat,
    });
  }

  update(dt: number) {
    this.time += dt;
    for (let i = 0; i < this.stations.length; i++) {
      const st = this.stations[i]!;
      const pulse = 0.75 + Math.sin(this.time * 2.2 + i * 1.5) * 0.22;
      st.mat.opacity = pulse;
      st.innerMat.opacity = 0.4 + Math.sin(this.time * 2.2 + i * 1.5 + 1.2) * 0.2;
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const st of this.stations) {
      st.outline.geometry.dispose();
      st.innerOutline.geometry.dispose();
      st.mat.dispose();
      st.innerMat.dispose();
      st.proxy.geometry.dispose();
      (st.proxy.material as THREE.Material).dispose();
    }
    this.stations.length = 0;
    this.proxies.length = 0;
  }
}
