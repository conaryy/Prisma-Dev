import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    watch: {
      ignored: [
        '**/backend/vendor/**',
        '**/backend/storage/**',
        '**/backend/bootstrap/**',
        '**/backend/public/**',
        '**/node_modules/**',
        '**/.git/**',
      ],
    },
  },
});
