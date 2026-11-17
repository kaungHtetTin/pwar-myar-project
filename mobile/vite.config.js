import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    optimizeDeps: {
      include: ['html5-qrcode'],
    },
    build: mode === 'laravel' ? { outDir: '../laravel/public/mobile', emptyOutDir: true } : undefined,
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: false,
    },
    server: {
      host: '127.0.0.1',
      port: 5176,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_ORIGIN || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/sanctum': {
          target: env.VITE_DEV_API_ORIGIN || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
