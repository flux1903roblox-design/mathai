// Test hooks are on in a QA build (VITE_QA_HOOKS=1, the staging copy) or with localStorage 'madregot-debug' set.
export function qaOn() {
  let on = import.meta.env.VITE_QA_HOOKS === '1';
  try { on = on || !!localStorage.getItem('madregot-debug'); } catch { /* storage blocked */ }
  return on;
}
