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

export interface SuitConfig {
  version: 1;
  helmet: SuitColorId;
  vest: SuitColorId;
  suit: SuitColorId;
  gloves: SuitColorId;
  boots: SuitColorId;
  backpack: SuitColorId;
}

export const DEFAULT_SUIT: Readonly<SuitConfig> = {
  version: 1,
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
    helmet: colors[0] ?? 'ice',
    vest: colors[1] ?? 'ice',
    suit: colors[2] ?? 'ice',
    gloves: colors[3] ?? 'graphite',
    boots: colors[4] ?? 'graphite',
    backpack: colors[5] ?? 'station',
  },
});

export const SUIT_PRESETS = [
  { name: 'Jezero Padrão', suit: { ...DEFAULT_SUIT } },
  makePreset('Explorador Solar', ['yellow', 'yellow', 'ice', 'graphite', 'yellow', 'station']),
  makePreset('Aurora Boreal', ['sky', 'lilac', 'ice', 'pink', 'pink', 'sky']),
  makePreset('Bio-Botânico', ['mint', 'mint', 'deep_blue', 'ice', 'orange', 'mint']),
  makePreset('Sombra Marciana', ['graphite', 'ice', 'graphite', 'graphite', 'orange', 'graphite']),
  makePreset('Nebulosa Viva', ['pink', 'lilac', 'sky', 'mint', 'yellow', 'coral']),
];

export function normalizeSuit(value: unknown): SuitConfig {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const suit: SuitConfig = { ...DEFAULT_SUIT };
  for (const part of SUIT_PARTS) {
    const color = source[part];
    if (typeof color === 'string' && (SUIT_COLOR_IDS as readonly string[]).includes(color)) {
      suit[part] = color as SuitColorId;
    }
  }
  return suit;
}

export function randomSuit(): SuitConfig {
  const next: SuitConfig = { ...DEFAULT_SUIT };
  for (const part of SUIT_PARTS) {
    next[part] = SUIT_COLOR_IDS[Math.floor(Math.random() * SUIT_COLOR_IDS.length)]!;
  }
  return next;
}
