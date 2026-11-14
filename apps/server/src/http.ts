import type { ApiError } from '@mars/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { config } from './config';

/** Erro com status HTTP e mensagem segura para o cliente. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Valida com Zod; em caso de erro devolve 400 com a mensagem por campo. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new HttpError(400, 'Confira os dados informados', fields);
}

/** Violação de unicidade do Postgres (23505). Devolve o nome da constraint. */
export function uniqueViolation(err: unknown): string | null {
  const e = err as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const src = e?.code === '23505' ? e : e?.cause?.code === '23505' ? e.cause : null;
  return src ? (src.constraint ?? '') : null;
}

export function installErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if (err instanceof HttpError) {
      const body: ApiError = { error: err.message, ...(err.fields ? { fields: err.fields } : {}) };
      return reply.code(err.status).send(body);
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status === 429) {
      return reply
        .code(429)
        .send({ error: 'Muitas tentativas. Aguarde um instante e tente de novo.' });
    }
    if (status >= 400 && status < 500) {
      return reply.code(status).send({ error: 'Requisição inválida' });
    }
    req.log.error({ err }, 'erro não tratado');
    return reply
      .code(500)
      .send({ error: config.isProd ? 'Erro interno. Tente novamente.' : String(err.message) });
  });
}
