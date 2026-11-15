import { create } from 'zustand';
import type { LoreId } from './lore';

const KEY = 'mo_lore_seen';

function readSeen(): LoreId[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? (v as LoreId[]) : [];
  } catch {
    return [];
  }
}

interface LoreStore {
  /** curiosidades esperando para aparecer (a primeira é a que a janela mostra) */
  queue: LoreId[];
  seen: LoreId[];
  /** pede para mostrar (por padrão ignora as que o jogador já viu, a menos que force=true) */
  request: (id: LoreId, force?: boolean) => void;
  close: () => void;
}

export const useLore = create<LoreStore>((set, get) => ({
  queue: [],
  seen: readSeen(),
  request: (id, force = false) => {
    const s = get();
    if (!force && s.seen.includes(id)) return;
    if (s.queue.includes(id)) return;
    set({ queue: [...s.queue, id] });
  },
  close: () => {
    const [id, ...rest] = get().queue;
    if (!id) return;
    const seen = [...get().seen, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(seen));
    } catch {
      /* sem armazenamento: aparece de novo na próxima visita */
    }
    set({ queue: rest, seen });
  },
}));
