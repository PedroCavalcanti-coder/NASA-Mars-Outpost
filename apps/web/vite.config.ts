import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Em desenvolvimento, /api e /socket.io vão para o servidor local (mesma origem: cookies sem CORS).
const api = process.env.API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // escuta em todas as interfaces: quem está na mesma rede acessa por http://<seu-ip>:5173
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { '/api': api, '/socket.io': { target: api, ws: true } },
  },
  build: { target: 'es2022' },
});
