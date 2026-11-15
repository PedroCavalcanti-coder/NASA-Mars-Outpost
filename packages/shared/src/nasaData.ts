/**
 * Dados reais da NASA embutidos no jogo (arquivo curado, sem chamada a API).
 *
 * Nada aqui é "ao vivo": são registros e medições publicados, copiados com a fonte. O jogo mostra
 * sempre a origem e a data de cada número, para a criança (e os jurados) saberem que é ciência
 * de verdade e de quando ela é.
 */

export interface SolarFlareRecord {
  /** classe da explosão solar (C < M < X; o número multiplica: X9 é ~9 vezes X1) */
  classType: string;
  /** pico da explosão (UTC) */
  peak: string;
  /** região ativa do Sol (numeração da NOAA) */
  region: number;
  /** o que aconteceu de importante (em linguagem simples) */
  note: string;
}

/**
 * Explosões solares registradas no DONKI (Space Weather Database Of Notifications, Knowledge,
 * Information), mantido pelo CCMC/NASA Goddard. Arquivo curado: as maiores do ciclo solar atual
 * e as do ciclo anterior que chegaram a Marte.
 */
export const SOLAR_FLARES: readonly SolarFlareRecord[] = [
  {
    classType: 'X9.0',
    peak: '2024-10-03T12:18Z',
    region: 13842,
    note: 'A explosão mais forte do ciclo solar atual (até o fim de 2024).',
  },
  {
    classType: 'X8.7',
    peak: '2024-05-14T16:51Z',
    region: 13664,
    note: 'Parte da tempestade solar de maio de 2024, que causou auroras vistas até no Brasil e em Marte.',
  },
  {
    classType: 'X2.8',
    peak: '2023-12-14T17:02Z',
    region: 13514,
    note: 'Uma das maiores explosões de 2023; atrapalhou rádios de ondas curtas na Terra.',
  },
  {
    classType: 'X9.3',
    peak: '2017-09-06T12:02Z',
    region: 12673,
    note: 'A explosão mais forte do ciclo solar anterior.',
  },
  {
    classType: 'X8.2',
    peak: '2017-09-10T16:06Z',
    region: 12673,
    note: 'Lançou partículas que chegaram a Marte: o detector RAD do Curiosity mediu a radiação na superfície mais que dobrar.',
  },
];

export const DONKI_SOURCE = {
  name: 'DONKI — Space Weather Database (CCMC/NASA Goddard)',
  url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
} as const;

/** Medições de radiação publicadas (mSv = milisievert, a unidade da "dose" que o corpo recebe). */
export const RADIATION = {
  /** dose média por dia na superfície de Marte, medida pelo RAD do Curiosity (Hassler et al., Science, 2014) */
  marsSurfacePerDay: 0.64,
  /** dose por dia na viagem Terra–Marte, medida pelo RAD dentro da nave (Zeitlin et al., Science, 2013) */
  cruisePerDay: 1.8,
  /** radiação natural média que uma pessoa recebe por ANO na Terra (UNSCEAR) */
  earthPerYear: 2.4,
  /** uma tomografia de tórax, para comparar */
  chestCt: 7,
  /** limite de dose de toda a carreira de um astronauta da NASA (NASA-STD-3001, 2022) */
  careerLimit: 600,
} as const;

export const RADIATION_SOURCES = [
  { label: 'RAD/Curiosity na superfície de Marte (Hassler et al., 2014)', url: 'https://science.nasa.gov/mission/msl-curiosity/' },
  { label: 'RAD na viagem até Marte (Zeitlin et al., 2013)', url: 'https://science.nasa.gov/mission/msl-curiosity/' },
  { label: 'Limite de carreira da NASA (NASA-STD-3001)', url: 'https://www.nasa.gov/ochmo/' },
  { label: 'RadLab — doses medidas na Estação Espacial (OSDR)', url: 'https://visualization.osdr.nasa.gov/radlab/gui/' },
] as const;

/** Quanto mais forte a classe da explosão, maior o multiplicador da dose da tempestade. */
export function flareFactor(classType: string): number {
  const m = /^([CMX])(\d+(?:\.\d+)?)/.exec(classType);
  if (!m) return 1;
  const n = Number(m[2]);
  return m[1] === 'X' ? 1 + n / 4 : m[1] === 'M' ? 0.6 + n / 20 : 0.4;
}

/** Explosão real usada num evento (sempre a mesma para o mesmo evento da sala). */
export function flareFor(key: number): SolarFlareRecord {
  return SOLAR_FLARES[Math.abs(Math.floor(key)) % SOLAR_FLARES.length]!;
}

/** Locais reais das bases em Marte (latitude/longitude em graus; leste positivo). */
export interface MarsSite {
  name: string;
  lat: number;
  lon: number;
  /** por que este lugar importa (missões reais que estiveram lá) */
  why: string;
}

export const MARS_SITES: Record<string, MarsSite> = {
  jezero: { name: 'Cratera Jezero', lat: 18.4, lon: 77.5, why: 'Onde o rover Perseverance pousou em 2021: um antigo lago com delta de rio.' },
  gale: { name: 'Cratera Gale', lat: -5.4, lon: 137.8, why: 'Onde o rover Curiosity explora desde 2012 e subiu o Monte Sharp.' },
  olympus: { name: 'Olympus Mons', lat: 18.65, lon: -133.8, why: 'O maior vulcão do Sistema Solar: quase 3 vezes mais alto que o Everest.' },
  valles: { name: 'Valles Marineris', lat: -13.9, lon: -59.2, why: 'Um cânion de 4.000 km, longo como os Estados Unidos de costa a costa.' },
  hellas: { name: 'Hellas Planitia', lat: -42.4, lon: 70.5, why: 'Uma bacia de impacto tão funda que a pressão do ar lá é a maior de Marte.' },
  elysium: { name: 'Elysium Planitia', lat: 4.5, lon: 135.6, why: 'Onde a sonda InSight ouviu terremotos de Marte (2018–2022).' },
  arcadia: { name: 'Arcadia Planitia', lat: 47.2, lon: -176.0, why: 'Planície com gelo de água logo abaixo da superfície, um alvo para futuras bases.' },
  utopia: { name: 'Utopia Planitia', lat: 48.0, lon: 134.0, why: 'Onde pousou a Viking 2 em 1976; o rover chinês Zhurong andou mais ao sul.' },
};

export const MARS_TREK_URL = 'https://trek.nasa.gov/mars/';
