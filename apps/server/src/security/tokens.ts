import { EncryptJWT, jwtDecrypt } from 'jose';
import { config } from '../config';
import { tokenEncryptionKey } from './crypto';

/**
 * Token de acesso = JWT **criptografado** (JWE, alg `dir` + enc `A256GCM`).
 * Diferente de um JWT assinado comum, o conteúdo (usuário, sessão) não é legível por quem
 * intercepta o token, e a tag do AES-GCM garante a integridade. Validamos emissor, público,
 * tipo e expiração. Dura 15 min; a renovação usa o refresh token opaco guardado no banco.
 */
const ISSUER = 'mars-outpost';
const AUDIENCE = 'mars-outpost:web';

export type TokenKind = 'access' | 'socket';

export interface TokenClaims {
  userId: string;
  sessionId: string;
  kind: TokenKind;
}

export async function issueToken(
  c: Omit<TokenClaims, 'kind'>,
  kind: TokenKind = 'access',
): Promise<string> {
  const ttl = kind === 'access' ? config.accessTtlSeconds : config.socketTicketTtlSeconds;
  return new EncryptJWT({ sid: c.sessionId, kind })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(c.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .encrypt(tokenEncryptionKey);
}

export async function verifyToken(
  token: string | undefined,
  kind: TokenKind = 'access',
): Promise<TokenClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, tokenEncryptionKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
      clockTolerance: 5,
    });
    if (payload.kind !== kind || !payload.sub || typeof payload.sid !== 'string') return null;
    return { userId: payload.sub, sessionId: payload.sid, kind };
  } catch {
    return null;
  }
}
