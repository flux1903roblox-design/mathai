import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import serviceWorker from './scripts/vite-plugin-sw.mjs';
import brand from './scripts/vite-plugin-brand.mjs';

// BASE_PATH lets the same build live at a GitHub Pages sub-path, e.g. /madregot/.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  // serviceWorker: dist/sw.js with the list of files kept for offline use (DURABLE-10)
  // brand: the product's name from shared/brand.js in index.html and the web manifest (STUDENT-12)
  plugins: [react(), brand(), serviceWorker()],
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
  // Unit tests only; the browser tests in e2e/ run with Playwright (npm run test:e2e).
  test: { environment: 'node', exclude: ['**/node_modules/**', 'e2e/**', 'dist-test/**', 'dist-ios-test/**'] },
});
