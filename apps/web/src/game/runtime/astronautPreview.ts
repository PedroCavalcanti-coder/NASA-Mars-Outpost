import { DEFAULT_SUIT, type SuitConfig } from '@mars/shared';
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {
  ASTRONAUT_MODEL_URL,
  applySuitAppearance,
  meshMaterials,
  prepareModel,
  setFaceExpression,
} from '../astronautModel';
import type { AssetPool } from './assets';

export async function prepareAstronautPreview(pool: AssetPool) {
  const url = ASTRONAUT_MODEL_URL;
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
  scene.background = new THREE.Color(0xc69b7b);
  scene.fog = new THREE.Fog(0xc69b7b, 12, 42);
  // Luz quente do sol e preenchimento frio para destacar o traje.
  const hemi = new THREE.HemisphereLight(0xb4d6ff, 0x442818, 1.8);
  scene.add(hemi);

  const keySun = new THREE.DirectionalLight(0xffdfb9, 3.2);
  keySun.position.set(3, 5, 4);
  keySun.castShadow = true;
  keySun.shadow.mapSize.set(1024, 1024);
  keySun.shadow.camera.left = keySun.shadow.camera.bottom = -4;
  keySun.shadow.camera.right = keySun.shadow.camera.top = 4;
  keySun.shadow.normalBias = 0.025;
  scene.add(keySun);

  const rimLight = new THREE.DirectionalLight(0x78ace1, 2.2);
  rimLight.position.set(-3, 3, -4);
  scene.add(rimLight);

  // Terreno contínuo: o astronauta faz parte da paisagem, sem pedestal.
  const landscape = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0xa85f38, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  ground.receiveShadow = true;
  landscape.add(ground);

  // Geometria compartilhada e distribuição determinística mantêm a prévia leve.
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const rockMaterials = [0x9a5534, 0xb7734c, 0x864b32].map(
    (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }),
  );
  for (let i = 0; i < 65; i++) {
    const angle = i * 2.39996;
    const distance = 2.5 + ((i * 17) % 70) / 5;
    const rock = new THREE.Mesh(rockGeometry, rockMaterials[i % rockMaterials.length]);
    const size = 0.06 + ((i * 7) % 13) / 35;
    rock.position.set(Math.cos(angle) * distance, size * 0.22 - 0.025, Math.sin(angle) * distance);
    rock.scale.set(size * 1.5, size * 0.65, size);
    rock.rotation.set(i * 0.4, i * 1.7, i * 0.2);
    rock.castShadow = rock.receiveShadow = true;
    landscape.add(rock);
  }
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const mountain = new THREE.Mesh(rockGeometry, rockMaterials[i % rockMaterials.length]);
    mountain.position.set(Math.cos(angle) * 27, -0.8, Math.sin(angle) * 27);
    mountain.scale.set(5 + (i % 4), 2 + (i % 3) * 1.2, 5);
    mountain.rotation.y = i * 0.7;
    landscape.add(mountain);
  }
  scene.add(landscape);

  const model = clone(gltf.scene);
  model.scale.setScalar(0.75);
  // materiais próprios, acessórios escondidos e rosto/marcas com texturas clonadas
  const textures = prepareModel(model);
  const materials: THREE.Material[] = [];
  model.traverse((o) => {
    if (o.name.startsWith('tool_')) o.visible = false;
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = o.receiveShadow = true;
    materials.push(...meshMaterials(o));
  });
  // O atlas tem oito expressões; a prévia exibe o sorriso (célula 0).
  setFaceExpression(textures, 0);
  const faceTextures = textures.all;
  // Normaliza o modelo pelos limites reais e apoia as botas no solo.
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
  scene.add(model);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const m of materials) m.dispose();
    for (const texture of faceTextures) texture.dispose();
    ground.geometry.dispose();
    ground.material.dispose();
    rockGeometry.dispose();
    for (const material of rockMaterials) material.dispose();
    keySun.shadow.map?.dispose();
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

/** Cores, acessórios e marcas na prévia: o mesmo caminho do astronauta dentro do jogo. */
export function applySuitColors(root: THREE.Object3D, suit: SuitConfig = DEFAULT_SUIT) {
  applySuitAppearance(root, suit);
}
