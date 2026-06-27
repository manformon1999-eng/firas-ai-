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
const UPSTREAM_TIMEOUT_MS = Number(env("REQUEST_TIMEOUT_MS")) || 300000;

const COOKIE_NAME = "firas_session";
const COOKIE_MAX_AGE = 2592000;            // 30 days (seconds)
const MAX_CHATS_PER_USER = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_DAILY_LIMIT = Math.max(1, parseInt(env("IMAGE_DAILY_LIMIT") || "5", 10) || 5);
const MAX_DAILY_LIMIT  = Math.max(1, parseInt(env("MAX_DAILY_LIMIT")  || "10", 10) || 10);

const TIERS = {
  mini:  { model: env("OLLAMA_MODEL_MINI")  || "gpt-oss:120b-cloud",     temperature: 0.5, num_predict: 16384 },
  pro:   { model: env("OLLAMA_MODEL_PRO")   || "gpt-oss:120b-cloud",     temperature: 0.7, num_predict: 131072 },
  ultra: { model: env("OLLAMA_MODEL_ULTRA") || "qwen3-coder:480b-cloud", temperature: 0.8, num_predict: 65536 },
  // Max = strongest general/reasoning model (671B), gated by a per-user daily cap.
  // Env-overridable so the model can be swapped without a redeploy if Ollama's
  // cloud catalog rotates. fallbackModel degrades to a known-good hosted model
  // (gpt-oss) before the last-resort pollinations fallback.
  max:   { model: env("OLLAMA_MODEL_MAX") || "deepseek-v3.1:671b-cloud", temperature: 0.7, num_predict: 32768, fallbackModel: env("OLLAMA_MODEL_MAX_FALLBACK") || "gpt-oss:120b-cloud", capped: true },
};
const OLLAMA_MODEL_VISION = env("OLLAMA_MODEL_VISION") || "qwen2.5vl:7b";
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
        const okOllama = await streamOllamaInto(enc, ollamaMessages, tier, think, ac.signal, modelOverride);
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
      if (rateLimited("auth:signup", 30, 60000)) return json({ error: "too many attempts, please wait a minute" }, 429);
      let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
      const name = String(b.name ?? "").trim().slice(0, 80);
      const email = String(b.email ?? "").trim().toLowerCase();
      const password = String(b.password ?? "");
      if (!name) return json({ error: "name is required" }, 400);
      if (!EMAIL_RE.test(email) || email.length > 200) return json({ error: "a valid email is required" }, 400);
      if (password.length < 8) return json({ error: "password must be at least 8 characters" }, 400);
      if (password.length > 200) return json({ error: "password is too long" }, 400);
      if (await getUserByEmail(email)) return json({ error: "email already registered" }, 409);
      const user = { id: crypto.randomUUID(), name, email, passHash: await hashPassword(password), createdAt: new Date().toISOString() };
      await saveUser(user);
      await attachSession(context, user.id, request);
      return json({ user: publicUser(user) });
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
      if (rateLimited("auth:fb", 30, 60000)) return json({ error: "too many attempts, please wait a minute" }, 429);
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
        const list = Object.keys(meta).map((id) => ({ id, title: meta[id].title, updatedAt: meta[id].updatedAt })).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
        return json(list);
      }
      if (method === "POST") {
        let b; try { b = await request.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
        const meta = (await dbGet("chatMeta/" + user.id)) || {};
        if (Object.keys(meta).length >= MAX_CHATS_PER_USER) return json({ error: "chat limit reached; delete some conversations" }, 409);
        const now = new Date().toISOString();
        const chat = { id: crypto.randomUUID(), userId: user.id, title: String(b.title ?? "New chat").slice(0, 200) || "New chat", messages: sanitizeMessages(b.messages), createdAt: now, updatedAt: now };
        await dbPut(`chats/${user.id}/${chat.id}`, chat);
        await dbPut(`chatMeta/${user.id}/${chat.id}`, { title: chat.title, updatedAt: now });
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
        if (typeof b.title === "string") chat.title = b.title.slice(0, 200);
        if (Array.isArray(b.messages)) chat.messages = sanitizeMessages(b.messages);
        chat.updatedAt = new Date().toISOString();
        await dbPut(`chats/${user.id}/${id}`, chat);
        await dbPut(`chatMeta/${user.id}/${id}`, { title: chat.title, updatedAt: chat.updatedAt });
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
    if (path === "/api/max/quota" && method === "POST") {
      const user = await currentUser(context);
      if (!user) return json({ ok: false, error: "auth required" }, 401);
      const used = Object.keys(await maxDayNode(user.id)).length;
      if (used >= MAX_DAILY_LIMIT) return json({ ok: false, limit: MAX_DAILY_LIMIT, used, remaining: 0 }, 429);
      return json({ ok: true, limit: MAX_DAILY_LIMIT, used, remaining: MAX_DAILY_LIMIT - used });
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
      const src = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=" + w + "&height=" + h + "&nologo=true&model=flux" + (seed ? "&seed=" + seed : "");
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
