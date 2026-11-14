/** Tipos das respostas da API (o servidor devolve exatamente estes formatos). */

/** Dados do próprio usuário (inclui e-mail, que nunca é mostrado a outras pessoas). */
export interface PublicUser {
  id: string;
  name: string;
  username: string;
  email: string;
  createdAt: string;
}

/** Cartão público de outro jogador. */
export interface UserCard {
  id: string;
  name: string;
  username: string;
}

export interface FriendInfo {
  /** id da amizade (para aceitar/recusar/remover) */
  id: string;
  user: UserCard;
  since: string;
  online: boolean;
}

export interface FriendsResponse {
  friends: FriendInfo[];
  incoming: FriendInfo[];
  outgoing: FriendInfo[];
}

export type Relation = 'none' | 'friend' | 'incoming' | 'outgoing';

export interface UserSearchResult extends UserCard {
  relation: Relation;
}

export interface SessionInfo {
  id: string;
  current: boolean;
  userAgent: string;
  ip: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface DirectMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  createdAt: string;
  readAt: string | null;
}

export interface HealthResponse {
  ok: boolean;
  game: string;
  time: string;
  db: boolean;
}

export interface ApiError {
  error: string;
  /** campo inválido -> mensagem (validação) */
  fields?: Record<string, string>;
}
