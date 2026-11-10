import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The commit a build was made from, written into every save (meta.app) and every error report (lib/monitor.js), so both
// say which build they came from: the CI's commit, else the checkout's, else 'dev'.
function release() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'; } catch { return 'dev'; }
}
const RELEASE = release();

// BASE_PATH lets the same build live at a GitHub Pages sub-path, e.g. /madregot/.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  define: { __RELEASE__: JSON.stringify(RELEASE), 'import.meta.env.VITE_RELEASE': JSON.stringify(RELEASE) },
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
  // Unit tests only; the browser tests in e2e/ run with Playwright (npm run test:e2e).
  test: { environment: 'node', exclude: ['**/node_modules/**', 'e2e/**', 'dist-test/**'] },
});
