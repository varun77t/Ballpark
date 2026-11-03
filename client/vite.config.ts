import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache separately from app code.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          motion: ['framer-motion', 'canvas-confetti'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-tabs', '@radix-ui/react-tooltip', 'sonner', 'lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
