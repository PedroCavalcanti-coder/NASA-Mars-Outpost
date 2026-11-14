// Relatório dos GLBs do jogo: triângulos, malhas, materiais, malhas idênticas e animações.
//   node scripts/audit-models.mjs [pasta ...]
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const root = resolve(import.meta.dirname, '..', 'apps', 'web', 'public', 'assets');
const dirs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [join(root, 'models'), join(root, 'bases')];
const rows = [];
for (const dir of dirs)
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb'))) {
    const doc = await io.read(join(dir, f));
    const r = doc.getRoot();
    let tris = 0;
    const sig = new Map();
    let dupTris = 0;
    for (const mesh of r.listMeshes())
      for (const p of mesh.listPrimitives()) {
        const idx = p.getIndices();
        const pos = p.getAttribute('POSITION');
        const t = idx ? idx.getCount() / 3 : pos.getCount() / 3;
        tris += t;
      }
    // malhas com a mesma geometria (mesmo nº de vértices + soma das posições) e materiais iguais
    for (const node of r.listNodes()) {
      const m = node.getMesh();
      if (!m) continue;
      for (const p of m.listPrimitives()) {
        const pos = p.getAttribute('POSITION');
        const arr = pos.getArray();
        let s = 0;
        for (let i = 0; i < arr.length; i++) s += arr[i] * (1 + (i % 7));
        const key = `${pos.getCount()}:${s.toFixed(3)}`;
        const idx = p.getIndices();
        const t = idx ? idx.getCount() / 3 : pos.getCount() / 3;
        if (sig.has(key) && sig.get(key) !== m) dupTris += t;
        else sig.set(key, m);
      }
    }
    const mats = r.listMaterials();
    const names = new Map();
    for (const m of mats) names.set(m.getName(), (names.get(m.getName()) ?? 0) + 1);
    rows.push({
      arquivo: f,
      nos: r.listNodes().length,
      malhas: r.listMeshes().length,
      tris: Math.round(tris),
      trisDuplicados: Math.round(dupTris),
      materiais: mats.length,
      matsRepetidos: [...names.values()].filter((n) => n > 1).length,
      texturas: r.listTextures().length,
      anim: r
        .listAnimations()
        .map((a) => a.getName())
        .join(','),
    });
  }
rows.sort((a, b) => b.tris - a.tris);
console.table(rows);
console.log(
  'TOTAL tris:',
  rows.reduce((n, r) => n + r.tris, 0),
);
