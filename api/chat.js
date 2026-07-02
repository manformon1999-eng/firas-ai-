// Firas AI — serverless AI stream (Vercel-style Node function).
//
// Node 18+, raw fetch, NO npm dependencies.
//
// Engine priority:
//   1. Ollama  — when OLLAMA_HOST is set (native /api/chat endpoint, think toggle)
//   2. Anthropic (Claude) — when ANTHROPIC_API_KEY is set      [optional]
//   3. OpenAI            — when OPENAI_API_KEY is set           [optional]
//   4. Free keyless pollinations engine                        [fallback]
//
// Contract (must stay stable — the frontend SSE parser depends on it):
//   Request:  POST JSON { messages:[{role,content},...], tier:"mini"|"pro"|"ultra", think?:boolean }
//   Response: Server-Sent Events:
//       data: {"choices":[{"delta":{"content":"token"}}]}
//       data: {"choices":[{"delta":{"reasoning":"thinking token"}}]}   // optional
//       data: [DONE]
//
// The underlying provider/model name is NEVER revealed in any user-visible output.

export const config = { runtime: 'nodejs' };

import crypto from 'node:crypto';

// Optional auth gate for deployments. When SESSION_SECRET is set (same value as
// the Node server that issued the cookie), this verifies the signed
// firas_session cookie and rejects anonymous requests — preventing public
// quota/billing abuse. When SESSION_SECRET is NOT set, auth is not enforced
// (keyless dev / single-user deploys keep working).
function authOk(req) {
  const secret = process.env.SESSION_SECRET;
  // FAIL CLOSED: if SESSION_SECRET is missing, refuse rather than serving an open,
  // unauthenticated AI relay that any anonymous caller could use to burn credits.
  // (This Vercel function is a legacy/divergent path — the real backends are
  // server.mjs and the Netlify edge. Set SESSION_SECRET to use it.)
  if (!secret) return false;
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)firas_session=([^;]+)/);
  if (!m) return false;
  let val;
  try { val = decodeURIComponent(m[1]); } catch { return false; }
  const dot = val.lastIndexOf('.');
  if (dot <= 0) return false;
  const userId = val.slice(0, dot);
  const mac = val.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(userId).digest('hex');
  try {
    const a = Buffer.from(mac, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

// ---- Engine config -----------------------------------------------------------
const OLLAMA_HOST = process.env.OLLAMA_HOST ? process.env.OLLAMA_HOST.replace(/\/+$/, '') : '';

// Tier -> generation parameters.
// Generous caps so thinking tokens don't starve the answer (gpt-oss accepts up
// to 131072; qwen3-coder caps at 65536). Other providers are clamped per-path.
const TIERS = {
  mini:  { temperature: 0.5, maxTokens: 16384,  think: false, thinkBudget: 0 },
  pro:   { temperature: 0.7, maxTokens: 131072, think: false, thinkBudget: 0 },
  ultra: { temperature: 0.8, maxTokens: 65536,  think: true,  thinkBudget: 4000 },
};
function tierParams(tier) {
  return TIERS[tier] || TIERS.pro;
}

// Vision/multimodal model — used automatically when a request carries images.
// qwen2.5vl:7b is verified installed locally. vl models do not emit useful
// "thinking", so vision requests always run with think OFF.
const OLLAMA_MODEL_VISION = process.env.OLLAMA_MODEL_VISION || 'qwen2.5vl:7b';

// Image caps: at most 6 images per request; skip any single image whose raw
// base64 exceeds ~8MB.
const MAX_IMAGES_PER_REQUEST = 10;
const MAX_IMAGE_B64_BYTES = 8_000_000;

// Strip an optional "data:image/...;base64," prefix and return RAW base64.
// Returns null for anything that isn't a usable, in-bounds base64 string.
function normalizeImage(img) {
  try {
    if (typeof img !== 'string') return null;
    let s = img.trim();
    if (!s) return null;
    const comma = s.indexOf(',');
    if (s.startsWith('data:') && comma !== -1) s = s.slice(comma + 1);
    s = s.trim();
    if (!s || s.length > MAX_IMAGE_B64_BYTES) return null;
    return s;
  } catch { return null; }
}

// Vision is decided by the LATEST user message ONLY, so a text follow-up after
// an image returns to the strong text model instead of staying on vision.
function hasImages(messages) {
  const list = messages || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m && m.role === 'user') return Array.isArray(m.images) && m.images.length > 0;
  }
  return false;
}

// Drop image data so the text path never sends base64 images to a text model.
function stripImages(messages) {
  return (messages || []).map((m) => {
    if (m && Array.isArray(m.images)) { const { images, ...rest } = m; return rest; }
    return m;
  });
}

