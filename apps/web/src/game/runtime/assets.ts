import * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { type GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function disposeObjects(roots: THREE.Object3D[]) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  for (const root of roots)
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        for (const value of Object.values(m))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  const images = new Set<ImageBitmap>();
  for (const t of textures) {
    if (typeof ImageBitmap !== 'undefined' && t.image instanceof ImageBitmap) images.add(t.image);
    t.dispose();
  }
  for (const i of images) i.close();
}

/** Bounded, reference-counted cache. Scenes are cloned by consumers; GPU assets stay shared. */
let livePools = 0;

export class AssetPool {
  private disposed = false;
  private entries = new Map<string, { refs: number; promise: Promise<GLTF> }>();
  private abort = new AbortController();
  private running = 0;
  private queue: (() => void)[] = [];
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  constructor() {
    livePools++;
    // biome-ignore lint/correctness/useHookAtTopLevel: Meshopt API, not a React hook.
    if (typeof Worker !== 'undefined') MeshoptDecoder.useWorkers(1);
  }
  get signal() {
    return this.abort.signal;
  }
  load(url: string): Promise<GLTF> {
    if (this.disposed) return Promise.reject(new DOMException('Disposed asset pool', 'AbortError'));
    const cached = this.entries.get(url);
    if (cached) {
      cached.refs++;
      return cached.promise;
    }
    const entry = { refs: 1, promise: this.fetch(url) };
    this.entries.set(url, entry);
    return entry.promise;
  }
  release(url: string) {
    const entry = this.entries.get(url);
    if (!entry || --entry.refs > 0) return;
    this.entries.delete(url);
    void entry.promise.then(
      (gltf) => disposeObjects([gltf.scene]),
      () => {},
    );
  }
  private async fetch(url: string) {
    if (this.running >= 2) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running++;
    try {
      this.abort.signal.throwIfAborted();
      const start = performance.now();
      const response = await fetch(url, {
        signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(60_000)]),
      });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const downloaded = performance.now();
      performance.measure(`asset-download:${url}`, { start, end: downloaded });
      const gltf = await this.loader.parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1));
      performance.measure(`asset-decode:${url}`, { start: downloaded, end: performance.now() });
      return gltf;
    } finally {
      this.running--;
      this.queue.shift()?.();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    livePools--;
    this.abort.abort();
    const pending = [...this.entries.values()].map((entry) => entry.promise);
    for (const [url, entry] of this.entries) {
      entry.refs = 1;
      this.release(url);
    }
    void Promise.allSettled(pending).then(() => {
      // biome-ignore lint/correctness/useHookAtTopLevel: Meshopt API, not a React hook.
      if (!livePools && typeof Worker !== 'undefined') MeshoptDecoder.useWorkers(0);
    });
  }
}

/** Yield between controllable assembly batches, including on browsers without scheduler.yield. */
export async function yieldFrame(signal?: AbortSignal) {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    let frame = 0;
    const cleanup = () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visible);
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(signal?.reason);
    };
    const visible = () => {
      if (!document.hidden)
        frame = requestAnimationFrame(() => {
          cleanup();
          resolve();
        });
    };
    signal?.addEventListener('abort', abort, { once: true });
    document.addEventListener('visibilitychange', visible);
    visible();
  });
}
