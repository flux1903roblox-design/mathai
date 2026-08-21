import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the app under /mathai/; local dev stays at /
  base: mode === 'production' ? '/mathai/' : '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
}))
