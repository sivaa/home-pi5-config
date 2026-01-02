import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for deployment at /v2/
  base: '/v2/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  // Static export for nginx serving on Pi
  build: {
    outDir: 'dist',
    // Generate static assets
    rollupOptions: {
      output: {
        // Keep chunk names predictable for caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  // Dev server config for local testing
  server: {
    port: 5173,
    // Allow CORS for MQTT WebSocket on Pi
    cors: true,
  },
})
