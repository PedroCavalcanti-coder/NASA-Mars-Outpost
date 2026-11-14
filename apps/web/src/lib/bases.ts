/** As 8 bases marcianas modeladas (arquivos em Assets/bases). */
export const BASE_IDS = [
  'jezero',
  'utopia',
  'gale',
  'olympus',
  'valles',
  'hellas',
  'elysium',
  'arcadia',
] as const;
export type BaseId = (typeof BASE_IDS)[number];

/** Sorteia uma base. Com `exclude`, nunca repete a atual (usado em "sortear outra"). */
export function pickRandomBase(exclude?: BaseId): BaseId {
  const pool = BASE_IDS.filter((id) => id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? BASE_IDS[0];
}

export interface BaseInfo {
  id: BaseId;
  name: string;
  description: string;
  /** limites dos cômodos em tiles de 4 m (x1/y1 exclusivos; y para o norte) */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  rooms?: Array<{
    id: string;
    kind: string;
    tile: [number, number];
    size: [number, number];
    doors?: Array<{
      side: string;
      pos: [number, number];
      garage?: boolean;
      exterior?: boolean;
    }>;
  }>;
  corridors?: Array<{ tile: [number, number]; axis?: 'x' | 'y' }>;
  pad?: [number, number];
  solar?: Array<[number, number]>;
  /** garagem: por onde o rover sai (metros do modelo; x leste, y norte) */
  bay?: {
    room: string;
    crew: {
      path: Array<[number, number]>;
      heading: [number, number];
      door: string;
      exit: [number, number];
    };
  };
}

export const baseModelUrl = (id: BaseId) => `/assets/bases/base_${id}.glb`;
export const baseThumbUrl = (id: BaseId) => `/assets/bases/thumb_${id}.jpg`;

/** Nome, descrição e dimensões completas da base (arquivo JSON gerado junto do modelo). */
export async function loadBaseInfo(id: BaseId): Promise<BaseInfo> {
  const res = await fetch(`/assets/bases/base_${id}.json`);
  if (!res.ok) throw new Error(`Base ${id} não encontrada`);
  const j = (await res.json()) as Omit<BaseInfo, 'id'>;
  return {
    id,
    name: j.name,
    description: j.description,
    bounds: j.bounds,
    rooms: j.rooms ?? [],
    corridors: j.corridors ?? [],
    pad: j.pad ?? [0, 0],
    solar: j.solar ?? [],
    bay: j.bay,
  };
}
