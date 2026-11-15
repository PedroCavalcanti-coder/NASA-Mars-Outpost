import fs from 'node:fs';
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

await MeshoptDecoder.ready;
/** Geometry-only GLB decoding for offline navigation; no texture or browser dependencies. */
export function readGeometry(file: string) {
  const data = fs.readFileSync(file);
  const jsonLength = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString());
  const binary = data.subarray(28 + jsonLength);
  const views = gltf.bufferViews.map((v: any) => {
    const ext = v.extensions?.EXT_meshopt_compression;
    if (!ext)
      return new Uint8Array(binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
    const out = new Uint8Array(ext.count * ext.byteStride);
    MeshoptDecoder.decodeGltfBuffer(
      out,
      ext.count,
      ext.byteStride,
      binary.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength),
      ext.mode,
      ext.filter,
    );
    return out;
  });
  const array = (id: number) => {
    const a = gltf.accessors[id],
      v = gltf.bufferViews[a.bufferView];
    const n = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type]!;
    const C = (
      {
        5120: Int8Array,
        5122: Int16Array,
        5126: Float32Array,
        5125: Uint32Array,
        5123: Uint16Array,
        5121: Uint8Array,
      } as any
    )[a.componentType];
    const stride = v.byteStride ?? n * C.BYTES_PER_ELEMENT;
    const out = new C(a.count * n);
    const bytes = new Uint8Array(out.buffer);
    for (let i = 0; i < a.count; i++)
      bytes.set(
        views[a.bufferView].subarray(
          (a.byteOffset ?? 0) + i * stride,
          (a.byteOffset ?? 0) + i * stride + n * C.BYTES_PER_ELEMENT,
        ),
        i * n * C.BYTES_PER_ELEMENT,
      );
    return out;
  };

  const nodes = gltf.nodes.map((n: any) => {
    const group = new THREE.Group();
    group.name = n.name ?? '';
    if (n.matrix) group.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));
    else {
      if (n.translation) group.position.fromArray(n.translation);
      if (n.rotation) group.quaternion.fromArray(n.rotation);
      if (n.scale) group.scale.fromArray(n.scale);
    }
    if (n.mesh !== undefined) {
      const mesh = gltf.meshes[n.mesh];
      for (const p of mesh.primitives) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(
            array(p.attributes.POSITION),
            3,
            gltf.accessors[p.attributes.POSITION].normalized === true,
          ),
        );
        if (p.indices !== undefined)
          geometry.setIndex(new THREE.BufferAttribute(array(p.indices), 1));
        const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        mat.name = gltf.materials?.[p.material]?.name ?? '';
        const m = new THREE.Mesh(geometry, mat);
        m.name = mesh.name ?? group.name;
        group.add(m);
      }
    }
    return group;
  });
  gltf.nodes.forEach((n: any, i: number) => {
    n.children?.forEach((c: number) => {
      nodes[i].add(nodes[c]);
    });
  });
  const model = new THREE.Group();
  for (const i of gltf.scenes[gltf.scene ?? 0].nodes) model.add(nodes[i]);
  model.updateMatrixWorld(true);
  return model;
}
