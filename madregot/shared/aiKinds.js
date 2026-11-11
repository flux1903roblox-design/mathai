// The AI kinds and their limits, on their own (FOLLOWUP-23): the app's first load needs only these few constants
// (lib/account.js reads which kinds are free and which daily group a kind counts in; lib/qaFixtures.js the same), so
// they live apart from shared/ai.js, whose prompts, schemas and checks the app loads only with the tutor (lib/ai.js).
// shared/ai.js re-exports them, so the Worker reads them from either.

export const AI_KINDS = ['explain', 'chat', 'generate', 'check', 'exam', 'feedback'];

// Which AI kinds share a daily limit (a "group"), and what each kind weighs against a class-wide cap.
export const KIND_GROUP = { explain: 'tutor', chat: 'tutor', check: 'check', generate: 'generate', exam: 'exam', feedback: 'tutor' };
export const AI_UNITS = { explain: 1, chat: 1, check: 4, generate: 3, exam: 20, feedback: 1 };
export const AI_GROUPS = ['tutor', 'check', 'generate', 'exam'];
// The free taste covers only the short kinds: the tutor's group (feedback on a written explanation is one of its
// questions, ai spec AI-10).
export const FREE_KINDS = ['explain', 'chat', 'feedback'];
