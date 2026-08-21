// AI proxy for MathAI: holds the Groq key as a Cloudflare secret so it never reaches the browser.
// ponytail: origin allowlist + token cap; per-IP rate limiting via CF binding if abuse ever shows up.

const ALLOWED = [
  'https://flux1903roblox-design.github.io',
  'http://localhost:5173',
];
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET' && new URL(req.url).pathname === '/models') {
      const m = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      });
      return new Response(m.body, { status: m.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
    if (!ALLOWED.includes(origin)) return new Response('Forbidden', { status: 403, headers: cors });

    let body;
    try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400, headers: cors }); }

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({
        ...body,
        model: body.model || DEFAULT_MODEL,
        max_tokens: Math.min(body.max_tokens || 4096, 4096),
        stream: false,
      }),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
