// The help lines a child can reach (trust spec TRUST-3 §3.6), on their own: the app's first screen shows them
// (components/SupportSheet.jsx and SupportCard.jsx, through content/support.js's words) without loading the distress
// detector, the masking and the output screen of shared/safety.js, which re-exports SUPPORT for the Worker and every
// other caller (as shared/aiKinds.js does for shared/ai.js, FOLLOWUP-23). No regex here, and none with a lookbehind
// anywhere in shared/ (worker/test/safety.test.js).

/**
 * Free services for a child who needs a person. Checked against each service's own site on the date in `checked`;
 * dailySummary (worker/src/cron.js) reminds the owner to check them again once that date is more than 330 days old.
 * ער״ן answers the phone at any hour, but its WhatsApp and chat only 08:00–02:00.
 */
export const SUPPORT = Object.freeze({
  checked: '2026-11-10',
  eran: Object.freeze({
    name: 'ער״ן', phone: '1201', phoneHours: 'בכל שעה', whatsapp: '052-845-1201', wa: 'https://wa.me/972528451201',
    web: 'https://www.eran.org.il/online-emotional-help/', textHours: '08:00–02:00',
  }),
  sahar: Object.freeze({
    name: 'סה״ר', whatsapp: '055-957-1399', wa: 'https://wa.me/972559571399', web: 'https://sahar.org.il',
    hours: 'א׳–ה׳ 16:00–03:00, שישי, שבת וערבי חג 18:00–00:00',
  }),
  online: Object.freeze({ name: 'המוקד הלאומי להגנה על ילדים ברשת', phone: '105', hours: 'בכל שעה' }),
  police: '100',
  mda: '101',
});
