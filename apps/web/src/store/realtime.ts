import type { DirectMessage, FriendsResponse } from '@mars/shared';
import { create } from 'zustand';
import { api } from '../net/api';
import { type AppSocket, connectSocket } from '../net/socket';
import { toast } from '../ui/toast';
import { useAuth } from './auth';

type MessageListener = (m: DirectMessage) => void;
const listeners = new Set<MessageListener>();

/** Escuta mensagens diretas (usado pela tela de conversa). Devolve a função de cancelar. */
export function onDirectMessage(fn: MessageListener) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

interface RealtimeStore {
  socket: AppSocket | null;
  connected: boolean;
  online: Set<string>;
  /** pedidos de amizade recebidos aguardando resposta */
  pendingRequests: number;
  unread: Record<string, number>;
  /** amigo cuja conversa está aberta (não conta como não lida) */
  activeChat: string | null;
  /** incrementa quando a lista de amigos muda no servidor (as telas recarregam) */
  friendsVersion: number;
  connect: () => void;
  disconnect: () => void;
  refreshCounters: () => Promise<void>;
  setActiveChat: (id: string | null) => void;
  clearUnread: (id: string) => void;
}

export const useRealtime = create<RealtimeStore>((set, get) => ({
  socket: null,
  connected: false,
  online: new Set(),
  pendingRequests: 0,
  unread: {},
  activeChat: null,
  friendsVersion: 0,

  connect: () => {
    if (get().socket) return;
    const socket = connectSocket();
    const bump = () => set((s) => ({ friendsVersion: s.friendsVersion + 1 }));

    socket.on('connect', () => {
      set({ connected: true });
      void get().refreshCounters();
    });
    socket.on('disconnect', () => set({ connected: false }));

    socket.on('presence:list', (ids) => set({ online: new Set(ids) }));
    socket.on('presence:update', ({ userId, online }) =>
      set((s) => {
        const next = new Set(s.online);
        if (online) next.add(userId);
        else next.delete(userId);
        return { online: next };
      }),
    );

    socket.on('friend:request', (f) => {
      toast(`${f.user.name} (@${f.user.username}) quer ser seu amigo`, 'info');
      void get().refreshCounters();
      bump();
    });
    socket.on('friend:accepted', (f) => {
      toast(`${f.user.name} aceitou seu pedido de amizade`);
      void get().refreshCounters();
      bump();
    });
    socket.on('friend:removed', () => {
      void get().refreshCounters();
      bump();
    });

    socket.on('dm:message', (m) => {
      const self = useAuth.getState().user?.id;
      const incoming = m.from !== self;
      if (incoming && get().activeChat !== m.from) {
        set((s) => ({ unread: { ...s.unread, [m.from]: (s.unread[m.from] ?? 0) + 1 } }));
        toast('Nova mensagem de um amigo', 'info');
      }
      for (const fn of listeners) fn(m);
    });

    // Sessão encerrada em outro lugar (troca de senha, "sair de todos"…): volta ao login.
    socket.on('session:revoked', () => {
      get().disconnect();
      useAuth.getState().setUser(null);
      toast('Sua sessão foi encerrada. Entre novamente.', 'info');
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.removeAllListeners().disconnect();
    set({ socket: null, connected: false, online: new Set(), pendingRequests: 0, unread: {} });
  },

  refreshCounters: async () => {
    try {
      const [friends, unread] = await Promise.all([
        api<FriendsResponse>('/friends'),
        api<Record<string, number>>('/messages/unread'),
      ]);
      const active = get().activeChat;
      if (active) delete unread[active];
      set({ pendingRequests: friends.incoming.length, unread });
    } catch {
      /* só contadores: tenta de novo na próxima navegação */
    }
  },

  setActiveChat: (activeChat) => set({ activeChat }),
  clearUnread: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.unread;
      return { unread: rest };
    }),
}));
