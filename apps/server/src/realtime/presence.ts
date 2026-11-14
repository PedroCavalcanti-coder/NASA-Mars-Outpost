/** Presença em memória: um usuário está online se tem ao menos um socket conectado. */
const sockets = new Map<string, Set<string>>();

export function addPresence(userId: string, socketId: string): boolean {
  const set = sockets.get(userId) ?? new Set<string>();
  const first = set.size === 0;
  sockets.set(userId, set);
  set.add(socketId);
  return first; // true = acabou de ficar online
}

export function removePresence(userId: string, socketId: string): boolean {
  const set = sockets.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    sockets.delete(userId);
    return true; // true = acabou de ficar offline
  }
  return false;
}

export const isOnline = (userId: string) => (sockets.get(userId)?.size ?? 0) > 0;
