// ============================================================================
// Firas AI — backend as a SINGLE Netlify Edge Function (Deno runtime).
// Mirrors server.mjs's /api/* routes so the unchanged frontend works as-is.
// DB = Firebase Realtime Database (per-record). Crypto = Web Crypto (crypto.subtle).
// Self-contained (no imports between edge files) to avoid resolution surprises.
// ============================================================================

const env = (k) => { try { return Netlify.env.get(k); } catch { return undefined; } };

const SESSION_SECRET     = env("SESSION_SECRET") || "";
const FIREBASE_DB_URL    = (env("FIREBASE_DB_URL") || "").replace(/\/+$/, "");
const FIREBASE_PROJECT_ID= env("FIREBASE_PROJECT_ID") || "firas-ai";
let   FB_SA = null;
try { if (env("FIREBASE_SERVICE_ACCOUNT")) FB_SA = JSON.parse(env("FIREBASE_SERVICE_ACCOUNT")); } catch (_) {}
const OLLAMA_HOST    = (env("OLLAMA_HOST") || "https://ollama.com").replace(/\/+$/, "");
const OLLAMA_API_KEY = env("OLLAMA_API_KEY") || "";
const OLLAMA_CHAT_URL= OLLAMA_HOST + "/api/chat";
const FALLBACK_URL   = "https://text.pollinations.ai/openai";
const FALLBACK_MODEL = "openai";
// PREMIUM "Max" tier engines (server-side keys only — end users stay keyless).
// Max chain: Claude Sonnet (paid) → OpenRouter free (DeepSeek-R1) → Ollama/pollinations.
const ANTHROPIC_API_KEY  = env("ANTHROPIC_API_KEY") || "";
const ANTHROPIC_MODEL    = env("ANTHROPIC_MODEL") || "claude-sonnet-4-6";
const ANTHROPIC_URL      = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MAX_TOK  = Math.max(1024, parseInt(env("ANTHROPIC_MAX_TOKENS") || "8192", 10) || 8192);
const OPENROUTER_API_KEY = env("OPENROUTER_API_KEY") || "";
const OPENROUTER_MODEL   = env("OPENROUTER_MODEL") || "nvidia/nemotron-3-ultra-550b-a55b:free";
const OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions";
// Gemini TEXT for Max — Google AI Studio FREE tier (Flash family, ~1500 req/day, no card).
// OpenAI-compatible endpoint → streams like OpenRouter. Tried FIRST in the Max chain.
// GEMINI_TEXT_MODEL may be a comma-separated fallback list; first id that streams wins.
const GEMINI_TEXT_MODELS = (env("GEMINI_TEXT_MODEL") || "gemini-2.5-flash,gemini-flash-latest").split(",").map((s) => s.trim()).filter(Boolean);
const GEMINI_OAI_URL     = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
// Gemini image model (Google AI Studio "Nano Banana"). If GEMINI_API_KEY is set,
// /api/image uses it FIRST, falling back to keyless pollinations. Free key, no card.
const GEMINI_API_KEY     = env("GEMINI_API_KEY") || "";
const GEMINI_IMAGE_MODEL = env("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
// Hugging Face image model — only FLUX.1-schnell is still free (dev/SDXL/SD3.5 = 410/400).
const HF_API_KEY     = env("HF_API_KEY") || "";
const HF_IMAGE_MODEL = env("HF_IMAGE_MODEL") || "black-forest-labs/FLUX.1-schnell";
const HF_IMAGE_URL   = env("HF_IMAGE_URL") || ("https://router.huggingface.co/hf-inference/models/" + HF_IMAGE_MODEL);
// Puter.com image generation (BEST free option). Server-side call with the DEVELOPER's
// auth token, so END USERS never sign in to Puter → real GPT-Image/Gemini quality, free.
// Tried FIRST when set. Token: https://puter.com/dashboard#account → API token → Create.
const PUTER_AUTH_TOKEN    = env("PUTER_AUTH_TOKEN") || "";
// Default = gpt-image-2 at "low": the FULL GPT-Image model (sharper, better in-image
// text than gpt-image-1-mini) at moderate cost. gpt-image-2 "high"/"medium" + gemini
// "nano-banana" cost more and 402 fast; set gpt-image-1-mini for the cheapest option.
const PUTER_IMAGE_MODEL   = env("PUTER_IMAGE_MODEL") || "gpt-image-2";
const PUTER_IMAGE_QUALITY = env("PUTER_IMAGE_QUALITY") || "low"; // gpt-image-2 / gpt-image-1.5 only: low | medium | high
const PUTER_DRIVER_URL    = "https://api.puter.com/drivers/call";
const PUTER_MODEL_ALIASES = { "nano-banana": "gemini-2.5-flash-image-preview", "nano-banana-pro": "gemini-3-pro-image-preview" };
function puterEngineTag() { const m = PUTER_MODEL_ALIASES[PUTER_IMAGE_MODEL] || PUTER_IMAGE_MODEL; return m + (/gpt-image-(2|1\.5)/i.test(m) ? " " + PUTER_IMAGE_QUALITY : ""); }
let _puterCooldownUntil = 0; // set when Puter is out of credits → skip the doomed 402 call briefly
// Cloudflare Workers AI — RELIABLE FREE fallback (10k neurons/day ≈ ~150-200 imgs/day, no
// card). FLUX.1-schnell quality (≈ pollinations). Server-side token → no user login. Free
// Cloudflare account → Account ID + an API token with "Workers AI" permission.
const CF_ACCOUNT_ID  = env("CF_ACCOUNT_ID") || "";
const CF_API_TOKEN   = env("CF_API_TOKEN") || "";
// Default = FLUX.2 Klein 9B: newest FLUX.2 — excellent quality + best free in-image text
// AND fast (~4s), far better value than flux-2-dev (same quality, ~80s — would also TIME
// OUT on the edge). ~65 free imgs/day. FLUX.2 needs multipart (handled below). Higher
// volume: @cf/black-forest-labs/flux-1-schnell (~130/day). NOTE: flux-2-dev is too slow
// for the edge's response window — keep a fast model (klein/schnell/leonardo) here.
const CF_IMAGE_MODEL = env("CF_IMAGE_MODEL") || "@cf/black-forest-labs/flux-2-klein-9b";
const CF_IMAGE_STEPS = Math.min(20, Math.max(1, parseInt(env("CF_IMAGE_STEPS") || "10", 10) || 10)); // flux-2 uses this; flux-schnell clamped to 8 in the request
// Pool of CF accounts → multiplies the free 10k-neuron/day quota: primary CF_ACCOUNT_ID/
// CF_API_TOKEN + any pairs in CF_ACCOUNTS ("id:token,id:token"). (Pooling to bypass a free
// tier may breach Cloudflare's ToS — operator's choice.)
const CF_ACCOUNTS = (() => {
  const list = [], seen = new Set();
  const add = (id, token) => {
    id = String(id || "").trim(); token = String(token || "").trim();
    if (id && token && !seen.has(id)) { seen.add(id); list.push({ id, token }); }
  };
  // 1) Primary (unnumbered) pair.
  add(CF_ACCOUNT_ID, CF_API_TOKEN);
  // 2) NUMBERED pairs: CF_ACCOUNT_ID_1 + CF_API_TOKEN_1, _2, _3 … add as many as you want;
  //    only the pairs actually set are used, and the engine rotates/falls over between them.
  for (let i = 1; i <= 64; i++) add(env("CF_ACCOUNT_ID_" + i), env("CF_API_TOKEN_" + i));
  // 3) Legacy combined string "id:token,id:token,…".
  for (const pair of (env("CF_ACCOUNTS") || "").split(",")) {
    const s = pair.trim(); if (!s) continue;
    const i = s.indexOf(":"); if (i < 1) continue;
    add(s.slice(0, i), s.slice(i + 1));
  }
  return list;
})();
const _cfCooldown = new Map(); // accountId -> ms timestamp to skip until (its daily 429)
function sniffImageMime(b) { if (!b || b.length < 4) return "image/jpeg"; if (b[0] === 0x89 && b[1] === 0x50) return "image/png"; if (b[0] === 0xFF && b[1] === 0xD8) return "image/jpeg"; if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return "image/webp"; return "image/jpeg"; }
const UPSTREAM_TIMEOUT_MS = Number(env("REQUEST_TIMEOUT_MS")) || 300000;

const COOKIE_NAME = "firas_session";
const COOKIE_MAX_AGE = 2592000;            // 30 days (seconds)
const MAX_CHATS_PER_USER = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_DAILY_LIMIT = Math.max(1, parseInt(env("IMAGE_DAILY_LIMIT") || "5", 10) || 5);
const MAX_DAILY_LIMIT  = Math.max(1, parseInt(env("MAX_DAILY_LIMIT")  || "10", 10) || 10);
// Admins (the owner) can publish site updates. Comma-separated emails; default the owner.
const ADMIN_EMAILS = (env("ADMIN_EMAILS") || "firasnozad@gmail.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
function isAdmin(user) { return !!(user && user.email && ADMIN_EMAILS.includes(String(user.email).toLowerCase())); }
const ANN_IMG_OK = (s) => typeof s === "string" && /^(data:image\/(png|jpe?g|webp);base64,|https?:\/\/)/.test(s);

const TIERS = {
  mini:  { model: env("OLLAMA_MODEL_MINI")  || "gpt-oss:120b-cloud",     temperature: 0.5, num_predict: 16384 },
  pro:   { model: env("OLLAMA_MODEL_PRO")   || "gpt-oss:120b-cloud",     temperature: 0.7, num_predict: 131072 },
  ultra: { model: env("OLLAMA_MODEL_ULTRA") || "qwen3-coder:480b-cloud", temperature: 0.8, num_predict: 65536 },
  // Max = strongest general/reasoning model (671B), gated by a per-user daily cap.
  // Env-overridable so the model can be swapped without a redeploy if Ollama's
  // cloud catalog rotates. fallbackModel degrades to a known-good hosted model
  // (gpt-oss) before the last-resort pollinations fallback.
  max:   { model: env("OLLAMA_MODEL_MAX") || "qwen3-coder:480b-cloud", temperature: 0.7, num_predict: 32768, fallbackModel: env("OLLAMA_MODEL_MAX_FALLBACK") || "gpt-oss:120b-cloud", capped: false },
};
// Vision model. The edge ALWAYS talks to Ollama cloud, which does NOT host the
// local-only qwen2.5vl — so use a CLOUD-hosted multimodal model. gemma3:27b-cloud
// is free, available, and reads images (verified). Env-overridable.
const OLLAMA_MODEL_VISION = env("OLLAMA_MODEL_VISION") || "gemma3:27b-cloud";
const MAX_IMAGES_PER_REQUEST = 6;
const MAX_IMAGE_B64_BYTES = 8000000;
const SEARCH_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const te = new TextEncoder();
const td = new TextDecoder();

/* ---------------- base64url + json helpers ---------------- */
function b64urlFromBytes(buf) {
  const b = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(str) {
  let s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function b64FromBytes(buf){ const b=buf instanceof ArrayBuffer?new Uint8Array(buf):buf; let s=""; for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]); return btoa(s); }
function b64ToBytes(s){ const bin=atob(s); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i); return u; }
function b64urlJson(obj){ return b64urlFromBytes(te.encode(JSON.stringify(obj))); }
function decodeJwtSeg(seg){ try { return JSON.parse(td.decode(b64urlToBytes(seg))); } catch { return null; } }
function json(obj, status, extra) { return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, extra || {}) }); }
function emailKey(email){ return b64urlFromBytes(te.encode(String(email).toLowerCase())); }

