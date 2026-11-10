// The words of the support card and sheet (trust spec TRUST-3 §3.5, Appendix E.1), built from SUPPORT in
// shared/safety.js so the numbers, their links and their hours have one source. Calm, short, plural: the child is never
// pushed, never counted down, and chooses whom to talk to.

/** The quiet link that opens the support sheet: the chat, the resting chat, the "not connected" chat, the limit sheet, Settings. */
export const SUPPORT_LINK = 'צריכים לדבר עם מישהו?';

/** The card's variants: under a message that flagged, opened from a link (nothing was written), in the help sheet. */
export const SUPPORT_VARIANTS = Object.freeze(['after-message', 'opened', 'help-note']);

const OPENING = {
  'after-message': 'מה שכתבתם חשוב. לא צריך להתמודד עם זה לבד.',
  opened: 'אם משהו מציק לכם, מפחיד או מעציב אתכם, לא צריך להתמודד עם זה לבד.',
  'help-note': 'מה שכתבתם חשוב. לא צריך להתמודד עם זה לבד.',
};
const FOOTER = {
  'after-message': 'העוזר החכם הוא תוכנה, לא אדם. מה שכתבתם לעוזר לא נשמר אצלנו.',
  opened: 'העוזר החכם הוא תוכנה, לא אדם.',
  'help-note': 'המורה יראה את מה שכתבתם בבקשה.',
};
// After "ask the teacher to talk with me": only under a message does "what you wrote was not sent" add anything (from a
// link nothing was written; in the help sheet the note did go to the teacher).
const TALK_SENT = {
  'after-message': 'שלחנו למורה שאתם רוצים לדבר. מה שכתבתם לא נשלח.',
  opened: 'שלחנו למורה שאתם רוצים לדבר.',
  'help-note': 'שלחנו למורה שאתם רוצים לדבר.',
};

const digits = (phone) => String(phone).replace(/\D/g, '');
const tel = (phone) => `tel:${digits(phone)}`;
/** An Israeli mobile number as a wa.me link: 052-845-1201 → https://wa.me/972528451201. */
export const waLink = (number) => `https://wa.me/972${digits(number).replace(/^0/, '')}`;

/**
 * Everything the card shows, in order. services: { id, name, detail?, links: [{ kind: 'phone'|'whatsapp'|'web', label,
 * href }], hours? }. Every phone is a tel: link and every WhatsApp entry a wa.me link.
 */
export function supportLines(SUPPORT, variant = 'opened') {
  const v = SUPPORT_VARIANTS.includes(variant) ? variant : 'opened';
  const { eran, sahar, online, police, mda } = SUPPORT;
  return {
    link: SUPPORT_LINK,
    title: 'חשוב לנו שתהיו בסדר',
    opening: OPENING[v],
    adult: 'כדאי לספר עוד היום למבוגר שסומכים עליו: הורה, היועצת או היועץ בבית הספר, או מורה.',
    now: 'אפשר גם לדבר עכשיו, בחינם ובלי לומר שם:',
    services: [
      {
        id: 'eran', name: eran.name,
        links: [
          { kind: 'phone', label: `חיוג ${eran.phone} · ${eran.phoneHours}`, href: tel(eran.phone) },
          { kind: 'whatsapp', label: `וואטסאפ ${eran.whatsapp}`, href: eran.wa },
          { kind: 'web', label: 'צ׳אט באתר', href: eran.web },
        ],
        hours: `וואטסאפ וצ׳אט: ${eran.textHours}`,
      },
      {
        id: 'sahar', name: sahar.name,
        links: [
          { kind: 'web', label: 'צ׳אט באתר', href: sahar.web },
          { kind: 'whatsapp', label: `וואטסאפ ${sahar.whatsapp}`, href: sahar.wa },
        ],
        hours: sahar.hours,
      },
      {
        id: 'online', name: 'פגיעה ברשת', detail: 'הצקות, איומים, מישהו שמבקש תמונות',
        links: [{ kind: 'phone', label: `חיוג ${online.phone} · ${online.hours}`, href: tel(online.phone) }],
      },
      {
        id: 'danger', name: 'בסכנה עכשיו',
        links: [
          { kind: 'phone', label: `משטרה ${police}`, href: tel(police) },
          { kind: 'phone', label: `מד״א ${mda}`, href: tel(mda) },
        ],
      },
    ],
    talk: 'לבקש מהמורה לדבר איתי',
    talkBusy: 'שולחים…',
    talkSent: TALK_SENT[v],
    talkFailed: 'לא הצלחנו לשלוח עכשיו. אפשר לנסות שוב, או לדבר עם המורה בבית הספר.',
    footer: FOOTER[v],
    close: 'חזרה',
  };
}

/** Every word the card can show, for tests that read the copy. */
export function supportText(lines) {
  return [lines.link, lines.title, lines.opening, lines.adult, lines.now,
    ...lines.services.flatMap((s) => [s.name, s.detail, ...s.links.map((l) => l.label), s.hours]),
    lines.talk, lines.talkSent, lines.talkFailed, lines.footer, lines.close].filter(Boolean).join('\n');
}
