import { create } from 'zustand';

const KEY = 'mo_easy';
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** Modo fácil dos minigames (mais tempo e margens maiores), para os menores. */
export const useEasyMode = create<{ easy: boolean; set: (on: boolean) => void }>((set) => ({
  easy: read(),
  set: (on) => {
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      /* opcional */
    }
    set({ easy: on });
  },
}));