/* ---------------- HMAC signed session value ---------------- */
let _hmacKey = null;
async function hmacKey() {
  if (_hmacKey) return _hmacKey;
  _hmacKey = await crypto.subtle.importKey("raw", te.encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return _hmacKey;
}
async function signUserId(userId) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), te.encode(userId));
  return userId + "." + b64urlFromBytes(sig);
}
async function verifySessionValue(value) {
  if (typeof value !== "string") return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = value.slice(0, dot), sig = value.slice(dot + 1);
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await hmacKey(), b64urlToBytes(sig), te.encode(userId)); } catch { return null; }
  return ok ? userId : null;
}

/* ---------------- PBKDF2 password hashing (Web Crypto; scrypt is unavailable on Edge) ---------------- */
const PBKDF2_ITER = 100000; // stays well under Netlify Edge's 50ms CPU-per-request limit (verifyPassword reads each hash's own iter count, so this is backward-compatible)
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" }, km, 256);
  return `pbkdf2$${PBKDF2_ITER}$${b64FromBytes(salt)}$${b64FromBytes(bits)}`;
}
async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2") return false;          // legacy scrypt hashes can't verify here
  const km = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: b64ToBytes(saltB64), iterations: parseInt(iterStr, 10) || PBKDF2_ITER, hash: "SHA-256" }, km, 256);
  const a = new Uint8Array(bits), b = b64ToBytes(hashB64);
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ---------------- Firebase RTDB (service-account RS256 -> OAuth token -> REST) ---------------- */
function pemToPkcs8(pem) {
  let p = String(pem); if (p.includes("\\n")) p = p.replace(/\\n/g, "\n");
  const body = p.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return b64ToBytes(body).buffer;
}
let _saKey = null, _fbToken = null, _fbExp = 0;
async function fbAccessToken() {
  if (!FB_SA) throw new Error("firebase not configured");
  const now = Math.floor(Date.now() / 1000);
  if (_fbToken && now < _fbExp - 60) return _fbToken;
  if (!_saKey) _saKey = await crypto.subtle.importKey("pkcs8", pemToPkcs8(FB_SA.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const aud = FB_SA.token_uri || "https://oauth2.googleapis.com/token";
  const claims = { iss: FB_SA.client_email, scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email", aud, iat: now, exp: now + 3600 };
  const input = b64urlJson({ alg: "RS256", typ: "JWT" }) + "." + b64urlJson(claims);
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, _saKey, te.encode(input));
  const jwt = input + "." + b64urlFromBytes(sig);
  const r = await fetch(aud, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  if (!r.ok) throw new Error("fb token " + r.status + " " + (await r.text()).slice(0, 160));
  const j = await r.json(); _fbToken = j.access_token; _fbExp = now + (j.expires_in || 3600);
  return _fbToken;
}
async function dbGet(path) {
  const t = await fbAccessToken();
  const r = await fetch(`${FIREBASE_DB_URL}/${path}.json`, { headers: { Authorization: "Bearer " + t } });
  if (!r.ok) throw new Error("db get " + r.status);
  return await r.json();
}
async function dbPut(path, value) {
  const t = await fbAccessToken();
  const r = await fetch(`${FIREBASE_DB_URL}/${path}.json?print=silent`, { method: "PUT", headers: { Authorization: "Bearer " + t, "content-type": "application/json" }, body: JSON.stringify(value) });
  if (!r.ok) throw new Error("db put " + r.status + " " + (await r.text()).slice(0, 160));
}
async function dbDelete(path) {
  const t = await fbAccessToken();
  const r = await fetch(`${FIREBASE_DB_URL}/${path}.json?print=silent`, { method: "DELETE", headers: { Authorization: "Bearer " + t } });
  if (!r.ok && r.status !== 404) throw new Error("db del " + r.status);
}

/* ---------------- user + chat records ---------------- */
function publicUser(u) { return { id: u.id, name: u.name, email: u.email }; }
async function getUserById(id) { if (!id) return null; return (await dbGet("users/" + id)) || null; }
async function getUserByEmail(email) {
  const id = await dbGet("emailIndex/" + emailKey(email));
  return id ? getUserById(id) : null;
}
async function saveUser(u) {
  await dbPut("users/" + u.id, u);
  await dbPut("emailIndex/" + emailKey(u.email), u.id);
}

/* ---------------- email (Resend) + signup verification + password reset ---------------- */
const RESEND_API_KEY = env("RESEND_API_KEY") || "";
const RESEND_FROM    = env("RESEND_FROM") || "Firas AI <onboarding@resend.dev>";
// Brevo (primary): single-sender reaches ALL members for free, no domain needed.
const BREVO_API_KEY   = env("BREVO_API_KEY") || "";
const BREVO_FROM      = env("BREVO_FROM") || "firasnozad@gmail.com";
const BREVO_FROM_NAME = env("BREVO_FROM_NAME") || "Firas AI";
const VERIFY_TTL_MS  = 15 * 60000;
const RESET_TTL_MS   = 30 * 60000;
function appBase(request) { try { return new URL(request.url).origin; } catch (_) { return ""; } }
async function sendViaBrevo(to, subject, html, fromName) {
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "content-type": "application/json", "accept": "application/json", "api-key": BREVO_API_KEY }, body: JSON.stringify({ sender: { name: fromName || BREVO_FROM_NAME, email: BREVO_FROM }, to: [{ email: to }], subject, htmlContent: html }) });
    if (!r.ok) { console.error("[firas] Brevo send failed " + r.status); return false; }
    return true;
  } catch (e) { console.error("[firas] Brevo error: " + ((e && e.message) || e)); return false; }
}
async function sendViaResend(to, subject, html, fromName) {
  if (!RESEND_API_KEY) return false;
  const addr = (RESEND_FROM.match(/<([^>]+)>/) || [])[1] || "onboarding@resend.dev";
  const from = fromName ? (fromName + " <" + addr + ">") : RESEND_FROM;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "content-type": "application/json", "Authorization": "Bearer " + RESEND_API_KEY }, body: JSON.stringify({ from, to: [to], subject, html }) });
    if (!r.ok) { console.error("[firas] Resend send failed " + r.status); return false; }
    return true;
  } catch (e) { console.error("[firas] Resend error: " + ((e && e.message) || e)); return false; }
}
// Brevo first (reaches everyone free), Resend fallback. opts.fromName overrides display name.
async function sendEmail(to, subject, html, opts) {
  const fromName = opts && opts.fromName;
  if (BREVO_API_KEY) { if (await sendViaBrevo(to, subject, html, fromName)) return true; }
  if (RESEND_API_KEY) { if (await sendViaResend(to, subject, html, fromName)) return true; }
  return false;
}
function fmtNow() { try { return new Date().toLocaleString("ar", { dateStyle: "long", timeStyle: "short" }); } catch (_) { return new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC"; } }
function brandedEmail(o) {
  const bg = "#060d0b", card = "#121b18", border = "#2b5950", ink = "#F1EFE8", muted = "#a7b0ab", soft = "#6f7a76", accent = "#2C8A78", accent2 = "#5fc4ae";
  const font = "'Segoe UI',Tahoma,Arial,'Helvetica Neue',sans-serif";
  const time = o.time || fmtNow();
  const glow = "box-shadow:0 0 0 1px rgba(95,196,174,0.20),0 0 60px rgba(44,138,120,0.55),0 0 26px rgba(95,196,174,0.30);";
  return '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>' +
    '<body bgcolor="' + bg + '" style="margin:0;padding:0;background:' + bg + ';">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + bg + ';">' + (o.preheader || "") + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + bg + '" style="background:' + bg + ';padding:34px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;"><tr><td style="padding:3px;background:#0c211d;border-radius:22px;' + glow + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + card + '" style="background:' + card + ';border:1px solid ' + border + ';border-radius:19px;overflow:hidden;">' +
    '<tr><td style="height:4px;background:' + accent + ';font-size:0;line-height:0;">&nbsp;</td></tr>' +
    '<tr><td style="padding:26px 30px 6px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="width:48px;height:48px;border-radius:14px;background:' + accent + ';text-align:center;font:800 25px/48px ' + font + ';color:#ffffff;box-shadow:0 0 20px rgba(44,138,120,0.85);">F</td>' +
      '<td style="padding-inline-start:13px;font:800 21px/1 ' + font + ';letter-spacing:2px;color:' + ink + ';">FIRAS<span style="color:' + accent2 + ';"> AI</span></td>' +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:18px 30px 6px;font-family:' + font + ';color:' + ink + ';">' +
      '<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:' + ink + ';">' + o.heading + '</h1>' +
      '<p style="margin:0 0 20px;font-size:15px;line-height:1.85;color:' + muted + ';">' + o.lead + '</p>' +
      o.contentHtml +
      (o.note ? '<p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:' + muted + ';">' + o.note + '</p>' : '') +
    '</td></tr>' +
    '<tr><td style="padding:14px 30px 2px;font-family:' + font + ';font-size:12px;color:' + soft + ';">أُرسلت في: ' + time + '</td></tr>' +
    '<tr><td style="padding:18px 30px 0;"><div style="border-top:1px solid ' + border + ';"></div></td></tr>' +
    '<tr><td style="padding:16px 30px 26px;font-family:' + font + ';text-align:center;">' +
      '<p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:1px;color:' + accent2 + ';">FIRAS AI</p>' +
      '<p style="margin:0;font-size:12px;color:' + soft + ';">مساعدك الذكي · رسالة آلية، لا داعي للرد عليها.</p>' +
    '</td></tr></table>' +
    '</td></tr></table>' +
    '<p style="margin:16px 0 0;font-size:11px;color:#4f5754;font-family:' + font + ';">© Firas AI</p>' +
    '</td></tr></table></body></html>';
}
function escEmail(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function welcomeEmailHtml(name, link) {
  const safe = escEmail(String(name || "").trim()) || "صديقي";
  const p = (t) => '<p style="margin:0 0 14px;font-size:15px;line-height:1.9;color:#cfd6d2;">' + t + '</p>';
  const btn = '<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 2px;"><tr>' +
    '<td style="border-radius:11px;background:#2C8A78;box-shadow:0 0 22px rgba(44,138,120,0.7);"><a href="' + link + '" style="display:inline-block;padding:14px 34px;font:800 15px \'Segoe UI\',Tahoma,Arial,sans-serif;color:#06120f;text-decoration:none;border-radius:11px;">ابدأ المحادثة الآن</a></td>' +
    '</tr></table>';
  const content =
    p('شكراً لانضمامك إلى <b style="color:#5fc4ae;">Firas AI</b> — حسابك صار جاهزاً ومفعّلاً بالكامل. 🎉') +
    p('أنا فراس، مطوّر المنصّة. بنيت Firas AI ليكون مساعدك الذكي بالعربية والإنجليزية: محادثة، برمجة، بحث في الإنترنت، توليد صور، وملفات PDF — كله مجاناً، وبأربعة نماذج تختار منها حسب حاجتك.') +
    p('جرّب نموذج <b style="color:#5fc4ae;">Max</b> الجديد (تجريبي) للأسئلة الصعبة والرياضيات. وإذا واجهت أي مشكلة أو عندك اقتراح، بابي مفتوح دائماً.') +
    btn +
    '<p style="margin:24px 0 0;font-size:14px;line-height:1.8;color:#a7b0ab;">مع خالص التقدير،<br><b style="color:#F1EFE8;">فراس</b> · مطوّر Firas AI</p>';
  return brandedEmail({ preheader: "أهلاً بك في Firas AI — رسالة من فراس", heading: "مرحباً بك يا " + safe + " 👋", lead: "يسعدني انضمامك إلى عائلة Firas AI. هذي رسالة شخصية مني لك:", contentHtml: content });
}
function verifyEmailHtml(link) {
  const btn = '<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto;"><tr>' +
    '<td style="border-radius:11px;background:#2C8A78;"><a href="' + link + '" style="display:inline-block;padding:14px 34px;font:800 15px \'Segoe UI\',Tahoma,Arial,sans-serif;color:#06120f;text-decoration:none;border-radius:11px;">تأكيد الحساب وبدء الاستخدام</a></td>' +
    '</tr></table>' +
    '<p style="margin:18px 0 0;font-size:12px;color:#6f7a76;word-break:break-all;">أو افتح هذا الرابط:<br><a href="' + link + '" style="color:#57AE9C;">' + link + '</a></p>';
  return brandedEmail({ preheader: "أكمل إنشاء حسابك في Firas AI", heading: "تأكيد بريدك الإلكتروني", lead: "أهلاً بك في Firas AI! اضغط الزر لتأكيد بريدك وتفعيل حسابك — وستدخل مباشرةً.", contentHtml: btn, note: "الرابط صالح لمدة 15 دقيقة. إذا لم تطلب إنشاء حساب، تجاهل هذه الرسالة." });
}
function resetEmailHtml(link) {
  const btn = '<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto;"><tr>' +
    '<td style="border-radius:11px;background:#2C8A78;"><a href="' + link + '" style="display:inline-block;padding:14px 32px;font:800 15px \'Segoe UI\',Tahoma,Arial,sans-serif;color:#06120f;text-decoration:none;border-radius:11px;">تعيين كلمة مرور جديدة</a></td>' +
    '</tr></table>' +
    '<p style="margin:18px 0 0;font-size:12px;color:#6f7a76;word-break:break-all;">أو افتح هذا الرابط:<br><a href="' + link + '" style="color:#57AE9C;">' + link + '</a></p>';
  return brandedEmail({ preheader: "رابط إعادة تعيين كلمة المرور — Firas AI", heading: "إعادة تعيين كلمة المرور", lead: "طلبت إعادة تعيين كلمة مرورك. اضغط الزر للمتابعة:", contentHtml: btn, note: "الرابط صالح لمدة 30 دقيقة. إذا لم تطلب هذا، تجاهل الرسالة وكلمة مرورك تبقى كما هي." });
}
// Pending signups live in Firebase with reverse-indexes by token + pid (for O(1) lookup).
async function delPending(ek, rec) {
  try { await dbDelete("pending/" + ek); } catch (_) {}
  if (rec && rec.token) { try { await dbDelete("pendingTok/" + rec.token); } catch (_) {} }
  if (rec && rec.pid) { try { await dbDelete("pendingPid/" + rec.pid); } catch (_) {} }
}
// Best-effort client IP for per-client rate-limit keys (Netlify provides x-nf-client-connection-ip).
function ipOf(request, context) {
  try {
    return (context && context.ip) ||
      request.headers.get("x-nf-client-connection-ip") ||
      (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  } catch (_) { return "?"; }
}
async function sha256hex(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function currentUser(context) {
  if (!SESSION_SECRET) return null;
  const raw = context.cookies.get(COOKIE_NAME);
  if (!raw) return null;
  const id = await verifySessionValue(raw);
  if (!id) return null;
  return getUserById(id);
}
async function attachSession(context, userId, request) {
  const value = await signUserId(userId);
  const secure = new URL(request.url).protocol === "https:";
  context.cookies.set({ name: COOKIE_NAME, value, httpOnly: true, sameSite: "Lax", secure, maxAge: COOKIE_MAX_AGE, path: "/" });
}
function sanitizeMessages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 2000).map((m) => {
    const o = { role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.content) ?? "").slice(0, 200000) };
    if (m && m.tier) o.tier = String(m.tier).slice(0, 16);
    if (m && m.lang) o.lang = String(m.lang).slice(0, 8);
    if (m && m.reasoning) o.reasoning = String(m.reasoning).slice(0, 200000);
    if (m && m.mode) o.mode = String(m.mode).slice(0, 16);
    if (m && Array.isArray(m.imageThumbs) && m.imageThumbs.length) o.imageThumbs = m.imageThumbs.slice(0, 6).map((s) => String(s).slice(0, 200000));
    return o;
  });
}

/* ---------------- Firebase ID-token verification (Google JWK) ---------------- */
let _googleJwks = { keys: null, exp: 0 };
async function getGoogleKey(kid) {
  const now = Date.now();
  if (!_googleJwks.keys || now >= _googleJwks.exp) {
    const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    if (!r.ok) return null;
    const j = await r.json();
    let maxAge = 3600; const cc = r.headers.get("cache-control") || ""; const m = cc.match(/max-age\s*=\s*(\d+)/i); if (m) maxAge = parseInt(m[1], 10) || 3600;
    const map = {}; for (const k of (j.keys || [])) map[k.kid] = k;
    _googleJwks = { keys: map, exp: now + maxAge * 1000 };
  }
  return _googleJwks.keys ? _googleJwks.keys[kid] : null;
}
async function verifyFirebaseIdToken(idToken) {
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 8192) return null;
  const parts = idToken.split("."); if (parts.length !== 3) return null;
  const header = decodeJwtSeg(parts[0]); const payload = decodeJwtSeg(parts[1]);
  if (!header || !payload) return null;
  if (header.alg !== "RS256" || (header.typ && header.typ !== "JWT")) return null;
  if (typeof header.kid !== "string" || !header.kid) return null;
  const jwk = await getGoogleKey(header.kid); if (!jwk) return null;
  let key;
  try { key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]); } catch { return null; }
  let ok = false;
  try { ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, b64urlToBytes(parts[2]), te.encode(parts[0] + "." + parts[1])); } catch { return null; }
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000), skew = 300;
  if (payload.aud !== FIREBASE_PROJECT_ID) return null;
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
  if (typeof payload.exp !== "number" || payload.exp <= now - skew) return null;
  if (typeof payload.iat !== "number" || payload.iat > now + skew) return null;
  // Mirror server.mjs: reject a future-dated auth_time (clock-skew / tampering guard).
  if (payload.auth_time != null && (typeof payload.auth_time !== "number" || payload.auth_time > now + skew)) return null;
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 200) return null;
  return payload;
}

