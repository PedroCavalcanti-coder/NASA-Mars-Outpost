import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

/**
 * Chaves independentes derivadas do JWT_SECRET com HKDF-SHA256.
 * Vazar uma chave (ex.: o pepper) não revela as outras, e o segredo-mestre nunca é usado direto.
 */
function derive(label: string, bytes = 32): Buffer {
  return Buffer.from(
    hkdfSync('sha256', config.jwtSecret, 'mars-outpost/v1', `mars-outpost:${label}`, bytes),
  );
}

/** Chave AES-256-GCM do token de acesso (JWE). */
export const tokenEncryptionKey = new Uint8Array(derive('token-encryption'));
/** Chave do HMAC que protege tokens opacos guardados no banco (refresh, reset de senha). */
const macKey = derive('token-mac');
/** Pepper aplicado à senha antes do scrypt: um dump do banco sozinho não basta para quebrá-las. */
const pepperKey = derive('password-pepper');

/** Token aleatório de 256 bits em base64url. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** HMAC-SHA256 em hex: o que se guarda no banco no lugar do token em si. */
export function macToken(token: string): string {
  return createHmac('sha256', macKey).update(token).digest('hex');
}

export function pepper(password: string): Buffer {
  return createHmac('sha512', pepperKey).update(password.normalize('NFKC')).digest();
}

/** Comparação em tempo constante de duas strings hex. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}
