// Round 17: one light look everywhere (the category standard). The screens that used to switch between the black
// and the white surfaces still call useTheme; the page simply stays light.
import { useEffect } from 'react';

export function setTheme(theme) {
  const html = document.documentElement;
  if (html.dataset.theme !== theme) html.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
}

/** Kept for the screens that call it; the app has one light theme. */
export function useTheme() {
  useEffect(() => { setTheme('light'); }, []);
}
