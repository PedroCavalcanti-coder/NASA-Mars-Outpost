import type { ApiError } from '@mars/shared';

/** Vazio = mesma origem (proxy do Vite em dev, ou servidor único em produção). */
export const API_URL: string = import.meta.env.VITE_API_URL ?? '';

/** Erro da API com mensagem amigável e (em validações) a mensagem de cada campo. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type Init = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown };

async function send(path: string, init?: Init) {
  const hasBody = init?.body !== undefined;
  return fetch(`${API_URL}/api${path}`, {
    method: init?.method ?? (hasBody ? 'POST' : 'GET'),
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    credentials: API_URL ? 'include' : 'same-origin',
  });
}

/** Várias requisições com token vencido renovam a sessão uma única vez. */
let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  refreshing ??= send('/auth/refresh', { method: 'POST' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

/** Chamada JSON à API. Se o token de acesso venceu (401), renova a sessão e repete uma vez. */
export async function api<T>(path: string, init?: Init): Promise<T> {
  let res = await send(path, init).catch(() => null);
  if (res?.status === 401 && !NO_REFRESH.includes(path) && (await refreshSession())) {
    res = await send(path, init).catch(() => null);
  }
  if (!res) throw new HttpError(0, 'Sem conexão com o servidor. Tente de novo.');
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiError>) | null;
  if (!res.ok) {
    throw new HttpError(res.status, data?.error ?? 'Algo deu errado. Tente de novo.', data?.fields);
  }
  return data as T;
}

/** O site só consulta a sessão se o cookie-indicador existir (evita 401 para visitantes). */
export const hasSessionHint = () => document.cookie.split('; ').some((c) => c === 'mo_in=1');
