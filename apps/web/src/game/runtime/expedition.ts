import * as THREE from 'three';
import {
  BASE_IDS,
  type BaseId,
  type BaseInfo,
  loadBaseInfo,
  pickRandomBase,
} from '../../lib/bases';
import type { BaseViewer } from '../BaseViewer';
import { AssetPool, yieldFrame } from './assets';
import { prepareAstronautPreview } from './astronautPreview';

export class GameRuntime {
  readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  private raf = 0;
  private callback: FrameRequestCallback | null = null;
  private disposed = false;
  private suspended = false;
  private abort = new AbortController();
  profileRevision = 0;
  get paused() {
    return this.suspended;
  }
  set paused(value: boolean) {
    this.suspended = value;
    cancelAnimationFrame(this.raf);
    if (!value && !document.hidden && this.callback) this.raf = requestAnimationFrame(this.tick);
  }
  constructor() {
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.addEventListener('visibilitychange', this.visibility);
  }
  request = (callback: FrameRequestCallback) => {
    this.callback = callback;
    cancelAnimationFrame(this.raf);
    if (!document.hidden) this.raf = requestAnimationFrame(this.tick);
    return this.raf;
  };
  private tick = (now: number) => {
    if (this.paused || this.disposed) return;
    this.callback?.(now);
  };
  private visibility = () => {
    cancelAnimationFrame(this.raf);
    if (!document.hidden && !this.paused && this.callback)
      this.raf = requestAnimationFrame(this.tick);
  };
  stop() {
    cancelAnimationFrame(this.raf);
    this.callback = null;
  }
  async warm(scene: THREE.Scene, camera: THREE.Camera): Promise<void> {
    await yieldFrame(this.abort.signal);
    if (this.disposed) return;
    const revision = this.profileRevision;
    await this.renderer.compileAsync(scene, camera);
    await yieldFrame(this.abort.signal);
    if (revision !== this.profileRevision) return this.warm(scene, camera);
    if (this.disposed) return;
    const start = performance.now();
    const target = new THREE.WebGLRenderTarget(128, 128);
    const previous = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(target);
      this.renderer.render(scene, camera);
      // A second pass also warms depth variants after the light/shadow state is populated.
      this.renderer.render(scene, camera);
    } finally {
      this.renderer.setRenderTarget(previous);
      target.dispose();
      performance.measure('world-gpu-upload', { start, end: performance.now() });
    }
    // The offscreen pass initializes shadow maps; compile final screen variants afterwards.
    await this.renderer.compileAsync(scene, camera);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.stop();
    document.removeEventListener('visibilitychange', this.visibility);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

export class Expedition {
  readonly runtime = new GameRuntime();
  readonly assets = new AssetPool();
  viewer: BaseViewer | null = null;
  info: BaseInfo | null = null;
  ready = false;
  entered = false;
  error: string | null = null;
  private disposed = false;
  private attempt = 0;
  private host = document.createElement('div');
  preview: Awaited<ReturnType<typeof prepareAstronautPreview>> | null = null;
  private preparing: Promise<void> | null = null;
  constructor(readonly id: BaseId) {
    this.host.style.cssText =
      'position:fixed;inset:0;visibility:hidden;pointer-events:none;z-index:-1';
    this.host.setAttribute('aria-hidden', 'true');
    document.body.append(this.host);
    this.runtime.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.runtime.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored);
  }
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.ready = this.entered = false;
    this.runtime.stop();
    this.error = 'A conexão gráfica foi interrompida. Aguardando recuperação do dispositivo.';
    emit();
  };
  private contextRestored = () => {
    this.viewer?.dispose();
    this.viewer = null;
    this.preview?.dispose();
    this.preview = null;
    void this.prepare();
  };
  prepare() {
    if (this.ready) return Promise.resolve();
    if (!this.preparing)
      this.preparing = this.prepareAttempt().finally(() => {
        this.preparing = null;
      });
    return this.preparing;
  }
  private async prepareAttempt() {
    const attempt = ++this.attempt;
    this.error = null;
    emit();
    performance.mark('world-prepare-start');
    try {
      await yieldFrame(this.assets.signal);
      const [info, { BaseViewer }] = await Promise.all([
        loadBaseInfo(this.id, AbortSignal.any([this.assets.signal, AbortSignal.timeout(60_000)])),
        import('../BaseViewer'),
      ]);
      if (this.disposed || attempt !== this.attempt) return;
      this.info = info;
      this.viewer = new BaseViewer(this.host, info, this.runtime, this.assets);
      await this.viewer.ready;
      if (this.disposed || attempt !== this.attempt) return;
      this.preview = await prepareAstronautPreview(this.assets);
      if (this.disposed || attempt !== this.attempt) {
        this.preview.dispose();
        this.preview = null;
        return;
      }
      this.ready = true;
      performance.mark('world-ready');
      performance.measure('world-prepare', 'world-prepare-start', 'world-ready');
      emit();
    } catch (e) {
      if (this.disposed || attempt !== this.attempt) return;
      console.error('World preparation failed', e);
      this.viewer?.dispose();
      this.viewer = null;
      this.error = 'Não foi possível preparar a base. Verifique sua conexão e tente novamente.';
      emit();
    }
  }
  refreshGraphics() {
    if (!this.ready || !this.viewer) return;
    this.ready = false;
    emit();
    void this.viewer
      .prepareGraphics()
      .then(() => {
        if (!this.disposed) {
          this.ready = true;
          emit();
        }
      })
      .catch((error) => {
        if (!this.disposed) {
          console.error(error);
          this.error = 'Não foi possível preparar os gráficos. Tente novamente.';
          emit();
        }
      });
  }
  restart() {
    this.runtime.stop();
    this.ready = this.entered = false;
    this.viewer?.dispose();
    this.viewer = null;
    this.preview?.dispose();
    this.preview = null;
    void this.prepare();
  }
  enter() {
    if (!this.ready || this.disposed) return;
    performance.mark('world-entry-request');
    this.entered = true;
    emit();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.attempt++;
    this.runtime.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.runtime.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.contextRestored,
    );
    this.viewer?.dispose();
    this.preview?.dispose();
    this.assets.dispose();
    this.runtime.dispose();
    this.host.remove();
  }
}
let current: Expedition | null = null;
let leases = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let version = 0;
const listeners = new Set<() => void>();
function emit() {
  version++;
  for (const listener of listeners) listener();
}
export const subscribeExpedition = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const expeditionSnapshot = () => version;
export const peekExpedition = () => current;
export function retainExpedition() {
  clearTimeout(timer);
  if (!current) {
    let id = pickRandomBase();
    try {
      const saved = sessionStorage.getItem('mo_base');
      if (BASE_IDS.includes(saved as BaseId)) id = saved as BaseId;
      sessionStorage.setItem('mo_base', id);
    } catch {
      /* Private browsing. */
    }
    current = new Expedition(id);
    void current.prepare();
  }
  leases++;
  const session = current;
  let released = false;
  return {
    session,
    release: () => {
      if (released) return;
      released = true;
      leases--;
      if (!leases)
        timer = setTimeout(() => {
          session.dispose();
          if (current === session) current = null;
          emit();
        }, 0);
    },
  };
}
