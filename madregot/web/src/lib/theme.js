// "Electric Premium" has two surfaces: black for home, missions, results and transitions (the default, set on
// <html data-theme="dark"> in index.html), and white for the learning itself (exercises, graphs, explanations).
// A learning screen asks for white while it is open; leaving it brings the black back.
import { useEffect } from 'react';

const META = { dark: '#000000', light: '#ffffff' };

export function setTheme(theme) {
  const html = document.documentElement;
  if (html.dataset.theme === theme) return;
  html.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[theme] || META.dark);
}

/** While the calling screen is mounted the page uses `theme` ('light' or 'dark'); afterwards it returns to dark. */
export function useTheme(theme) {
  useEffect(() => { setTheme(theme); }, [theme]);
  useEffect(() => () => setTheme('dark'), []);
}
