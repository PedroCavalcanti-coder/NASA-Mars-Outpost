import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Origens permitidas do site (separadas por vírgula). A primeira é usada nos links de e-mail. */
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  /** Segredo-mestre: dele saem as chaves de criptografia do token, do HMAC e do pepper de senha. */
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET precisa ter ao menos 32 caracteres (npm run secret:jwt)'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL (Neon) não definido'),
  /** Atrás de proxy/CDN (Render, Fly, Vercel…): confiar no X-Forwarded-For. */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** `none` só é necessário se o site e a API ficarem em domínios diferentes (exige HTTPS). */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
}
const env = parsed.data;

const origins = env.WEB_ORIGIN.split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  webOrigins: origins,
  primaryOrigin: origins[0] ?? 'http://localhost:5173',
  jwtSecret: env.JWT_SECRET,
  databaseUrl: env.DATABASE_URL,
  trustProxy: env.TRUST_PROXY,
  cookieSameSite: env.COOKIE_SAMESITE,
  cookies: { access: 'mo_at', refresh: 'mo_rt' },
  /** Vida do token de acesso (JWE) e da sessão (refresh). */
  accessTtlSeconds: 15 * 60,
  socketTicketTtlSeconds: 60,
  refreshTtlSeconds: 30 * 24 * 60 * 60,
  /** Janela em que um refresh repetido (duas abas) é aceito sem derrubar a sessão. */
  refreshGraceSeconds: 15,
  resetTtlSeconds: 60 * 60,
  maxFailedLogins: 5,
  lockSeconds: 15 * 60,
} as const;

if (
  config.isProd &&
  config.cookieSameSite === 'none' &&
  config.webOrigins.some((o) => !o.startsWith('https://'))
) {
  throw new Error('COOKIE_SAMESITE=none exige WEB_ORIGIN com https://');
}
