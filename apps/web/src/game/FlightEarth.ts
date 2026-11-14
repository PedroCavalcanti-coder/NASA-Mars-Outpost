import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createFlightEarth() {
  const earth = new THREE.Group();
  let disposed = false;
  const release = (model: THREE.Object3D) => {
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
  };
  // Preload during the launch-pad scene so the model is ready for the space shot.
  new GLTFLoader().load(
    '/assets/models/low_poly_planet_earth.glb',
    (gltf) => {
      if (disposed) {
        release(gltf.scene);
        return;
      }
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 16 / Math.max(size.x, size.y, size.z);
      gltf.scene.position.copy(center).multiplyScalar(-scale);
      gltf.scene.scale.setScalar(scale);
      earth.add(gltf.scene);
      earth.userData.loaded = true;
    },
    undefined,
    (error) => console.error('Could not load Earth model', error),
  );
  return {
    earth,
    dispose() {
      disposed = true;
      earth.removeFromParent();
      release(earth);
      earth.clear();
    },
  };
}
