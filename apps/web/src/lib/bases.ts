import { NAVIGATION_HASH } from '@mars/shared';

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

const REQUESTED_BASE_KEY = 'mo_base';

/** Pede uma base específica para a PRÓXIMA viagem (central de bases, link `?base=`). */
export function requestBase(id: BaseId) {
  try {
    sessionStorage.setItem(REQUESTED_BASE_KEY, id);
  } catch {
    /* navegação privada: usa a base sorteada */
  }
}

/** Consome o pedido de base (uso único): a viagem seguinte volta a ser sorteada. */
export function takeRequestedBase(): BaseId | null {
  try {
    const id = sessionStorage.getItem(REQUESTED_BASE_KEY);
    sessionStorage.removeItem(REQUESTED_BASE_KEY);
    return BASE_IDS.includes(id as BaseId) ? (id as BaseId) : null;
  } catch {
    return null;
  }
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

export const baseModelUrl = (id: BaseId) => `/assets/bases/base_${id}.glb?v=${NAVIGATION_HASH}`;
export const baseThumbUrl = (id: BaseId) => `/assets/bases/thumb_${id}.jpg`;

/** Nome, descrição e dimensões da base (arquivo JSON gerado junto do modelo). */
export async function loadBaseInfo(id: BaseId, signal?: AbortSignal): Promise<BaseInfo> {
  const res = await fetch(`/assets/bases/base_${id}.json?v=${NAVIGATION_HASH}`, { signal });
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
