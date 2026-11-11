// The tutor's feedback on a challenge's written explanation (FOLLOWUP-16, ai spec AI-10): the button is there only where
// the device has the feedback tool; the request carries exactly the challenge's context, the rubric, the model answer
// and the student's text; the reply marks each point with the student's own words; a care reply never shows the rubric.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { challengeById } from '@/learn/challenges/index.ts';
import { useAIStatus } from '@/lib/account.js';
import { useApp } from '@/lib/store.js';
import { ExplainFeedback, FeedbackResult, sendFeedback } from './ExplainPart.jsx';
import { FEEDBACK_COPY, feedbackRequest, quoteIn } from './feedback.js';

const run = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai.js', () => ({ runAI: run }));
// rendering to a string reads a store's initial state, so the tutor's status comes through a plain stand-in
const aiState = vi.hoisted(() => ({ current: { status: null } }));
vi.mock('@/lib/account.js', async (orig) => {
  const real = await orig();
  const useAIStatus = Object.assign((sel = (s) => s) => sel(aiState.current), { getState: () => aiState.current, setState: (p) => { aiState.current = { ...aiState.current, ...p }; }, subscribe: () => () => {} });
  return { ...real, useAIStatus };
});

const task = challengeById('pct:c1');
const part = task.parts.find((p) => p.type === 'explain');
const TEXT = 'מי שקונה בפחות מ־400 משלם פחות במסלול א, ומעל זה מסלול ב.';
const render = (el) => renderToStaticMarkup(el);
const withServer = () => useApp.getState().setAI({ mode: 'server', apiUrl: 'https://api.example.test', key: '', introSeen: true });
const status = (s) => useAIStatus.setState({ status: s });

describe('the feedback button on the explanation', () => {
  beforeEach(() => { withServer(); status(null); run.mockReset(); });

  it('shows where the tutor gives feedback: the free taste, a family plan', () => {
    status({ paywall: true, tier: 'free', kinds: ['explain', 'chat', 'feedback'], groups: { tutor: { left: 2, limit: 2 } } });
    expect(render(<ExplainFeedback task={task} part={part} text={TEXT} />)).toContain(FEEDBACK_COPY.button);
    status({ paywall: true, tier: 'family', kinds: ['explain', 'chat', 'check', 'generate', 'exam', 'feedback'], groups: { tutor: { left: 29, limit: 30 } } });
    expect(render(<ExplainFeedback task={task} part={part} text={TEXT} />)).toContain(FEEDBACK_COPY.button);
  });

  it('is hidden without the tool: no tutor on this device, a tier without feedback, or the class has the tutor off', () => {
    useApp.getState().setAI({ apiUrl: 'none' });
    expect(render(<ExplainFeedback task={task} part={part} text={TEXT} />)).toBe('');
    withServer();
    status({ paywall: true, tier: 'class', kinds: ['explain', 'chat'], groups: { tutor: { left: 5, limit: 20 } } });
    expect(render(<ExplainFeedback task={task} part={part} text={TEXT} />)).toBe('');
    status({ classOff: true });
    expect(render(<ExplainFeedback task={task} part={part} text={TEXT} />)).toBe('');
  });

  it('is hidden with nothing written: there is no text to read', () => {
    expect(render(<ExplainFeedback task={task} part={part} text="   " />)).toBe('');
  });
});

