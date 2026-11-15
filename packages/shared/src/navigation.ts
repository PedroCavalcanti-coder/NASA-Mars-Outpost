import * as THREE from 'three';

type BaseId = string;

export interface RoomDoor {
  side: string;
  pos: [number, number];
  garage?: boolean;
  exterior?: boolean;
}

export interface RoomLayout {
  id: string;
  kind: string;
  tile: [number, number];
  size: [number, number];
  rotation?: number;
  doors?: RoomDoor[];
}

export interface BaseFullLayout {
  id: BaseId;
  name: string;
  description: string;
  bounds: { x0: number; y0: number; x1: number; y1: number };
  rooms: RoomLayout[];
  corridors: { tile: [number, number]; axis?: 'x' | 'y' }[];
  /** posição do heliponto em METROS do modelo (x leste, y norte) */
  pad: [number, number];
  /** painéis solares em METROS do modelo (x leste, y norte) */
  solar?: [number, number][];
}

export type TileKind = 'room' | 'corridor' | 'out';

const SCALE = 0.75;
export const TILE_SIZE = 4 * SCALE; // 3.0 unidades de mundo por tile

/** Altura do piso interno (m) e do heliponto: o astronauta "pisa" nelas. */
export const FLOOR_Y = 0.24;
export const PAD_Y = 0.14;
export const GROUND_Y = 0.04;

/** Raio do astronauta usado nas colisões com outros jogadores. */
export const PLAYER_RADIUS = 0.42;

/** Faixa de altura (m, mundo) em que uma superfície bloqueia o astronauta. */
const BAND_MIN = 0.45;
const BAND_MAX = 1.7;

/** Resolução da grade de colisão (unidades de mundo por célula). */
const CELL = 0.3;
/** Metade do lado do terreno navegável (unidades de mundo). */
const HALF_EXTENT = 78;
/** Durante tempestade o astronauta só circula dentro deste raio (inclui o heliponto). */
export const STORM_SAFE_RADIUS = 46;

/** `foot`: astronauta a pé. `vehicle`: rover (mais largo e proibido dentro da base). */
export type NavProfile = 'foot' | 'vehicle';

/** Raio do rover para colisão com paredes e obstáculos (unidades de mundo). */
export const VEHICLE_RADIUS = 1.5;

export interface PathResult {
  path: THREE.Vector3[];
  clampedByStorm: boolean;
}

export interface NavBuildOptions {
  /** ignora a malha (ancestrais incluídos) quando devolve true */
  skip: (name: string) => boolean;
  /** objetos que só entram na colisão se o nome passar neste filtro (terreno: rochas) */
  extraObstacles?: THREE.Object3D[];
  /** ponto (mundo) que precisa estar numa região navegável: define a ilha alcançável */
  seed: THREE.Vector3;
  /** ponto (mundo) onde o rover fica estacionado: define a região navegável do veículo */
  vehicleSeed?: THREE.Vector3;
}

/** Heap binário mínimo (menor `f` primeiro) para o A*. */
class MinHeap {
  protected f: number[] = [];
  protected v: number[] = [];
  get size() {
    return this.v.length;
  }
  clear() {
    this.f.length = 0;
    this.v.length = 0;
  }
  push(value: number, priority: number) {
    let i = this.v.length;
    this.f.push(priority);
    this.v.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p]! <= priority) break;
      this.f[i] = this.f[p]!;
      this.v[i] = this.v[p]!;
      i = p;
    }
    this.f[i] = priority;
    this.v[i] = value;
  }
  pop(): number {
    const top = this.v[0]!;
    const lastV = this.v.pop()!;
    const lastF = this.f.pop()!;
    const n = this.v.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && this.f[c + 1]! < this.f[c]!) c++;
        if (this.f[c]! >= lastF) break;
        this.f[i] = this.f[c]!;
        this.v[i] = this.v[c]!;
        i = c;
      }
      this.f[i] = lastF;
      this.v[i] = lastV;
    }
    return top;
  }
}

