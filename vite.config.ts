/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { geminiAskDevPlugin } from './vite.gemini-plugin'
import { foodSearchDevPlugin } from './vite.food-plugin'
import { integrationsDevPlugin } from './vite.integrations-plugin'
import { pushDevPlugin } from './vite.push-plugin'

export default defineConfig({
  plugins: [react(), geminiAskDevPlugin(), foodSearchDevPlugin(), integrationsDevPlugin(), pushDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    strictPort: true,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