// Build an Ollama-native messages array, attaching cleaned RAW base64 images,
// capping the total image count across the whole request.
function buildVisionMessages(messages) {
  let budget = MAX_IMAGES_PER_REQUEST;
  return (messages || []).map((m) => {
    const out = { role: m && typeof m.role === 'string' ? m.role : 'user', content: String((m && m.content) ?? '') };
    if (m && Array.isArray(m.images) && m.images.length && budget > 0) {
      const imgs = [];
      for (const raw of m.images) {
        if (budget <= 0) break;
        const norm = normalizeImage(raw);
        if (norm) { imgs.push(norm); budget--; }
      }
      if (imgs.length) out.images = imgs;
    }
    return out;
  });
}

// Per-provider model selection by tier (env-overridable, kept server-side).
const MODELS = {
  ollama: {
    mini:  process.env.OLLAMA_MODEL_MINI  || 'gpt-oss:120b-cloud',
    pro:   process.env.OLLAMA_MODEL_PRO   || 'gpt-oss:120b-cloud',
    ultra: process.env.OLLAMA_MODEL_ULTRA || 'qwen3-coder:480b-cloud',
  },
  anthropic: {
    mini:  process.env.ANTHROPIC_MODEL_MINI  || 'claude-haiku-4-5',
    pro:   process.env.ANTHROPIC_MODEL       || 'claude-sonnet-4-5',
    ultra: process.env.ANTHROPIC_MODEL_ULTRA || 'claude-opus-4-1',
  },
  openai: {
    mini:  process.env.OPENAI_MODEL_MINI  || 'gpt-4o-mini',
    pro:   process.env.OPENAI_MODEL       || 'gpt-4o',
    ultra: process.env.OPENAI_MODEL_ULTRA || 'gpt-4o',
  },
};

const FREE_MODEL = process.env.POLLINATIONS_MODEL || 'openai';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 120_000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || ''; // empty = same-origin only (no CORS header)

// ---- SSE helpers -------------------------------------------------------------
function sseInit(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}
function sseContent(res, text) {
  if (text == null || text === '') return;
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
}
function sseReasoning(res, text) {
  if (text == null || text === '') return;
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { reasoning: text } }] })}\n\n`);
}
function sseError(res, message) {
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: message } }] })}\n\n`);
}
function sseDone(res) {
  res.write('data: [DONE]\n\n');
  res.end();
}

// ---- Body parsing ------------------------------------------------------------
async function readJsonBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buf.length;
    if (size > 25_000_000) return {}; // 25MB guard (raised to allow image payloads)
    chunks.push(buf);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

// Split a streaming text body into complete SSE "data:" payloads.
function makeSseLineParser(onData) {
  let buffer = '';
  return (chunkText) => {
    buffer += chunkText;
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload) onData(payload);
    }
  };
}

// =============================================================================
// Engine 1: Ollama (native /api/chat NDJSON) -> OpenAI-style SSE
// content and thinking are SEPARATE fields; when think is false we DROP thinking.
// =============================================================================
async function streamOllama(res, messages, tier, think, signal, modelOverride, visionMessages) {
  const p = tierParams(tier);
  const model = modelOverride || MODELS.ollama[tier] || MODELS.ollama.pro;
  // For vision requests pass the pre-built messages (with RAW base64 images)
  // straight through; otherwise strip to {role,content} as before.
  const outMessages = visionMessages
    ? visionMessages
    : (messages || []).map((m) => ({ role: m.role, content: String(m.content ?? '') }));
  const body = JSON.stringify({
    model,
    messages: outMessages,
    stream: true,
    think: !!think,
    options: { temperature: p.temperature, num_predict: p.maxTokens },
  });

  const upstream = await fetch(OLLAMA_HOST + '/api/chat', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    sseError(res, 'The Firas AI engine is busy right now. Please try again.');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      const msg = obj.message || {};
      if (think && msg.thinking) sseReasoning(res, msg.thinking);
      if (msg.content) sseContent(res, msg.content);
      if (obj.done) return;
    }
  }
}

// =============================================================================
// Engine 2: Anthropic (Claude Messages API) -> OpenAI-style SSE
// =============================================================================
async function streamAnthropic(res, messages, tier, think, signal) {
  const p = tierParams(tier);
  const model = MODELS.anthropic[tier] || MODELS.anthropic.pro;
  const wantThink = think || p.think;

  let system = 'You are Firas AI, a helpful, precise bilingual (English/Arabic) assistant.';
  const turns = [];
  for (const m of messages || []) {
    if (m.role === 'system') { system += '\n' + String(m.content ?? ''); continue; }
    turns.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') });
  }

  const body = {
    model,
    max_tokens: Math.min(p.maxTokens > 0 ? p.maxTokens : 16384, 32000), // Anthropic positive + safe cap
    temperature: wantThink ? 1 : p.temperature, // extended thinking requires temperature 1
    system,
    messages: turns,
    stream: true,
  };
  if (wantThink) body.thinking = { type: 'enabled', budget_tokens: p.thinkBudget || 2000 };

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    sseError(res, 'The Firas AI engine is busy right now. Please try again.');
    return;
  }

  const decoder = new TextDecoder();
  const feed = makeSseLineParser((payload) => {
    if (payload === '[DONE]') return;
    let evt;
    try { evt = JSON.parse(payload); } catch { return; }
    if (evt.type === 'content_block_delta') {
      const d = evt.delta || {};
      if (d.type === 'thinking_delta') { if (think) sseReasoning(res, d.thinking); }
      else if (d.type === 'text_delta') sseContent(res, d.text);
    }
  });
  for await (const chunk of upstream.body) feed(decoder.decode(chunk, { stream: true }));
}

