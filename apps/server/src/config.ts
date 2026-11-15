import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Origens permitidas do site (separadas por vírgula). */
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  /** Segredo do servidor: usado no HMAC da chave do cookie do jogador. */
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
} as const;

if (
  config.isProd &&
  config.cookieSameSite === 'none' &&
  config.webOrigins.some((o) => !o.startsWith('https://'))
) {
  throw new Error('COOKIE_SAMESITE=none exige WEB_ORIGIN com https://');
}
