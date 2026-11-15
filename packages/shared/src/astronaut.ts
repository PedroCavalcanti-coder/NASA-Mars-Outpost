/** Paleta e configuração visual do traje espacial do astronauta. */
export const SUIT_COLOR_IDS = [
  'ice',
  'station',
  'graphite',
  'deep_blue',
  'sky',
  'mint',
  'orange',
  'yellow',
  'coral',
  'oxide',
  'lilac',
  'pink',
] as const;

export type SuitColorId = (typeof SUIT_COLOR_IDS)[number];

export const SUIT_COLORS: Record<SuitColorId, { name: string; hex: string }> = {
  ice: { name: 'Branco Gelo', hex: '#E9ECEF' },
  station: { name: 'Cinza Estação', hex: '#B7BFC6' },
  graphite: { name: 'Grafite', hex: '#30363B' },
  deep_blue: { name: 'Azul Cósmico', hex: '#1F3A66' },
  sky: { name: 'Azul Céu', hex: '#5AA9D6' },
  mint: { name: 'Verde Menta', hex: '#7FD6A0' },
  orange: { name: 'Laranja Ares', hex: '#FF7A1A' },
  yellow: { name: 'Amarelo Solar', hex: '#E5B84B' },
  coral: { name: 'Coral', hex: '#D97762' },
  oxide: { name: 'Vermelho Óxido', hex: '#B84C4C' },
  lilac: { name: 'Lilás Orbital', hex: '#A28AC8' },
  pink: { name: 'Rosa Nebulosa', hex: '#D995B9' },
};

export const SUIT_PARTS = ['helmet', 'vest', 'suit', 'gloves', 'boots', 'backpack'] as const;
export type SuitPart = (typeof SUIT_PARTS)[number];

export const SUIT_PART_NAMES: Record<SuitPart, string> = {
  helmet: 'Capacete',
  vest: 'Colete',
  suit: 'Macacão',
  gloves: 'Luvas',
  boots: 'Botas',
  backpack: 'Mochila ECLSS',
};

/** Acessórios 3D opcionais do v2 (nós `acc_<id>` do GLB). */
export const ACCESSORY_IDS = [
  'lanterna_capacete',
  'antena_parabolica',
  'tanques_oxigenio',
  'joelheiras',
  'bolsas_cinto',
  'cracha',
  'luzes_ombro',
] as const;
export type AccessoryId = (typeof ACCESSORY_IDS)[number];

export const ACCESSORIES: Record<AccessoryId, { name: string; part: SuitPart | null }> = {
  lanterna_capacete: { name: 'Lanterna do capacete', part: 'helmet' },
  antena_parabolica: { name: 'Antena parabólica', part: 'backpack' },
  tanques_oxigenio: { name: 'Tanques de oxigênio', part: 'backpack' },
  joelheiras: { name: 'Joelheiras', part: 'suit' },
  bolsas_cinto: { name: 'Bolsas de cinto', part: 'vest' },
  cracha: { name: 'Crachá de nome', part: null },
  luzes_ombro: { name: 'Luzes de ombro', part: null },
};

/** Quantos acessórios um traje pode ter ao mesmo tempo. */
export const MAX_ACCESSORIES = 5;

/** Lugares onde cabe uma marca (decalque `acc_emblema_<lugar>`; o ombro cobre os dois lados). */
export const MARK_SLOTS = ['ombro', 'peito', 'capacete', 'mochila'] as const;
export type MarkSlot = (typeof MARK_SLOTS)[number];

export const MARK_SLOT_NAMES: Record<MarkSlot, string> = {
  ombro: 'Ombro',
  peito: 'Peito',
  capacete: 'Capacete',
  mochila: 'Mochila',
};

/** Célula do atlas `emblemas.png` (4×2) que cada decalque já traz como base. */
export const MARK_BASE_CELL: Record<MarkSlot, number> = {
  ombro: 0,
  peito: 4,
  capacete: 1,
  mochila: 2,
};

/** Marcas = células do atlas, na ordem do arquivo. */
export const MARKS = [
  'Missão Marte',
  'Foguete',
  'Estrela',
  'Olympus Mons',
  'Botânica',
  'Engenharia',
  'Medicina',
  'Ciência',
] as const;
export type MarkId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SuitConfig {
  version: 1;
  helmet: SuitColorId;
  vest: SuitColorId;
  suit: SuitColorId;
  gloves: SuitColorId;
  boots: SuitColorId;
  backpack: SuitColorId;
  /** acessórios ligados (trajes antigos não têm: normalizeSuit devolve []) */
  accessories: AccessoryId[];
  /** marca de cada lugar; ausente/null = sem marca */
  marks: Partial<Record<MarkSlot, MarkId | null>>;
}

