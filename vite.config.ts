/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { kycEnrichDevPlugin } from './vite-kyc-enrich-plugin'
import { kycSummaryDevPlugin } from './vite-kyc-summary-plugin'
import { financePlaidDevPlugin } from './vite-finance-plaid-plugin'
import { switchDevPlugin } from './vite-switch-plugin'
import { automationBrowserDevPlugin } from './vite-automation-browser-plugin'
import { esignDevPlugin } from './vite-esign-plugin'

export default defineConfig({
  plugins: [
    react({
      // Exclude certain files from fast refresh that cause issues
      exclude: [/node_modules/],
      include: ['**/*.tsx', '**/*.ts'],
    }),
    kycEnrichDevPlugin(),
    kycSummaryDevPlugin(),
    financePlaidDevPlugin(),
    switchDevPlugin(),
    automationBrowserDevPlugin(),
    esignDevPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    strictPort: true,
    host: true,
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api/geocode': {
        target: 'https://geocoding-api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/geocode/, ''),
      },
      '/api/timezone': {
        target: 'https://api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/timezone/, ''),
      },
      // Native Agent Office → local SwarmClaw dev server (/api/office/foo → :3456/api/foo)
      '/api/office': {
        target: 'http://localhost:3456',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/office/, '/api'),
      },
    },
    watch: {
      // Ignore certain patterns that might cause excessive reloads
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'lucide-react': ['lucide-react'],
        },
      },
    },
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
})
