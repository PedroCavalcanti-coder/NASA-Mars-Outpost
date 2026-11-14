import type { PublicUser } from '@mars/shared';
import { create } from 'zustand';
import { api, hasSessionHint } from '../net/api';

interface AuthStore {
  user: PublicUser | null;
  /** já tentamos descobrir se há sessão? (evita piscar a tela de login) */
  ready: boolean;
  load: () => Promise<void>;
  setUser: (u: PublicUser | null) => void;
  logout: () => Promise<void>;
}

/** Sessão no cliente. A fonte da verdade são os cookies httpOnly no servidor. */
export const useAuth = create<AuthStore>((set) => ({
  user: null,
  ready: false,
  load: async () => {
    if (!hasSessionHint()) return set({ user: null, ready: true });
    try {
      set({ user: await api<PublicUser>('/auth/me'), ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
  setUser: (user) => set({ user, ready: true }),
  logout: async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    set({ user: null });
  },
}));