/**
 * Grade da base: coordenadas, tipo de cada tile (cômodo/corredor/exterior) e a malha de
 * navegação. A malha é gerada a partir da geometria REAL dos modelos (paredes, móveis,
 * equipamentos, painéis, rochas): o que bloqueia o astronauta é exatamente o que se vê.
 */
export class NavigationGrid {
  readonly layout: BaseFullLayout;
  readonly cx: number;
  readonly cy: number;

  protected readonly tiles = new Map<string, { kind: TileKind; roomId?: string }>();

  // ---- navegação ----
  protected readonly size = Math.ceil((HALF_EXTENT * 2) / CELL);
  protected readonly originX = -HALF_EXTENT;
  protected readonly originZ = -HALF_EXTENT;
  protected raw = new Uint8Array(0);
  /** 1 = bloqueado (já com a folga do corpo do astronauta) */
  protected blocked = new Uint8Array(0);
  /** 1 = região navegável conectada ao ponto de chegada */
  protected reach = new Uint8Array(0);
  /** o mesmo para o rover: obstáculos engordados pelo raio dele e a base inteira bloqueada */
  protected blockedV = new Uint8Array(0);
  /** penalidade por cercania de paredes: o caminho prefere o meio dos corredores e vãos */
  protected pen = new Float32Array(0);
  protected penV: Float32Array<ArrayBufferLike> = new Float32Array(0);
  protected reachV = new Uint8Array(0);
  protected navReady = false;

  // buffers do A* reaproveitados
  protected gScore = new Float32Array(0);
  protected cameFrom = new Int32Array(0);
  protected stamp = new Uint32Array(0);
  protected closedStamp = new Uint32Array(0);
  protected stampId = 0;
  protected readonly heap = new MinHeap();

  constructor(layout: BaseFullLayout) {
    // layouts parciais (testes, bases sem corredores) ganham listas vazias
    this.layout = {
      ...layout,
      rooms: layout.rooms ?? [],
      corridors: layout.corridors ?? [],
      pad: layout.pad ?? [0, 0],
    };
    const b = layout.bounds;
    this.cx = (b.x0 + b.x1) / 2;
    this.cy = (b.y0 + b.y1) / 2;

    for (const r of layout.rooms ?? []) {
      for (let i = 0; i < r.size[0]; i++) {
        for (let j = 0; j < r.size[1]; j++) {
          this.tiles.set(this.key(r.tile[0] + i, r.tile[1] + j), { kind: 'room', roomId: r.id });
        }
      }
    }
    for (const c of layout.corridors ?? []) {
      this.tiles.set(this.key(c.tile[0], c.tile[1]), { kind: 'corridor' });
    }
  }

  protected key(tx: number, ty: number): string {
    return `${tx},${ty}`;
  }

  // ------------------------------------------------------------------ coordenadas

  /** Mundo (x, z) -> tile da base (tx, ty). */
  worldToTile(wx: number, wz: number): { tx: number; ty: number } {
    return {
      tx: Math.floor(wx / TILE_SIZE + this.cx),
      ty: Math.floor(-wz / TILE_SIZE + this.cy),
    };
  }

  /** Centro do tile no mundo. */
  tileToWorld(tx: number, ty: number): { wx: number; wz: number } {
    return {
      wx: (tx + 0.5 - this.cx) * TILE_SIZE,
      wz: -(ty + 0.5 - this.cy) * TILE_SIZE,
    };
  }

  /** Metros do modelo (x leste, y norte) -> mundo (x, z). */
  modelMetersToWorld(mx: number, my: number): { wx: number; wz: number } {
    return {
      wx: (mx - this.cx * 4) * SCALE,
      wz: -(my - this.cy * 4) * SCALE,
    };
  }

