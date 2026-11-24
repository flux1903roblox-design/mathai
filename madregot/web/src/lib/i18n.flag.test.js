// Arabic is behind one build flag, off by default (VITE_ARABIC=on, lib/i18n.js; docs/ARABIC.md). The unit tests run
// with the flag on (vite.config.js test.env), so the Arabic the repository holds stays tested; this file loads the same
// modules with the flag off, as a default build has them: Hebrew is the only language, nothing can choose Arabic, and
// nothing Arabic is loaded.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fillBrand } from '../../scripts/vite-plugin-brand.mjs';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

/** The modules as a build with this flag value has them. */
async function withFlag(value) {
  vi.resetModules();
  vi.stubEnv('VITE_ARABIC', value);
  return import('./i18n.js');
}
const fakeWindow = (search, stored) => {
  const store = new Map(stored ? [['madregot-locale', stored]] : []);
  vi.stubGlobal('window', { location: { search, href: `https://app.example.test/${search}#/` }, history: { state: null, replaceState: vi.fn() }, dispatchEvent: () => {} });
  vi.stubGlobal('localStorage', { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) });
  return store;
};

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('the Arabic build flag', () => {
  it('the unit tests run with the flag on, and a build that does not set it has it off', async () => {
    expect(import.meta.env.VITE_ARABIC).toBe('on');
    expect((await withFlag('on')).ARABIC_ON).toBe(true);
    for (const off of ['', 'off', 'true', 'ON', undefined]) expect((await withFlag(off)).ARABIC_ON, String(off)).toBe(false);
    // no committed env file turns it on by itself
    for (const f of ['../../.env', '../../.env.production', '../../.env.local']) {
      let text = '';
      try { text = read(f); } catch { /* no such file */ }
      expect(text).not.toMatch(/VITE_ARABIC/);
    }
  });

  it('off: Hebrew is the only language; ?lang=ar, a stored choice and setLocale cannot turn Arabic on, and nothing Arabic is imported', async () => {
    for (const [search, stored] of [['?lang=ar', null], ['', 'ar'], ['?lang=ar', 'ar']]) {
      const store = fakeWindow(search, stored);
      const i18n = await withFlag('');
      expect(Object.keys(i18n.LOCALES)).toEqual(['he']);
      expect(await i18n.initLocale()).toBe('he');
      expect(i18n.locale()).toBe('he');
      expect(i18n.t('shell.welcome.1')).toMatch(/[א-ת]/);
      expect(await i18n.setLocale('ar')).toBe('he');
      expect(i18n.locale()).toBe('he');
      // a link's ?lang=ar is not remembered, and a choice stored by a build that had Arabic is left as it was
      expect(store.get('madregot-locale') ?? null).toBe(stored);
      expect(await i18n.importArabic()).toEqual({});
      await expect(i18n.loadLocale('ar')).resolves.toBeUndefined();
    }
  });

  it('off: the tutor is never asked for Arabic, and the content has no Arabic loader', async () => {
    fakeWindow('', 'ar');
    const i18n = await withFlag('');
    await i18n.initLocale();
    const { contentLang } = await import('@/content/arabic.js');
    expect(contentLang('signed:1')).toBe('he');
    // lib/ai.js adds `locale` to a request only when the app's language is not Hebrew
    expect(read('./ai.js')).toMatch(/if \(locale\(\) !== 'he'\) input = \{ \.\.\.input, locale: locale\(\) \}/);
    expect(i18n.locale()).toBe('he');
  });

  it('on: Arabic can be chosen, by a link or a stored choice, as before', async () => {
    const store = fakeWindow('?lang=ar', null);
    const i18n = await withFlag('on');
    expect(Object.keys(i18n.LOCALES)).toEqual(['he', 'ar']);
    expect(await i18n.initLocale()).toBe('ar');
    expect(store.get('madregot-locale')).toBe('ar');
    expect(i18n.t('shell.welcome.1')).toMatch(/[؀-ۿ]/);
  });

  it('every import of an Arabic file is written on the flag itself, so a build without it carries none', () => {
    // each of these files imports Arabic twins or catalogues; the import must sit behind `import.meta.env.VITE_ARABIC`
    // content/topics.js and learn/content/index.ts load a topic's twin behind the flag too: none since the round-3 merge
    // (content/arabic.js ARABIC_TOPICS is empty), and they come back there with the topic
    for (const [file, n] of [['./i18n.js', 2], ['../content/arabic.js', 4], ['../content/topics.js', 0], ['../learn/content/index.ts', 0]]) {
      const src = read(file);
      const imports = [...src.matchAll(/import\((['"])[^'"]*\.ar(?:\.(?:js|ts|json))?\1\)/g)];
      expect(imports.length, `${file}: its Arabic imports`).toBe(n);
      expect(src, file).toMatch(/import\.meta\.env\.VITE_ARABIC (?:===|!==) 'on'/);
    }
    // no other source file imports an Arabic twin (a new one must go behind the flag, and be added here)
    expect(read('../main.jsx')).not.toMatch(/\.ar(?:\.(?:js|ts|json))?['"]/);
  });

  it('the page says whether the build has Arabic (index.html\'s meta tag), and theme-boot.js reads only that', () => {
    const html = read('../../index.html');
    expect(html).toContain('<meta name="madregot-arabic" content="%ARABIC%" />');
    expect(fillBrand(html, {})).toContain('<meta name="madregot-arabic" content="off" />');
    expect(fillBrand(html, { VITE_ARABIC: 'off' })).toContain('content="off"');
    expect(fillBrand(html, { VITE_ARABIC: 'on' })).toContain('<meta name="madregot-arabic" content="on" />');
    const boot = read('../../public/theme-boot.js');
    // run the boot script against a page: only content "on" lets ?lang=ar or a stored choice set the page's language
    const run = (content, search, stored) => {
      const el = { lang: 'he', setAttribute() {} };
      const doc = { documentElement: el, querySelector: (sel) => (sel.includes('madregot-arabic') ? { content } : sel.includes('store-key') ? { content: 'madregot' } : null) };
      new Function('document', 'localStorage', 'location', boot)(doc, { getItem: (k) => (k === 'madregot-locale' ? stored : null) }, { search });
      return el.lang;
    };
    expect(run('on', '?lang=ar', null)).toBe('ar');
    expect(run('on', '', 'ar')).toBe('ar');
    for (const content of ['off', '%ARABIC%', '']) {
      expect(run(content, '?lang=ar', null), content).toBe('he');
      expect(run(content, '', 'ar'), content).toBe('he');
    }
  });
});
