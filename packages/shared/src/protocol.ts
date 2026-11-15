/** O servidor principal não tem eventos próprios (o jogo vive no namespace `/game`). */
export type ServerToClientEvents = Record<string, never>;
export type ClientToServerEvents = Record<string, never>;

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };
