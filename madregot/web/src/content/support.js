// The words of the support card and sheet (trust spec TRUST-3 §3.5, Appendix E.1), built from SUPPORT in
// shared/helpLines.js (re-exported by shared/safety.js) so the numbers, their links and their hours have one source.
// Calm, short, plural: the child is never pushed, never counted down, and chooses whom to talk to. The words are in the
// app's language (lib/i18n.js); the services' names and hours too (shell.support.svc.*: the Hebrew ones are SUPPORT's
// own, support.test.js holds them equal).
import { localized, t } from '@/lib/i18n.js';

/** The quiet link that opens the support sheet: the chat, the resting chat, the "not connected" chat, the limit sheet, Settings. */
export let SUPPORT_LINK = localized(() => t('shell.support.1'), (v) => { SUPPORT_LINK = v; });

/**
/**
 * The card's variants: under a message to the tutor that flagged ('after-message'), opened from a link with nothing
 * written ('opened'), under words to the teacher that read as distress (FOLLOWUP-9): they went ('help-note'), the
 * server read them, marked the request and refused them, a phone number in an answer say ('help-held'), or they never
 * reached the server ('help-unsent'); and under a message the tutor could not take that is not about maths ('held',
 * COUNCIL2-1/4: it says the tutor is not answering now, and that what was written was sent to no one). Only the
 * tutor's speak of the tutor.
 */
export const SUPPORT_VARIANTS = Object.freeze(['after-message', 'opened', 'help-note', 'help-held', 'help-unsent', 'held']);

let OPENING = localized(() => ({
  'after-message': t('shell.support.2'),
  opened: t('shell.support.3'),
  'help-note': t('shell.support.2'),
  'help-held': t('shell.support.2'),
  'help-unsent': t('shell.support.2'),
  held: t('shell.support.held.opening'),
}), (v) => { OPENING = v; });
// what is true about the words after this moment: the tutor keeps none; the teacher reads them, sees only the mark
// (worker/src/help.js studentReply), or nothing has gone yet and they wait in the field; a held message went nowhere
let FOOTER = localized(() => ({
  'after-message': t('shell.support.4'),
  opened: t('shell.support.5'),
  'help-note': t('shell.support.6'),
  'help-held': t('shell.support.helpHeld.footer'),
  'help-unsent': t('shell.support.helpUnsent.footer'),
  held: t('shell.support.held.footer'),
}), (v) => { FOOTER = v; });
// After "ask the teacher to talk with me": only under a message to the tutor does "what you wrote was not sent" add
// anything (from a link nothing was written; in the help sheet the note went, or the footer already says it did not).
let TALK_SENT = localized(() => ({
  'after-message': t('shell.support.7'),
  opened: t('shell.support.8'),
  'help-note': t('shell.support.8'),
  'help-held': t('shell.support.8'),
  'help-unsent': t('shell.support.8'),
  held: t('shell.support.7'),
}), (v) => { TALK_SENT = v; });

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
  const { police, mda } = SUPPORT;
  // the names and the hours in words, in the current language; the numbers, links and clock times are SUPPORT's
  const eran = { ...SUPPORT.eran, name: t('shell.support.svc.eran'), phoneHours: t('shell.support.svc.always') };
  const sahar = { ...SUPPORT.sahar, name: t('shell.support.svc.sahar'), hours: t('shell.support.svc.saharHours') };
  const online = { ...SUPPORT.online, hours: t('shell.support.svc.always') };
  return {
    link: SUPPORT_LINK,
    title: t('shell.support.9'),
    // under anything written, the first number is in the card's head too, so it is on the screen at once on a small phone
    quick: v === 'opened' ? null : { label: t('shell.support.10', { name: eran.name, phone: eran.phone }), href: tel(eran.phone), aria: t('shell.support.11', { name: eran.name, phone: eran.phone, phoneHours: eran.phoneHours }) },
    opening: OPENING[v],
    adult: t('shell.support.12'),
    now: t('shell.support.13'),
    services: [
      {
        id: 'eran', name: eran.name,
        links: [
          { kind: 'phone', label: t('shell.support.14', { phone: eran.phone, phoneHours: eran.phoneHours }), href: tel(eran.phone) },
          { kind: 'whatsapp', label: t('shell.support.15', { whatsapp: eran.whatsapp }), href: eran.wa },
          { kind: 'web', label: t('shell.support.16'), href: eran.web },
        ],
        hours: t('shell.support.17', { textHours: eran.textHours }),
      },
      {
        id: 'sahar', name: sahar.name,
        links: [
          { kind: 'web', label: t('shell.support.16'), href: sahar.web },
          { kind: 'whatsapp', label: t('shell.support.15', { whatsapp: sahar.whatsapp }), href: sahar.wa },
        ],
        hours: sahar.hours,
      },
      {
        id: 'online', name: t('shell.support.18'), detail: t('shell.support.19'),
        links: [{ kind: 'phone', label: t('shell.support.20', { phone: online.phone, hours: online.hours }), href: tel(online.phone) }],
      },
      {
        id: 'danger', name: t('shell.support.21'),
        links: [
          { kind: 'phone', label: t('shell.support.22', { police }), href: tel(police) },
          { kind: 'phone', label: t('shell.support.23', { mda }), href: tel(mda) },
        ],
      },
    ],
    talk: t('shell.support.24'),
    talkBusy: t('shell.support.25'),
    talkSent: TALK_SENT[v],
    talkFailed: t('shell.support.26'),
    footer: FOOTER[v],
    close: t('shell.support.27'),
  };
}

/** Every word the card can show, for tests that read the copy. */
export function supportText(lines) {
  return [lines.link, lines.title, lines.quick?.label, lines.opening, lines.adult, lines.now,
    ...lines.services.flatMap((s) => [s.name, s.detail, ...s.links.map((l) => l.label), s.hours]),
    lines.talk, lines.talkSent, lines.talkFailed, lines.footer, lines.close].filter(Boolean).join('\n');
}

/** The kinds of personal detail the tutor never receives (trust spec TRUST-4 §4.1), as the quiet line names them. */
let PII_NAME = localized(() => ({ phone: t('shell.support.28'), email: t('shell.support.29'), id: t('shell.support.30'), address: t('shell.support.31') }), (v) => { PII_NAME = v; });

/**
 * The quiet line under a child's message that held personal details (masked before the tutor gets it): "הסרנו מהשאלה
 * מספר טלפון. אין צורך לשלוח לעוזר פרטים אישיים." `found` is maskPersonal(text).found; '' when nothing was found.
 */
export function piiLine(found = []) {
  const names = ['phone', 'email', 'id', 'address'].filter((k) => found.includes(k)).map((k) => PII_NAME[k]);
  if (!names.length) return '';
  const list = names.length === 1 ? names[0] : t('shell.support.32', { p0: names.slice(0, -1).join(', '), p1: names.at(-1) });
  return t('shell.support.33', { list });
}
