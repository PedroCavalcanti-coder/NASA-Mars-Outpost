/** Tipos das respostas da API (o servidor devolve exatamente estes formatos). */

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
