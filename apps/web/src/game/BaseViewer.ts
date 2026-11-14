import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type BaseId, type BaseInfo, baseModelUrl } from '../lib/bases';
import { type AssetPool, yieldFrame } from './runtime/assets';
import type { GameRuntime } from './runtime/expedition';
import { instanceStatic } from './runtime/instancing';

/** Paleta de Marte: céu e neblina de poeira ocre, sol baixo e quente. */
const SKY = 0x1c0d08; // fundo escuro do tema: a borda do terreno lê como mesa de maquete
const SUN = 0xffe2c4;
/**
 * O kit modular usa tiles de 4 m; o terreno e as bases foram ajustados juntos na escala 0,75,
 * então 1 tile = 3 unidades do mundo.
 */
const SCALE = 0.75;
const TILE = 4 * SCALE;

/** Culturas dos canteiros e o modelo de planta já crescida (plantas.glb). */
const GROWN_CROPS = [
  'PLANTA_Batata_4_Crescida',
  'PLANTA_Alface_4_Colheita',
  'PLANTA_Tomate_5_Colheita',
];

async function shade(root: THREE.Object3D, cast = true, signal?: AbortSignal) {
  const nodes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) nodes.push(o);
  });
  let deadline = performance.now() + 2;
  for (const mesh of nodes) {
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    if (performance.now() >= deadline) {
      await yieldFrame(signal);
      deadline = performance.now() + 2;
    }
  }
}

/**
 * Cena 3D de uma base marciana: terreno, luz, câmera isométrica que o jogador gira, move e aproxima,
 * antena girando e estufas com plantas. Telhados ficam ocultos (vista em corte) e podem ser ligados.
 * Quando o jogo ganhar regras, ela recebe tripulação e instalações.
 */
