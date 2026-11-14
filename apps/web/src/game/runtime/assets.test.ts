import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetPool } from './assets';

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder() {
      return this;
    }
    async parseAsync() {
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
      return { scene };
    }
  },
}));
afterEach(() => vi.unstubAllGlobals());

describe('AssetPool ownership and scheduling', () => {
  it('deduplicates requests and frees shared geometry only after the last consumer', async () => {
    const fetcher = vi.fn(async () => new Response(new ArrayBuffer(0)));
    vi.stubGlobal('fetch', fetcher);
    const pool = new AssetPool();
    const a = pool.load('/model.glb'),
      b = pool.load('/model.glb');
    expect(a).toBe(b);
    const gltf = await a;
    const geometry = (gltf.scene.children[0] as THREE.Mesh).geometry;
    const disposed = vi.fn();
    geometry.addEventListener('dispose', disposed);
    pool.release('/model.glb');
    await Promise.resolve();
    expect(disposed).not.toHaveBeenCalled();
    pool.release('/model.glb');
    await Promise.resolve();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    pool.dispose();
    pool.dispose();
    await Promise.resolve();
    expect(disposed).toHaveBeenCalledTimes(1);
  });
  it('limits concurrent work and allows retry after releasing a failed request', async () => {
    const complete: (() => void)[] = [];
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) =>
          complete.push(() => resolve(new Response(new ArrayBuffer(0)))),
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    const pool = new AssetPool();
    const requests = ['/a', '/b', '/c'].map((url) => pool.load(url));
    expect(fetcher).toHaveBeenCalledTimes(2);
    complete[0]?.();
    complete[1]?.();
    await Promise.all(requests.slice(0, 2));
    expect(fetcher).toHaveBeenCalledTimes(3);
    complete[2]?.();
    await requests[2];
    pool.dispose();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(new Response(new ArrayBuffer(0))),
    );
    const retryPool = new AssetPool();
    await expect(retryPool.load('/retry')).rejects.toThrow('offline');
    retryPool.release('/retry');
    await expect(retryPool.load('/retry')).resolves.toHaveProperty('scene');
    retryPool.dispose();
  });
});
