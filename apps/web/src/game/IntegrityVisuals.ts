import { type IntegrityState, REPAIR_ANCHORS } from '@mars/shared';
import * as THREE from 'three';
import { useGameSettings } from '../lib/gameSettings';
import { type BaseGrid, FLOOR_Y } from './BaseGrid';
export interface RepairAnchor {
  point: THREE.Vector3;
  approach: THREE.Vector3;
  normal: THREE.Vector3;
}
/** Raycast the actual shell, rather than guessing where the wall should be. */
export class IntegrityVisuals {
  readonly anchors: RepairAnchor[] = [];
  readonly proxies: THREE.Object3D[] = [];
  private cracks = new Map<number, THREE.Group>();
  private fx = new THREE.Group();
  private patches = new Map<number, { group: THREE.Group; sol: number }>();
  private currentSol = 1;
  private cargoLanding = new THREE.Vector3();
  private eventSeq = -1;
  private eventApplied = false;
  private capsule: THREE.Mesh;
  private meteors: THREE.Mesh[] = [];
  private audio: AudioContext | null = null;
  private sounds: HTMLAudioElement[] = [];
  private leakGain: GainNode | null = null;
  private leakNoise: AudioBufferSourceNode | null = null;
  private breeze: THREE.Mesh[] = [];
  private ready = false;
  constructor(
    private scene: THREE.Scene,
    model: THREE.Object3D,
    grid: BaseGrid,
    generate = false,
  ) {
    const shells: THREE.Object3D[] = [];
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && /^(COMODO|CORREDOR)_/.test(o.name)) shells.push(o);
    });
    if (generate)
      for (let i = 0; i < 6; i++) {
        let found: RepairAnchor | undefined;
        for (let attempt = 0; attempt < grid.layout.rooms.length * 8 && !found; attempt++) {
          const room = grid.layout.rooms[(i + Math.floor(attempt / 8)) % grid.layout.rooms.length]!;
          const w = grid.tileToWorld(
            room.tile[0] + (room.size[0] - 1) / 2,
            room.tile[1] + (room.size[1] - 1) / 2,
          );
          const center = new THREE.Vector3(w.wx, 1.4, w.wz);
          const angle = ((i + attempt) * Math.PI) / 4;
          const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          const materials = new Map<THREE.Material, THREE.Side>();
          for (const o of shells) {
            const m = (o as THREE.Mesh).material;
            for (const mat of Array.isArray(m) ? m : [m]) {
              materials.set(mat, mat.side);
              mat.side = THREE.DoubleSide;
            }
          }
          const ray = new THREE.Raycaster(center, dir, 0, 30);
          const hit = ray.intersectObjects(shells, true)[0];
          for (const [mat, side] of materials) mat.side = side;
          if (!hit) continue;
          const approach = grid.nearestWalkablePoint(
            hit.point.x - dir.x * 1.2,
            hit.point.z - dir.z * 1.2,
            3,
            'foot',
          );
          if (
            !approach ||
            !grid.isInsideBase(approach.x, approach.z) ||
            this.anchors.some((a) => a.point.distanceTo(hit.point) < 1.5)
          )
            continue;
          approach.y = FLOOR_Y;
          found = {
            point: hit.point.clone().addScaledVector(dir, -0.06),
            approach,
            normal: dir.clone().negate(),
          };
        }
        if (found) this.anchors.push(found);
      }
    if (!generate) {
      const anchors = REPAIR_ANCHORS[grid.layout.id as keyof typeof REPAIR_ANCHORS];
      for (const a of anchors ?? []) {
        this.anchors.push({
          point: new THREE.Vector3(...a.point),
          approach: new THREE.Vector3(...a.approach),
          normal: new THREE.Vector3(...a.normal),
        });
      }
    }
    this.cargoLanding.set(
      grid.layout.pad[0] * 0.75 - grid.cx * 3 + 4,
      0.8,
      -grid.layout.pad[1] * 0.75 + grid.cy * 3,
    );
    this.capsule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.65, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9d5cf, roughness: 0.7 }),
    );
    this.capsule.visible = false;
    this.fx.add(this.capsule);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 3, 4),
        new THREE.MeshBasicMaterial({ color: 0xffd9a3 }),
      );
      m.rotation.z = -0.7;
      m.visible = false;
      this.fx.add(m);
      this.meteors.push(m);
    }
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(2 + i * 0.4, 0.035, 3, 24, Math.PI * 1.3),
        new THREE.MeshBasicMaterial({
          color: 0xe7cca1,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        }),
      );
      m.rotation.x = Math.PI / 2;
      m.visible = false;
      this.fx.add(m);
      this.breeze.push(m);
    }
    scene.add(this.fx);
  }
  sync(s: IntegrityState) {
    for (const [id, g] of this.cracks)
      if (!s.fractures.some((f) => f.id === id)) {
        g.children.forEach((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        g.clear();
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 1.1, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x9aafb4, roughness: 0.7 }),
        );
        g.add(plate);
        this.patches.set(id, { group: g, sol: this.currentSol });
        this.cracks.delete(id);
      }
    this.proxies.length = 0;
    for (const f of s.fractures) {
      const a = this.anchors[f.anchor];
      if (!a) continue;
      let g = this.cracks.get(f.id);
      if (!g) {
        g = new THREE.Group();
        g.position.copy(a.point);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.normal);
        const back = new THREE.Mesh(
          new THREE.PlaneGeometry(0.9, 1.1),
          new THREE.MeshBasicMaterial({ color: 0x20394b, side: THREE.DoubleSide }),
        );
        back.userData.pick = { kind: 'repair', id: f.id };
        g.add(back);
        for (let n = 0; n < 5; n++) {
          const m = new THREE.Mesh(
            new THREE.PlaneGeometry(0.065, 0.28),
            new THREE.MeshBasicMaterial({ color: 0x9ce8ee, side: THREE.DoubleSide }),
          );
          m.position.set(n % 2 ? -0.1 : 0.1, 0.4 - n * 0.2, 0.01);
          m.rotation.z = n % 2 ? 0.65 : -0.65;
          g.add(m);
        }
        for (let n = 0; n < 5; n++) {
          const air = new THREE.Mesh(
            new THREE.PlaneGeometry(0.025, 0.22),
            new THREE.MeshBasicMaterial({
              color: 0xc5f6fa,
              transparent: true,
              opacity: 0.5,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          );
          air.name = 'leak';
          air.userData.isParticle = true;
          g.add(air);
        }
        this.scene.add(g);
        this.cracks.set(f.id, g);
      }
      g.scale.setScalar(0.65 + f.damage / 60);
      g.userData.damage = f.damage;
      this.proxies.push(g);
    }
    if (this.ready && s.event && s.event.seq !== this.eventSeq) {
      this.eventSeq = s.event.seq;
      this.eventApplied = false;
    }
    if (this.ready && s.event?.applied && !this.eventApplied) {
      this.eventApplied = true;
      this.tone(s.event.id === 'supply_drop' ? 300 : 130);
    }
    if (!this.ready) {
      this.eventSeq = s.event?.seq ?? -1;
      this.eventApplied = s.event?.applied ?? false;
    }
    this.ready = true;
  }
  private tone(frequency: number) {
    const a = useGameSettings.getState().audio;
    if (a.muted) return;
    try {
      this.audio ??= new AudioContext();
      const o = this.audio.createOscillator(),
        g = this.audio.createGain();
      o.type = 'triangle';
      o.frequency.value = frequency;
      g.gain.setValueAtTime(
        ((a.masterVolume * a.sfxVolume) / 10000) * 0.06,
        this.audio.currentTime,
      );
      g.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + 0.18);
      o.connect(g);
      g.connect(this.audio.destination);
      o.start();
      o.stop(this.audio.currentTime + 0.2);
    } catch {
      /* audio is optional */
    }
  }
  update(t: number, s: IntegrityState | undefined, sol: number, reduced: boolean) {
    this.currentSol = sol;
    for (const [id, p] of this.patches) {
      if (p.sol < sol) {
        p.group.removeFromParent();
        p.group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        this.patches.delete(id);
      }
    }
    if (!s) return;
    for (const [id, g] of this.cracks) {
      const f = s.fractures.find((f) => f.id === id);
      if (f) {
        let n = 0;
        g.children
          .filter((o) => o.name === 'leak')
          .forEach((o) => {
            const phase = (t * 0.9 + n++ * 0.2) % 1;
            o.position.set(n % 2 ? -0.1 : 0.1, 0.3 - n * 0.12, reduced ? 0.03 : 0.04 + phase * 0.8);
            (o as THREE.Mesh).scale.setScalar(reduced ? 0.5 : 1 - phase);
          });
      }
    }
    const a = useGameSettings.getState().audio;
    if (s.fractures.length && !this.leakGain) {
      try {
        this.audio ??= new AudioContext();
        const buffer = this.audio.createBuffer(1, this.audio.sampleRate, this.audio.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        this.leakNoise = this.audio.createBufferSource();
        this.leakNoise.buffer = buffer;
        this.leakNoise.loop = true;
        const filter = this.audio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
        this.leakGain = this.audio.createGain();
        this.leakNoise.connect(filter);
        filter.connect(this.leakGain);
        this.leakGain.connect(this.audio.destination);
        this.leakGain.gain.value = 0;
        this.leakNoise.start();
      } catch {
        /* optional sound */
      }
    }
    if (this.leakGain)
      this.leakGain.gain.value =
        a.muted || s.stopped
          ? 0
          : (Math.min(0.025, s.fractures.length * 0.008) * a.masterVolume * a.sfxVolume) / 10000;
    const e = s.event;
    const age = e ? t - e.start : 0;
    this.breeze.forEach((m, i) => {
      m.visible = e?.id === 'cleaning_wind';
      if (m.visible) {
        m.position.set(0, 0.4 + i * 0.2, 0);
        m.rotation.z = reduced ? 0 : t * 0.8 + i;
      }
    });
    this.capsule.visible = e?.id === 'supply_drop';
    if (this.capsule.visible)
      this.capsule.position.set(this.cargoLanding.x, Math.max(0.8, 18 - age), this.cargoLanding.z);
    this.meteors.forEach((m, i) => {
      m.visible = !reduced && e?.id === 'micrometeorite' && age > 12 && age < 16;
      if (m.visible) {
        const phase = (age - 12 + i * 0.16) % 1;
        m.position.set(8 - phase * 8 + i, 15 - phase * 14, 3 + i);
      }
    });
  }

  dispose() {
    for (const g of this.cracks.values()) {
      g.removeFromParent();
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).geometry.dispose();
          ((o as THREE.Mesh).material as THREE.Material).dispose();
        }
      });
    }
    this.fx.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    for (const p of this.patches.values()) {
      p.group.removeFromParent();
      p.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    this.leakNoise?.stop();
    void this.audio?.close();
    for (const sound of this.sounds) sound.pause();
    this.fx.removeFromParent();
  }
}