export class BaseViewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 900);
  private readonly controls: OrbitControls;
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver;
  private readonly roofs: THREE.Object3D[] = [];
  private mixer: THREE.AnimationMixer | null = null;
  private frame = 0;
  private disposed = false;
  /** metade da altura visível (em metros) com zoom 1: calculada pelo tamanho da base */
  private view = 40;
  readonly ready: Promise<void>;

  constructor(
    private container: HTMLElement,
    private readonly info: BaseInfo,
    private readonly runtime: GameRuntime,
    private readonly assets: AssetPool,
  ) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer = runtime.renderer;
    this.scene.background = new THREE.Color(SKY);
    // distância da câmera ao centro ≈ 300; a neblina só encobre o horizonte, não a base
    this.scene.fog = new THREE.Fog(SKY, 330, 560);

    const { bounds: b } = info;
    const spanX = (b.x1 - b.x0) * TILE;
    const spanY = (b.y1 - b.y0) * TILE;
    const radius = Math.hypot(spanX, spanY) / 2 + 12;
    // enquadra a cratera inteira: a base fica pequena no centro, como no cenário original
    this.view = Math.max(80, radius * 2.2);

    this.scene.add(new THREE.HemisphereLight(0xffd9b8, 0x5a2414, 1.3));
    const sun = new THREE.DirectionalLight(SUN, 2.4);
    sun.position.set(-radius * 0.9, radius * 1.3, radius * 0.5);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -radius;
    sc.right = sc.top = radius;
    sc.near = 1;
    sc.far = radius * 4;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    this.scene.add(sun, sun.target);

    // Câmera isométrica clássica: 45° de giro e ~35° de elevação. O jogador pode girar e mover.
    const d = 170;
    this.camera.position.set(d, d * 0.82, d);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minZoom = 0.6;
    this.controls.maxZoom = 6;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.12; // nunca vai abaixo do chão
    this.controls.screenSpacePanning = false;
    this.controls.maxDistance = 600;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.resizeObserver = new ResizeObserver(() => this.resize());

    this.ready = this.load();
  }

  private async load() {
    const { id, bounds: b } = this.info;
    this.urls = [
      baseModelUrl(id as BaseId),
      '/assets/bases/terreno.glb',
      '/assets/bases/plantas.glb',
    ];
    const results = await Promise.allSettled(this.urls.map((url) => this.assets.load(url)));
    if (this.disposed) return;
    const failure = results.find((r) => r.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    const [base, land, plants] = results.map((r) => {
      if (r.status !== 'fulfilled') throw new Error('Missing world asset');
      return { ...r.value, scene: r.value.scene.clone(true) };
    });
    if (!base) throw new Error('Missing base');
    const assemblyStart = performance.now();
    await yieldFrame(this.assets.signal);
    if (this.disposed) return;

    if (land) {
      // o terreno novo já foi modelado no tamanho final (255 m), sem escala

      await shade(land.scene, false, this.assets.signal);
      this.scene.add(land.scene);
    }

    // O modelo vem com origem no canto do kit; centralizamos a base na origem do mundo.
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    const model = base.scene;
    model.position.set(-cx * TILE, 0.01, cy * TILE);
    model.scale.setScalar(SCALE);
    await shade(model, true, this.assets.signal);
    this.scene.add(model);

    // Canteiros: troca pelo modelo da planta já crescida.
    if (plants) {
      const slots: THREE.Object3D[] = [];
      model.traverse((o) => {
        if (/_Batata_\d_[A-Za-z]+_\d+$/.test(o.name)) slots.push(o);
      });
      for (const [i, slot] of slots.entries()) {
        const src = plants.scene.getObjectByName(GROWN_CROPS[i % GROWN_CROPS.length] ?? '');
        if (!src || !slot.parent) continue;
        const plant = src.clone(true);
        plant.position.copy(slot.position);
        plant.quaternion.copy(slot.quaternion);
        plant.scale.copy(slot.scale);
        await shade(plant, true, this.assets.signal);
        slot.parent.add(plant);
        slot.visible = false;
      }
    }

    model.traverse((o) => {
      if (o.name.endsWith('_Telhado')) {
        this.roofs.push(o);
        o.visible = false;
      }
    });

    // Só as animações em laço (antena varrendo o céu); as de porta ficam paradas.
    const loops = base.animations.filter((c) => /^Scan/.test(c.name));
    if (loops.length) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const clip of loops) this.mixer.clipAction(clip).play();
    }
    this.assets.signal.throwIfAborted();
    instanceStatic(model, base.animations);
    this.resize();
    performance.measure('world-assembly', { start: assemblyStart, end: performance.now() });
    await this.runtime.warm(this.scene, this.camera);
  }

  /** Mostra ou esconde os telhados (esconder deixa ver dentro dos cômodos). */
  setRoofs(visible: boolean) {
    for (const r of this.roofs) r.visible = visible;
  }

  private urls: string[] = [];
  prepareGraphics() {
    return this.runtime.warm(this.scene, this.camera);
  }
  get diagnostics() {
    return {
      drawCalls: this.renderer.info.render.calls,
      ...this.renderer.info.memory,
      programs: this.renderer.info.programs?.length ?? 0,
    };
  }
  activate(container: HTMLElement) {
    this.runtime.stop();
    this.container = container;
    container.append(this.renderer.domElement);
    this.renderer.domElement.removeAttribute('aria-hidden');
    this.renderer.domElement.setAttribute('aria-label', `Base marciana ${this.info.name} em 3D`);
    this.renderer.domElement.style.touchAction = 'none';
    this.controls.enabled = true;
    this.resizeObserver.observe(container);
    this.resize();
    this.clock.start();
    this.renderer.render(this.scene, this.camera);
    performance.mark('world-first-frame');
    if (performance.getEntriesByName('world-entry-request').length)
      performance.measure('world-entry', 'world-entry-request', 'world-first-frame');
    this.frame = this.runtime.request(this.tick);
  }
  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    if (this.controls.enabled) this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    const aspect = w / h;
    this.camera.left = -this.view * aspect;
    this.camera.right = this.view * aspect;
    this.camera.top = this.view;
    this.camera.bottom = -this.view;
    this.camera.updateProjectionMatrix();
  }

  private tick = () => {
    if (this.disposed) return;
    this.frame = this.runtime.request(this.tick);
    this.mixer?.update(Math.min(this.clock.getDelta(), 0.05));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      if (o instanceof THREE.DirectionalLight) o.dispose();
    });
    for (const url of this.urls) this.assets.release(url);
    this.scene.clear();
  }
}
