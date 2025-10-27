import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // Prevent Vite from reading files outside the project
  server: {
    fs: {
      strict: true,
      deny: ['.git'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:7000',
        changeOrigin: true,
      },
    },
    allowedHosts: ['miqattravels.com','https://miqattravels.com','www.miqattravels.com'],
  },
});
