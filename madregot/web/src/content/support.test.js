import { describe, it, expect } from 'vitest';
import { SUPPORT } from '@shared/safety.js';
import { supportLines, supportText, SUPPORT_VARIANTS, SUPPORT_LINK, waLink } from './support.js';

const all = (lines) => lines.services.flatMap((s) => s.links);
const byLabel = (lines, label) => all(lines).find((l) => l.label.startsWith(label));

describe('supportLines: the support card, built from SUPPORT', () => {
  it('shows the same numbers as SUPPORT, with their hours', () => {
    for (const v of SUPPORT_VARIANTS) {
      const text = supportText(supportLines(SUPPORT, v));
      for (const n of [SUPPORT.eran.phone, SUPPORT.eran.whatsapp, SUPPORT.sahar.whatsapp, SUPPORT.online.phone, SUPPORT.police, SUPPORT.mda]) {
        expect(text).toContain(n);
      }
      expect(text).toContain('1201'); expect(text).toContain('052-845-1201'); expect(text).toContain('055-957-1399');
      expect(text).toContain('105'); expect(text).toContain('100'); expect(text).toContain('101');
      expect(text).toContain(SUPPORT.sahar.hours);
    }
  });

  it('every phone is a tel: link and every WhatsApp entry a wa.me link, to the right number', () => {
    const lines = supportLines(SUPPORT, 'opened');
    expect(byLabel(lines, 'חיוג 1201').href).toBe('tel:1201');
    expect(byLabel(lines, 'חיוג 105').href).toBe('tel:105');
    expect(byLabel(lines, 'משטרה 100').href).toBe('tel:100');
    expect(byLabel(lines, 'מד״א 101').href).toBe('tel:101');
    expect(byLabel(lines, 'וואטסאפ 052-845-1201').href).toBe('https://wa.me/972528451201');
    expect(byLabel(lines, 'וואטסאפ 055-957-1399').href).toBe('https://wa.me/972559571399');
    for (const l of all(lines)) {
      if (l.kind === 'phone') expect(l.href).toMatch(/^tel:\d+$/);
      if (l.kind === 'whatsapp') {
        expect(l.href).toMatch(/^https:\/\/wa\.me\/972\d{9}$/);
        expect(l.href).toBe(waLink(l.label.replace('וואטסאפ ', ''))); // the link dials the number the label shows
      }
      if (l.kind === 'web') expect(l.href).toMatch(/^https:\/\//);
    }
    expect(all(lines).filter((l) => l.kind === 'web').map((l) => l.href)).toEqual([SUPPORT.eran.web, SUPPORT.sahar.web]);
  });

  it('says that ער״ן\'s WhatsApp and chat keep hours (only the phone is at any hour)', () => {
    const eran = supportLines(SUPPORT, 'after-message').services.find((s) => s.id === 'eran');
    expect(eran.hours).toBe('וואטסאפ וצ׳אט: 08:00–02:00');
    expect(eran.hours).toContain(SUPPORT.eran.textHours);
    expect(eran.links.find((l) => l.kind === 'whatsapp').label).not.toContain('בכל שעה');
    expect(eran.links.find((l) => l.kind === 'phone').label).toBe('חיוג 1201 · בכל שעה');
  });

  it('the "opened" variant never says "מה שכתבתם": nothing was written', () => {
    const opened = supportText(supportLines(SUPPORT, 'opened'));
    expect(opened).not.toContain('מה שכתבתם');
    expect(supportLines(SUPPORT, 'opened').opening).toBe('אם משהו מציק לכם, מפחיד או מעציב אתכם, לא צריך להתמודד עם זה לבד.');
    expect(supportLines(SUPPORT, 'after-message').opening).toBe('מה שכתבתם חשוב. לא צריך להתמודד עם זה לבד.');
    expect(supportLines(SUPPORT, 'help-note').footer).toBe('המורה יראה את מה שכתבתם בבקשה.');
    expect(supportLines(SUPPORT, 'help-note').talkSent).not.toContain('לא נשלח'); // the note did go to the teacher
    expect(supportLines(SUPPORT, 'unknown')).toEqual(supportLines(SUPPORT, 'opened'));
  });

  it('speaks calmly: the link, the title, no price, no countdown, no pressure', () => {
    const lines = supportLines(SUPPORT, 'after-message');
    expect(lines.link).toBe(SUPPORT_LINK);
    expect(SUPPORT_LINK).toBe('צריכים לדבר עם מישהו?');
    expect(lines.title).toBe('חשוב לנו שתהיו בסדר');
    expect(lines.close).toBe('חזרה');
    for (const v of SUPPORT_VARIANTS) {
      expect(supportText(supportLines(SUPPORT, v))).not.toMatch(/₪|מנוי|שאלות ביום|דקות|מהר|!/);
    }
  });
});
