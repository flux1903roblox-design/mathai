// /terms, /privacy and /accessibility: the owner's Hebrew text from src/content/legal/*.md (a lawyer reviews it before
// the paid tutor is switched on). Business details come from the server when there is one; {{NAME}} marks where.
import { useEffect, useState } from 'react';
import { hasServer } from '@/lib/api.js';
import { plans as loadPlans } from '@/lib/parent.js';
import terms from '@/content/legal/terms.md?raw';
import privacy from '@/content/legal/privacy.md?raw';
import accessibility from '@/content/legal/accessibility.md?raw';
import ParentsFrame from './ParentsFrame.jsx';
import { RichText } from '@/components/RichText.jsx';
import { LoadingState } from '@/components/Screen.jsx';

const DOCS = { terms: { title: 'תקנון', text: terms }, privacy: { title: 'מדיניות פרטיות', text: privacy }, accessibility: { title: 'הצהרת נגישות', text: accessibility } };

/** {{BUSINESS_NAME}} and the like, from the server's business details (or a visible blank). */
export function fillLegal(text, plans) {
  const b = plans?.business || {};
  const v = {
    BUSINESS_NAME: b.name, BUSINESS_ID: b.id, BUSINESS_ADDRESS: b.address, CONTACT_EMAIL: b.email || plans?.contact, CONTACT_PHONE: b.phone,
    TERMS_VERSION: plans?.termsVersion,
  };
  return String(text).replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => v[k] || '______');
}

export default function Legal({ doc = 'terms' }) {
  const d = DOCS[doc] || DOCS.terms;
  const [plans, setPlans] = useState(null);
  useEffect(() => { if (hasServer()) loadPlans().then(setPlans).catch(() => {}); }, []);
  useEffect(() => { window.scrollTo?.(0, 0); }, [doc]);
  return (
    <ParentsFrame title={d.title} business={plans?.business}>
      {/* markdown without maths: a $ in the text stays a $ */}
      <RichText as="article" className="legal" math={false} trusted fallback={<LoadingState />}>{fillLegal(d.text, plans)}</RichText>
    </ParentsFrame>
  );
}
