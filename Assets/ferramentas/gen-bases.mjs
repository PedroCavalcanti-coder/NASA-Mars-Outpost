// Gera packages/shared/src/bases.generated.ts a partir dos JSON exportados pelo Blender
// (assets-src/blender/build_all.py -> apps/web/public/assets/bases/base_*.json).
//   node scripts/gen-bases.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'apps', 'web', 'public', 'assets', 'bases');
const ORDER = ['jezero', 'utopia', 'gale', 'olympus', 'valles', 'hellas', 'elysium', 'arcadia'];
const bases = readdirSync(dir)
  .filter((f) => /^base_.*\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
  .map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    model: b.model,
    thumb: `/assets/bases/thumb_${b.id}.jpg`,
    bounds: b.bounds,
    pad: [b.pad[0] / b.tileMeters, b.pad[1] / b.tileMeters],
    rooms: b.rooms.map((r) => ({
      id: r.id,
      kind: r.kind,
      tile: r.tile,
      size: r.size,
      // porta = par de tiles (dentro do cômodo, do outro lado da parede)
      doors: r.doors.map((d) => {
        const [x, y] = d.pos;
        const [x0, y0] = [r.tile[0] * 4, r.tile[1] * 4];
        const [x1, y1] = [x0 + r.size[0] * 4, y0 + r.size[1] * 4];
        const n = x === x1 ? [1, 0] : x === x0 ? [-1, 0] : y === y1 ? [0, 1] : [0, -1];
        const inner = [Math.floor((x - n[0] * 2) / 4), Math.floor((y - n[1] * 2) / 4)];
        const outer = [Math.floor((x + n[0] * 2) / 4), Math.floor((y + n[1] * 2) / 4)];
        return { inner, outer, exterior: d.exterior, garage: d.garage };
      }),
    })),
    corridors: b.corridors.map((c) => ({ tile: c.tile, axis: c.axis })),
    // painéis solares (tiles): o astronauta limpa um por um
    solar: (b.solar ?? []).map(([x, y]) => [x / b.tileMeters, y / b.tileMeters]),
    // garagem: onde os dois veículos ficam e por onde saem (tiles, mesma origem das salas)
    bay: b.bay
      ? {
          room: b.bay.room,
          kind: b.bay.kind,
          ...Object.fromEntries(
            ['crew', 'auto'].map((k) => [
              k,
              {
                path: b.bay[k].path.map(([x, y]) => [x / b.tileMeters, y / b.tileMeters]),
                heading: b.bay[k].heading,
                door: b.bay[k].door,
                exit: b.bay[k].exit,
              },
            ]),
          ),
        }
      : undefined,
  }));
const out = `// GERADO por scripts/gen-bases.mjs — não edite à mão.
import type { BaseLayout } from './expedition';

export const BASE_LAYOUTS: readonly BaseLayout[] = ${JSON.stringify(bases, null, 1)};
`;
writeFileSync(join(root, 'packages', 'shared', 'src', 'bases.generated.ts'), out);
console.log(`✔ ${bases.length} bases -> packages/shared/src/bases.generated.ts`);
