// Gera as bases do jogo: Blender (GLB bruto) -> dedup + poda + meshopt -> bases.generated.ts
//   node scripts/build-bases.mjs            (usa o Blender 5.x instalado ou $BLENDER)
//   node scripts/build-bases.mjs --post     (só dedup/poda/meshopt/gen-bases, sem rodar o Blender)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'apps', 'web', 'public', 'assets', 'bases');
const blender =
  process.env.BLENDER ??
  ['5.2', '5.1', '5.0', '4.5', '4.4']
    .map((v) => `C:/Program Files/Blender Foundation/Blender ${v}/blender.exe`)
    .find((p) => existsSync(p));
if (!blender && !process.argv.includes('--post'))
  throw new Error('Blender não encontrado: defina a variável BLENDER.');
const cli = join(root, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
const gt = (...args) => run(process.execPath, [cli, ...args]);

if (!process.argv.includes('--post'))
  run(blender, [
    '-b',
    join(root, 'assets-src', 'blender', 'MarsOutpost_Bases.blend'),
    '--python',
    join(root, 'assets-src', 'blender', 'exportar_bases.py'),
  ]);
for (const f of readdirSync(dir).filter((n) => /^base_.*\.glb$/.test(n))) {
  const p = join(dir, f);
  gt('dedup', p, p);
  gt('prune', p, p, '--keep-leaves', 'true'); // mantém os marcadores vazios dos canteiros
  gt('webp', p, p, '--quality', '90', '--slots', '*'); // logos e piso: PNG -> WebP
  gt('meshopt', p, p);
}
run(process.execPath, ['scripts/gen-bases.mjs']);