/* ---------------- best-effort per-isolate rate limit ---------------- */
const rlBuckets = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (rlBuckets.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); rlBuckets.set(key, arr);
  if (rlBuckets.size > 5000) { for (const k of rlBuckets.keys()) { rlBuckets.delete(k); if (rlBuckets.size <= 2500) break; } }
  return arr.length > max;
}

/* ---------------- AI engine helpers (ported from server.mjs) ---------------- */
function normalizeImage(img) {
  if (typeof img !== "string") return null;
  let s = img.trim(); if (!s) return null;
  const c = s.indexOf(","); if (s.startsWith("data:") && c !== -1) s = s.slice(c + 1);
  s = s.trim(); if (!s || s.length > MAX_IMAGE_B64_BYTES) return null;
  return s;
}
/* ---- Persistent per-user memory (mirrors server.mjs; persisted via saveUser) ---- */
const MEMORY_MAX = 60;
function userMemory(user) { if (!Array.isArray(user.memory)) user.memory = []; return user.memory; }
function memoryBlock(user) {
  const m = userMemory(user);
  if (!m.length) return "";
  return "PERSISTENT MEMORY — VERIFIED facts about the user you are talking to RIGHT NOW (saved from past chats). Treat them as TRUE:\n" +
    m.map((f) => "- " + f).join("\n") +
    "\nUse them to personalize naturally. When the user ASKS what you know/remember about them, answer using EXACTLY these facts and nothing invented — keep their exact name, country, city, age and numbers as written here; never substitute a different place or guess a value. If the user now says something that contradicts a fact, trust their newest statement.";
}
// Strong, accurate completion: Ollama (gpt-oss, temperature-controlled) → pollinations.
async function llmComplete(messages, maxTokens, temperature) {
  const tok = maxTokens || 1500;
  const temp = temperature != null ? temperature : 0;
  try {
    const headers = { "content-type": "application/json" };
    if (OLLAMA_API_KEY) headers["Authorization"] = "Bearer " + OLLAMA_API_KEY;
    const r = await fetch(OLLAMA_CHAT_URL, { method: "POST", headers, body: JSON.stringify({ model: (TIERS.pro && TIERS.pro.model) || "gpt-oss:120b-cloud", messages, stream: false, options: { temperature: temp, num_predict: tok } }) });
    if (r.ok) { const j = await r.json().catch(() => null); const c = j && j.message && j.message.content; if (typeof c === "string" && c.trim()) return c; }
  } catch (_) {}
  try {
    const r = await fetch(FALLBACK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: FALLBACK_MODEL, messages, stream: false, temperature: temp, max_tokens: tok }) });
    if (!r.ok) return "";
    const j = await r.json().catch(() => null);
    const c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return typeof c === "string" ? c : "";
  } catch (_) { return ""; }
}
async function memoryLearn(user, userText, aiText) {
  const existing = userMemory(user);
  const sys =
    "You extract durable facts about a USER. Preserve name, age, country, city EXACTLY as stated " +
    "(from Iraq -> 'From Iraq'; age 16 -> 'Age: 16'; never change or guess). " +
    "Capture name, age, country, job, language, likes, projects, goals, interests, and any personal detail. " +
    "Return ONLY a JSON array of short strings. If nothing, []." +
    (existing.length ? " Skip facts already in: " + JSON.stringify(existing.slice(-50)) : "");
  const u = 'The USER said: "' + userText + '". Return JSON array of facts:';
  const msgs = [{ role: "system", content: sys }, { role: "user", content: u }];
  const collected = new Map();
  const temps = [0, 0.5, 0.8]; // varied temps → fuller union; run in PARALLEL for speed
  const outs = await Promise.all(temps.map((t) => llmComplete(msgs, 1500, t)));
  for (const out of outs) {
    let arr = []; try { const mm = out.match(/\[[\s\S]*\]/); if (mm) arr = JSON.parse(mm[0]); } catch (_) {}
    if (Array.isArray(arr)) for (const f of arr) { const s = String(f || "").trim(); if (s && s.length <= 140) { const k = s.toLowerCase(); if (!collected.has(k)) collected.set(k, s); } }
  }
  let added = 0; const seen = new Set(existing.map((f) => String(f).toLowerCase().trim()));
  for (const s of collected.values()) { const k = s.toLowerCase(); if (seen.has(k)) continue; seen.add(k); existing.push(s); added++; }
  if (added) { while (existing.length > MEMORY_MAX) existing.shift(); try { await saveUser(user); } catch (_) {} }
  return added;
}

