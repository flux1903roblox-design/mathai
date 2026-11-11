// /terms, /privacy, /accessibility and /safety (trust spec TRUST-2): the Hebrew texts in src/content/legal/*.md. The
// details they quote ({{NAME}}: the business, prices, limits, dates) come from the server's GET /api/billing/plans;
// without a server, or before the owner set one, a blank "______" shows. Until the owner's sign-off after the lawyer's
// review (plans.legalApproved, the LEGAL_APPROVED var), one banner says the text is a draft, and checkout stays closed.
//
// The app routes by the hash, so a section is reached as #/terms#cancel: a heading written "## ביטול והחזר {#cancel}"
// gets the id "cancel", and opening the page with that anchor scrolls to it and moves the focus there. A link in a text
// to an app page (/safety, /terms#cancel) moves inside the app without loading the page again.
import { Children, useEffect, useRef, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import { Link, useLocation } from 'react-router-dom';
import { hasServer } from '@/lib/api.js';
import { plans as loadPlans } from '@/lib/parent.js';
import { formatAgorot, vatLine, dateNum } from '@/lib/price.js';
import terms from '@/content/legal/terms.md?raw';
import privacy from '@/content/legal/privacy.md?raw';
import accessibility from '@/content/legal/accessibility.md?raw';
import safety from '@/content/legal/safety.md?raw';
import ParentsFrame from './ParentsFrame.jsx';

export const DOCS = {
  terms: { title: 'תקנון', text: terms },
  privacy: { title: 'מדיניות פרטיות', text: privacy },
  accessibility: { title: 'הצהרת נגישות', text: accessibility },
  safety: { title: 'בטיחות בעוזר החכם', text: safety },
};
export const DRAFT_TEXT = 'טיוטה לבדיקה משפטית. הנוסח עוד לא סופי.';
const BLANK = '______';

/** A YYYY-MM-DD var as people read it (2026-12-01 → 01.12.2026); anything else as it is. */
const asDay = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? dateNum(`${s}T12:00:00Z`) : s);
const asPrice = (a) => (Number.isInteger(a) && a > 0 ? formatAgorot(a) : '');

/**
 * Every {{NAME}} the legal texts may use, from the plans the server sent (null without a server). Prices are written
 * as the parents' page writes them (price.js), the limits are the server's, and DB_PLACE names the EU only when the
 * server says the database was made there. A missing value is left empty here and shows as "______".
 */
export function legalValues(plans) {
  const b = plans?.business || {};
  const acc = plans?.accessibility || {};
  const plan = (id) => plans?.plans?.find((p) => p.id === id) || {};
  const fam = plans?.limits?.family || {};
  return {
    BUSINESS_NAME: b.name, BUSINESS_ID: b.id, BUSINESS_KIND: b.kind, BUSINESS_ADDRESS: b.address,
    CONTACT_EMAIL: b.email || plans?.contact, CONTACT_PHONE: b.phone,
    TERMS_VERSION: plans?.termsVersion, LEGAL_DATE: asDay(plans?.legalDate),
    PRICE_MONTH: asPrice(plan('family_month').amountAgorot), PRICE_YEAR: asPrice(plan('family_year').amountAgorot),
    PRICE_SEAT: asPrice(plan('class_year').seatAgorot), VAT_LINE: plans?.vatMode ? vatLine(plans.vatMode) : '',
    FAMILY_TUTOR: fam.tutor, FAMILY_CHECK: fam.check, FAMILY_EXAM: fam.exam, FAMILY_EXAM_MONTH: fam.examMonthly,
    FAMILY_GENERATE: fam.generate, FAMILY_DEVICES: fam.devices, FREE_TUTOR: plans?.limits?.free?.tutor,
    PAYMENT_PROVIDER: b.provider, DB_PLACE: plans?.dbJurisdiction === 'eu' ? 'באיחוד האירופי' : '',
    ACCESS_NAME: acc.name, ACCESS_PHONE: acc.phone, ACCESS_EMAIL: acc.email, ACCESS_DATE: asDay(acc.date), ACCESS_TESTED: acc.tested,
  };
}
/** The names fillLegal knows (legal.test.js checks every {{NAME}} in the texts is one of them). */
export const LEGAL_PLACEHOLDERS = Object.freeze(Object.keys(legalValues(null)));

