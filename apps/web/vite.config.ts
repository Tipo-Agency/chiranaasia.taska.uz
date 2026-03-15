import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: 'localhost',
        proxy: {
          '/api': { target: 'http://localhost:8000', changeOrigin: true },
          '/health': { target: 'http://localhost:8000', changeOrigin: true },
        },
        hmr: {
          overlay: false, // Отключаем overlay для более быстрой работы
          clientPort: 3000,
        },
        watch: {
          usePolling: true,
          interval: 100,
          ignored: ['**/node_modules/**', '**/.git/**'],
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['bcryptjs']
      }
    };
});
