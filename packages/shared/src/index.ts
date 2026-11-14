/** Tipos e constantes compartilhados entre o site e o servidor. */
export const GAME_NAME = 'Mars Outpost';

/** Resposta da rota de saúde do servidor. */
export interface HealthResponse {
  ok: boolean;
  game: string;
  time: string;
}
