import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { L } from '../../../lib/i18n';

/** Distância do reconhecimento (m): a corrida acaba ao chegar aqui. */
export const RUN_METERS = 300;
const SPEED_START = 11;
const SPEED_END = 18;
const MAX_HITS = 3;
/** meia largura da pista (m) e velocidade lateral do rover (m/s) */
const HALF_ROAD = 4.6;
const STEER = 9;

export interface RunResult {
  /** 0..1: pontos coletados e poucas batidas */
  quality: number;
  samples: number;
  hits: number;
  /** chegou aos 300 m (sem 3 batidas) */
  completed: boolean;
  meters: number;
}

type Kind = 'rock' | 'hole' | 'point';
interface Thing {
  kind: Kind;
  mesh: THREE.Object3D;
  /** raio de colisão (m) */
  r: number;
  done?: boolean;
}

function marsTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b5653d';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = 140 + Math.random() * 60;
    g.fillStyle = `rgba(${v},${v * 0.55},${v * 0.35},0.35)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  // marcas de pneu da trilha
  g.fillStyle = 'rgba(80,35,20,0.25)';
  g.fillRect(30, 0, 6, 128);
  g.fillRect(92, 0, 6, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 40);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildRover() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2d3640, roughness: 0.9 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xf7a440, emissive: 0x552200 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.6), white);
  body.position.y = 0.75;
  g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 1), white);
  cab.position.set(0, 1.25, 0.3);
  g.add(cab);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9), dark);
  mast.position.set(0.55, 1.6, -0.8);
  g.add(mast);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12), orange);
  lamp.position.set(0.55, 2.05, -0.8);
  g.add(lamp);
  for (const x of [-1, 1])
    for (const z of [-0.9, 0.9]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 14), dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(x * 0.95, 0.42, z);
      w.userData.wheel = true;
      g.add(w);
    }
  return g;
}

/**
 * Reconhecimento em 3D: o rover anda sozinho para a frente e você o dirige para os lados (setas,
 * A/D ou arrastando o dedo) desviando de pedras e buracos e pegando os pontos amarelos que
 * flutuam acima do chão. A corrida acaba aos 300 m (ou com 3 batidas).
 */
export function RoverRunGame({ onEnd }: { onEnd: (r: RunResult) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const steer = useRef(0);
  const [hud, setHud] = useState({ m: 0, samples: 0, hits: 0 });
  const ended = useRef(false);

  // teclado: segurar para virar
  useEffect(() => {
    const keys = new Set<string>();
    const update = () => {
      steer.current =
        (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    };
    const dir = (e: KeyboardEvent) =>
      ['ArrowLeft', 'a', 'A'].includes(e.key) ? 'left' : ['ArrowRight', 'd', 'D'].includes(e.key) ? 'right' : null;
    const down = (e: KeyboardEvent) => {
      const d = dir(e);
      if (!d) return;
      e.preventDefault();
      keys.add(d);
      update();
    };
    const up = (e: KeyboardEvent) => {
      const d = dir(e);
      if (!d) return;
      keys.delete(d);
      update();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    renderer.domElement.className = 'sci-canvas';
    const scene = new THREE.Scene();
    const fogColor = new THREE.Color(0xe2b48c);
    scene.background = fogColor;
    // névoa de poeira: o que está longe aparece aos poucos
    scene.fog = new THREE.Fog(fogColor, 14, 70);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xffe6cc, 0x6b3020, 1.4));
    const sun = new THREE.DirectionalLight(0xfff1dd, 1.6);
    sun.position.set(-6, 12, 4);
    scene.add(sun);

    const groundTex = marsTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 400),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -150;
    scene.add(ground);
    // bordas da trilha
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x7b3f26 });
    for (const x of [-HALF_ROAD - 0.9, HALF_ROAD + 0.9]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 400), edgeMat);
      edge.position.set(x, 0.17, -150);
      scene.add(edge);
    }

    const rover = buildRover();
    scene.add(rover);

    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7b4a35, flatShading: true, roughness: 1 });
    const holeGeo = new THREE.CircleGeometry(1.25, 24);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x2a120b });
    const rimGeo = new THREE.RingGeometry(1.25, 1.6, 24);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9805a });
    const pointGeo = new THREE.OctahedronGeometry(0.45);
    const pointMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffaa00, emissiveIntensity: 0.9 });

    const things: Thing[] = [];
    const spawn = (z: number) => {
      const lanes = [-3, 0, 3].sort(() => Math.random() - 0.5);
      // sempre sobra um caminho livre
      const blocked = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < blocked; i++) {
        const x = lanes[i]! + (Math.random() - 0.5) * 1.2;
        if (Math.random() < 0.5) {
          const m = new THREE.Mesh(rockGeo, rockMat);
          const s = 0.7 + Math.random() * 0.5;
          m.scale.set(s, s * 0.8, s);
          m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
          m.position.set(x, s * 0.6, z);
          scene.add(m);
          things.push({ kind: 'rock', mesh: m, r: s + 0.55 });
        } else {
          const g = new THREE.Group();
          const hole = new THREE.Mesh(holeGeo, holeMat);
          const rim = new THREE.Mesh(rimGeo, rimMat);
          hole.rotation.x = rim.rotation.x = -Math.PI / 2;
          hole.position.y = 0.02;
          rim.position.y = 0.03;
          g.add(hole, rim);
          g.position.set(x, 0, z);
          scene.add(g);
          things.push({ kind: 'hole', mesh: g, r: 1.6 });
        }
      }
      if (Math.random() < 0.7) {
        const m = new THREE.Mesh(pointGeo, pointMat);
        m.position.set(lanes[2]!, 1.2, z);
        scene.add(m);
        things.push({ kind: 'point', mesh: m, r: 1.1 });
      }
    };

    let meters = 0;
    let carX = 0;
    let samples = 0;
    let hits = 0;
    let invulnerable = 0;
    let shake = 0;
    let nextSpawn = 0;
    let last = performance.now();
    let raf = 0;
    let lastHud = 0;

    const resize = () => {
      const w = el.clientWidth || 360;
      const h = el.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const finish = (completed: boolean) => {
      if (ended.current) return;
      ended.current = true;
      const quality = Math.max(0, Math.min(1, samples / 14 - hits * 0.1 + (completed ? 0.2 : 0)));
      onEnd({ quality, samples, hits, completed, meters: Math.round(meters) });
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const progress = Math.min(1, meters / RUN_METERS);
      const speed = SPEED_START + (SPEED_END - SPEED_START) * progress;
      meters += speed * dt;
      carX = THREE.MathUtils.clamp(carX + steer.current * STEER * dt, -HALF_ROAD + 1, HALF_ROAD - 1);
      rover.position.x = carX;
      rover.rotation.y = -steer.current * 0.18;
      rover.rotation.z = steer.current * 0.06;
      for (const w of rover.children) if (w.userData.wheel) w.rotation.x -= speed * dt * 2.4;
      groundTex.offset.y += (speed * dt) / 10;

      // novos obstáculos a cada ~9 m, aparecendo dentro da névoa
      nextSpawn -= speed * dt;
      if (nextSpawn <= 0 && meters < RUN_METERS - 20) {
        spawn(-75);
        nextSpawn = 8 + Math.random() * 4;
      }
      invulnerable = Math.max(0, invulnerable - dt);
      for (const t of things) {
        t.mesh.position.z += speed * dt;
        if (t.kind === 'point') {
          t.mesh.rotation.y += dt * 3;
          t.mesh.position.y = 1.2 + Math.sin(now / 250 + t.mesh.position.x) * 0.25;
        }
        if (t.done || Math.abs(t.mesh.position.z) > 1.4) continue;
        if (Math.abs(t.mesh.position.x - carX) > t.r) continue;
        if (t.kind === 'point') {
          t.done = true;
          t.mesh.visible = false;
          samples++;
        } else if (!invulnerable) {
          t.done = true;
          hits++;
          invulnerable = 1;
          shake = 0.4;
        }
      }
      for (let i = things.length - 1; i >= 0; i--) {
        const t = things[i]!;
        if (t.mesh.position.z > 10) {
          scene.remove(t.mesh);
          things.splice(i, 1);
        }
      }
      shake = Math.max(0, shake - dt);
      const jitter = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      camera.position.set(carX * 0.55 + jitter, 3.4, 7);
      camera.lookAt(carX * 0.6, 0.6, -10);
      // o rover pisca enquanto está protegido depois de uma batida
      rover.visible = invulnerable <= 0 || Math.floor(now / 90) % 2 === 0;
      renderer.render(scene, camera);

      if (now - lastHud > 80) {
        lastHud = now;
        setHud({ m: meters, samples, hits });
      }
      if (hits >= MAX_HITS) return finish(false);
      if (meters >= RUN_METERS) return finish(true);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      groundTex.dispose();
      for (const geo of [rockGeo, holeGeo, rimGeo, pointGeo]) geo.dispose();
      for (const mat of [rockMat, holeMat, rimMat, pointMat, edgeMat]) mat.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      renderer.domElement.remove();
    };
  }, [onEnd]);

  // toque: segurar no lado esquerdo/direito ou arrastar
  const touchX = useRef<number | null>(null);
  return (
    <>
      <div className="sci-row">
        <span>
          🏁 {Math.floor(hud.m)} / {RUN_METERS} m
        </span>
        <span>
          ⭐ {hud.samples} pontos · 💥 {hud.hits}/{MAX_HITS}
        </span>
      </div>
      <div
        ref={host}
        className="sci-stage"
        style={{ height: 'min(56vh, 360px)' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          touchX.current = e.clientX;
          const r = e.currentTarget.getBoundingClientRect();
          steer.current = e.clientX < r.left + r.width / 2 ? -1 : 1;
        }}
        onPointerMove={(e) => {
          if (touchX.current === null) return;
          const dx = e.clientX - touchX.current;
          if (Math.abs(dx) > 12) steer.current = dx < 0 ? -1 : 1;
        }}
        onPointerUp={() => {
          touchX.current = null;
          steer.current = 0;
        }}
        onPointerCancel={() => {
          touchX.current = null;
          steer.current = 0;
        }}
      />
      <p className="msn-mg__hint">{L('⬅️ ➡️ Segure as setas (ou A/D), ou segure o dedo num lado da tela para virar.', '⬅️ ➡️ Hold the arrow keys (or A/D), or hold your finger on one side of the screen to steer.')}</p>
    </>
  );
}
