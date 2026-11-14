import { EncryptJWT, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { macToken, randomToken, safeEqualHex, tokenEncryptionKey } from './crypto';
import { burnPasswordTime, hashPassword, needsRehash, verifyPassword } from './password';
import { issueToken, verifyToken } from './tokens';

describe('senhas (scrypt + pepper)', () => {
  it('aceita a senha correta e rejeita a errada', async () => {
    const hash = await hashPassword('astronauta-123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('astronauta-123', hash)).toBe(true);
    expect(await verifyPassword('astronauta-124', hash)).toBe(false);
  });

  it('usa sal diferente a cada hash', async () => {
    const [a, b] = await Promise.all([
      hashPassword('mesma-senha-1'),
      hashPassword('mesma-senha-1'),
    ]);
    expect(a).not.toBe(b);
  });

  it('não guarda a senha em claro e rejeita formato inválido', async () => {
    const hash = await hashPassword('segredo-muito-forte');
    expect(hash).not.toContain('segredo-muito-forte');
    expect(await verifyPassword('x', 'lixo')).toBe(false);
    expect(needsRehash(hash)).toBe(false);
    expect(needsRehash('scrypt$1024$8$1$a$b')).toBe(true);
  });

  it('burnPasswordTime não lança', async () => {
    await expect(burnPasswordTime('qualquer')).resolves.toBeUndefined();
  });
});

describe('tokens de acesso (JWE)', () => {
  const claims = { userId: '0b0b3a64-3f43-4c1d-9d27-0f0a5d9a1a11', sessionId: 'sess-1' };

  it('emite e valida', async () => {
    const t = await issueToken(claims);
    expect(await verifyToken(t)).toEqual({ ...claims, kind: 'access' });
  });

  it('é criptografado: o conteúdo não é legível', async () => {
    const t = await issueToken(claims);
    expect(t.split('.')).toHaveLength(5); // JWE compacto (um JWT assinado teria 3 partes)
    const decoded = Buffer.from(t.split('.').join(''), 'base64url').toString('latin1');
    expect(decoded).not.toContain(claims.userId);
  });

  it('não aceita token de socket como acesso (e vice-versa)', async () => {
    const socket = await issueToken(claims, 'socket');
    expect(await verifyToken(socket, 'access')).toBeNull();
    expect(await verifyToken(socket, 'socket')).not.toBeNull();
  });

  it('rejeita lixo, token adulterado e JWT apenas assinado', async () => {
    expect(await verifyToken(undefined)).toBeNull();
    expect(await verifyToken('abc')).toBeNull();
    const t = await issueToken(claims);
    const parts = t.split('.');
    parts[3] = `${parts[3]?.slice(0, -2)}AA`; // mexe no texto cifrado
    expect(await verifyToken(parts.join('.'))).toBeNull();
    const signed = await new SignJWT({ sid: 'x', kind: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .sign(new TextEncoder().encode('segredo-de-teste-com-mais-de-trinta-e-dois-caracteres'));
    expect(await verifyToken(signed)).toBeNull();
  });

  it('rejeita token expirado e com emissor errado', async () => {
    const expired = await new EncryptJWT({ sid: 's', kind: 'access' })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuer('mars-outpost')
      .setAudience('mars-outpost:web')
      .setSubject(claims.userId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .encrypt(tokenEncryptionKey);
    expect(await verifyToken(expired)).toBeNull();
    const foreign = await new EncryptJWT({ sid: 's', kind: 'access' })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuer('outro')
      .setAudience('mars-outpost:web')
      .setSubject(claims.userId)
      .setExpirationTime('5m')
      .encrypt(tokenEncryptionKey);
    expect(await verifyToken(foreign)).toBeNull();
  });
});

describe('tokens opacos', () => {
  it('geram valores únicos de 256 bits', () => {
    const a = randomToken();
    expect(a).not.toBe(randomToken());
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
  });

  it('HMAC é determinístico e não revela o token', () => {
    const t = randomToken();
    expect(macToken(t)).toBe(macToken(t));
    expect(macToken(t)).not.toContain(t);
    expect(safeEqualHex(macToken(t), macToken(t))).toBe(true);
    expect(safeEqualHex(macToken(t), macToken(`${t}x`))).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });
});
