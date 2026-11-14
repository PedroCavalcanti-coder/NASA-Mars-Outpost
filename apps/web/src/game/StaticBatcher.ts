import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface BatchStats {
  before: number;
  after: number;
  merged: number;
}

/**
 * Cópia da geometria com todos os atributos em Float32. Os GLBs vêm quantizados (inteiros
 * normalizados, a escala fica no nó): aplicar uma matriz nesses inteiros "estrangula" as
 * posições em [-1, 1]. Em float o valor decodificado é preservado.
 */
function toFloatGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(source.attributes)) {
    const a = attr as THREE.BufferAttribute;
    if (a.array instanceof Float32Array && !a.normalized) {
      geo.setAttribute(name, a.clone());
      continue;
    }
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) {
      out[i * a.itemSize] = a.getX(i);
      if (a.itemSize > 1) out[i * a.itemSize + 1] = a.getY(i);
      if (a.itemSize > 2) out[i * a.itemSize + 2] = a.getZ(i);
      if (a.itemSize > 3) out[i * a.itemSize + 3] = a.getW(i);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  const index = source.getIndex();
  if (index) geo.setIndex(index.clone());
  return geo;
}

/**
 * Junta a mobília e os equipamentos FIXOS do cenário em poucas malhas (uma por material).
 * O jogo desenhava ~900 objetos por quadro, cada um com a própria chamada à GPU e outra
 * para a sombra; depois do agrupamento sobram algumas dezenas.
 *
 * Ficam de fora tudo o que se mexe, some ou é clicado: portas, tetos, paredes dos cômodos (a
 * transparência é por cômodo), painéis solares, nave, antenas e plantas.
 */
export function batchStaticMeshes(
  model: THREE.Object3D,
  isProtected: (o: THREE.Object3D) => boolean,
): BatchStats {
  model.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(model.matrixWorld).invert();

  type Group = {
    material: THREE.Material;
    interior: boolean;
    geometries: THREE.BufferGeometry[];
    meshes: THREE.Mesh[];
  };
  const groups = new Map<string, Group>();
  let before = 0;

  const collect = (o: THREE.Object3D, blocked: boolean) => {
    const prot = blocked || isProtected(o);
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      before++;
      if (
        !prot &&
        !(mesh as THREE.SkinnedMesh).isSkinnedMesh &&
        !Array.isArray(mesh.material) &&
        mesh.visible &&
        mesh.geometry.getIndex() &&
        !mesh.userData.keepSeparate
      ) {
        const interior = Boolean(mesh.userData.isInterior);
        const attrKey = Object.keys(mesh.geometry.attributes).sort().join(',');
        const key = `${mesh.material.uuid}|${interior ? 1 : 0}|${attrKey}`;
        let g = groups.get(key);
        if (!g) {
          g = { material: mesh.material, interior, geometries: [], meshes: [] };
          groups.set(key, g);
        }
        // geometria no referencial do modelo (posição/rotação/escala de cada peça "assadas")
        const geo = toFloatGeometry(mesh.geometry);
        geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
        g.geometries.push(geo);
        g.meshes.push(mesh);
      }
    }
    for (const child of o.children) collect(child, prot);
  };
  collect(model, false);

  let merged = 0;
  let produced = 0;
  for (const g of groups.values()) {
    // um grupo de uma peça só não ganha nada com o merge
    if (g.meshes.length < 2) {
      for (const geo of g.geometries) geo.dispose();
      continue;
    }
    const geometry = mergeGeometries(g.geometries, false);
    for (const geo of g.geometries) geo.dispose();
    if (!geometry) continue;

    const mesh = new THREE.Mesh(geometry, g.material);
    mesh.castShadow = g.meshes.some((m) => m.castShadow);
    mesh.receiveShadow = g.meshes.some((m) => m.receiveShadow);
    mesh.userData.isInterior = g.interior;
    mesh.name = `STATIC_BATCH_${produced}`;
    mesh.matrixAutoUpdate = false;
    model.add(mesh);

    for (const original of g.meshes) original.removeFromParent();
    merged += g.meshes.length;
    produced++;
  }

  return { before, after: before - merged + produced, merged };
}

/**
 * Trava as matrizes do que nunca se move: o three.js deixa de recalcular transformações de
 * centenas de nós a cada quadro. `isDynamic` marca o que continua animado.
 */
export function freezeStatic(root: THREE.Object3D, isDynamic: (o: THREE.Object3D) => boolean) {
  root.updateMatrixWorld(true);
  const visit = (o: THREE.Object3D, ancestorDynamic: boolean): boolean => {
    // devolve true se o nó (ou algum descendente) é dinâmico; tudo DENTRO de um nó dinâmico
    // (p.ex. as malhas da nave) também continua dinâmico
    const self = ancestorDynamic || isDynamic(o);
    let dynamic = self;
    for (const c of o.children) if (visit(c, self)) dynamic = true;
    if (!dynamic) {
      o.matrixAutoUpdate = false;
      o.matrixWorldAutoUpdate = false;
    }
    return dynamic;
  };
  visit(root, false);
}
