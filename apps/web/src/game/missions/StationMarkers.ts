import * as THREE from 'three';
import type { MissionSite, StationSite } from './rules';

export type MarkerState = 'hidden' | 'ready' | 'blocked';

const COLORS: Record<Exclude<MarkerState, 'hidden'>, number> = {
  ready: 0x5df2c0,
  blocked: 0xffb347,
};

interface Item {
  root: THREE.Group;
  gem: THREE.Mesh;
  beam: THREE.Mesh;
  ring: THREE.Mesh;
  mats: THREE.MeshBasicMaterial[];
  phase: number;
}

/**
 * Hologramas que marcam onde cada missão acontece: um feixe de luz, um anel no piso e um
 * cristal que gira. As estações de dentro da base (laboratório, comunicações, energia,
 * enfermaria) também têm uma caixa invisível maior para o clique.
 */
export class StationMarkers {
  readonly group = new THREE.Group();
  /** caixas de clique (invisíveis) das estações internas */
  readonly proxies: THREE.Mesh[] = [];
  private readonly items = new Map<MissionSite, Item>();
  private readonly gemGeo = new THREE.OctahedronGeometry(0.3, 0);
  private readonly beamGeo = new THREE.CylinderGeometry(0.34, 0.34, 3.4, 20, 1, true);
  private readonly ringGeo = new THREE.RingGeometry(0.55, 0.7, 40);
  private readonly proxyGeo = new THREE.CylinderGeometry(0.85, 0.85, 2.6, 10);
  private readonly proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  private time = 0;

  constructor() {
    this.group.name = 'StationMarkers';
  }

  add(site: MissionSite, pos: THREE.Vector3, clickable: boolean) {
    const mk = (opacity: number, side: THREE.Side = THREE.FrontSide) =>
      new THREE.MeshBasicMaterial({
        color: COLORS.ready,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side,
        toneMapped: false,
        fog: false,
      });
    const gemMat = mk(0.95);
    const beamMat = mk(0.32, THREE.DoubleSide);
    const ringMat = mk(0.7, THREE.DoubleSide);
    const root = new THREE.Group();
    root.position.copy(pos);
    const gem = new THREE.Mesh(this.gemGeo, gemMat);
    gem.position.y = 1.9;
    const beam = new THREE.Mesh(this.beamGeo, beamMat);
    beam.position.y = 1.7;
    const ring = new THREE.Mesh(this.ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    for (const m of [gem, beam, ring]) {
      m.renderOrder = 8;
      m.raycast = () => {}; // só o proxy recebe cliques
      root.add(m);
    }
    this.group.add(root);
    if (clickable) {
      const proxy = new THREE.Mesh(this.proxyGeo, this.proxyMat);
      proxy.position.set(pos.x, pos.y + 1.3, pos.z);
      proxy.userData.pick = { kind: 'station', site: site as StationSite };
      proxy.updateMatrixWorld(true);
      this.group.add(proxy);
      this.proxies.push(proxy);
    }
    this.items.set(site, {
      root,
      gem,
      beam,
      ring,
      mats: [gemMat, beamMat, ringMat],
      phase: this.items.size * 1.7,
    });
    root.visible = false;
  }

  has(site: MissionSite) {
    return this.items.has(site);
  }

  /** Move o marcador (o rover pode mudar de lugar). */
  move(site: MissionSite, pos: THREE.Vector3) {
    this.items.get(site)?.root.position.copy(pos);
  }

  set(site: MissionSite, state: MarkerState, enabled: boolean) {
    const it = this.items.get(site);
    if (!it) return;
    const show = enabled && state !== 'hidden';
    it.root.visible = show;
    if (!show) return;
    const color = COLORS[state === 'blocked' ? 'blocked' : 'ready'];
    for (const m of it.mats) m.color.setHex(color);
  }

  update(dt: number) {
    this.time += dt;
    for (const it of this.items.values()) {
      if (!it.root.visible) continue;
      it.gem.rotation.y += dt * 1.6;
      it.gem.position.y = 1.9 + Math.sin(this.time * 2 + it.phase) * 0.08;
      const pulse = 1 + Math.sin(this.time * 2.4 + it.phase) * 0.06;
      it.ring.scale.setScalar(pulse);
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.gemGeo.dispose();
    this.beamGeo.dispose();
    this.ringGeo.dispose();
    this.proxyGeo.dispose();
    this.proxyMat.dispose();
    for (const it of this.items.values()) for (const m of it.mats) m.dispose();
    this.items.clear();
    this.proxies.length = 0;
  }
}
