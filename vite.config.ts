import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages hosts this at https://<org>.github.io/test-coding-chess-advanced-2/
// so the base path must match the repo subpath.
const base = '/test-coding-chess-advanced-2/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5183,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
