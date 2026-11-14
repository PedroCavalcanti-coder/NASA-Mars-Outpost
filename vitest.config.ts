import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/server/**/*.test.ts',
      'apps/web/src/**/*.test.{ts,tsx}',
    ],
    environment: 'node',
    // Valores falsos só para os testes unitários: nada aqui toca o banco real.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
      DATABASE_URL: 'postgresql://teste:teste@localhost/teste',
    },
  },
});
