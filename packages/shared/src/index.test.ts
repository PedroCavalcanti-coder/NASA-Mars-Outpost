import { describe, expect, it } from 'vitest';
import {
  friendRequestSchema,
  GAME_NAME,
  loginSchema,
  PASSWORD_MIN,
  registerSchema,
  sendMessageSchema,
} from './index';

const valid = {
  name: '  Ana Lima ',
  username: 'Ana_Lima',
  email: ' ANA@Exemplo.com ',
  password: 'uma-senha-longa-1',
};

describe('shared', () => {
  it('expõe o nome do jogo', () => {
    expect(GAME_NAME).toBe('Mars Outpost');
  });
});

describe('schemas', () => {
  it('normaliza cadastro (trim, minúsculas)', () => {
    const r = registerSchema.parse(valid);
    expect(r).toMatchObject({ name: 'Ana Lima', username: 'ana_lima', email: 'ana@exemplo.com' });
  });

  it('rejeita senha curta, apelido com símbolos e e-mail inválido', () => {
    expect(
      registerSchema.safeParse({ ...valid, password: 'x'.repeat(PASSWORD_MIN - 1) }).success,
    ).toBe(false);
    expect(registerSchema.safeParse({ ...valid, username: 'ana lima!' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, email: 'nao-e-email' }).success).toBe(false);
  });

  it('login aceita qualquer senha não vazia', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('pedido de amizade usa apelido; mensagem exige uuid e texto', () => {
    expect(friendRequestSchema.parse({ username: 'Joao_9' }).username).toBe('joao_9');
    expect(sendMessageSchema.safeParse({ to: 'nope', text: 'oi' }).success).toBe(false);
    expect(
      sendMessageSchema.safeParse({ to: '0b0b3a64-3f43-4c1d-9d27-0f0a5d9a1a11', text: '   ' })
        .success,
    ).toBe(false);
  });
});
