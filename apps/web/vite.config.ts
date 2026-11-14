import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Em desenvolvimento, /api e /socket.io vão para o servidor local (mesma origem: cookies sem CORS).
const api = process.env.API_URL ?? 'http://localhost:3001';

/**
 * Modelos 3D e animações ficam na pasta `Assets/` da raiz do repositório (fonte única, junto dos arquivos
 * do Blender). Este plugin os publica em `/assets/<pasta>/...` sem duplicá-los no código:
 * no `dev` serve direto do disco e no `build` inclui no `dist`. Só as pastas abaixo são públicas,
 * então os `.blend`, scripts e modelos brutos nunca vão para o site.
 */
const ASSETS_ROOT = resolve(__dirname, '../../Assets');
const PUBLIC_DIRS = ['bases', 'modelos'];
const TYPES: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function sharedAssets(): Plugin {
  return {
    name: 'mars-shared-assets',
    configureServer(server) {
      server.middlewares.use('/assets', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '').split('?')[0] ?? '')).replace(
          /^[\\/]+/,
          '',
        );
        const dir = rel.split(/[\\/]/)[0] ?? '';
        const file = join(ASSETS_ROOT, rel);
        if (
          !PUBLIC_DIRS.includes(dir) ||
          !file.startsWith(ASSETS_ROOT) ||
          !existsSync(file) ||
          !statSync(file).isFile()
        ) {
          return next();
        }
        // ETag + Last-Modified: o navegador (e o cache de modelos do jogo) revalida com HEAD/304
        // em vez de baixar de novo; editar um .glb continua refletindo na hora.
        const stat = statSync(file);
        const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('ETag', etag);
        res.setHeader('Last-Modified', stat.mtime.toUTCString());
        res.setHeader('Content-Length', stat.size);
        if (req.headers['if-none-match'] === etag) {
          res.statusCode = 304;
          res.end();
          return;
        }
        res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
      });
    },
    generateBundle() {
      for (const dir of PUBLIC_DIRS) {
        const full = join(ASSETS_ROOT, dir);
        if (!existsSync(full)) continue;
        for (const name of readdirSync(full)) {
          if (!(extname(name) in TYPES)) continue;
          this.emitFile({
            type: 'asset',
            fileName: `assets/${dir}/${name}`,
            source: readFileSync(join(full, name)),
          });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), sharedAssets()],
  server: {
    host: true, // escuta em todas as interfaces: quem está na mesma rede acessa por http://<seu-ip>:5173
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { '/api': api, '/socket.io': { target: api, ws: true } },
  },
  build: {
    target: 'es2022',
    // o three.js fica num pedaço separado: só é baixado ao entrar no jogo
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) },
    },
    chunkSizeWarningLimit: 800,
  },
});