// =============================================================================
// Engine 3/fallback: OpenAI-compatible streams (OpenAI + free pollinations).
// =============================================================================
async function streamOpenAICompatible(res, { url, model, headers, messages, p, think, extra }, signal) {
  const body = {
    model,
    messages: (messages || []).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: String(m.content ?? ''),
    })),
    temperature: p.temperature,
    ...(p.maxTokens > 0 ? { max_tokens: Math.min(p.maxTokens, 16384) } : {}), // safe cap for OpenAI/free providers
    stream: true,
    ...extra,
  };

  const upstream = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    sseError(res, 'The Firas AI engine is busy right now. Please try again.');
    return;
  }

  const decoder = new TextDecoder();
  const feed = makeSseLineParser((payload) => {
    if (payload === '[DONE]') return;
    let evt;
    try { evt = JSON.parse(payload); } catch { return; }
    const delta = (evt.choices && evt.choices[0] && evt.choices[0].delta) || {};
    if (think && (delta.reasoning || delta.reasoning_content)) {
      sseReasoning(res, delta.reasoning || delta.reasoning_content);
    }
    if (delta.content) sseContent(res, delta.content);
  });
  for await (const chunk of upstream.body) feed(decoder.decode(chunk, { stream: true }));
}

// ---- Engine router -----------------------------------------------------------
async function route(res, messages, tier, think, signal) {
  const p = tierParams(tier);

  // VISION: any message carrying images routes to the Ollama vision model with
  // think forced OFF. The text-only providers/pollinations cannot see images,
  // so for vision we go through Ollama and report a clear message if it's down.
  const vision = hasImages(messages);
  if (vision) {
    if (OLLAMA_HOST) {
      try {
        return await streamOllama(
          res, messages, tier, false, signal,
          OLLAMA_MODEL_VISION, buildVisionMessages(messages)
        );
      } catch (e) {
        if (signal.aborted) return;
        // fall through to the clear vision-unavailable message below
      }
    }
    sseError(res, "The Firas AI vision engine is offline right now, so I can't view images. Please try again shortly.");
    return;
  }

  // Text path: never forward image data to a text model.
  messages = stripImages(messages);

  // 1. Ollama first when configured. On a connection failure, fall through to
  //    the keyless engine so the app keeps working.
  if (OLLAMA_HOST) {
    try {
      return await streamOllama(res, messages, tier, think, signal);
    } catch (e) {
      if (signal.aborted) return;
      // fall through to fallback engine below
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return streamAnthropic(res, messages, tier, think, signal);
  }

  if (process.env.OPENAI_API_KEY) {
    return streamOpenAICompatible(res, {
      url: 'https://api.openai.com/v1/chat/completions',
      model: MODELS.openai[tier] || MODELS.openai.pro,
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      messages, p, think,
    }, signal);
  }

  // Fallback: free, keyless engine (OpenAI-compatible SSE).
  return streamOpenAICompatible(res, {
    url: 'https://text.pollinations.ai/openai',
    model: FREE_MODEL,
    headers: {},
    messages, p, think,
  }, signal);
}

// ---- Handler -----------------------------------------------------------------
export default async function handler(req, res) {
  if (ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
  }

  // Reject anonymous requests when auth is configured (SESSION_SECRET set).
  if (!authOk(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'authentication required' }));
    return;
  }

  const body = await readJsonBody(req);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const tier = ['mini', 'pro', 'ultra'].includes(body.tier) ? body.tier : 'pro';
  const think = !!body.think;

  if (!messages.length) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Body must include a non-empty "messages" array.' }));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  res.on('close', () => controller.abort());

  sseInit(res);
  try {
    await route(res, messages, tier, think, controller.signal);
  } catch (err) {
    const msg = err?.name === 'AbortError'
      ? 'The Firas AI engine timed out. Please try again.'
      : 'Something went wrong with the Firas AI engine. Please try again.';
    sseError(res, msg);
  } finally {
    clearTimeout(timeout);
    sseDone(res);
  }
}
