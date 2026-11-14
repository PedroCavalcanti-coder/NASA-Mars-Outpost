// Exporta o pacote 3D do jogo (modelos, animações, texturas, scripts do Blender, .blend) para uma pasta
// e gera um catálogo (catalog.json) que descreve cada arquivo: nós, animações, materiais e polígonos.
//   node scripts/export-assets.mjs "C:/caminho/Assets"
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const root = resolve(import.meta.dirname, '..');
const dest = resolve(process.argv[2] ?? join(root, 'Assets'));
const pub = join(root, 'apps', 'web', 'public', 'assets');
const blenderDir = join(root, 'assets-src', 'blender');
const modelsDocs = process.env.BLEND_EXTRA ?? 'C:/Users/Dev_RV01/Documents/modelos3dprojeto';

const ensure = (d) => mkdirSync(d, { recursive: true });
const copyAll = (from, to, filter = () => true) => {
  if (!existsSync(from)) return [];
  ensure(to);
  const out = [];
  for (const f of readdirSync(from)) {
    if (!filter(f)) continue;
    copyFileSync(join(from, f), join(to, f));
    out.push(f);
  }
  return out;
};

ensure(dest);
const models = copyAll(join(pub, 'models'), join(dest, 'modelos'), (f) => f.endsWith('.glb'));
const bases = copyAll(join(pub, 'bases'), join(dest, 'bases'), (f) => /\.(glb|json|jpg)$/.test(f));
const blends = [
  ...copyAll(blenderDir, join(dest, 'blender', 'arquivos'), (f) => f.endsWith('.blend')),
  ...copyAll(modelsDocs, join(dest, 'blender', 'arquivos'), (f) => f.endsWith('.blend')),
];
const scripts = copyAll(
  blenderDir,
  join(dest, 'blender', 'scripts'),
  (f) => f.endsWith('.py') || f.endsWith('.md'),
);
const tools = copyAll(join(root, 'scripts'), join(dest, 'ferramentas'), (f) =>
  ['audit-models.mjs', 'build-bases.mjs', 'gen-bases.mjs', 'export-assets.mjs'].includes(f),
);
copyAll(join(pub, 'textures'), join(dest, 'texturas', 'jogo'));
copyAll(join(root, 'assets-src', 'models-raw'), join(dest, 'modelos-brutos'), (f) =>
  f.endsWith('.glb'),
);

copyFileSync(join(root, 'assets-src', 'ASSETS_README.md'), join(dest, 'README.md'));

// ---------------------------------------------------------------- catálogo + texturas embutidas
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const catalog = [];
const texDir = join(dest, 'texturas', 'embutidas');
ensure(texDir);
const seenTex = new Set();
for (const [folder, files] of [
  ['modelos', models],
  ['bases', bases.filter((f) => f.endsWith('.glb'))],
]) {
  for (const f of files) {
    const doc = await io.read(join(dest, folder, f));
    const r = doc.getRoot();
    let tris = 0;
    for (const m of r.listMeshes())
      for (const p of m.listPrimitives())
        tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    const nodes = r
      .listNodes()
      .map((n) => n.getName())
      .filter(Boolean);
    const skins = r
      .listSkins()
      .map((s) => ({ name: s.getName(), ossos: s.listJoints().map((j) => j.getName()) }));
    const anims = r.listAnimations().map((a) => {
      let dur = 0;
      for (const c of a.listChannels()) {
        const t = c.getSampler()?.getInput();
        if (t) dur = Math.max(dur, t.getMax([])[0] ?? 0);
      }
      return { nome: a.getName(), duracaoSeg: +dur.toFixed(2), canais: a.listChannels().length };
    });
    const mats = [...new Set(r.listMaterials().map((m) => m.getName()))];
    const texs = r.listTextures().map((t, i) => {
      const name = `${basename(f, '.glb')}_${t.getName() || i}`;
      const ext = t.getMimeType().includes('webp')
        ? '.webp'
        : t.getMimeType().includes('jpeg')
          ? '.jpg'
          : '.png';
      if (!seenTex.has(name)) {
        seenTex.add(name);
        writeFileSync(join(texDir, name + ext), t.getImage());
      }
      return { arquivo: `texturas/embutidas/${name}${ext}`, tamanho: t.getSize() };
    });
    catalog.push({
      arquivo: `${folder}/${f}`,
      triangulos: Math.round(tris),
      nos: nodes.length,
      nosNomeados: nodes.slice(0, 60),
      esqueleto: skins,
      animacoes: anims,
      materiais: mats,
      texturas: texs,
      tamanhoKB: Math.round((await import('node:fs')).statSync(join(dest, folder, f)).size / 1024),
    });
  }
}
writeFileSync(
  join(dest, 'catalog.json'),
  JSON.stringify({ gerado: 'node scripts/export-assets.mjs', itens: catalog }, null, 2),
);
console.log(
  JSON.stringify(
    {
      dest,
      modelos: models.length,
      bases: bases.length,
      blends,
      scripts: scripts.length,
      ferramentas: tools,
      catalogo: catalog.length,
    },
    null,
    2,
  ),
);
void extname;
