import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Generated demo files (seed resumes, recorded videos) aren't app source;
    // watching a large video while it's being written crashes Vite on Windows.
    watch: { ignored: ['**/demo-output/**', '**/demo-resumes/**', '**/backups/**', '**/uploads/**'] },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