export const DEFAULT_SUIT: Readonly<SuitConfig> = {
  version: 1,
  accessories: [],
  marks: {},
  helmet: 'ice',
  vest: 'ice',
  suit: 'ice',
  gloves: 'graphite',
  boots: 'graphite',
  backpack: 'station',
};

const makePreset = (name: string, colors: readonly SuitColorId[]) => ({
  name,
  suit: {
    version: 1 as const,
    accessories: [] as AccessoryId[],
    marks: {} as SuitConfig['marks'],
    helmet: colors[0] ?? 'ice',
    vest: colors[1] ?? 'ice',
    suit: colors[2] ?? 'ice',
    gloves: colors[3] ?? 'graphite',
    boots: colors[4] ?? 'graphite',
    backpack: colors[5] ?? 'station',
  },
});

export const SUIT_PRESETS = [
  { name: 'Jezero Padrão', suit: cloneSuit(DEFAULT_SUIT) },
  makePreset('Explorador Solar', ['yellow', 'yellow', 'ice', 'graphite', 'yellow', 'station']),
  makePreset('Aurora Boreal', ['sky', 'lilac', 'ice', 'pink', 'pink', 'sky']),
  makePreset('Bio-Botânico', ['mint', 'mint', 'deep_blue', 'ice', 'orange', 'mint']),
  makePreset('Sombra Marciana', ['graphite', 'ice', 'graphite', 'graphite', 'orange', 'graphite']),
  makePreset('Nebulosa Viva', ['pink', 'lilac', 'sky', 'mint', 'yellow', 'coral']),
];

/** Cópia profunda (acessórios e marcas não podem ser compartilhados entre trajes). */
export function cloneSuit(suit: Readonly<SuitConfig>): SuitConfig {
  return { ...suit, accessories: [...suit.accessories], marks: { ...suit.marks } };
}

/** Compara dois trajes (cores, acessórios e marcas). */
export function suitsEqual(a: Readonly<SuitConfig>, b: Readonly<SuitConfig>): boolean {
  return (
    SUIT_PARTS.every((p) => a[p] === b[p]) &&
    a.accessories.length === b.accessories.length &&
    a.accessories.every((id) => b.accessories.includes(id)) &&
    MARK_SLOTS.every((s) => (a.marks[s] ?? null) === (b.marks[s] ?? null))
  );
}

/** Aceita qualquer coisa (trajes antigos, lixo vindo da rede) e devolve um traje válido. */
export function normalizeSuit(value: unknown): SuitConfig {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const suit = cloneSuit(DEFAULT_SUIT);
  for (const part of SUIT_PARTS) {
    const color = source[part];
    if (typeof color === 'string' && (SUIT_COLOR_IDS as readonly string[]).includes(color)) {
      suit[part] = color as SuitColorId;
    }
  }
  if (Array.isArray(source.accessories)) {
    for (const id of source.accessories) {
      if (suit.accessories.length >= MAX_ACCESSORIES) break;
      if (
        typeof id === 'string' &&
        (ACCESSORY_IDS as readonly string[]).includes(id) &&
        !suit.accessories.includes(id as AccessoryId)
      ) {
        suit.accessories.push(id as AccessoryId);
      }
    }
  }
  const marks = source.marks;
  if (marks && typeof marks === 'object' && !Array.isArray(marks)) {
    for (const slot of MARK_SLOTS) {
      const m = (marks as Record<string, unknown>)[slot];
      if (typeof m === 'number' && Number.isInteger(m) && m >= 0 && m < MARKS.length) {
        suit.marks[slot] = m as MarkId;
      }
    }
  }
  return suit;
}

export function randomSuit(): SuitConfig {
  const next = cloneSuit(DEFAULT_SUIT);
  for (const part of SUIT_PARTS) {
    next[part] = SUIT_COLOR_IDS[Math.floor(Math.random() * SUIT_COLOR_IDS.length)]!;
  }
  const pool = [...ACCESSORY_IDS];
  const count = Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    next.accessories.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
  }
  for (const slot of MARK_SLOTS) {
    if (Math.random() < 0.5) next.marks[slot] = Math.floor(Math.random() * MARKS.length) as MarkId;
  }
  return next;
}
