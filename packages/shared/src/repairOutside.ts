/**
 * Onde o astronauta fica, do LADO DE FORA da base, para consertar cada rachadura (mesma ordem de
 * `REPAIR_ANCHORS`). `null`: a parede dá para um corredor interno, então ali nunca nasce rachadura.
 * Gerado por apps/server/scripts/build-repair-outside.ts a partir da malha de navegação de cada base.
 */
export const REPAIR_OUTSIDE: Record<string, Array<[number, number] | null>> = {
  arcadia: [null,[-8.08,9.92],[-12,19.07],[-17.16,18.66],null,null],
  elysium: [null,[20.16,14.16],[-10.84,13.84],[-20.16,11.16],[-8.73,-1.5],[-5.16,-14.16]],
  gale: [null,null,[9,7.23],[-15.66,6.66],[-16.23,-6],[6.49,-7.01]],
  hellas: [[4.82,6.32],[4.84,-8.66],[11.08,6.92],[-17.16,3.66],[-5.73,15],[24.49,-1.01]],
  jezero: [null,[8.42,14.42],[16.5,14.57],[-13,7],[1.77,-10.5],[-21.66,-5.16]],
  olympus: [null,[12.66,12.66],[5.62,3.38],[-6.34,-5.66],null,[-15.66,5.34]],
  utopia: [null,null,[-7.5,16.07],[3.59,3.91],[17.62,-6.38],[31.99,-4.01]],
  valles: [null,[3.92,3.92],[7.16,3.34],[-3.91,-5.09],null,[-14.16,-15.66]],
};

/** Âncoras de parede que dão para o lado de fora (as únicas onde a blindagem racha). */
export function outerAnchors(base: string): number[] {
  return (REPAIR_OUTSIDE[base] ?? []).flatMap((p, i) => (p ? [i] : []));
}
