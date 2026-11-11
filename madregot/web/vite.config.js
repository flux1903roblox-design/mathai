import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import swPlugin from './scripts/vite-plugin-sw.mjs';

// The commit a build was made from, written into every save (meta.app), every error report (lib/monitor.js) and the
// service worker's cache name (DURABLE-10), so all say which build they came from: VITE_RELEASE when it is set (the
// update test builds two releases), else the CI's commit, else the checkout's, else 'dev'.
function release() {
  if (process.env.VITE_RELEASE) return process.env.VITE_RELEASE.slice(0, 20);
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'; } catch { return 'dev'; }
}
const RELEASE = release();

// BASE_PATH lets the same build live at a GitHub Pages sub-path, e.g. /madregot/.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  define: { __RELEASE__: JSON.stringify(RELEASE), 'import.meta.env.VITE_RELEASE': JSON.stringify(RELEASE) },
  // the service worker (scripts/vite-plugin-sw.mjs): sw.js with this release's files, for the app to work offline
  plugins: [react(), swPlugin({ release: RELEASE })],
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
        // Libraries change less often than the app: a separate file stays cached between releases. The markdown
        // libraries need no rule: only components/Markdown.jsx imports them, and it loads on demand, so they are in its
        // file (a manual chunk also pulled React in with them, which put the whole chunk on the first download).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/katex/')) return 'katex';
          return undefined;
        },
      },
    },
  },
  // Unit tests only; the browser tests in e2e/ run with Playwright (npm run test:e2e).
  test: { environment: 'node', exclude: ['**/node_modules/**', 'e2e/**', 'dist-test/**'] },
});
