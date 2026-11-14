import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Em desenvolvimento, /api e /socket.io vão para o servidor local.
const api = process.env.API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { '/api': api, '/socket.io': { target: api, ws: true } },
  },
});