  worldToGridCoords(wx: number, wz: number): { gx: number; gy: number } {
    const { tx, ty } = this.worldToTile(wx, wz);
    return { gx: Math.round(tx - this.cx), gy: Math.round(ty - this.cy) };
  }

  tileKindAt(wx: number, wz: number): TileKind {
    const { tx, ty } = this.worldToTile(wx, wz);
    return this.tiles.get(this.key(tx, ty))?.kind ?? 'out';
  }

  /** Dentro da base (cômodo ou corredor). */
  isInsideBase(wx: number, wz: number): boolean {
    return this.tileKindAt(wx, wz) !== 'out';
  }

  isInsideRoom(wx: number, wz: number): boolean {
    return this.tileKindAt(wx, wz) === 'room';
  }

  roomIdAt(wx: number, wz: number): string | null {
    const { tx, ty } = this.worldToTile(wx, wz);
    return this.tiles.get(this.key(tx, ty))?.roomId ?? null;
  }

  /** Centro do heliponto no mundo. */
  getPadWorldPosition(): THREE.Vector3 {
    const { wx, wz } = this.modelMetersToWorld(
      this.layout.pad?.[0] ?? 0,
      this.layout.pad?.[1] ?? 0,
    );
    return new THREE.Vector3(wx, PAD_Y, wz);
  }

  /** Altura em que o astronauta pisa naquele ponto. */
  groundY(wx: number, wz: number): number {
    if (this.isInsideBase(wx, wz)) return FLOOR_Y;
    const pad = this.getPadWorldPosition();
    if (Math.abs(wx - pad.x) < 4.7 && Math.abs(wz - pad.z) < 4.7) return PAD_Y;
    return GROUND_Y;
  }

  // ------------------------------------------------------------------ malha de colisão

  protected idx(i: number, j: number) {
    return j * this.size + i;
  }

  protected cellOf(wx: number, wz: number) {
    return {
      i: Math.floor((wx - this.originX) / CELL),
      j: Math.floor((wz - this.originZ) / CELL),
    };
  }

  protected cellCenter(i: number, j: number) {
    return { x: this.originX + (i + 0.5) * CELL, z: this.originZ + (j + 0.5) * CELL };
  }

  protected inRange(i: number, j: number) {
    return i >= 0 && j >= 0 && i < this.size && j < this.size;
  }

  get navigationReady() {
    return this.navReady;
  }

