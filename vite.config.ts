import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'

export default defineConfig({
  plugins: [
    react(),
    eslint({
      cache: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['node_modules', 'dist'],
    }),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    global: 'globalThis',
    Buffer: 'globalThis.Buffer',
    util: 'globalThis.util',
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
