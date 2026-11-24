// Writes <outDir>/.vite/modules.json after a build (STUDENT-15's budget gate): for every JavaScript chunk, its static
// imports, its dynamic imports and the source modules inside it. Vite's own manifest (vite build --manifest) names only
// each chunk's entry module, so a module bundled into the first chunk would be invisible there; scripts/check-budget.mjs
// reads this file to tell whether a module that must load on demand (the wardrobe, the reminder code, ...) has slipped
// into the first load.
import { relative, sep } from 'node:path';

/** A module id as a short path: node_modules/<package>/… or the path under the project (src/…, ../shared/…). */
export function shortId(id, root) {
  const clean = id.replace(/^\0/, '').split('?')[0];
  const nm = clean.lastIndexOf(`${sep}node_modules${sep}`);
  if (nm >= 0) return clean.slice(nm + 1).split(sep).join('/');
  return relative(root, clean).split(sep).join('/');
}

export default function budgetMap() {
  let root = process.cwd();
  return {
    name: 'madregot-budget-map',
    apply: 'build',
    configResolved(c) { root = c.root; },
    generateBundle(_, bundle) {
      const chunks = {};
      for (const [file, out] of Object.entries(bundle)) {
        if (out.type !== 'chunk') continue;
        chunks[file] = {
          isEntry: out.isEntry, imports: out.imports, dynamicImports: out.dynamicImports,
          modules: Object.keys(out.modules).map((id) => shortId(id, root)).sort(),
        };
      }
      this.emitFile({ type: 'asset', fileName: '.vite/modules.json', source: `${JSON.stringify(chunks)}\n` });
    },
  };
}
