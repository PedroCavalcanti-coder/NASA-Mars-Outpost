import * as THREE from 'three';

/** Only immutable opaque leaves; preserve named controls and animated subtrees. */
export function instanceStatic(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
  const animated = new Set(clips.flatMap((c) => c.tracks.map((t) => t.name.split('.')[0])));
  const groups = new Map<string, THREE.Mesh[]>();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (
      !(o instanceof THREE.Mesh) ||
      o instanceof THREE.SkinnedMesh ||
      o instanceof THREE.InstancedMesh ||
      o.children.length ||
      o.morphTargetInfluences ||
      !o.visible ||
      o.matrixWorld.determinant() <= 0
    )
      return;
    let ancestor: THREE.Object3D | null = o;
    while (ancestor) {
      if (
        !ancestor.visible ||
        /Telhado|Porta|color_/.test(ancestor.name) ||
        animated.has(ancestor.name)
      )
        return;
      ancestor = ancestor.parent;
    }
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    if (materials.some((m) => m.transparent)) return;
    const key = `${o.geometry.uuid}:${materials.map((m) => m.uuid).join(',')}:${o.castShadow}:${o.receiveShadow}`;
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  });
  const inverse = root.matrixWorld.clone().invert();
  for (const meshes of groups.values()) {
    const first = meshes[0];
    if (!first || meshes.length < 3) continue;
    const instance = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
    instance.castShadow = first.castShadow;
    instance.receiveShadow = first.receiveShadow;
    meshes.forEach((mesh, i) => {
      instance.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      mesh.removeFromParent();
    });
    instance.computeBoundingSphere();
    root.add(instance);
  }
}
