import { writeFileSync } from 'node:fs';
import { REPAIR_ANCHORS } from '@mars/shared';
import { RoomMovement } from '../src/realtime/movement';

const out: Record<string, Array<[number, number] | null>> = {};
for (const base of Object.keys(REPAIR_ANCHORS) as Array<keyof typeof REPAIR_ANCHORS>) {
  const m = new RoomMovement(base);
  out[base] = REPAIR_ANCHORS[base].map((a) => {
    const [px, , pz] = a.point;
    const [nx, , nz] = a.normal;
    for (let k = 0.5; k <= 5; k += 0.25) {
      const x = px! - nx! * k;
      const z = pz! - nz! * k;
      if (m.grid.isInsideBase(x, z) || !m.grid.isWalkable(x, z)) continue;
      // um passo a mais para fora, se der, para o astronauta não ficar colado na parede
      const x2 = px! - nx! * (k + 0.4);
      const z2 = pz! - nz! * (k + 0.4);
      const ok = !m.grid.isInsideBase(x2, z2) && m.grid.isWalkable(x2, z2);
      const fx = ok ? x2 : x;
      const fz = ok ? z2 : z;
      return [Math.round(fx * 100) / 100, Math.round(fz * 100) / 100];
    }
    return null;
  });
}
const body = Object.entries(out)
  .map(([base, list]) => `  ${base}: ${JSON.stringify(list)},`)
  .join('\n');
writeFileSync(
  process.argv[2]!,
  `/**
 * Onde o astronauta fica, do LADO DE FORA da base, para consertar cada rachadura (mesma ordem de
 * \`REPAIR_ANCHORS\`). \`null\`: a parede dá para um corredor interno, então ali nunca nasce rachadura.
 * Gerado por apps/server/scripts/build-repair-outside.ts a partir da malha de navegação de cada base.
 */
export const REPAIR_OUTSIDE: Record<string, Array<[number, number] | null>> = {
${body}
};

/** Âncoras de parede que dão para o lado de fora (as únicas onde a blindagem racha). */
export function outerAnchors(base: string): number[] {
  return (REPAIR_OUTSIDE[base] ?? []).flatMap((p, i) => (p ? [i] : []));
}
`,
);
console.log(body);
