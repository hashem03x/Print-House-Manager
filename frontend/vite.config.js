import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // In development the app calls "/api" on its own origin and Vite forwards it
  // to the backend, so no CORS setup is needed locally.
  const proxy = {
    '/api': {
      target: env.VITE_DEV_PROXY_TARGET || 'http://localhost:5000',
      changeOrigin: true,
    },
  };

  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
