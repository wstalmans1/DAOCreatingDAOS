import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'global': 'globalThis',
    'Buffer': 'globalThis.Buffer',
    'util': 'globalThis.util',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      util: 'util',
      process: 'process',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'util', 'process'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          wagmi: ['wagmi', '@tanstack/react-query'],
          rainbowkit: ['@rainbow-me/rainbowkit'],
        },
      },
    },
  },
})