function hasImages(messages) {
  for (let i = messages.length - 1; i >= 0; i--) { const m = messages[i]; if (m && m.role === "user") return Array.isArray(m.images) && m.images.length > 0; }
  return false;
}
function stripImages(messages) { return messages.map((m) => { if (m && Array.isArray(m.images)) { const { images, ...rest } = m; return rest; } return m; }); }
function buildVisionMessages(messages) {
  let budget = MAX_IMAGES_PER_REQUEST;
  return messages.map((m) => {
    const out = { role: m && typeof m.role === "string" ? m.role : "user", content: String((m && m.content) ?? "") };
    if (m && Array.isArray(m.images) && m.images.length && budget > 0) {
      const imgs = []; for (const raw of m.images) { if (budget <= 0) break; const n = normalizeImage(raw); if (n) { imgs.push(n); budget--; } }
      if (imgs.length) out.images = imgs;
    }
    return out;
  });
}
function sseFrame(content, reasoning) {
  const delta = {}; if (content) delta.content = content; if (reasoning) delta.reasoning = reasoning;
  if (!("content" in delta) && !("reasoning" in delta)) return "";
  return `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
}
function stripEngineAd(text) {
  if (!text) return text; let t = text;
  const cut = t.search(/\n*\s*(?:[-—*_]{2,}\s*)?\**\s*(?:support\s+|powered\s+by\s+)*pollinations|support our mission|🌸|free text api/i);
  if (cut !== -1) t = t.slice(0, cut);
  t = t.replace(/^.*pollinations.*$/gim, "").replace(/^\s*\**\s*ad\s*\**\s*$/gim, "");
  return t.replace(/\s+$/, "");
}

// Stream the AI reply as SSE. Returns a Response immediately; upstream work runs
// inside the stream so the 40s header timeout is satisfied and the body can run
// for minutes. Tries Ollama first; on connect failure falls back to pollinations.
function chatStreamResponse(messages, tier, think, vision) {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
  const ollamaMessages = vision ? buildVisionMessages(messages) : stripImages(messages);
  const modelOverride = vision ? OLLAMA_MODEL_VISION : undefined;

  // `closed` is hoisted so cancel() (client disconnect / Stop) can mark it; every
  // controller op is guarded so a post-cancel enqueue/close can never throw an
  // unhandled TypeError in the isolate.
  let closed = false;
  const body = new ReadableStream({
    async start(controller) {
      const enc = (s) => { if (closed || !s) return; try { controller.enqueue(te.encode(s)); } catch (_) { closed = true; } };
      const finish = () => { if (closed) return; closed = true; try { controller.enqueue(te.encode("data: [DONE]\n\n")); } catch (_) {} try { controller.close(); } catch (_) {} clearTimeout(timeout); };
      try {
        let served = false;
        // Max tier → premium external engines FIRST: Claude Sonnet (paid), then
        // OpenRouter free (DeepSeek-R1) when Claude has no credit/fails.
        if (tier === "max" && !vision) {
          served = await streamGeminiInto(enc, messages, ac.signal);
          if (!served && !closed) served = await streamAnthropicInto(enc, messages, ac.signal);
          if (!served && !closed) served = await streamOpenRouterInto(enc, messages, ac.signal);
        }
        const okOllama = served ? true : await streamOllamaInto(enc, ollamaMessages, tier, think, ac.signal, modelOverride);
        if (!okOllama && !closed) {
          if (vision) { enc(sseFrame("The Firas AI vision engine is offline right now, so I can't view images. Please try again shortly.")); }
          else {
            // For a capped tier (Max), first degrade to its known-good Ollama
            // fallback model (gpt-oss) before the last-resort pollinations path.
            const fb = TIERS[tier] && TIERS[tier].fallbackModel;
            let recovered = false;
            if (fb) recovered = await streamOllamaInto(enc, ollamaMessages, tier, think, ac.signal, fb);
            if (!recovered && !closed) await streamFallbackInto(enc, stripImages(messages), tier, think, ac.signal);
          }
        }
      } catch (e) {
        if (!ac.signal.aborted) enc(sseFrame("Something went wrong with the Firas AI engine. Please try again."));
      } finally { finish(); }
    },
    cancel() { closed = true; try { ac.abort(); } catch (_) {} clearTimeout(timeout); },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" } });
}

// Returns true on success (stream delivered or aborted), false if Ollama unreachable.
async function streamOllamaInto(enc, messages, tier, think, signal, modelOverride) {
  const t = TIERS[tier]; const model = modelOverride || t.model;
  const thinkVal = think ? (/gpt-oss/i.test(model) ? "high" : true) : false;
  const reqBody = JSON.stringify({ model, messages, stream: true, think: thinkVal, options: { temperature: t.temperature, num_predict: t.num_predict } });
  const headers = { "content-type": "application/json" };
  if (OLLAMA_API_KEY) headers["Authorization"] = "Bearer " + OLLAMA_API_KEY;
  let upstream = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      upstream = await fetch(OLLAMA_CHAT_URL, { method: "POST", headers, body: reqBody, signal });
      if (upstream.ok && upstream.body) break;
      upstream = null;
    } catch (e) { if (signal.aborted) return true; upstream = null; }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
  }
  if (!upstream) return false; // unreachable -> caller falls back
  const reader = upstream.body.getReader(); let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += td.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim(); buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let obj; try { obj = JSON.parse(line); } catch { continue; }
        const msg = obj.message || {};
        const content = msg.content || "";
        const reasoning = think ? (msg.thinking || "") : "";
        if (content || reasoning) { const f = sseFrame(content, reasoning); if (f) enc(f); }
        if (obj.done) return true;
      }
    }
    const tail = buffer.trim();
    if (tail) { try { const obj = JSON.parse(tail); const msg = obj.message || {}; const r = think ? (msg.thinking || "") : ""; if (msg.content || r) { const f = sseFrame(msg.content || "", r); if (f) enc(f); } } catch (_) {} }
    return true;
  } catch (e) { if (signal.aborted) return true; return true; }
}

async function streamFallbackInto(enc, messages, tier, think, signal) {
  let upstream;
  try { upstream = await fetch(FALLBACK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: FALLBACK_MODEL, messages: stripImages(messages), stream: true }), signal }); }
  catch (e) { if (signal.aborted) return; const f = sseFrame("The Firas AI engine is unavailable right now. Please try again."); if (f) enc(f); return; }
  if (!upstream.ok || !upstream.body) { const f = sseFrame("The Firas AI engine is busy right now. Please try again."); if (f) enc(f); return; }
  const reader = upstream.body.getReader(); let buffer = "", answer = "", reasoningAcc = "";
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += td.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim(); if (!payload) continue;
        if (payload === "[DONE]") { buffer = ""; break; }
        let evt; try { evt = JSON.parse(payload); } catch { continue; }
        const delta = (evt.choices && evt.choices[0] && evt.choices[0].delta) || {};
        if (delta.content) answer += delta.content;
        if (think && (delta.reasoning || delta.reasoning_content)) reasoningAcc += delta.reasoning || delta.reasoning_content;
      }
    }
    const cleaned = stripEngineAd(answer);
    if (reasoningAcc) { const f = sseFrame("", reasoningAcc); if (f) enc(f); }
    if (cleaned) { const f = sseFrame(cleaned, ""); if (f) enc(f); }
    else if (!reasoningAcc) { const f = sseFrame("The Firas AI engine is busy right now. Please try again."); if (f) enc(f); }
  } catch (e) { /* end gracefully */ }
}

// ── Max engine: Claude (Anthropic Messages API → our SSE). Returns true if it
// streamed any answer, false if it failed BEFORE any bytes (no key / no-credit /
// error) so the caller can fall back. Does NOT send [DONE] (finish() does). ──
async function streamAnthropicInto(enc, messages, signal) {
  if (!ANTHROPIC_API_KEY) return false;
  const system = messages.filter((m) => m.role === "system").map((m) => String(m.content || "")).join("\n\n");
  const conv = messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: String(m.content || "") }));
  while (conv.length && conv[0].role !== "user") conv.shift();
  if (!conv.length) return false;
  const reqBody = JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: ANTHROPIC_MAX_TOK, stream: true, ...(system ? { system } : {}), messages: conv });
  let upstream;
  try { upstream = await fetch(ANTHROPIC_URL, { method: "POST", headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: reqBody, signal }); }
  catch (e) { return signal.aborted ? true : false; }
  if (!upstream.ok || !upstream.body) { try { upstream && upstream.body && upstream.body.cancel(); } catch (_) {} return false; }
  const reader = upstream.body.getReader(); let buffer = "", any = false;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += td.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let evt; try { evt = JSON.parse(payload); } catch { continue; }
        if (evt.type === "content_block_delta" && evt.delta) {
          if (evt.delta.type === "text_delta" && evt.delta.text) { const f = sseFrame(evt.delta.text); if (f) enc(f); any = true; }
          else if (evt.delta.type === "thinking_delta" && evt.delta.thinking) { const f = sseFrame("", evt.delta.thinking); if (f) enc(f); }
        } else if (evt.type === "error" && !any) { return false; }
      }
    }
    return any;
  } catch (e) { return signal.aborted ? true : any; }
}

// ── Max engine: OpenRouter (OpenAI-compatible, free DeepSeek-R1) ──
async function streamGeminiInto(enc, messages, signal) {
  if (!GEMINI_API_KEY) return false;
  const msgs = messages.filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: String(m.content || "") }));
  if (!msgs.length) return false;
  for (const model of GEMINI_TEXT_MODELS) {
    const reqBody = JSON.stringify({ model, messages: msgs, stream: true });
    let upstream;
    try { upstream = await fetch(GEMINI_OAI_URL, { method: "POST", headers: { "content-type": "application/json", "Authorization": "Bearer " + GEMINI_API_KEY }, body: reqBody, signal }); }
    catch (e) { if (signal.aborted) return true; continue; }
    if (!upstream.ok || !upstream.body) { try { upstream && upstream.body && upstream.body.cancel(); } catch (_) {} continue; }
    const reader = upstream.body.getReader(); let buffer = "", any = false;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += td.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let evt; try { evt = JSON.parse(payload); } catch { continue; }
          const delta = evt.choices && evt.choices[0] && evt.choices[0].delta;
          if (delta && delta.content) { const f = sseFrame(delta.content); if (f) enc(f); any = true; }
        }
      }
      if (any) return true;   // served by this id; otherwise try the next candidate
    } catch (e) { return signal.aborted ? true : any; }
  }
  return false;
}

async function streamOpenRouterInto(enc, messages, signal) {
  if (!OPENROUTER_API_KEY) return false;
  const msgs = messages.filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: String(m.content || "") }));
  if (!msgs.length) return false;
  const reqBody = JSON.stringify({ model: OPENROUTER_MODEL, messages: msgs, stream: true });
  let upstream;
  try { upstream = await fetch(OPENROUTER_URL, { method: "POST", headers: { "content-type": "application/json", "Authorization": "Bearer " + OPENROUTER_API_KEY, "HTTP-Referer": "https://firasai.netlify.app", "X-Title": "Firas AI" }, body: reqBody, signal }); }
  catch (e) { return signal.aborted ? true : false; }
  if (!upstream.ok || !upstream.body) { try { upstream && upstream.body && upstream.body.cancel(); } catch (_) {} return false; }
  const reader = upstream.body.getReader(); let buffer = "", any = false;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += td.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let evt; try { evt = JSON.parse(payload); } catch { continue; }
        const delta = evt.choices && evt.choices[0] && evt.choices[0].delta;
        if (delta) {
          if (delta.reasoning) { const f = sseFrame("", delta.reasoning); if (f) enc(f); }
          if (delta.content) { const f = sseFrame(delta.content); if (f) enc(f); any = true; }
        }
      }
    }
    return any;
  } catch (e) { return signal.aborted ? true : any; }
}

/* ---------------- DuckDuckGo search (ported) ---------------- */
function decodeEntities(s){ return String(s).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," "); }
function stripTags(s){ return decodeEntities(String(s).replace(/<[^>]+>/g,"")).replace(/\s+/g," ").trim(); }
function decodeDdgUrl(href){ try { const m=href.match(/[?&]uddg=([^&]+)/); if(m) return decodeURIComponent(m[1]); return href.startsWith("//")?"https:"+href:href; } catch { return href; } }
function parseDuckDuckGo(html) {
  const out = []; const titleRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = titleRe.exec(html)) && out.length < 8) {
    const url = decodeDdgUrl(m[1]); const title = stripTags(m[2]);
    if (!title || !/^https?:\/\//i.test(url)) continue;
    const after = html.slice(titleRe.lastIndex, titleRe.lastIndex + 1500);
    const nt = after.search(/<a[^>]+class="[^"]*result__a/i);
    const win = nt >= 0 ? after.slice(0, nt) : after;
    const sm = win.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    out.push({ title, url, snippet: sm ? stripTags(sm[1]) : "" });
  }
  return out;
}

/* ---------------- image quota helpers ---------------- */
function serverDay(d) { d = d || new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; }
// Today's charged cids for a user, as an object { cid: true }. Each cid is its own
// child key so concurrent distinct-cid charges never clobber each other (no array
// read-modify-write), and the day naturally "rolls over" since the path is dated.
async function imgDayNode(userId) { return (await dbGet(`imgQuota/${userId}/${serverDay()}`)) || {}; }
// Today's charged Max-tier request ids for a user, as { cid: true } — same per-child
// scheme as images so concurrent distinct charges never clobber each other.
async function maxDayNode(userId) { return (await dbGet(`maxQuota/${userId}/${serverDay()}`)) || {}; }

// Generate an image via Puter's driver API using the DEVELOPER's auth token (server-
// side → end users never sign in). Real GPT-Image/Gemini quality, free. {bytes,mime}|null.
async function generateImagePuter(prompt) {
  if (!PUTER_AUTH_TOKEN) return null;
  if (Date.now() < _puterCooldownUntil) return null;
  const model = PUTER_MODEL_ALIASES[PUTER_IMAGE_MODEL] || PUTER_IMAGE_MODEL;
  const args = { prompt: String(prompt || "").slice(0, 4000), model };
  if (/gpt-image-(2|1\.5)/i.test(model) && PUTER_IMAGE_QUALITY) args.quality = PUTER_IMAGE_QUALITY;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 120000);
  try {
    const r = await fetch(PUTER_DRIVER_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + PUTER_AUTH_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ interface: "puter-image-generation", driver: "ai-image", method: "generate", args }),
      signal: ac.signal,
    });
    if (!r.ok) {
      if (r.status === 402 || /insufficient/i.test(await r.text().catch(() => ""))) { _puterCooldownUntil = Date.now() + 10 * 60000; }
      return null;
    }
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.startsWith("image/")) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      return bytes.length ? { bytes, mime: ct } : null;
    }
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (_) {}
    if (j && j.success === false) return null;
    const pick = (v) => { if (!v) return null; if (typeof v === "string") return v; if (typeof v === "object") return v.url || v.image_url || v.image || v.data || v.b64_json || v.base64 || pick(v.result) || null; return null; };
    let s = j ? (pick(j.result) || pick(j)) : txt;
    if (typeof s !== "string" || !s) return null;
    s = s.trim();
    if (s.startsWith("data:")) {
      const comma = s.indexOf(","), semi = s.indexOf(";");
      const mime = semi > 5 ? s.slice(5, semi) : "image/png";
      try { return { bytes: b64ToBytes(s.slice(comma + 1)), mime }; } catch (_) { return null; }
    }
    if (/^https?:\/\//i.test(s)) {
      const ir = await fetch(s, { signal: ac.signal });
      if (!ir.ok) return null;
      const bytes = new Uint8Array(await ir.arrayBuffer());
      return bytes.length ? { bytes, mime: ir.headers.get("content-type") || "image/png" } : null;
    }
    if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.replace(/\s+/g, "").length > 200) {
      try { const bytes = b64ToBytes(s.replace(/\s+/g, "")); if (bytes.length > 100) return { bytes, mime: "image/png" }; } catch (_) {}
    }
    return null;
  } catch (_) { return null; }
  finally { clearTimeout(to); }
}

// Generate an image via Cloudflare Workers AI (free daily quota, reliable). flux-schnell
// returns base64 in {result:{image}}; SDXL-style models return raw bytes. {bytes,mime}|null.
// One attempt against a SINGLE account. Returns {bytes,mime}, "429", or null.
async function cfTryAccount(acct, prompt, w, h) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 90000);
  try {
    const url = "https://api.cloudflare.com/client/v4/accounts/" + acct.id + "/ai/run/" + CF_IMAGE_MODEL;
    const text = String(prompt || "").slice(0, 2000);
    let r;
    if (/flux-2/i.test(CF_IMAGE_MODEL)) {
      // FLUX.2 needs multipart/form-data — don't set content-type (fetch adds the boundary).
      const fd = new FormData();
      fd.append("prompt", text); fd.append("steps", String(CF_IMAGE_STEPS));
      fd.append("width", String(w || 1024)); fd.append("height", String(h || 1024));
      r = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + acct.token }, body: fd, signal: ac.signal });
    } else {
      const body = { prompt: text };
      if (/flux-1|schnell/i.test(CF_IMAGE_MODEL)) body.steps = Math.min(8, CF_IMAGE_STEPS); // flux-schnell max 8
      r = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + acct.token, "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
    }
    if (!r.ok) {
      if (r.status === 429 || /allocation|neurons/i.test(await r.text().catch(() => ""))) return "429";
      return null;
    }
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.startsWith("image/")) { const bytes = new Uint8Array(await r.arrayBuffer()); return bytes.length ? { bytes, mime: ct } : null; }
    const j = await r.json().catch(() => null);
    const b64 = j && ((j.result && (j.result.image || (Array.isArray(j.result.images) && j.result.images[0]))) || j.image);
    if (typeof b64 === "string" && b64.length > 100) {
      const clean = b64.startsWith("data:") ? b64.slice(b64.indexOf(",") + 1) : b64;
      try { const bytes = b64ToBytes(clean); return bytes.length ? { bytes, mime: sniffImageMime(bytes) } : null; } catch (_) { return null; }
    }
    return null;
  } catch (_) { return null; }
  finally { clearTimeout(to); }
}
// Round-robin across pooled accounts (spreads load), skipping any in 429 cooldown and
// falling over to the next on failure. Returns {bytes,mime} or null.
let _cfNext = 0;
async function generateImageCloudflare(prompt, w, h) {
  const n = CF_ACCOUNTS.length;
  if (!n) return null;
  for (let k = 0; k < n; k++) {
    const acct = CF_ACCOUNTS[(_cfNext + k) % n];
    if (Date.now() < (_cfCooldown.get(acct.id) || 0)) continue;
    const out = await cfTryAccount(acct, prompt, w, h);
    if (out === "429") { _cfCooldown.set(acct.id, Date.now() + 30 * 60000); continue; }
    if (out && out.bytes && out.bytes.length) { _cfNext = (_cfNext + k + 1) % n; return out; }
  }
  return null;
}

// Generate an image with Gemini (Google AI Studio). Returns {bytes, mime} or null to
// fall back to pollinations. Free key, ~500/day, no card.
async function generateImageGemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 45000);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_IMAGE_MODEL + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: String(prompt || "").slice(0, 4000) }] }] }),
      signal: ac.signal,
    });
    if (!r.ok) return null;
    const j = await r.json();
    const parts = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        const inl = p.inlineData || p.inline_data;
        if (inl && inl.data) { try { return { bytes: b64ToBytes(inl.data), mime: inl.mimeType || inl.mime_type || "image/png" }; } catch (_) {} }
      }
    }
    return null;
  } catch (_) { return null; }
  finally { clearTimeout(to); }
}

// Generate an image with Hugging Face (FLUX.1-schnell). Returns {bytes, mime} or null.
async function generateImageHF(prompt) {
  if (!HF_API_KEY) return null;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 60000);
  try {
    const r = await fetch(HF_IMAGE_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + HF_API_KEY, "content-type": "application/json", "Accept": "image/png" },
      body: JSON.stringify({ inputs: String(prompt || "").slice(0, 2000) }),
      signal: ac.signal,
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    return bytes.length ? { bytes, mime: ct } : null;
  } catch (_) { return null; }
  finally { clearTimeout(to); }
}

/* ============================================================================
   ROUTER
   ============================================================================ */
export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  try {
    if (!SESSION_SECRET || !FB_SA || !FIREBASE_DB_URL) {
      // Misconfig: name exactly which env var is missing/invalid (must be set in the
      // Netlify UI with the "Functions" scope — NOT in netlify.toml).
      if (path !== "/api/version") {
        const missing = [!SESSION_SECRET && "SESSION_SECRET", !FIREBASE_DB_URL && "FIREBASE_DB_URL", !FB_SA && "FIREBASE_SERVICE_ACCOUNT (valid JSON)"].filter(Boolean);
        return json({ error: "server not configured — missing/invalid env: " + missing.join(", ") }, 500);
      }
    }

    // Version changes per deploy (deploy id), so open tabs auto-reload after a deploy.
    if (path === "/api/version") return json({ version: (context.deploy && context.deploy.id) || env("DEPLOY_VERSION") || "netlify-1" });

    if (path === "/api/chat") {
      if (method !== "POST") return new Response("method not allowed", { status: 405 });
      const user = await currentUser(context);
      if (!user) return json({ error: "authentication required" }, 401);
      let payload; try { payload = await request.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const tier = TIERS[payload.tier] ? payload.tier : "pro";
      if (!messages.length) return json({ error: 'body must include a non-empty "messages" array' }, 400);
      // Inject persistent user memory so every reply is personalized — but NOT for
      // internal agent calls (nomem=true: file/PDF generation, prompt-enhance), so
      // personal facts never leak into generated documents. Memory is for CHAT only.
      const memBlk = payload.nomem ? "" : memoryBlock(user);
      if (memBlk) { const si = messages.findIndex((m) => m && m.role === "system"); if (si >= 0) messages[si] = { role: "system", content: String(messages[si].content || "") + "\n\n" + memBlk }; else messages.unshift({ role: "system", content: memBlk }); }
      const vision = hasImages(messages);
      const think = vision ? false : !!payload.think;
      // Capped tier (Max): enforce the per-user daily limit and charge one slot per
      // distinct request id (idempotent on retry of the same cid).
      if (TIERS[tier] && TIERS[tier].capped) {
        const day = serverDay();
        const node = await maxDayNode(user.id);
        let cid = String(payload.cid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
        const isNew = !cid || !(cid in node);
        if (isNew && Object.keys(node).length >= MAX_DAILY_LIMIT) {
          return json({ error: "daily Max limit reached", limit: MAX_DAILY_LIMIT, used: Object.keys(node).length, remaining: 0 }, 429);
        }
        if (isNew) { if (!cid) cid = crypto.randomUUID(); try { await dbPut(`maxQuota/${user.id}/${day}/${cid}`, true); } catch (_) {} }
      }
      return chatStreamResponse(messages, tier, think, vision);
    }

    /* ---- auth ---- */
    if (path === "/api/auth/signup" && method === "POST") {
      if (rateLimited("auth:signup:" + ipOf(request, context), 12, 60000)) return json({ error: "too many attempts, please wait a minute" }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
      const name = String(b.name ?? "").trim().slice(0, 80);
      const email = String(b.email ?? "").trim().toLowerCase();
      const password = String(b.password ?? "");
      if (!name) return json({ error: "name is required" }, 400);
      if (!EMAIL_RE.test(email) || email.length > 200) return json({ error: "a valid email is required" }, 400);
      if (password.length < 8) return json({ error: "password must be at least 8 characters" }, 400);
      if (password.length > 200) return json({ error: "password is too long" }, 400);
      if (await getUserByEmail(email)) return json({ error: "email already registered" }, 409);
      // Don't create the account yet — stash a PENDING signup (Firebase) + email a verify LINK.
      const ek = emailKey(email);
      const prev = await dbGet("pending/" + ek); // re-signup before verifying → clear old indexes
      if (prev) await delPending(ek, prev);
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const pid = crypto.randomUUID().replace(/-/g, "");
      const rec = { name, email, passHash: await hashPassword(password), token, pid, exp: Date.now() + VERIFY_TTL_MS, verified: false, userId: null };
      await dbPut("pending/" + ek, rec);
      await dbPut("pendingTok/" + token, ek);
      await dbPut("pendingPid/" + pid, ek);
      const link = appBase(request) + "/?verify=" + token;
      const sent = await sendEmail(email, "تأكيد حسابك — Firas AI", verifyEmailHtml(link));
      if (!sent) console.log("[firas] signup verify link for " + email + " -> " + link + " (not delivered)");
      return json({ ok: true, pending: true, email, pid });
    }

    if (path === "/api/auth/login" && method === "POST") {
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
      const email = String(b.email ?? "").trim().toLowerCase();
      const password = String(b.password ?? "");
      if (rateLimited("login:" + email, 6, 60000)) return json({ error: "too many attempts, please wait a minute" }, 429);
      const user = await getUserByEmail(email);
      // A legacy scrypt account (from the old Node backend) can't be verified with
      // Web Crypto — give a clear message instead of "invalid password".
      if (user && user.passHash && !user.passHash.startsWith("pbkdf2$")) {
        return json({ error: "This account predates the new sign-in. Please reset your password, or sign in with Google." }, 401);
      }
      if (!user || !user.passHash || !(await verifyPassword(password, user.passHash))) return json({ error: "invalid email or password" }, 401);
      await attachSession(context, user.id, request);
      return json({ user: publicUser(user) });
    }

    if (path === "/api/auth/verify-signup" && method === "POST") {
      if (rateLimited("verify:" + ipOf(request, context), 60, 60000)) return json({ error: "too many requests" }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
      const token = String(b.token || "").trim(); if (!token) return json({ error: "رابط غير صالح" }, 400);
      const ek = await dbGet("pendingTok/" + token);
      const rec = ek ? await dbGet("pending/" + ek) : null;
      if (!rec || Date.now() > rec.exp) { if (ek) await delPending(ek, rec); return json({ error: "الرابط غير صالح أو منتهي — أعد التسجيل" }, 400); }
      let user;
      if (rec.verified && rec.userId) { user = await getUserById(rec.userId); }
      else {
        if (await getUserByEmail(rec.email)) { await delPending(ek, rec); return json({ error: "email already registered" }, 409); }
        user = { id: crypto.randomUUID(), name: rec.name, email: rec.email, passHash: rec.passHash, emailVerified: true, createdAt: new Date().toISOString() };
        await saveUser(user);
        rec.verified = true; rec.userId = user.id; rec.verifiedAt = Date.now();
        await dbPut("pending/" + ek, rec);
        // Consume the token so the link can't be replayed; the pid index stays for the
        // original device's cross-device poll, which then cleans up the rest.
        try { await dbDelete("pendingTok/" + token); } catch (_) {}
        // personal welcome from Firas — don't block sign-in (run after response if possible)
        const _welcome = sendEmail(user.email, "أهلاً بك في Firas AI 🎉", welcomeEmailHtml(user.name, appBase(request) + "/"), { fromName: "فراس" }).catch(() => {});
        if (context && typeof context.waitUntil === "function") context.waitUntil(_welcome); else await _welcome;
      }
      if (!user) return json({ error: "تعذّر التأكيد — أعد التسجيل" }, 400);
      await attachSession(context, user.id, request);
      return json({ ok: true, user: publicUser(user) });
    }
    if (path === "/api/auth/verify-status" && method === "POST") {
      if (rateLimited("vstatus:" + ipOf(request, context), 120, 60000)) return json({ error: "too many requests" }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
      const pid = String(b.pid || "").trim(); if (!pid) return json({ error: "missing pid" }, 400);
      const ek = await dbGet("pendingPid/" + pid);
      const rec = ek ? await dbGet("pending/" + ek) : null;
      if (!rec) return json({ verified: false, gone: true });
      if (Date.now() > rec.exp) { await delPending(ek, rec); return json({ verified: false, expired: true }); }
      if (rec.verified && rec.userId) {
        const user = await getUserById(rec.userId);
        if (user) { await attachSession(context, user.id, request); await delPending(ek, rec); return json({ verified: true, user: publicUser(user) }); }
      }
      return json({ verified: false });
    }
    if (path === "/api/auth/resend-code" && method === "POST") {
      if (rateLimited("resend:" + ipOf(request, context), 8, 60000)) return json({ error: "too many requests" }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
      const email = String(b.email || "").trim().toLowerCase();
      const ek = emailKey(email);
      const rec = await dbGet("pending/" + ek);
      if (rec && !rec.verified) {
        if (rec.token) { try { await dbDelete("pendingTok/" + rec.token); } catch (_) {} }
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        rec.token = token; rec.exp = Date.now() + VERIFY_TTL_MS;
        await dbPut("pending/" + ek, rec);
        await dbPut("pendingTok/" + token, ek);
        const link = appBase(request) + "/?verify=" + token;
        const sent = await sendEmail(email, "تأكيد حسابك — Firas AI", verifyEmailHtml(link));
        if (!sent) console.log("[firas] (resend) verify link for " + email + " -> " + link);
      }
      return json({ ok: true });
    }
    if (path === "/api/auth/forgot" && method === "POST") {
      if (rateLimited("forgot:" + ipOf(request, context), 6, 60000)) return json({ error: "too many requests" }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
      const email = String(b.email || "").trim().toLowerCase();
      if (EMAIL_RE.test(email)) {
        const user = await getUserByEmail(email);
        if (user && user.passHash) {
          const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
          user.reset = { hash: await sha256hex(token), exp: Date.now() + RESET_TTL_MS }; // store only a hash, never the raw token
          await saveUser(user);
          const link = appBase(request) + "/?reset=" + token + "&uid=" + encodeURIComponent(user.id);
          const sent = await sendEmail(email, "إعادة تعيين كلمة المرور — Firas AI", resetEmailHtml(link));
          if (!sent) console.log("[firas] password-reset link for " + email + " -> " + link);
        }
      }
      return json({ ok: true }); // anti-enumeration
    }
    if (path === "/api/auth/reset" && method === "POST") {
      if (rateLimited("reset:" + ipOf(request, context), 10, 60000)) return json({ error: "too many requests" }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
      const uid = String(b.uid || ""), token = String(b.token || ""), password = String(b.password || "");
      if (password.length < 8) return json({ error: "password must be at least 8 characters" }, 400);
      if (password.length > 200) return json({ error: "password is too long" }, 400);
      const user = await getUserById(uid);
      if (!user || !user.reset || !user.reset.hash || Date.now() > user.reset.exp || user.reset.hash !== await sha256hex(token)) return json({ error: "invalid or expired link" }, 400);
      user.passHash = await hashPassword(password);
      delete user.reset;
      await saveUser(user);
      await attachSession(context, user.id, request);
      return json({ ok: true, user: publicUser(user) });
    }

    if (path === "/api/auth/change-password" && method === "POST") {
      const user = await currentUser(context);
      if (!user) return json({ error: "not authenticated" }, 401);
      if (rateLimited("acct:" + user.id, 10, 60000)) return json({ error: "too many requests" }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
      const current = String(b.current || ""), next = String(b.password || "");
      if (!user.passHash) return json({ error: "هذا الحساب يسجّل عبر Google ولا يملك كلمة مرور" }, 400);
      if (next.length < 8) return json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
      if (next.length > 200) return json({ error: "كلمة المرور طويلة جداً" }, 400);
      if (!(await verifyPassword(current, user.passHash))) return json({ error: "كلمة المرور الحالية غير صحيحة" }, 403);
      user.passHash = await hashPassword(next);
      await saveUser(user);
      return json({ ok: true });
    }
    if (path === "/api/auth/change-email" && method === "POST") {
      const user = await currentUser(context);
      if (!user) return json({ error: "not authenticated" }, 401);
      if (rateLimited("acct:" + user.id, 10, 60000)) return json({ error: "too many requests" }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
      const current = String(b.current || ""), email = String(b.email || "").trim().toLowerCase();
      if (!user.passHash) return json({ error: "هذا الحساب يسجّل عبر Google" }, 400);
      if (!EMAIL_RE.test(email) || email.length > 200) return json({ error: "أدخل بريداً صالحاً" }, 400);
      if (!(await verifyPassword(current, user.passHash))) return json({ error: "كلمة المرور غير صحيحة" }, 403);
      if (email === user.email) return json({ error: "هذا هو بريدك الحالي" }, 400);
      if (await getUserByEmail(email)) return json({ error: "هذا البريد مستخدم بالفعل" }, 409);
      const oldKey = emailKey(user.email);
      user.email = email;
      await saveUser(user);
      try { await dbDelete("emailIndex/" + oldKey); } catch (_) {}
      return json({ ok: true, user: publicUser(user) });
    }
    if (path === "/api/auth/delete-account" && method === "POST") {
      const user = await currentUser(context);
      if (!user) return json({ error: "not authenticated" }, 401);
      if (rateLimited("acct:" + user.id, 10, 60000)) return json({ error: "too many requests" }, 429);
      let b; try { b = await request.json(); } catch { b = {}; }
      const current = String((b && b.current) || "");
      if (user.passHash && !(await verifyPassword(current, user.passHash))) return json({ error: "كلمة المرور غير صحيحة" }, 403);
      try { await dbDelete("chats/" + user.id); } catch (_) {}
      try { await dbDelete("emailIndex/" + emailKey(user.email)); } catch (_) {}
      try { await dbDelete("users/" + user.id); } catch (_) {}
      context.cookies.delete({ name: COOKIE_NAME, path: "/" });
      return json({ ok: true });
    }

    if (path === "/api/auth/logout" && method === "POST") {
      context.cookies.delete({ name: COOKIE_NAME, path: "/" });
      return json({ ok: true });
    }

    if (path === "/api/auth/me" && method === "GET") {
      const user = await currentUser(context);
      if (!user) return json({ error: "not authenticated" }, 401);
      return json({ user: publicUser(user) });
    }

    if (path === "/api/auth/firebase" && method === "POST") {
      if (rateLimited("auth:fb:" + ipOf(request, context), 30, 60000)) return json({ error: "too many attempts, please wait a minute" }, 429);
      if (!FIREBASE_PROJECT_ID) return json({ error: "social sign-in not configured" }, 501);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
      let payload = null; try { payload = await verifyFirebaseIdToken(b.idToken); } catch { payload = null; }
      if (!payload) return json({ error: "invalid token" }, 401);
      const email = String(payload.email).trim().toLowerCase();
      const name = (typeof payload.name === "string" && payload.name.trim() && payload.name.trim().slice(0, 80)) || (typeof b.name === "string" && b.name.trim() && b.name.trim().slice(0, 80)) || email.split("@")[0];
      let user = await getUserByEmail(email);
      if (user) {
        const verified = payload.email_verified === true;
        if (!!user.passHash && !verified) return json({ error: "An account with this email already exists. Please sign in with your password, or verify your email first." }, 409);
      } else {
        user = { id: crypto.randomUUID(), name, email, provider: "firebase", createdAt: new Date().toISOString() };
        await saveUser(user);
      }
      await attachSession(context, user.id, request);
      return json({ user: publicUser(user) });
    }

    /* ---- chats ---- */
    if (path === "/api/chats") {
      const user = await currentUser(context);
      if (!user) return json({ error: "not authenticated" }, 401);
      if (method === "GET") {
        const meta = (await dbGet("chatMeta/" + user.id)) || {};
        const list = Object.keys(meta).map((id) => ({ id, title: meta[id].title, updatedAt: meta[id].updatedAt, pinned: !!meta[id].pinned })).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
        return json(list);
      }
      if (method === "POST") {
        let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
        const meta = (await dbGet("chatMeta/" + user.id)) || {};
        if (Object.keys(meta).length >= MAX_CHATS_PER_USER) return json({ error: "chat limit reached; delete some conversations" }, 409);
        const now = new Date().toISOString();
        const chat = { id: crypto.randomUUID(), userId: user.id, title: String(b.title ?? "New chat").slice(0, 200) || "New chat", messages: sanitizeMessages(b.messages), pinned: !!b.pinned, createdAt: now, updatedAt: now };
        await dbPut(`chats/${user.id}/${chat.id}`, chat);
        await dbPut(`chatMeta/${user.id}/${chat.id}`, { title: chat.title, updatedAt: now, pinned: chat.pinned });
        return json({ id: chat.id, title: chat.title, createdAt: now, updatedAt: now }, 201);
      }
      return new Response("method not allowed", { status: 405 });
    }
    const chatMatch = path.match(/^\/api\/chats\/([^/]+)$/);
    if (chatMatch) {
      const user = await currentUser(context);
      if (!user) return json({ error: "not authenticated" }, 401);
      const id = decodeURIComponent(chatMatch[1]);
      if (method === "GET") {
        const chat = await dbGet(`chats/${user.id}/${id}`);
        if (!chat) return json({ error: "not found" }, 404);
        return json({ id: chat.id, title: chat.title, messages: chat.messages || [] });
      }
      if (method === "PUT") {
        let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
        const chat = await dbGet(`chats/${user.id}/${id}`);
        if (!chat) return json({ error: "not found" }, 404);
        let touched = false;
        if (typeof b.title === "string") { chat.title = b.title.slice(0, 200); touched = true; }
        if (Array.isArray(b.messages)) { chat.messages = sanitizeMessages(b.messages); touched = true; }
        if (typeof b.pinned === "boolean") chat.pinned = b.pinned; // pin toggle alone must not bump updatedAt
        if (touched) chat.updatedAt = new Date().toISOString();
        await dbPut(`chats/${user.id}/${id}`, chat);
        await dbPut(`chatMeta/${user.id}/${id}`, { title: chat.title, updatedAt: chat.updatedAt, pinned: !!chat.pinned });
        return json({ ok: true });
      }
      if (method === "DELETE") {
        await dbDelete(`chats/${user.id}/${id}`);
        await dbDelete(`chatMeta/${user.id}/${id}`);
        return json({ ok: true });
      }
      return new Response("method not allowed", { status: 405 });
    }

    /* ---- image quota (read-only pre-check) ---- */
    if (path === "/api/image/quota" && method === "POST") {
      const user = await currentUser(context);
      if (!user) return json({ ok: false, error: "auth required" }, 401);
      const used = Object.keys(await imgDayNode(user.id)).length;
      if (used >= IMAGE_DAILY_LIMIT) return json({ ok: false, limit: IMAGE_DAILY_LIMIT, used, remaining: 0 }, 429);
      return json({ ok: true, limit: IMAGE_DAILY_LIMIT, used, remaining: IMAGE_DAILY_LIMIT - used });
    }

    /* ---- Max tier quota (read-only pre-check) ---- */
    if (path === "/api/memory" && method === "GET") {
      const user = await currentUser(context); if (!user) return json({ error: "authentication required" }, 401);
      return json({ memory: userMemory(user) });
    }
    if (path === "/api/memory" && method === "DELETE") {
      const user = await currentUser(context); if (!user) return json({ error: "authentication required" }, 401);
      const i = url.searchParams.get("i"); const mem = userMemory(user);
      if (i != null && i !== "") { const n = parseInt(i, 10); if (n >= 0 && n < mem.length) mem.splice(n, 1); } else user.memory = [];
      try { await saveUser(user); } catch (_) {}
      return json({ ok: true, memory: userMemory(user) });
    }
    if (path === "/api/memory/learn" && method === "POST") {
      const user = await currentUser(context); if (!user) return json({ error: "authentication required" }, 401);
      if (rateLimited("mem:" + user.id, 60, 60000)) return json({ error: "rate limited" }, 429);
      let payload; try { payload = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
      const userText = String(payload.user || "").slice(0, 4000).trim();
      const aiText = String(payload.assistant || "").slice(0, 2000).trim();
      if (!userText) return json({ ok: true, added: 0 });
      const added = await memoryLearn(user, userText, aiText);
      return json({ ok: true, added, total: userMemory(user).length });
    }

    if (path === "/api/max/quota" && method === "POST") {
      const user = await currentUser(context);
      if (!user) return json({ ok: false, error: "auth required" }, 401);
      // Max is FREE & UNLIMITED for everyone now.
      return json({ ok: true, limit: 0, used: 0, remaining: -1 });
    }

    /* ---- site updates / announcements (admin publishes, all users see) ---- */
    if (path === "/api/announcements" && method === "GET") {
      const user = await currentUser(context);
      if (!user) return json({ error: "authentication required" }, 401);
      const node = (await dbGet("announcements")) || {};
      const list = Object.values(node).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 50);
      return json({ announcements: list, admin: isAdmin(user) });
    }
    if (path === "/api/announcements" && method === "POST") {
      const user = await currentUser(context);
      if (!user) return json({ error: "authentication required" }, 401);
      if (!isAdmin(user)) return json({ error: "admins only" }, 403);
      let p; try { p = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }
      const title = String(p.title || "").slice(0, 200).trim();
      const body = String(p.body || "").slice(0, 4000).trim();
      let image = String(p.image || "").trim();
      if (image && !ANN_IMG_OK(image)) image = "";
      if (image.length > 600000) return json({ error: "image too large" }, 413);
      if (!title && !body && !image) return json({ error: "empty announcement" }, 400);
      const id = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const item = { id, title, body, image, ts: Date.now(), by: user.name || "Firas" };
      try { await dbPut("announcements/" + id, item); } catch (_) {}
      return json({ ok: true, announcement: item });
    }
    if (path === "/api/announcements" && method === "DELETE") {
      const user = await currentUser(context);
      if (!user) return json({ error: "authentication required" }, 401);
      if (!isAdmin(user)) return json({ error: "admins only" }, 403);
      const id = url.searchParams.get("id");
      if (id) { try { await dbPut("announcements/" + id, null); } catch (_) {} }
      return json({ ok: true });
    }

    /* ---- image generation proxy (charge on success by cid) ---- */
    if (path === "/api/image" && method === "GET") {
      const user = await currentUser(context);
      if (!user) return new Response("auth required", { status: 401 });
      if (rateLimited("img:" + user.id, 240, 60000)) return new Response("rate limited", { status: 429 });
      const prompt = (url.searchParams.get("prompt") || "").trim().slice(0, 1000);
      if (!prompt) return new Response("no prompt", { status: 400 });
      const cid = (url.searchParams.get("cid") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
      const day = serverDay();
      const node = await imgDayNode(user.id);
      const isNew = !!cid && !(cid in node);
      if (isNew && Object.keys(node).length >= IMAGE_DAILY_LIMIT) return new Response("daily limit reached", { status: 429 });
      const w = Math.min(1280, Math.max(256, parseInt(url.searchParams.get("w"), 10) || 1024));
      const h = Math.min(1280, Math.max(256, parseInt(url.searchParams.get("h"), 10) || 1024));
      const seed = (url.searchParams.get("seed") || "").replace(/[^0-9]/g, "").slice(0, 12);
      // Cloudflare Workers AI (FREE FLUX.2, ~65/day) FIRST → great quality + in-image text,
      // no per-image cost, no user login. Falls through to Puter when its daily quota is gone.
      try {
        const cf = await generateImageCloudflare(prompt, w, h);
        if (cf && cf.bytes && cf.bytes.length) {
          if (isNew) { try { await dbPut(`imgQuota/${user.id}/${day}/${cid}`, true); } catch (_) {} }
          return new Response(cf.bytes, { headers: { "Content-Type": cf.mime, "Cache-Control": "public, max-age=86400" } });
        }
      } catch (_) { /* fall through */ }
      // Puter gpt-image-2 (paid credits) → premium fallback: the sharpest in-image text.
      try {
        const put = await generateImagePuter(prompt);
        if (put && put.bytes && put.bytes.length) {
          if (isNew) { try { await dbPut(`imgQuota/${user.id}/${day}/${cid}`, true); } catch (_) {} }
          return new Response(put.bytes, { headers: { "Content-Type": put.mime, "Cache-Control": "public, max-age=86400" } });
        }
      } catch (_) { /* fall through */ }
      // Gemini (free key) → actual Gemini-image quality; else keyless pollinations.
      try {
        const gem = await generateImageGemini(prompt);
        if (gem && gem.bytes && gem.bytes.length) {
          if (isNew) { try { await dbPut(`imgQuota/${user.id}/${day}/${cid}`, true); } catch (_) {} }
          return new Response(gem.bytes, { headers: { "Content-Type": gem.mime, "Cache-Control": "public, max-age=86400" } });
        }
      } catch (_) { /* fall through */ }
      // Hugging Face FLUX.1-schnell (free token) → lossless PNG; ~on par with keyless.
      try {
        const hf = await generateImageHF(prompt);
        if (hf && hf.bytes && hf.bytes.length) {
          if (isNew) { try { await dbPut(`imgQuota/${user.id}/${day}/${cid}`, true); } catch (_) {} }
          return new Response(hf.bytes, { headers: { "Content-Type": hf.mime, "Cache-Control": "public, max-age=86400" } });
        }
      } catch (_) { /* fall through to pollinations */ }
      const src = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=" + w + "&height=" + h + "&nologo=true&enhance=true&private=true&nofeed=true&model=flux" + (seed ? "&seed=" + seed : "");
      try {
        const r = await fetch(src, { headers: { "User-Agent": SEARCH_UA, "Accept": "image/*" } });
        if (!r.ok) return new Response("image generation failed", { status: 502 });
        const buf = new Uint8Array(await r.arrayBuffer());
        if (isNew) { try { await dbPut(`imgQuota/${user.id}/${day}/${cid}`, true); } catch (_) {} } // charge once, on success
        return new Response(buf, { headers: { "Content-Type": r.headers.get("content-type") || "image/jpeg", "Cache-Control": "public, max-age=86400" } });
      } catch (_) { return new Response("image generation error", { status: 502 }); }
    }

    /* ---- web search ---- */
    if (path === "/api/search" && method === "GET") {
      const user = await currentUser(context);
      if (!user) return json({ results: [], error: "auth" }, 401);
      if (rateLimited("search:" + user.id, 30, 60000)) return json({ results: [], error: "rate" }, 429);
      const q = (url.searchParams.get("q") || "").trim().slice(0, 300);
      if (!q) return json({ results: [] }, 400);
      let results = [];
      try {
        const r = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { headers: { "User-Agent": SEARCH_UA, "Accept-Language": "ar,en-US;q=0.8,en;q=0.6", "Accept": "text/html" } });
        if (r.ok) results = parseDuckDuckGo(await r.text()).slice(0, 6);
      } catch (_) {}
      return json({ q, results });
    }

    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: "internal error", detail: String((e && e.message) || e).slice(0, 200) }, 500);
  }
};

export const config = { path: "/api/*" };
