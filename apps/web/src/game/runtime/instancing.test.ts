import * as THREE from 'three';
import { expect, it } from 'vitest';
import { instanceStatic } from './instancing';

it('batches repeated static leaves without changing world transforms or interactive nodes', () => {
  const root = new THREE.Group();
  root.position.set(12, 0, -5);
  root.scale.setScalar(0.75);
  const geometry = new THREE.BoxGeometry(),
    material = new THREE.MeshStandardMaterial();
  const expected: THREE.Matrix4[] = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = i * 2;
    root.add(mesh);
  }
  const roof = new THREE.Mesh(geometry, material);
  roof.name = 'Habitat_Telhado';
  root.add(roof);
  const door = new THREE.Mesh(geometry, material);
  door.name = 'Porta';
  root.add(door);
  const antenna = new THREE.Mesh(geometry, material);
  antenna.name = 'Antenna';
  root.add(antenna);
  root.updateMatrixWorld(true);
  for (const node of root.children.slice(0, 4)) expected.push(node.matrixWorld.clone());
  const clip = new THREE.AnimationClip('Scan', 1, [
    new THREE.NumberKeyframeTrack('Antenna.rotation[y]', [0, 1], [0, 1]),
  ]);
  instanceStatic(root, [clip]);
  root.updateMatrixWorld(true);
  const batch = root.children.find((o) => o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
  expect(batch.count).toBe(4);
  expect(root.children).toContain(roof);
  expect(root.children).toContain(door);
  expect(root.children).toContain(antenna);
  expected.forEach((world, i) => {
    const matrix = new THREE.Matrix4();
    batch.getMatrixAt(i, matrix);
    matrix.premultiply(batch.matrixWorld);
    matrix.elements.forEach((v, j) => {
      expect(v).toBeCloseTo(world.elements[j] ?? 0);
    });
  });
});
