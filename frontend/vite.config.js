import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const defaultBase = './';

  return {
    define: mode === 'desktop' ? {
      'import.meta.env.VITE_DESKTOP_VERSION': JSON.stringify(JSON.parse(readFileSync(new URL('../desktop/package.json', import.meta.url), 'utf8')).version),
    } : {},
    base: env.VITE_BASE_PATH || defaultBase,
    plugins: [react()],
    build: mode === 'laravel'
      ? { outDir: '../laravel/public/app', emptyOutDir: true }
      : mode === 'desktop'
        ? { outDir: 'dist-desktop', emptyOutDir: true }
        : undefined,
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: false,
    },
    server: {
      host: '127.0.0.1',
      port: 5174,
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
