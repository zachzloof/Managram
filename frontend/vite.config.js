import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/posts': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/queue': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/schedule': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/captions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/settings': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/presets': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/tags': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/analytics': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/account': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/billing': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