/** The text with every {{NAME}} filled from the plans (or a visible blank). */
export function fillLegal(text, plans) {
  const v = legalValues(plans);
  return String(text).replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => (v[k] === undefined || v[k] === null || v[k] === '' ? BLANK : String(v[k])));
}

/**
 * The text as a reader sees it. The page's own title is the frame's h1, so a text's first "# title" line is not shown a
 * second time; and a note for the lawyer, written in the text as <!-- … --> beside the words it is about (TRUST-13),
 * is not shown at all (the markdown would print it as it is).
 */
export const legalBody = (text) => String(text).replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').replace(/^\s*#\s[^\n]*\n+/, '');

const ANCHOR = /\s*\{#([a-z0-9-]+)\}\s*$/;
/** A heading whose text ends with {#id}: the id goes on the heading (focusable from a link), the braces are dropped. */
function anchored(Tag) {
  return function Anchored({ node, children, ...rest }) {
    const kids = Children.toArray(children);
    const last = kids[kids.length - 1];
    const m = typeof last === 'string' ? last.match(ANCHOR) : null;
    if (m) kids[kids.length - 1] = last.replace(ANCHOR, '');
    return <Tag {...rest} {...(m ? { id: m[1], tabIndex: -1 } : {})}>{kids}</Tag>;
  };
}

/**
 * A link in a legal text: an app page (/safety, /terms#cancel, #cancel) moves inside the app (a plain href would load
 * the page again, and the hash router would not find it); mailto: and tel: stay plain; any other site opens in a new
 * tab, and says so to a screen reader.
 */
function LegalLink({ node, href = '', children, ...rest }) {
  if (!href) return <span>{children}</span>; // an address the markdown dropped as unsafe: its words only
  if ((href.startsWith('/') && !href.startsWith('//')) || href.startsWith('#')) return <Link to={href} {...rest}>{children}</Link>;
  if (/^(mailto|tel):/i.test(href)) return <a href={href} {...rest}>{children}</a>;
  return <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children}<span className="visually-hidden"> (נפתח בכרטיסייה חדשה)</span></a>;
}
const COMPONENTS = { h2: anchored('h2'), h3: anchored('h3'), a: LegalLink };
/** The markdown's own safe addresses, and a phone number to dial (tel:), which it would drop. */
const urlTransform = (url) => (/^tel:\+?[\d-]+$/i.test(url) ? url : defaultUrlTransform(url));
/** A legal text as the page shows it: lawyer's notes and the first "# title" line dropped, {{NAME}} filled, anchors and app links set. */
export const LegalMarkdown = ({ text, plans }) => (
  <ReactMarkdown components={COMPONENTS} urlTransform={urlTransform}>{fillLegal(legalBody(text), plans)}</ReactMarkdown>
);

export default function Legal({ doc = 'terms' }) {
  const d = DOCS[doc] || DOCS.terms;
  const server = hasServer();
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(server);
  useEffect(() => {
    if (!server) return;
    loadPlans().then(setPlans).catch(() => {}).finally(() => setLoading(false));
  }, [server]);
  const { hash } = useLocation();
  const article = useRef(null);
  // an anchor (#/terms#cancel): its heading at the top, under the bar, with the focus on it; otherwise the page's top
  useEffect(() => {
    const id = decodeURIComponent(String(hash || '').slice(1));
    const el = /^[a-z0-9-]+$/.test(id) ? article.current?.querySelector(`#${id}`) : null;
    if (!el) { window.scrollTo?.(0, 0); return; }
    el.scrollIntoView?.({ block: 'start' });
    el.focus({ preventScroll: true });
  }, [doc, hash]);
  // once the plans arrive (the banner may appear above it), the focused heading is put back in place
  useEffect(() => {
    const el = document.activeElement;
    if (!loading && el?.tabIndex === -1 && article.current?.contains(el)) el.scrollIntoView?.({ block: 'start' });
  }, [loading]);
  const draft = !loading && plans?.legalApproved !== true;
  return (
    <ParentsFrame title={d.title} business={plans?.business}>
      {draft && <p className="legal-draft" role="note">{DRAFT_TEXT}</p>}
      <article ref={article} className="legal md">
        <LegalMarkdown text={d.text} plans={plans} />
      </article>
    </ParentsFrame>
  );
}
