/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/agent': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['tests/unit/agent/**', 'node'],
      ['tests/unit/mcp/**', 'node'],
      ['tests/unit/tools/**', 'node'],
      ['tests/unit/utils/**', 'node'],
      ['tests/integration/**', 'node'],
      ['tests/unit/client/**', 'jsdom'],
    ],
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