describe('the feedback request', () => {
  it('the press sends one feedback call with exactly ctx, rubric, sample and text', async () => {
    run.mockReset(); run.mockResolvedValue({ points: [], summary: '', care: false });
    await sendFeedback({ task, part, text: TEXT, grade: '8' });
    expect(run).toHaveBeenCalledTimes(1);
    const [kind, body] = run.mock.calls[0];
    expect(kind).toBe('feedback');
    expect(Object.keys(body).sort()).toEqual(['ctx', 'rubric', 'sample', 'text']);
    expect(body).toEqual({ ctx: feedbackRequest({ task, part, text: TEXT, grade: '8' }).ctx, rubric: part.rubric, sample: part.sample, text: TEXT });
  });

  it('carries exactly ctx, rubric, sample and text, with the challenge as the tutor\'s context', () => {
    const body = feedbackRequest({ task, part, text: TEXT, grade: '8' });
    expect(Object.keys(body).sort()).toEqual(['ctx', 'rubric', 'sample', 'text']);
    expect(body.rubric).toEqual(part.rubric);
    expect(body.sample).toBe(part.sample);
    expect(body.text).toBe(TEXT);
    expect(body.ctx).toMatchObject({ v: 2, surface: 'challenge', grade: '8', skill: 'pct:2', topicId: 'pct', item: { answerFrom: 'app' } });
    expect(body.ctx.policy.answer).toBe('reveal');
    expect(body.ctx.item.text).toContain(part.prompt);
    expect(body.ctx.item.text).toContain('מסלול ב'); // the story
    expect(JSON.stringify(body.ctx)).not.toContain('משלם פחות במסלול א'); // the text is the request's own field only
  });
});

describe('the feedback reply', () => {
  const reply = {
    care: false,
    summary: 'כבר כתבתם מתי כל מסלול זול יותר. אפשר להוסיף דוגמה עם מספרים.',
    points: [
      { i: 0, status: 'yes', quote: 'מי שקונה בפחות מ־400 משלם פחות במסלול א', tip: '' },
      { i: 1, status: 'partly', quote: '400', tip: 'כתבו מה קורה בדיוק בסכום הזה.' },
      { i: 2, status: 'no', quote: '', tip: 'בחרו סכום אחד וחשבו את שתי העמלות.' },
    ],
  };

  it('each rubric line with its status, the quote marked in the student\'s own text, and the tip; then the summary', () => {
    const html = render(<FeedbackResult result={reply} rubric={part.rubric} text={TEXT} />);
    expect(html).toContain(FEEDBACK_COPY.intro);
    for (const r of part.rubric) expect(html).toContain(r);
    expect(html).toMatch(/data-status="yes".*יש<\/span>/s);
    expect(html).toContain('יש חלק');
    expect(html).toContain('עוד חסר');
    expect(html).toContain('<mark class="ch-fb-mark">מי שקונה בפחות מ־400 משלם פחות במסלול א</mark>, ומעל זה מסלול ב.');
    expect(html).toContain('כתבו מה קורה בדיוק בסכום הזה.');
    expect(html).toContain('בחרו סכום אחד וחשבו את שתי העמלות.');
    expect(html).toContain(reply.summary);
    expect((html.match(/<mark/g) || []).length).toBe(2); // a point that is still missing has no quote
  });

  it('a care reply shows only its summary and the people to talk to, never the rubric', () => {
    const care = { care: true, summary: 'נשמע שקשה לכם עכשיו. אפשר לדבר עם מבוגר שאתם סומכים עליו.', points: reply.points };
    const html = render(<FeedbackResult result={care} rubric={part.rubric} text={TEXT} />);
    expect(html).toContain(care.summary);
    expect(html).toContain('support-card');
    expect(html).not.toContain(FEEDBACK_COPY.intro);
    for (const r of part.rubric) expect(html).not.toContain(r);
    expect(html).not.toContain('<mark');
  });
});

describe('quoteIn: a quote in the student\'s own words', () => {
  it('keeps a little of the text around it, cut at a space', () => {
    const long = `${'אחת שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר '.repeat(2)}המשפט החשוב כאן ${'ועוד מילים אחרי זה '.repeat(4)}`;
    const q = quoteIn(long, 'המשפט החשוב');
    expect(q.mark).toBe('המשפט החשוב');
    expect(q.before.startsWith('…')).toBe(true);
    expect(q.after.endsWith('…')).toBe(true);
    expect(q.before.length).toBeLessThanOrEqual(41);
    expect(long).toContain(q.before.slice(1) + q.mark);
  });
  it('a quote not found is shown alone, and no quote is nothing', () => {
    expect(quoteIn('טקסט אחר', 'מילים')).toEqual({ before: '', mark: 'מילים', after: '' });
    expect(quoteIn('טקסט', '')).toBeNull();
  });
});
