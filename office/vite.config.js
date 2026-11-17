import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE_PATH || '/',
  publicDir: '../frontend/public',
  plugins: [react()],
  build: mode === 'laravel' ? { outDir: '../laravel/public/office', emptyOutDir: true } : undefined,
  test: { environment: 'jsdom', setupFiles: './src/test/setup.js' },
  server: {
    host: '127.0.0.1', port: 5175, strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/sanctum': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
}));
