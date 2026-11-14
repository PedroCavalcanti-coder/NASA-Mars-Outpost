import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { pepper } from './crypto';

/**
 * Senhas: HMAC-SHA512 com pepper -> scrypt (N=2^15, r=8, p=1, sal de 16 bytes por senha).
 * Formato guardado: `scrypt$N$r$p$salt$hash` (base64url). Os parâmetros ficam no próprio hash,
 * então dá para aumentá-los no futuro e rehashear no próximo login (`needsRehash`).
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64 } as const;

function derive(input: Buffer, salt: Buffer, N: number, r: number, p: number, keylen: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(input, salt, keylen, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p, keylen } = PARAMS;
  const key = await derive(pepper(password), salt, N, r, p, keylen);
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await derive(
    pepper(password),
    Buffer.from(salt, 'base64url'),
    +n,
    +r,
    +p,
    expected.length,
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function needsRehash(stored: string): boolean {
  const [alg, n, r, p] = stored.split('$');
  return (
    alg !== 'scrypt' || +(n ?? 0) !== PARAMS.N || +(r ?? 0) !== PARAMS.r || +(p ?? 0) !== PARAMS.p
  );
}

let dummy: Promise<string> | undefined;
/**
 * Verifica contra um hash falso quando o e-mail não existe, para que "e-mail inexistente"
 * e "senha errada" demorem o mesmo tempo (evita enumeração de contas por timing).
 */
export async function burnPasswordTime(password: string): Promise<void> {
  dummy ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(password, await dummy);
}
