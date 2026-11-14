// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BaseInfo } from '../lib/bases';
import { BaseViewer } from './BaseViewer';
import type { AssetPool } from './runtime/assets';
import type { GameRuntime } from './runtime/expedition';

vi.mock('./runtime/assets', () => ({ yieldFrame: async () => {} }));
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    target = new THREE.Vector3();
    update() {}
    dispose() {}
  },
}));
const info: BaseInfo = {
  id: 'jezero',
  name: 'Jezero',
  description: 'Base de teste',
  bounds: { x0: 0, y0: 0, x1: 4, y1: 4 },
};
beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false })));
afterEach(() => vi.unstubAllGlobals());

it.each([false, true])(
  'disposes owned shadow targets exactly once (allocated: %s), preserving the shared renderer',
  async (allocated) => {
    const shadowDisposals = [vi.fn(), vi.fn()];
    const rendererDispose = vi.fn();
    const runtime = {
      renderer: { domElement: document.createElement('canvas'), dispose: rendererDispose },
      warm: vi.fn(async (scene: THREE.Scene) => {
        if (!allocated) return;
        scene.traverse((object) => {
          if (!(object instanceof THREE.DirectionalLight)) return;
          object.shadow.map = new THREE.WebGLRenderTarget(8, 8);
          object.shadow.mapPass = new THREE.WebGLRenderTarget(8, 8);
          object.shadow.map.addEventListener('dispose', shadowDisposals[0] ?? vi.fn());
          object.shadow.mapPass.addEventListener('dispose', shadowDisposals[1] ?? vi.fn());
        });
      }),
    } as unknown as GameRuntime;
    const release = vi.fn();
    const pool = {
      signal: new AbortController().signal,
      load: vi.fn(async () => ({ scene: new THREE.Scene(), animations: [] })),
      release,
    } as unknown as AssetPool;
    const viewer = new BaseViewer(document.createElement('div'), info, runtime, pool);
    await viewer.ready;
    viewer.dispose();
    viewer.dispose();
    for (const disposed of shadowDisposals)
      expect(disposed).toHaveBeenCalledTimes(allocated ? 1 : 0);
    expect(release).toHaveBeenCalledTimes(3);
    expect(rendererDispose).not.toHaveBeenCalled();
  },
);

it('does not allocate shadow maps if disposed while models are still loading', async () => {
  type Model = { scene: THREE.Scene; animations: never[] };
  let resolveLoad: (model: Model) => void = () => {};
  const loaded = new Promise<Model>((resolve) => {
    resolveLoad = resolve;
  });
  const warm = vi.fn();
  const release = vi.fn();
  const runtime = {
    renderer: { domElement: document.createElement('canvas') },
    warm,
  } as unknown as GameRuntime;
  const pool = {
    signal: new AbortController().signal,
    load: () => loaded,
    release,
  } as unknown as AssetPool;
  const viewer = new BaseViewer(document.createElement('div'), info, runtime, pool);
  viewer.dispose();
  resolveLoad({ scene: new THREE.Scene(), animations: [] });
  await viewer.ready;
  viewer.dispose();
  expect(warm).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledTimes(3);
});