  /**
   * Gera a colisão a partir das malhas já posicionadas na cena. Cada triângulo que cruza a
   * faixa de altura do corpo vira obstáculo (paredes, móveis, painéis, postes, rochas…).
   * Pisos, tetos, rampas e a plataforma ficam fora da faixa; as folhas das portas são
   * ignoradas (a porta abre sozinha), deixando o vão livre.
   */
  buildFromTriangles(
    triangles: Iterable<readonly number[]>,
    opts: { seed: THREE.Vector3; vehicleSeed?: THREE.Vector3 },
  ) {
    this.allocate();
    for (const t of triangles) this.rasterTriangle(t[0]!, t[1]!, t[2]!, t[3]!, t[4]!, t[5]!);
    // Folga do corpo: 1 célula em cruz (~0,3) somada à rasterização conservadora (~0,15).
    const s = this.size;
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        const k = j * s + i;
        if (
          this.raw[k] ||
          (i > 0 && this.raw[k - 1]) ||
          (i < s - 1 && this.raw[k + 1]) ||
          (j > 0 && this.raw[k - s]) ||
          (j < s - 1 && this.raw[k + s])
        ) {
          this.blocked[k] = 1;
        }
      }
    }
    // borda do mundo
    for (let t = 0; t < s; t++) {
      this.blocked[t] = 1;
      this.blocked[(s - 1) * s + t] = 1;
      this.blocked[t * s] = 1;
      this.blocked[t * s + s - 1] = 1;
    }

    this.buildClearancePenalty();
    this.floodReachable(opts.seed, this.blocked, this.reach);
    this.buildVehicleMask();
    this.penV = this.clearanceOf(this.blockedV, 4);
    if (opts.vehicleSeed) this.floodReachable(opts.vehicleSeed, this.blockedV, this.reachV);
    this.navReady = true;
    this.refreshDebugMesh();
  }

  /** Rasterização conservadora (triângulo x célula) no plano XZ. */
  protected rasterTriangle(ax: number, az: number, bx: number, bz: number, cx: number, cz: number) {
    const minX = Math.min(ax, bx, cx);
    const maxX = Math.max(ax, bx, cx);
    const minZ = Math.min(az, bz, cz);
    const maxZ = Math.max(az, bz, cz);
    if (
      maxX < this.originX ||
      minX > -this.originX ||
      maxZ < this.originZ ||
      minZ > -this.originZ
    ) {
      return;
    }
    const i0 = Math.max(0, Math.floor((minX - this.originX) / CELL));
    const i1 = Math.min(this.size - 1, Math.floor((maxX - this.originX) / CELL));
    const j0 = Math.max(0, Math.floor((minZ - this.originZ) / CELL));
    const j1 = Math.min(this.size - 1, Math.floor((maxZ - this.originZ) / CELL));

    // eixos de separação: normais das arestas (as do retângulo são os eixos X/Z, já testados
    // pela caixa envolvente acima)
    let axes = 0;
    const pts = [ax, az, bx, bz, cx, cz];
    for (let e = 0; e < 3; e++) {
      const px = pts[e * 2]!;
      const pz = pts[e * 2 + 1]!;
      const qx = pts[((e + 1) % 3) * 2]!;
      const qz = pts[((e + 1) % 3) * 2 + 1]!;
      const nx = -(qz - pz);
      const nz = qx - px;
      if (nx * nx + nz * nz < 1e-10) continue;
      const d0 = nx * ax + nz * az;
      const d1 = nx * bx + nz * bz;
      const d2 = nx * cx + nz * cz;
      axisX[axes] = nx;
      axisZ[axes] = nz;
      triMin[axes] = Math.min(d0, d1, d2);
      triMax[axes] = Math.max(d0, d1, d2);
      axes++;
    }

    const half = CELL / 2;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * this.size + i;
        if (this.raw[k]) continue;
        const ctrX = this.originX + (i + 0.5) * CELL;
        const ctrZ = this.originZ + (j + 0.5) * CELL;
        let separated = false;
        for (let e = 0; e < axes; e++) {
          const nx = axisX[e]!;
          const nz = axisZ[e]!;
          const c0 = nx * ctrX + nz * ctrZ;
          const r = (Math.abs(nx) + Math.abs(nz)) * half;
          if (triMax[e]! < c0 - r || triMin[e]! > c0 + r) {
            separated = true;
            break;
          }
        }
        if (!separated) this.raw[k] = 1;
      }
    }
  }

  /**
   * Colisão do rover: cada obstáculo engorda pelo raio do veículo e a base inteira (cômodos,
   * corredores e um corredor de folga em volta) fica proibida: o carro não entra na base.
   */
  /** Penalidade (0..~2) por cercania de células bloqueadas, até `radius` células. */
  protected clearanceOf(blocked: Uint8Array, radius: number): Float32Array {
    const s = this.size;
    const out = new Float32Array(s * s);
    for (let j = radius; j < s - radius; j++) {
      for (let i = radius; i < s - radius; i++) {
        const k = j * s + i;
        if (blocked[k]) continue;
        let best = radius + 1;
        for (let dj = -radius; dj <= radius; dj++) {
          for (let di = -radius; di <= radius; di++) {
            if (!blocked[k + dj * s + di]) continue;
            const d = Math.max(Math.abs(di), Math.abs(dj));
            if (d < best) best = d;
          }
        }
        if (best <= radius) out[k] = ((radius + 1 - best) / radius) * 2;
      }
    }
    return out;
  }

  protected buildClearancePenalty() {
    const s = this.size;
    this.pen = new Float32Array(s * s);
    for (let j = 2; j < s - 2; j++) {
      for (let i = 2; i < s - 2; i++) {
        const k = j * s + i;
        if (this.blocked[k]) continue;
        let p = 0;
        for (let dj = -2; dj <= 2 && p < 1.2; dj++) {
          for (let di = -2; di <= 2; di++) {
            if (!this.blocked[k + dj * s + di]) continue;
            p = Math.max(p, Math.max(Math.abs(di), Math.abs(dj)) <= 1 ? 1.2 : 0.5);
            if (p >= 1.2) break;
          }
        }
        this.pen[k] = p;
      }
    }
  }

  protected buildVehicleMask() {
    const s = this.size;
    const r = Math.ceil(VEHICLE_RADIUS / CELL);
    const offsets: Array<[number, number]> = [];
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.hypot(di, dj) * CELL <= VEHICLE_RADIUS + CELL * 0.5) offsets.push([di, dj]);
      }
    }
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        if (!this.raw[j * s + i]) continue;
        for (const [di, dj] of offsets) {
          const ni = i + di;
          const nj = j + dj;
          if (this.inRange(ni, nj)) this.blockedV[nj * s + ni] = 1;
        }
      }
    }
    // a base: cada tile de cômodo/corredor, com folga
    const margin = 1.2;
    for (const key of this.tiles.keys()) {
      const [tx, ty] = key.split(',').map(Number) as [number, number];
      const w = this.tileToWorld(tx, ty);
      const half = TILE_SIZE / 2 + margin;
      const i0 = Math.max(0, Math.floor((w.wx - half - this.originX) / CELL));
      const i1 = Math.min(s - 1, Math.floor((w.wx + half - this.originX) / CELL));
      const j0 = Math.max(0, Math.floor((w.wz - half - this.originZ) / CELL));
      const j1 = Math.min(s - 1, Math.floor((w.wz + half - this.originZ) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.blockedV[j * s + i] = 1;
    }
    for (let t = 0; t < s; t++) {
      this.blockedV[t] = 1;
      this.blockedV[(s - 1) * s + t] = 1;
      this.blockedV[t * s] = 1;
      this.blockedV[t * s + s - 1] = 1;
    }
  }

  protected floodReachable(seed: THREE.Vector3, blocked: Uint8Array, reach: Uint8Array) {
    const s = this.size;
    const start = this.nearestFreeIn(seed.x, seed.z, 40, blocked);
    if (start === null) return;
    const queue: number[] = [start];
    reach[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const k = queue[head]!;
      const i = k % s;
      const j = (k - i) / s;
      for (let d = 0; d < 4; d++) {
        const ni = i + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const nj = j + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (!this.inRange(ni, nj)) continue;
        const nk = nj * s + ni;
        if (blocked[nk] || reach[nk]) continue;
        reach[nk] = 1;
        queue.push(nk);
      }
    }
  }

  /** Índice da célula livre mais próxima do ponto (busca em anéis). */
  protected nearestFree(
    wx: number,
    wz: number,
    maxRings: number,
    mustReach = false,
    profile: NavProfile = 'foot',
  ): number | null {
    const reach = profile === 'foot' ? this.reach : this.reachV;
    const blocked = profile === 'foot' ? this.blocked : this.blockedV;
    return mustReach
      ? this.nearestWhere(wx, wz, maxRings, (k) => reach[k] === 1)
      : this.nearestWhere(wx, wz, maxRings, (k) => blocked[k] === 0);
  }

  protected nearestFreeIn(wx: number, wz: number, maxRings: number, blocked: Uint8Array) {
    return this.nearestWhere(wx, wz, maxRings, (k) => blocked[k] === 0);
  }

  protected nearestWhere(
    wx: number,
    wz: number,
    maxRings: number,
    pred: (k: number) => boolean,
  ): number | null {
    const { i, j } = this.cellOf(wx, wz);
    const ok = (ci: number, cj: number) => this.inRange(ci, cj) && pred(this.idx(ci, cj));
    if (ok(i, j)) return this.idx(i, j);
    for (let r = 1; r <= maxRings; r++) {
      let best = -1;
      let bestD = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (!ok(i + di, j + dj)) continue;
          const d = di * di + dj * dj;
          if (d < bestD) {
            bestD = d;
            best = this.idx(i + di, j + dj);
          }
        }
      }
      if (best >= 0) return best;
    }
    return null;
  }

  /** O ponto está num lugar onde o astronauta pode estar? */
  isWalkable(wx: number, wz: number, profile: NavProfile = 'foot'): boolean {
    if (!this.navReady) return true;
    const { i, j } = this.cellOf(wx, wz);
    if (!this.inRange(i, j)) return false;
    return (profile === 'foot' ? this.reach : this.reachV)[this.idx(i, j)] === 1;
  }

  /** O ponto está sobre algo sólido de verdade (parede, móvel, painel…), sem a folga do corpo? */
  isSolid(wx: number, wz: number): boolean {
    if (!this.navReady) return false;
    const { i, j } = this.cellOf(wx, wz);
    return !this.inRange(i, j) || this.raw[this.idx(i, j)] === 1;
  }

  /** Ponto navegável mais próximo (mundo). `null` se não houver nada por perto. */
  nearestWalkablePoint(
    wx: number,
    wz: number,
    maxRings = 60,
    profile: NavProfile = 'foot',
  ): THREE.Vector3 | null {
    if (!this.navReady) return new THREE.Vector3(wx, this.groundY(wx, wz), wz);
    const k = this.nearestFree(wx, wz, maxRings, true, profile);
    if (k === null) return null;
    const i = k % this.size;
    const j = (k - i) / this.size;
    const p = this.cellCenter(i, j);
    return new THREE.Vector3(p.x, this.groundY(p.x, p.z), p.z);
  }

  /**
   * Caminho A* (8 direções, sem cortar quinas) + suavização por linha de visada.
   * `extraBlocked` serve para desviar de outros jogadores.
   */
  findPath(
    from: THREE.Vector3,
    to: THREE.Vector3,
    stormActive = false,
    extraBlocked?: (wx: number, wz: number) => boolean,
    profile: NavProfile = 'foot',
  ): PathResult {
    if (!this.navReady) {
      return { path: [to.clone()], clampedByStorm: false };
    }
    const s = this.size;
    let clampedByStorm = false;
    let goalX = to.x;
    let goalZ = to.z;
    if (stormActive) {
      const r = Math.hypot(goalX, goalZ);
      if (r > STORM_SAFE_RADIUS) {
        goalX = (goalX / r) * (STORM_SAFE_RADIUS - 1);
        goalZ = (goalZ / r) * (STORM_SAFE_RADIUS - 1);
        clampedByStorm = true;
      }
    }

    const reach = profile === 'foot' ? this.reach : this.reachV;
    const startK = this.nearestFree(from.x, from.z, profile === 'foot' ? 12 : 20, true, profile);
    const goalK = this.nearestFree(goalX, goalZ, 60, true, profile);
    if (startK === null || goalK === null) return { path: [], clampedByStorm };

    const stormR2 = STORM_SAFE_RADIUS * STORM_SAFE_RADIUS;
    const goalI = goalK % s;
    const goalJ = (goalK - goalI) / s;

    this.stampId++;
    const stampId = this.stampId;
    this.heap.clear();
    this.gScore[startK] = 0;
    this.stamp[startK] = stampId;
    this.cameFrom[startK] = -1;
    this.heap.push(startK, 0);
    const closedMark = this.closedStamp;
    const visited: number[] = [];
    let found = false;

    const SQRT2 = Math.SQRT2;
    while (this.heap.size > 0) {
      const k = this.heap.pop();
      if (k === goalK) {
        found = true;
        break;
      }
      if (closedMark[k] === stampId) continue;
      closedMark[k] = stampId;
      visited.push(k);
      const ci: number = k % s;
      const cj: number = (k - ci) / s;
      const g = this.gScore[k]!;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const ni: number = ci + di;
          const nj: number = cj + dj;
          if (!this.inRange(ni, nj)) continue;
          const nk = nj * s + ni;
          if (!reach[nk] || closedMark[nk] === stampId) continue;
          if (di !== 0 && dj !== 0) {
            // não corta quinas de obstáculos
            if (!reach[cj * s + ni] || !reach[nj * s + ci]) continue;
          }
          const p = this.cellCenter(ni, nj);
          if (stormActive && p.x * p.x + p.z * p.z > stormR2) continue;
          if (extraBlocked?.(p.x, p.z)) continue;
          const ng =
            g +
            (di !== 0 && dj !== 0 ? SQRT2 : 1) *
              (1 + (profile === 'foot' ? this.pen[nk]! : this.penV[nk]!));
          if (this.stamp[nk] !== stampId || ng < this.gScore[nk]!) {
            this.stamp[nk] = stampId;
            this.gScore[nk] = ng;
            this.cameFrom[nk] = k;
            const dx = Math.abs(ni - goalI);
            const dz = Math.abs(nj - goalJ);
            const h = dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
            this.heap.push(nk, ng + h);
          }
        }
      }
    }

    if (!found) {
      // destino inalcançável (p.ex. cercado por jogadores): leva ao nó explorado mais próximo
      let bestK = startK;
      let bestD = Infinity;
      for (const k of visited) {
        const ki = k % s;
        const kj = (k - ki) / s;
        const d = (ki - goalI) ** 2 + (kj - goalJ) ** 2;
        if (d < bestD) {
          bestD = d;
          bestK = k;
        }
      }
      return { path: this.buildPath(startK, bestK, from, null, profile), clampedByStorm };
    }

    return {
      path: this.buildPath(startK, goalK, from, new THREE.Vector3(goalX, 0, goalZ), profile),
      clampedByStorm,
    };
  }

  protected buildPath(
    startK: number,
    endK: number,
    from: THREE.Vector3,
    exactEnd: THREE.Vector3 | null,
    profile: NavProfile,
  ): THREE.Vector3[] {
    const s = this.size;
    const cells: number[] = [];
    for (let k = endK; k !== -1; k = this.cameFrom[k]!) {
      cells.push(k);
      if (k === startK) break;
    }
    cells.reverse();

    const pts = cells.map((k) => {
      const i = k % s;
      return this.cellCenter(i, (k - i) / s);
    });

    // O último ponto é o toque exato do jogador quando a célula dele é navegável.
    if (exactEnd && this.isWalkable(exactEnd.x, exactEnd.z, profile)) {
      pts[pts.length - 1] = { x: exactEnd.x, z: exactEnd.z };
    }

    // suavização: pula nós enquanto a linha reta cruzar só células livres
    const out: { x: number; z: number }[] = [];
    let anchor = { x: from.x, z: from.z };
    let i = 0;
    while (i < pts.length) {
      let far = i;
      for (let j = pts.length - 1; j > i; j--) {
        if (this.lineClear(anchor.x, anchor.z, pts[j]!.x, pts[j]!.z, profile)) {
          far = j;
          break;
        }
      }
      out.push(pts[far]!);
      anchor = pts[far]!;
      i = far + 1;
    }

    return out.map((p) => new THREE.Vector3(p.x, this.groundY(p.x, p.z), p.z));
  }

  /** A reta entre dois pontos só atravessa células navegáveis? (amostragem a 1/3 de célula) */
  lineClear(x0: number, z0: number, x1: number, z1: number, profile: NavProfile = 'foot'): boolean {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(dist / (CELL / 3)));
    for (let t = 1; t <= steps; t++) {
      const u = t / steps;
      if (!this.isWalkable(x0 + (x1 - x0) * u, z0 + (z1 - z0) * u, profile)) return false;
    }
    return true;
  }

  protected refreshDebugMesh() {}

  protected allocate() {
    const n = this.size * this.size;
    this.raw = new Uint8Array(n);
    this.blocked = new Uint8Array(n);
    this.reach = new Uint8Array(n);
    this.blockedV = new Uint8Array(n);
    this.reachV = new Uint8Array(n);
    this.gScore = new Float32Array(n);
    this.cameFrom = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closedStamp = new Uint32Array(n);
    this.stampId = 0;
  }

  exportMasks(): number[][] {
    return [this.raw, this.blocked, this.reach, this.blockedV, this.reachV].map((mask) => {
      const runs: number[] = [];
      let value = 0,
        count = 0;
      for (const cell of mask) {
        if (cell === value) count++;
        else {
          runs.push(count);
          value = cell;
          count = 1;
        }
      }
      runs.push(count);
      return runs;
    });
  }

  importMasks(masks: readonly (readonly number[])[]) {
    this.allocate();
    [this.raw, this.blocked, this.reach, this.blockedV, this.reachV].forEach((mask, index) => {
      let offset = 0;
      masks[index]?.forEach((count, run) => {
        mask.fill(run % 2, offset, offset + count);
        offset += count;
      });
      if (offset !== mask.length) throw new Error('Invalid navigation data');
    });
    this.buildClearancePenalty();
    this.penV = this.clearanceOf(this.blockedV, 4);
    this.navReady = true;
    this.refreshDebugMesh();
  }
}

