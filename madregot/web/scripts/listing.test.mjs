// The store listing (STUDENT-12 §4), store/listing.he.json, linted against the stores' limits and the product's rules:
// lengths, no English in the Hebrew text (except XP), no boasts the app cannot back, and topics that are the app's own.
// It lives here because vitest collects tests only under web/. The file is written by store/make-listing.mjs.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOPICS, topicsFor } from '@/content/index.js';
import { APP_NAME } from '../../shared/brand.js';
import { listing, description, privacyUrlFor, LISTING_FILE } from '../../store/make-listing.mjs';

const json = JSON.parse(readFileSync(LISTING_FILE, 'utf8'));
const template = readFileSync(fileURLToPath(new URL('../../store/description.he.md', import.meta.url)), 'utf8');
const topics = { 7: topicsFor('7').map((t) => t.title), 8: topicsFor('8').map((t) => t.title) };
/** Characters as the stores count them (code points; the Hebrew geresh ׳ and the dash – are one each). */
const len = (s) => [...s].length;
/** The privacy address the file has, if any: the one thing in it that depends on the owner's PUBLIC_URL. */
const privacyIn = (text) => /^מדיניות פרטיות: (\S+)$/m.exec(text)?.[1] || '';

/** Every Hebrew string shown to people: all but the review notes, which are English for the reviewers. */
const hebrew = [
  ['apple.name', json.apple.name], ['apple.subtitle', json.apple.subtitle], ['apple.promotionalText', json.apple.promotionalText],
  ['apple.keywords', json.apple.keywords], ['apple.description', json.apple.description],
  ['play.title', json.play.title], ['play.shortDescription', json.play.shortDescription], ['play.fullDescription', json.play.fullDescription],
];

describe('the store listing', () => {
  it('is what make-listing.mjs writes for the app as it is (the topics, the name, the template)', () => {
    expect(json).toEqual(listing({ appName: APP_NAME, topics, privacyUrl: privacyIn(json.apple.description), template }));
  });

  it('fits App Store Connect: name and subtitle 30, promotional text 170, keywords 100 with no space after a comma, description 4000', () => {
    expect(len(json.apple.name)).toBeLessThanOrEqual(30);
    expect(len(json.apple.subtitle)).toBeLessThanOrEqual(30);
    expect(len(json.apple.promotionalText)).toBeLessThanOrEqual(170);
    expect(len(json.apple.keywords)).toBeLessThanOrEqual(100);
    expect(json.apple.keywords).not.toMatch(/,\s|\s,/);
    expect(json.apple.keywords.split(',').every((k) => k.trim() === k && k.length > 0)).toBe(true);
    expect(len(json.apple.description)).toBeLessThanOrEqual(4000);
  });

  it('fits Play Console: title 30, short description 80, full description 4000', () => {
    expect(len(json.play.title)).toBeLessThanOrEqual(30);
    expect(len(json.play.shortDescription)).toBeLessThanOrEqual(80);
    expect(len(json.play.fullDescription)).toBeLessThanOrEqual(4000);
    expect(json.play.fullDescription).toBe(json.apple.description);
  });

  it('has no English letters in the Hebrew text, except XP (and the privacy address)', () => {
    for (const [field, text] of hebrew) {
      const bare = text.replace(/https:\/\/\S+/g, '').replace(/\bXP\b/g, '');
      expect(bare, field).not.toMatch(/[A-Za-z]/);
    }
  });

  it('makes no claim the app cannot back: no "הכי", "מספר 1", "כל תכנית הלימודים" or "100%"', () => {
    for (const [field, text] of hebrew) {
      for (const bad of [/הכי/, /מספר\s*1(?!\d)/, /כל\s+תכנית\s+הלימודים/, /כל\s+תוכנית\s+הלימודים/, /100\s*%/]) expect(text, field).not.toMatch(bad);
    }
  });

  it('names exactly the topics the app teaches, per grade, each one in TOPICS', () => {
    const line = (g) => new RegExp(`^• כיתה ${g}׳: (.+)$`, 'm').exec(json.apple.description)?.[1].split(', ');
    const titles = new Set(TOPICS.map((t) => t.title));
    for (const [g, names] of [['ז', line('ז')], ['ח', line('ח')]]) {
      expect(names, g).toBeTruthy();
      for (const n of names) expect(titles.has(n), `${n} (כיתה ${g}׳)`).toBe(true);
    }
    expect(line('ז')).toEqual(topics['7']);
    expect(line('ח')).toEqual(topics['8']);
  });

  it('uses the product\'s one name, and keeps the English review notes per store', () => {
    expect(json.apple.name.startsWith(`${APP_NAME}:`)).toBe(true);
    expect(json.play.title.startsWith(`${APP_NAME}:`)).toBe(true);
    expect(json.apple.description.startsWith(`${APP_NAME} היא`)).toBe(true);
    // Apple's reviewer reads nothing about a plan bought on the website (3.1.3(b)/(c)); Play's reads the AI report button
    expect(json.reviewNotes.apple).toMatch(/3\.1\.3\(c\)/);
    expect(json.reviewNotes.apple).toMatch(/5\.1\.2\(i\)/);
    expect(json.reviewNotes.apple).not.toMatch(/website|subscribe/i);
    expect(json.reviewNotes.play).toMatch(/consumption-only/);
    expect(json.reviewNotes.play).toMatch(/reported in the app/);
    for (const notes of Object.values(json.reviewNotes)) expect(notes).toMatch(/Test path: .*"מתחילים מההתחלה"/);
  });

  it('a privacy address, when there is one, is the app\'s https privacy page', () => {
    const url = privacyIn(json.apple.description);
    if (url) expect(url).toMatch(/^https:\/\/[^\s]+\/#\/privacy$/);
    expect(privacyUrlFor('https://madregot.example.test/')).toBe('https://madregot.example.test/#/privacy');
    expect(privacyUrlFor('')).toBe('');
    expect(privacyUrlFor('http://madregot.example.test')).toBe('');
  });

  it('the description template: every slot filled, and a line with an empty slot left out', () => {
    const out = description(template, { appName: 'שם', topics: { 7: ['א', 'ב'], 8: ['ג'] }, privacyUrl: '' });
    expect(out).not.toMatch(/\{\{/);
    expect(out).not.toMatch(/מדיניות פרטיות/);
    expect(out).toMatch(/^• כיתה ז׳: א, ב$/m);
    const withUrl = description(template, { appName: 'שם', topics: { 7: ['א'], 8: ['ג'] }, privacyUrl: 'https://x.example.test/#/privacy' });
    expect(withUrl.endsWith('מדיניות פרטיות: https://x.example.test/#/privacy')).toBe(true);
    expect(() => description('{{NOPE}}', { appName: 'x', topics: { 7: [], 8: [] } })).toThrow(/unknown slot/);
  });
});
