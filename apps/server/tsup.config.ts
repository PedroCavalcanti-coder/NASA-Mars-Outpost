import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // os pacotes do monorepo são TypeScript puro: entram no bundle
  noExternal: [/^@mars\//],
});
