import { DEFAULT_SUIT, SUIT_COLORS, SUIT_PARTS, type SuitConfig } from '@mars/shared';
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { AssetPool } from './assets';

export async function prepareAstronautPreview(pool: AssetPool) {
  const url = '/assets/modelos/astronaut.glb';
  const gltf = await pool.load(url).catch((error) => {
    pool.release(url);
    throw error;
  });
  pool.signal.throwIfAborted();
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(320, 300, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  const camera = new THREE.PerspectiveCamera(38, 320 / 300, 0.1, 50);
  camera.position.set(2.4, 1.6, 3.2);
  camera.lookAt(0, 0.85, 0);
  // Iluminação cósmica suave
  const hemi = new THREE.HemisphereLight(0xb4d6ff, 0x442818, 1.8);
  scene.add(hemi);

  const keySun = new THREE.DirectionalLight(0xffdfb9, 3.2);
  keySun.position.set(3, 5, 4);
  keySun.castShadow = true;
  scene.add(keySun);

  const rimLight = new THREE.DirectionalLight(0x78ace1, 2.2);
  rimLight.position.set(-3, 3, -4);
  scene.add(rimLight);

  // Plataforma da maquete
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.95, 0.08, 24),
    new THREE.MeshStandardMaterial({
      color: 0x182c54,
      roughness: 0.8,
      metalness: 0.2,
    }),
  );
  pad.position.y = -0.04;
  pad.receiveShadow = true;
  scene.add(pad);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.98, 1.05, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffb511,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);

  const model = clone(gltf.scene);
  const materials: THREE.Material[] = [];
  model.scale.setScalar(0.75);
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = o.receiveShadow = true;
    if (Array.isArray(o.material)) {
      o.material = o.material.map((m) => m.clone());
      materials.push(...o.material);
    } else {
      o.material = o.material.clone();
      materials.push(o.material);
    }
  });
  scene.add(model);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const m of materials) m.dispose();
    pad.geometry.dispose();
    pad.material.dispose();
    ring.geometry.dispose();
    ring.material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    pool.release(url);
  };
  try {
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);
  } catch (error) {
    dispose();
    throw error;
  }
  return { scene, renderer, camera, model, dispose };
}

export function applySuitColors(root: THREE.Object3D, suit: SuitConfig = DEFAULT_SUIT) {
  for (const part of SUIT_PARTS) {
    const node = root.getObjectByName(`color_${part}`);
    node?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          (m as THREE.MeshStandardMaterial).color.set(SUIT_COLORS[suit[part]].hex);
        }
      }
    });
  }
}
