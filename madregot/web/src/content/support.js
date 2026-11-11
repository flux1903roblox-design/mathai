// The words of the support card and sheet (trust spec TRUST-3 §3.5, Appendix E.1), built from SUPPORT in
// shared/safety.js so the numbers, their links and their hours have one source. Calm, short, plural: the child is never
// pushed, never counted down, and chooses whom to talk to.

/** The quiet link that opens the support sheet: the chat, the resting chat, the "not connected" chat, the limit sheet, Settings. */
export const SUPPORT_LINK = 'צריכים לדבר עם מישהו?';

/**
 * The card's variants: under a message to the tutor that flagged ('after-message'), opened from a link with nothing
 * written ('opened'), and under words to the teacher that read as distress (FOLLOWUP-9): they went ('help-note'), the
 * server read them, marked the request and refused them, a phone number in an answer say ('help-held'), or they never
 * reached the server ('help-unsent'). Only the tutor's two speak of the tutor.
 */
export const SUPPORT_VARIANTS = Object.freeze(['after-message', 'opened', 'help-note', 'help-held', 'help-unsent']);

const WROTE = 'מה שכתבתם חשוב. לא צריך להתמודד עם זה לבד.';
const OPENING = {
  'after-message': WROTE,
  opened: 'אם משהו מציק לכם, מפחיד או מעציב אתכם, לא צריך להתמודד עם זה לבד.',
  'help-note': WROTE,
  'help-held': WROTE,
  'help-unsent': WROTE,
};
// what is true about the words after this moment: the tutor keeps none; the teacher reads them, sees only the mark
// (worker/src/help.js studentReply), or nothing has gone yet and they wait in the field
const FOOTER = {
  'after-message': 'העוזר החכם הוא תוכנה, לא אדם. מה שכתבתם לעוזר לא נשמר אצלנו.',
  opened: 'העוזר החכם הוא תוכנה, לא אדם.',
  'help-note': 'המורה יראה את מה שכתבתם בבקשה.',
  'help-held': 'מה שכתבתם לא נשלח. המורה יראה ליד הבקשה רק סימון: ״כדאי לבדוק מה שלום התלמיד/ה״.',
  'help-unsent': 'מה שכתבתם עוד לא נשלח. הוא מחכה כאן, ואפשר לשלוח שוב.',
};
// After "ask the teacher to talk with me": only under a message to the tutor does "what you wrote was not sent" add
// anything (from a link nothing was written; in the help sheet the note went, or the footer already says it did not).
const TALK_SENT = {
  'after-message': 'שלחנו למורה שאתם רוצים לדבר. מה שכתבתם לא נשלח.',
  opened: 'שלחנו למורה שאתם רוצים לדבר.',
  'help-note': 'שלחנו למורה שאתם רוצים לדבר.',
  'help-held': 'שלחנו למורה שאתם רוצים לדבר.',
  'help-unsent': 'שלחנו למורה שאתם רוצים לדבר.',
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
    // under anything written, the first number is in the card's head too, so it is on the screen at once on a small phone
    quick: v === 'opened' ? null : { label: `${eran.name} · חיוג ${eran.phone}`, href: tel(eran.phone), aria: `${eran.name}, חיוג ${eran.phone}, ${eran.phoneHours}` },
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
  return [lines.link, lines.title, lines.quick?.label, lines.opening, lines.adult, lines.now,
    ...lines.services.flatMap((s) => [s.name, s.detail, ...s.links.map((l) => l.label), s.hours]),
    lines.talk, lines.talkSent, lines.talkFailed, lines.footer, lines.close].filter(Boolean).join('\n');
}

/** The kinds of personal detail the tutor never receives (trust spec TRUST-4 §4.1), as the quiet line names them. */
const PII_NAME = { phone: 'מספר טלפון', email: 'כתובת מייל', id: 'מספר זהות' };

/**
 * The quiet line under a child's message that held personal details (masked before the tutor gets it): "הסרנו מהשאלה
 * מספר טלפון. אין צורך לשלוח לעוזר פרטים אישיים." `found` is maskPersonal(text).found; '' when nothing was found.
 */
export function piiLine(found = []) {
  const names = ['phone', 'email', 'id'].filter((k) => found.includes(k)).map((k) => PII_NAME[k]);
  if (!names.length) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} ו${names.at(-1)}`;
  return `הסרנו מהשאלה ${list}. אין צורך לשלוח לעוזר פרטים אישיים.`;
}
