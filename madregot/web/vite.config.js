import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// BASE_PATH lets the same build live at a GitHub Pages sub-path, e.g. /madregot/.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: { fs: { allow: ['..'] } },
  build: {
    rollupOptions: {
      output: {
        // Libraries change less often than the app: separate files stay cached between releases.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/katex/')) return 'katex';
          if (/\/(react-markdown|remark-|rehype-|micromark|mdast-|hast-|unist-|unified|vfile|property-information|space-separated|comma-separated|decode-named|character-entities|estree-|devlop|bail|trough|zwitch|ccount|longest-streak|markdown-table|html-url-attributes|style-to|inline-style)/.test(id)) return 'markdown';
          return undefined;
        },
      },
    },
  },
  test: { environment: 'node' },
});