/**
 * Campo aberto da expedição: o mesmo mapa, mas sem nenhuma estrutura (a base some). Só a borda
 * do mundo bloqueia; ninguém "está dentro da base" e o chão é plano.
 */
export class OpenFieldGrid extends NavigationGrid {
  constructor(layout: BaseFullLayout) {
    super(layout);
    this.allocate();
    const s = this.size;
    const reachV = Math.ceil(VEHICLE_RADIUS / CELL) + 1;
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        const k = j * s + i;
        const edge = Math.min(i, j, s - 1 - i, s - 1 - j);
        this.blocked[k] = edge < 1 ? 1 : 0;
        this.blockedV[k] = edge < reachV ? 1 : 0;
        this.reach[k] = this.blocked[k] ? 0 : 1;
        this.reachV[k] = this.blockedV[k] ? 0 : 1;
      }
    }
    this.buildClearancePenalty();
    this.penV = this.clearanceOf(this.blockedV, 4);
    this.navReady = true;
  }
  override isInsideBase(): boolean {
    return false;
  }
  override roomIdAt(): string | null {
    return null;
  }
  override groundY(): number {
    return GROUND_Y;
  }
}

export function mapTransform(bounds: BaseFullLayout['bounds']) {
  return {
    x: -(bounds.x0 + bounds.x1) * 1.5,
    y: 0.01,
    z: (bounds.y0 + bounds.y1) * 1.5,
    scale: SCALE,
  };
}

/** Screen-relative control becomes a map-space vector exactly once, before networking. */
export function mapDirection(theta: number, up: number, right: number) {
  const x = -Math.sin(theta) * up + Math.cos(theta) * right;
  const z = -Math.cos(theta) * up - Math.sin(theta) * right;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}
// buffers da rasterização (reaproveitados para não alocar a cada triângulo)
const axisX = [0, 0, 0];
const axisZ = [0, 0, 0];
const triMin = [0, 0, 0];
const triMax = [0, 0, 0];
