import { describe, expect, it } from 'vitest';
import { originAllowed } from './origin';

describe('origens HTTP e Socket.IO', () => {
  it.each([
    'http://192.168.20.113:5173',
    'http://10.0.0.2:5173',
    'http://172.16.0.2:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://[::1]:5173',
  ])('aceita desenvolvimento na rede local: %s', (origin) => {
    expect(originAllowed(origin)).toBe(true);
  });
  it.each([
    'http://localhost.evil.example',
    'http://192.168.evil.example',
    'http://172.32.1.1',
    'http://evil.example',
    'null',
    'file:///etc/passwd',
  ])('recusa origem estranha: %s', (origin) => {
    expect(originAllowed(origin)).toBe(false);
  });
  it('aceita a própria origem pelo Host do servidor', () => {
    expect(originAllowed('https://mars.example', 'mars.example')).toBe(true);
  });
});
