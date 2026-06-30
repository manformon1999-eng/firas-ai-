/* ============================================================================
   Firas AI — local server + AI proxy + accounts + database (Node 18+, ESM)
   ZERO npm dependencies. Pure node: http / crypto / fs / url / stream.

   What this server does:
     1. Serves the static site (index.html / styles.css / app.js / ...) with a
        Cache-Control: no-cache header so edits show up immediately.
     2. Exposes an authenticated AI stream at POST /api/chat, powered by Ollama
        (native /api/chat endpoint) with a free keyless pollinations fallback.
     3. Provides a real multi-user account system (signup / login / logout / me)
        backed by a serialized JSON-file database, with secure scrypt password
        hashing and signed HttpOnly session cookies.
     4. Stores per-user chat history (list / read / create / update / delete).

   Run:  node server.mjs      then open  http://localhost:3000
   ========================================================================== */
import http from "node:http";
import crypto from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load a local .env (KEY=value lines) if present, so secrets like OPENROUTER_API_KEY
// can be dropped in a gitignored file instead of exported each run. Real env vars
// still win (loadEnvFile does not overwrite already-set process.env). Node 20.12+.
try { process.loadEnvFile(path.join(__dirname, ".env")); } catch (_) { /* no .env — fine */ }

const PORT = process.env.PORT || process.argv[2] || 3000;

/* ---------------------------------------------------------------------------
   AI ENGINE = OLLAMA (native endpoint). Free pollinations fallback.
   --------------------------------------------------------------------------- */
// When an API key is set we're meant to use Ollama's HOSTED cloud, so default
// the host to https://ollama.com (a deployed server has no local daemon). Only
// fall back to localhost when there's no key (local dev).
const OLLAMA_HOST = (process.env.OLLAMA_HOST || (process.env.OLLAMA_API_KEY ? "https://ollama.com" : "http://localhost:11434")).replace(/\/+$/, "");
const OLLAMA_CHAT_URL = OLLAMA_HOST + "/api/chat";
const FALLBACK_URL = "https://text.pollinations.ai/openai"; // keyless, server-side (no Origin)
const FALLBACK_MODEL = "openai";
const UPSTREAM_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 300_000; // 5 min — long code/full websites need room to finish

// Optional Ollama API key. Set this (+ OLLAMA_HOST=https://ollama.com) to use
// Ollama's HOSTED cloud API from a deployed server that has NO local Ollama —
// so the app works online, not just on a machine running the Ollama daemon.
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
function ollamaHeaders() {
  const h = { "Content-Type": "application/json" };
  if (OLLAMA_API_KEY) h["Authorization"] = "Bearer " + OLLAMA_API_KEY;
  return h;
}

// PREMIUM "Max" tier engines (server-side keys only — end users stay keyless).
// Max chain: Gemini Flash (free) → Claude Sonnet (paid) → OpenRouter free (Nemotron) → Ollama/pollinations.
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL    = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_URL      = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MAX_TOK  = Math.max(1024, parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10) || 8192);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL   = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
// NVIDIA NIM (build.nvidia.com) — FREE OpenAI-compatible API. Powers the Max tier's PRIMARY engine
// (DeepSeek V4 Pro, frontier-class reasoning+coding). Key from .env (NVIDIA_API_KEY); when it's
// unset or rate-limited (free tier ~40 req/min) Max falls back to Gemini automatically.
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_OAI_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL   = process.env.NVIDIA_MODEL || "deepseek-ai/deepseek-v4-pro";
// CREDIT GUARD: cap DeepSeek (NVIDIA) calls per day so the free credit can't be drained — beyond the
// cap, Max uses Gemini (free). Tune with NVIDIA_DAILY_CAP. (server.mjs: in-memory per-process day count.)
const NVIDIA_DAILY_CAP = parseInt(process.env.NVIDIA_DAILY_CAP, 10) || 100;
let _nvDay = "", _nvCount = 0;
function nvidiaUnderCap() { const d = new Date().toISOString().slice(0, 10); if (d !== _nvDay) { _nvDay = d; _nvCount = 0; } return _nvCount < NVIDIA_DAILY_CAP; }
function nvidiaCharge() { _nvCount++; }
const OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions";
// Gemini TEXT for the Max tier — Google AI Studio FREE tier (Flash family is free,
// ~1500 req/day, no credit card; the stronger Pro tier is paid since Apr 2026). Uses
// Gemini's OpenAI-compatible endpoint so it streams exactly like OpenRouter. Tried FIRST
// in the Max chain. GEMINI_TEXT_MODEL may be a comma-separated fallback list of ids — the
// adapter uses the first that actually streams (resilient to Google's model-id churn).
const GEMINI_TEXT_MODELS = (process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash,gemini-flash-latest").split(",").map((s) => s.trim()).filter(Boolean);
const GEMINI_OAI_URL     = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
// Gemini image model (Google AI Studio "Nano Banana") — actual Gemini-level quality.
// If GEMINI_API_KEY is set, /api/image uses it FIRST, falling back to keyless
// pollinations on error/quota. Free key, NO credit card (aistudio.google.com).
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY || "";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
// Hugging Face image model. Only FLUX.1-schnell is still served FREE by hf-inference
// (FLUX.1-dev/SDXL/SD3.5 now 410/400 — need a paid provider). Lossless PNG, but not
// clearly better than keyless pollinations. If HF_API_KEY is set, /api/image tries it
// after Gemini, before keyless pollinations. HF_IMAGE_URL overrides the endpoint.
const HF_API_KEY     = process.env.HF_API_KEY || "";
const HF_IMAGE_MODEL = process.env.HF_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
const HF_IMAGE_URL   = process.env.HF_IMAGE_URL || ("https://router.huggingface.co/hf-inference/models/" + HF_IMAGE_MODEL);
// Puter.com image generation (the BEST free option). Calls Puter's driver API with
// the DEVELOPER's auth token server-side, so END USERS never sign in to Puter. Gives
// real GPT-Image / Gemini ("Nano Banana") quality for free. Tried FIRST when the token
// is set. Get a token at https://puter.com/dashboard#account → API token → Create.
const PUTER_AUTH_TOKEN    = process.env.PUTER_AUTH_TOKEN || "";
// Default = gpt-image-2 at "low": the FULL GPT-Image model (sharper, better in-image
// text than gpt-image-1-mini) at moderate cost. gpt-image-2 "high"/"medium" + gemini
// "nano-banana" cost more and 402 fast; set gpt-image-1-mini for the cheapest / most-
// images-per-credit option.
const PUTER_IMAGE_MODEL   = process.env.PUTER_IMAGE_MODEL || "gpt-image-2";
const PUTER_IMAGE_QUALITY = process.env.PUTER_IMAGE_QUALITY || "low"; // gpt-image-2 / gpt-image-1.5 only: low | medium | high
const PUTER_DRIVER_URL    = "https://api.puter.com/drivers/call";
// Friendly aliases (mirrors puter.js so PUTER_IMAGE_MODEL=nano-banana works server-side)
const PUTER_MODEL_ALIASES = { "nano-banana": "gemini-2.5-flash-image-preview", "nano-banana-pro": "gemini-3-pro-image-preview" };
// Cloudflare Workers AI image generation — RELIABLE FREE fallback (10,000 neurons/day
// free ≈ ~150-200 images/day, no card). FLUX.1-schnell quality (≈ pollinations, NOT
// gpt-image/Gemini). Server-side with the developer's token → no user login. Needs a
// free Cloudflare account: dash.cloudflare.com → Account ID + an API token with the
// "Workers AI" permission. Tried after the premium engines, before keyless pollinations.
const CF_ACCOUNT_ID  = process.env.CF_ACCOUNT_ID || "";
const CF_API_TOKEN   = process.env.CF_API_TOKEN || "";
// Default = FLUX.2 Klein 9B: newest FLUX.2 family — excellent quality + the BEST free
// in-image text (legible "Firas AI") AND fast (~4s at 6 steps), far better value than
// flux-2-dev (same quality, ~80s). ~65 free imgs/day. FLUX.2 needs a multipart request
// (handled in generateImageCloudflare). Higher volume: @cf/black-forest-labs/flux-1-schnell
// (~130/day, weak text). Premium-but-pricey: @cf/leonardo/lucid-origin (~4/day).
const CF_IMAGE_MODEL = process.env.CF_IMAGE_MODEL || "@cf/black-forest-labs/flux-2-klein-9b";
const CF_IMAGE_STEPS = Math.min(20, Math.max(1, parseInt(process.env.CF_IMAGE_STEPS || "10", 10) || 10)); // flux-2 (no per-step cost) uses this; flux-schnell clamped to 8 in the request

// Tier -> Ollama model + generation params (env-overridable).
// num_predict = MAX output tokens. Generous so long outputs (a full single-file
// website, big code, long derivations) are NOT truncated mid-answer. The model
// still stops early on short replies, so this only RAISES the ceiling.
// num_predict = MAX output tokens. The Ollama CLOUD models REJECT -1
// ("max_tokens must be positive"), so we use a very large finite cap instead —
// effectively unlimited (~65k tokens) so long code / full worksheets / multi-part
// science & math answers complete instead of cutting off. The model still stops
// early on short replies; the 5-min timeout is the backstop. Mini stays bounded
// so it remains the fast/short tier.
// num_predict = MAX output tokens. Generous so that "thinking" tokens (which
// share this budget on reasoning models) do NOT starve the actual answer/code.
// gpt-oss accepts up to 131072; qwen3-coder caps at its model max (65536, which
// still allows ~5000 lines and it does not spend tokens on thinking).
const TIERS = {
  mini:  { model: process.env.OLLAMA_MODEL_MINI  || "gpt-oss:120b-cloud", temperature: 0.5, num_predict: 16384 },
  pro:   { model: process.env.OLLAMA_MODEL_PRO   || "gpt-oss:120b-cloud", temperature: 0.7, num_predict: 131072 },
  ultra: { model: process.env.OLLAMA_MODEL_ULTRA || "qwen3-coder:480b-cloud", temperature: 0.8, num_predict: 65536 },
  // Max = strongest general/reasoning model (671B), gated by a per-user daily cap.
  // Env-overridable so the model swaps without a redeploy if Ollama's cloud catalog
  // rotates. fallbackModel degrades to a known-good hosted model (gpt-oss) before the
  // last-resort pollinations fallback.
  max:   { model: process.env.OLLAMA_MODEL_MAX || "qwen3-coder:480b-cloud", temperature: 0.7, num_predict: 32768, fallbackModel: process.env.OLLAMA_MODEL_MAX_FALLBACK || "gpt-oss:120b-cloud", capped: false },
};

// Vision/multimodal model — used automatically when a request carries images.
// qwen2.5vl:7b is verified installed locally. vl models do not emit useful
// "thinking", so vision requests always run with think OFF.
const OLLAMA_MODEL_VISION = process.env.OLLAMA_MODEL_VISION || "qwen2.5vl:7b";

// Image caps: at most 6 images per request; skip any single image whose raw
// base64 exceeds ~8MB. Larger JSON body cap (~25MB) applies to /api/chat only.
const MAX_IMAGES_PER_REQUEST = 6;
const MAX_IMAGE_B64_BYTES = 8_000_000;
const CHAT_BODY_LIMIT = 25_000_000;

// Strip an optional "data:image/...;base64," prefix and return RAW base64.
// Returns null for anything that isn't a usable, in-bounds base64 string.
function normalizeImage(img) {
  try {
    if (typeof img !== "string") return null;
    let s = img.trim();
    if (!s) return null;
    const comma = s.indexOf(",");
    if (s.startsWith("data:") && comma !== -1) s = s.slice(comma + 1);
    s = s.trim();
    if (!s) return null;
    if (s.length > MAX_IMAGE_B64_BYTES) return null; // too large -> skip
    return s;
  } catch {
    return null;
  }
}

// Vision is decided by the LATEST user message ONLY. So a text follow-up after
// an image routes back to the strong text model instead of staying stuck on the
// weaker vision model (the user's text is NOT treated as an image turn).
function hasImages(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === "user") {
      return Array.isArray(m.images) && m.images.length > 0;
    }
  }
  return false;
}

// Drop image data from every message (used for the TEXT path so the text model
// never receives base64 images it cannot read).
function stripImages(messages) {
  return messages.map((m) => {
    if (m && Array.isArray(m.images)) {
      const { images, ...rest } = m;
      return rest;
    }
    return m;
  });
}

// Build an Ollama-native messages array, attaching cleaned RAW base64 images.
// Caps the total number of images across the whole request to MAX_IMAGES.
function buildVisionMessages(messages) {
  let budget = MAX_IMAGES_PER_REQUEST;
  return messages.map((m) => {
    const out = { role: m && typeof m.role === "string" ? m.role : "user", content: String((m && m.content) ?? "") };
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

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff2":"font/woff2",
  ".woff": "font/woff",
  ".map":  "application/json",
  ".txt":  "text/plain; charset=utf-8",
};

/* ===========================================================================
   DATABASE — JSON file at data/db.json with serialized writes (mutex).
   shape: { users: [], chats: [], secret: "<hex>" }
   =========================================================================== */
// DATA_DIR is env-overridable so a deploy can point it at a persistent disk
// (the bundled ./data is ephemeral on most hosts).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

let DB = { users: [], chats: [], secret: "" };

// Promise-chain mutex: every write awaits the previous one, so concurrent
// writes can never interleave and corrupt the file.
let writeChain = Promise.resolve();

/* ---------------------------------------------------------------------------
   OPTIONAL Firebase Realtime Database backend (free, no card, PERSISTENT).
   Enabled ONLY when FIREBASE_DB_URL + FIREBASE_SERVICE_ACCOUNT are set; otherwise
   the server uses the local JSON file exactly as before (no behavior change).
   Lets the app keep accounts + history on hosts with no persistent disk
   (Render free, etc.). Zero deps: signs a service-account JWT with node:crypto,
   stores the whole DB under one RTDB key. The service account has ADMIN access,
   so the database can stay in locked mode (no public access needed).
--------------------------------------------------------------------------- */
const FB_DB_URL = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");
let FB_SA = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) FB_SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("[firas] FIREBASE_SERVICE_ACCOUNT is not valid JSON:", (e && e.message) || e);
}
function fbEnabled() { return !!(FB_DB_URL && FB_SA && FB_SA.client_email && FB_SA.private_key); }
const FB_KEY = "firasdb"; // single RTDB key holding the whole DB JSON

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
let fbToken = null, fbTokenExp = 0;
async function fbAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (fbToken && now < fbTokenExp - 60) return fbToken;
  const aud = FB_SA.token_uri || "https://oauth2.googleapis.com/token";
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: FB_SA.client_email,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud, iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(header + "." + claims);
  const jwt = header + "." + claims + "." + b64url(signer.sign(FB_SA.private_key));
  const r = await fetch(aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + encodeURIComponent(jwt),
  });
  if (!r.ok) throw new Error("firebase token " + r.status + ": " + (await r.text()).slice(0, 160));
  const j = await r.json();
  fbToken = j.access_token;
  fbTokenExp = now + (j.expires_in || 3600);
  return fbToken;
}
async function fbLoad() {
  const token = await fbAccessToken();
  const r = await fetch(FB_DB_URL + "/" + FB_KEY + ".json", { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error("firebase load " + r.status);
  return await r.json(); // null when the key doesn't exist yet (fresh DB)
}
async function fbSave(db) {
  const token = await fbAccessToken();
  const r = await fetch(FB_DB_URL + "/" + FB_KEY + ".json", {
    method: "PUT",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(db),
  });
  if (!r.ok) throw new Error("firebase save " + r.status + ": " + (await r.text()).slice(0, 160));
}

// Normalize a loaded DB (RTDB may return empty arrays as null / arrays as objects).
function normalizeDb(parsed) {
  const arr = (x) => (Array.isArray(x) ? x : (x && typeof x === "object" ? Object.values(x) : []));
  return {
    users: arr(parsed && parsed.users),
    chats: arr(parsed && parsed.chats),
    // announcements MUST persist across restarts (admin posts them once for everyone);
    // pending signups are transient but harmless to carry over (a sweep drops expired ones).
    announcements: arr(parsed && parsed.announcements),
    pending: (parsed && parsed.pending && typeof parsed.pending === "object" && !Array.isArray(parsed.pending)) ? parsed.pending : {},
    secret: parsed && typeof parsed.secret === "string" ? parsed.secret : "",
  };
}

function loadDbFromFile() {
  try {
    if (existsSync(DB_PATH)) DB = normalizeDb(JSON.parse(readFileSync(DB_PATH, "utf8") || "{}"));
  } catch (e) {
    console.error("[firas] failed to load db, starting fresh:", (e && e.message) || e);
    DB = { users: [], chats: [], secret: "" };
  }
}

// Load the DB (Firebase if configured, else file), then ensure a secret exists.
async function initDb() {
  if (fbEnabled()) {
    try {
      DB = normalizeDb((await fbLoad()) || {});
      console.log("[firas] database: Firebase Realtime Database");
    } catch (e) {
      // NEVER silently fall back to the (empty) file DB here — a later persist()
      // would overwrite the real remote data. Crash so the operator fixes config.
      console.error("[firas] FATAL: Firebase is configured but unreachable at boot:", (e && e.message) || e);
      process.exit(1);
    }
  } else {
    loadDbFromFile();
    try { if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true }); }
    catch (e) { console.error("[firas] could not create data dir:", (e && e.message) || e); }
  }
  if (!DB.secret) DB.secret = crypto.randomBytes(32).toString("hex");
  await persist(); // persists the secret on first run
}

// Serialized write (mutex) → Firebase when configured, else the local file.
function persist() {
  writeChain = writeChain.then(async () => {
    try {
      if (fbEnabled()) { await fbSave(DB); return; }
      if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
      const tmp = DB_PATH + ".tmp";
      await writeFile(tmp, JSON.stringify(DB, null, 2), "utf8");
      try {
        const { rename } = await import("node:fs/promises");
        await rename(tmp, DB_PATH);
      } catch {
        await writeFile(DB_PATH, JSON.stringify(DB, null, 2), "utf8");
      }
    } catch (e) {
      console.error("[firas] db write failed:", (e && e.message) || e);
    }
  });
  return writeChain;
}

/* ===========================================================================
   AUTH — scrypt password hashing + signed HttpOnly session cookies.
   =========================================================================== */
function sessionSecret() {
  return process.env.SESSION_SECRET || DB.secret;
}

// ASYNC scrypt — never blocks the event loop (a synchronous hash on every
// login/signup would let a few requests stall the whole server = DoS).
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, dk) => {
      if (err) return reject(err);
      resolve({ salt, passHash: dk.toString("hex") });
    });
  });
}

function verifyPassword(password, salt, passHash) {
  return new Promise((resolve) => {
    crypto.scrypt(password, salt, 64, (err, dk) => {
      if (err) return resolve(false);
      try {
        const stored = Buffer.from(passHash, "hex");
        if (dk.length !== stored.length) return resolve(false);
        resolve(crypto.timingSafeEqual(dk, stored));
      } catch {
        resolve(false);
      }
    });
  });
}

function signUserId(userId) {
  const mac = crypto.createHmac("sha256", sessionSecret()).update(userId).digest("hex");
  return userId + "." + mac;
}

// Returns the userId if the cookie value is a valid, untampered signature.
function verifySessionValue(value) {
  if (typeof value !== "string") return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = crypto.createHmac("sha256", sessionSecret()).update(userId).digest("hex");
  try {
    const a = Buffer.from(mac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return userId;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

const COOKIE_NAME = "firas_session";
const COOKIE_MAX_AGE = 2_592_000; // 30 days

// Send the cookie with Secure when we're actually on HTTPS (or told to via
// SECURE_COOKIES=1). Adding Secure unconditionally would break plain-HTTP
// localhost (the browser silently drops Secure cookies over http).
function isSecureReq(req) {
  return process.env.SECURE_COOKIES === "1" || (req && req.headers["x-forwarded-proto"] === "https");
}

function setSessionCookie(res, userId, req) {
  const value = signUserId(userId);
  const secure = isSecureReq(req) ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}${secure}`
  );
}

function clearSessionCookie(res, req) {
  const secure = isSecureReq(req) ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

/* Simple in-memory rate limiter (per key, sliding window) — slows brute-force
   on auth endpoints. Good enough for a single-node deploy; resets on restart. */
const rlBuckets = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (rlBuckets.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  rlBuckets.set(key, arr);
  if (rlBuckets.size > 5000) {
    // bound memory: drop the oldest-ish entries
    for (const k of rlBuckets.keys()) { rlBuckets.delete(k); if (rlBuckets.size <= 2500) break; }
  }
  return arr.length > max;
}
function clientIp(req) {
  // Only trust X-Forwarded-For when explicitly behind a known proxy — otherwise
  // a client could spoof it to dodge the per-IP rate limiter.
  if (process.env.TRUST_PROXY === "1") {
    const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (xff) return xff;
  }
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

// Resolve the logged-in user (or null) from the request's session cookie.
function currentUser(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  const userId = verifySessionValue(raw);
  if (!userId) return null;
  return DB.users.find((u) => u.id === userId) || null;
}

// Strip secrets — NEVER return passHash / salt to the client.
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email };
}

/* ===========================================================================
   Request helpers
   =========================================================================== */
function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let data = "";
    let aborted = false;
    req.on("data", (c) => {
      data += c;
      if (data.length > limit) {
        aborted = true;
        req.destroy();
      }
    });
    req.on("end", () => (aborted ? reject(new Error("body too large")) : resolve(data)));
    req.on("error", reject);
  });
}

async function readJson(req, limit) {
  const raw = await readBody(req, limit);
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return null;
  }
}

function sendJson(res, status, obj) {
  if (res.writableEnded) return;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ===========================================================================
   FIREBASE / GOOGLE SIGN-IN — ID-token verification with ZERO npm deps.
   We verify the RS256 JWT ourselves using node:crypto + global fetch:
     1. split header.payload.signature, base64url-decode header+payload JSON
     2. fetch Google's x509 certs (kid -> PEM), cached per Cache-Control max-age
     3. pick the cert by header.kid, verify RS256 over `${header}.${payload}`
     4. validate alg/aud/iss/exp/iat/auth_time/sub/email claims
   On success we link-or-create a passwordless { provider:"google" } user and
   issue the SAME signed session cookie as email/password login.
   =========================================================================== */
// projectId is public (it ships in firebase-config.js); default to it so Google
// login works locally and on deploy without an extra env var. Override via env.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "firas-ai";
// Google's public signing certs for Firebase Auth ID tokens.
const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

// In-memory cert cache: { keys: { kid: pem, ... }, expiresAt: epochMs }.
let googleCertCache = { keys: null, expiresAt: 0 };
let googleCertInflight = null; // de-dupe concurrent refreshes

// base64url -> Buffer (tolerant of missing padding).
function b64urlToBuffer(str) {
  if (typeof str !== "string") return null;
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad === 2) s += "==";
  else if (pad === 3) s += "=";
  else if (pad === 1) return null; // invalid base64url length
  try {
    return Buffer.from(s, "base64");
  } catch {
    return null;
  }
}

// base64url JSON segment -> parsed object (or null).
function decodeJwtSegment(seg) {
  const buf = b64urlToBuffer(seg);
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

// Fetch Google's x509 certs, caching them in memory until Cache-Control max-age
// expires. Returns the kid->PEM map, or null if it can't be (re)fetched and no
// cached copy is usable. Never throws.
async function getGoogleCerts() {
  const now = Date.now();
  if (googleCertCache.keys && now < googleCertCache.expiresAt) {
    return googleCertCache.keys;
  }
  if (googleCertInflight) return googleCertInflight; // coalesce parallel refreshes

  googleCertInflight = (async () => {
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 10_000);
      let resp;
      try {
        resp = await fetch(GOOGLE_CERTS_URL, { signal: ac.signal });
      } finally {
        clearTimeout(to);
      }
      if (!resp || !resp.ok) {
        // Serve a stale-but-present cache rather than failing outright.
        return googleCertCache.keys || null;
      }
      const keys = await resp.json();
      if (!keys || typeof keys !== "object") return googleCertCache.keys || null;

      // Honor Cache-Control max-age; default to 1h if absent/unparseable.
      let maxAge = 3600;
      const cc = resp.headers.get("cache-control") || "";
      const m = cc.match(/max-age\s*=\s*(\d+)/i);
      if (m) maxAge = parseInt(m[1], 10) || 3600;

      googleCertCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
      return keys;
    } catch {
      return googleCertCache.keys || null; // network error -> stale cache if any
    } finally {
      googleCertInflight = null;
    }
  })();
  return googleCertInflight;
}

// Verify a Firebase/Google ID token. Returns the validated payload on success,
// or null on ANY failure (generic — callers must not leak the reason). Never
// throws and never hangs (cert fetch is bounded).
async function verifyFirebaseIdToken(idToken) {
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 8192) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = decodeJwtSegment(headerB64);
  const payload = decodeJwtSegment(payloadB64);
  if (!header || !payload) return null;

  // alg MUST be RS256 (never accept "none" or HS* — algorithm-confusion guard).
  if (header.alg !== "RS256" || header.typ && header.typ !== "JWT") return null;
  if (typeof header.kid !== "string" || !header.kid) return null;

  const certs = await getGoogleCerts();
  if (!certs) return null;
  const pem = certs[header.kid];
  if (typeof pem !== "string" || !pem) return null; // unknown / rotated kid

  const signature = b64urlToBuffer(signatureB64);
  if (!signature || !signature.length) return null;

  // Verify the RS256 signature over the EXACT signing input bytes.
  const signingInput = `${headerB64}.${payloadB64}`;
  let sigOk = false;
  try {
    sigOk = crypto
      .createVerify("RSA-SHA256")
      .update(signingInput)
      .verify(pem, signature);
  } catch {
    return null;
  }
  if (!sigOk) return null;

  // ---- Claim validation (all required) ----
  const now = Math.floor(Date.now() / 1000);
  const skew = 300; // tolerate 5 min of clock skew

  // aud must equal our Firebase project; iss must be the matching issuer.
  if (payload.aud !== FIREBASE_PROJECT_ID) return null;
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;

  // exp in the future; iat/auth_time not absurdly in the future.
  if (typeof payload.exp !== "number" || payload.exp <= now - skew) return null;
  if (typeof payload.iat !== "number" || payload.iat > now + skew) return null;
  if (payload.auth_time != null) {
    if (typeof payload.auth_time !== "number" || payload.auth_time > now + skew) return null;
  }

  // sub = the Firebase user id; must be a non-empty string.
  if (typeof payload.sub !== "string" || !payload.sub) return null;

  // A usable, valid email is required to link/create an account.
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 200) return null;
  // NOTE: email_verified is false for fresh Firebase email/password sign-ups, so
  // we do NOT reject on it (otherwise password sign-in would never work). For a
  // PUBLIC deployment, enable email verification in Firebase to harden this.

  return payload;
}

/* ===========================================================================
   AUTH ENDPOINTS
   =========================================================================== */
async function handleSignup(req, res) {
  if (rateLimited("auth:" + clientIp(req), 12, 60_000)) {
    return sendJson(res, 429, { error: "too many attempts, please wait a minute" });
  }
  const body = await readJson(req, 100_000);
  if (!body) return sendJson(res, 400, { error: "invalid JSON body" });

  const name = String(body.name ?? "").trim().slice(0, 80);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!name) return sendJson(res, 400, { error: "name is required" });
  if (!EMAIL_RE.test(email) || email.length > 200) return sendJson(res, 400, { error: "a valid email is required" });
  if (password.length < 8) return sendJson(res, 400, { error: "password must be at least 8 characters" });
  if (password.length > 200) return sendJson(res, 400, { error: "password is too long" });
  if (DB.users.some((u) => u.email === email)) return sendJson(res, 409, { error: "email already registered" });

  // Do NOT create the account yet — stash a PENDING signup and email a verification LINK
  // (a button). The real account is created when the link is opened (handleVerifySignup).
  // A poll-id (pid) lets the ORIGINAL device finish the moment the link is opened on ANY
  // device (open the email on your phone → your computer logs in too).
  const { salt, passHash } = await hashPassword(password);
  const token = crypto.randomBytes(24).toString("hex");
  const pid = crypto.randomBytes(16).toString("hex");
  if (!DB.pending) DB.pending = {};
  DB.pending[email] = { name, email, passHash, salt, token, pid, exp: Date.now() + VERIFY_TTL_MS, verified: false, userId: null };
  await persist();
  const link = resetAppBase(req) + "/?verify=" + token;
  const sent = await sendEmail(email, "تأكيد حسابك — Firas AI", verifyEmailHtml(link));
  if (!sent) console.log("[firas] signup verify link for " + email + " -> " + link + " (not delivered — dev fallback)");
  return sendJson(res, 200, { ok: true, pending: true, email, pid });
}

// Open the emailed LINK → create the real account (idempotent) + sign in THIS device.
async function handleVerifySignup(req, res) {
  if (rateLimited("verify:" + clientIp(req), 30, 60_000)) return sendJson(res, 429, { error: "too many attempts, please wait a minute" });
  const body = await readJson(req, 100_000);
  const token = String((body && body.token) || "").trim();
  if (!token) return sendJson(res, 400, { error: "رابط غير صالح" });
  const email = Object.keys(DB.pending || {}).find((k) => DB.pending[k].token === token);
  const p = email && DB.pending[email];
  if (!p || Date.now() > p.exp) { if (p) { delete DB.pending[email]; await persist(); } return sendJson(res, 400, { error: "الرابط غير صالح أو منتهي — أعد التسجيل" }); }
  let user;
  if (p.verified && p.userId) {
    user = DB.users.find((u) => u.id === p.userId); // idempotent re-open
  } else {
    if (DB.users.some((u) => u.email === email)) { delete DB.pending[email]; await persist(); return sendJson(res, 409, { error: "email already registered" }); }
    user = { id: crypto.randomUUID(), name: p.name, email: p.email, passHash: p.passHash, salt: p.salt, emailVerified: true, createdAt: new Date().toISOString() };
    DB.users.push(user);
    p.verified = true; p.userId = user.id; p.verifiedAt = Date.now();
    await persist();
    // personal welcome from Firas (fire-and-forget — never block sign-in on email)
    sendEmail(user.email, "Welcome to Firas AI 🎉", welcomeEmailHtml(user.name, resetAppBase(req) + "/"), { fromName: "Firas" }).catch(() => {});
  }
  if (!user) return sendJson(res, 400, { error: "تعذّر التأكيد — أعد التسجيل" });
  setSessionCookie(res, user.id, req);
  return sendJson(res, 200, { ok: true, user: publicUser(user) });
}

// The original device polls this with its pid; once the link is opened ANYWHERE it returns
// verified and signs THIS device in too (cross-device completion), then cleans up.
async function handleVerifyStatus(req, res) {
  if (rateLimited("vstatus:" + clientIp(req), 60, 60_000)) return sendJson(res, 429, { error: "too many requests" });
  const body = await readJson(req, 100_000);
  const pid = String((body && body.pid) || "").trim();
  if (!pid) return sendJson(res, 400, { error: "missing pid" });
  const email = Object.keys(DB.pending || {}).find((k) => DB.pending[k].pid === pid);
  const p = email && DB.pending[email];
  if (!p) return sendJson(res, 200, { verified: false, gone: true });
  if (Date.now() > p.exp) { delete DB.pending[email]; await persist(); return sendJson(res, 200, { verified: false, expired: true }); }
  if (p.verified && p.userId) {
    const user = DB.users.find((u) => u.id === p.userId);
    if (user) {
      setSessionCookie(res, user.id, req);
      delete DB.pending[email]; await persist();   // both devices handled → done
      return sendJson(res, 200, { verified: true, user: publicUser(user) });
    }
  }
  return sendJson(res, 200, { verified: false });
}

// Re-send a fresh verification LINK for a pending email.
async function handleResendCode(req, res) {
  if (rateLimited("resend:" + clientIp(req), 4, 60_000)) return sendJson(res, 429, { error: "too many requests, wait a minute" });
  const body = await readJson(req, 100_000);
  const email = String((body && body.email) || "").trim().toLowerCase();
  const p = DB.pending && DB.pending[email];
  if (p && !p.verified) {
    p.token = crypto.randomBytes(24).toString("hex"); p.exp = Date.now() + VERIFY_TTL_MS;
    await persist();
    const link = resetAppBase(req) + "/?verify=" + p.token;
    const sent = await sendEmail(email, "تأكيد حسابك — Firas AI", verifyEmailHtml(link));
    if (!sent) console.log("[firas] (resend) signup verify link for " + email + " -> " + link + " (not delivered — dev fallback)");
  }
  return sendJson(res, 200, { ok: true });
}

// Periodically drop expired pending signups so DB.pending can't grow unbounded when the verify
// link is opened on the SAME device (no cross-device poll ever cleans it). They're useless past
// exp anyway. unref() so this timer never keeps the process alive on shutdown.
const _pendingSweep = setInterval(async () => {
  if (!DB.pending) return;
  const now = Date.now(); let changed = false;
  for (const k of Object.keys(DB.pending)) {
    if (now > (DB.pending[k].exp || 0) + 60_000) { delete DB.pending[k]; changed = true; }
  }
  if (changed) { try { await persist(); } catch (_) {} }
}, 5 * 60_000);
if (_pendingSweep && typeof _pendingSweep.unref === "function") _pendingSweep.unref();

async function handleLogin(req, res) {
  const ip = clientIp(req);
  if (rateLimited("auth:" + ip, 12, 60_000)) {
    return sendJson(res, 429, { error: "too many attempts, please wait a minute" });
  }
  const body = await readJson(req, 100_000);
  if (!body) return sendJson(res, 400, { error: "invalid JSON body" });

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  // Extra per-account throttle to slow targeted brute-force.
  if (rateLimited("login:" + email, 6, 60_000)) {
    return sendJson(res, 429, { error: "too many attempts, please wait a minute" });
  }

  const user = DB.users.find((u) => u.email === email);
  // Generic error — never reveal which field was wrong.
  if (!user || !(await verifyPassword(password, user.salt, user.passHash))) {
    return sendJson(res, 401, { error: "invalid email or password" });
  }

  setSessionCookie(res, user.id, req);
  return sendJson(res, 200, { user: publicUser(user) });
}

function handleLogout(req, res) {
  clearSessionCookie(res, req);
  return sendJson(res, 200, { ok: true });
}

function handleMe(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  return sendJson(res, 200, { user: publicUser(user) });
}

/* ---- Password reset: email a time-limited link via Resend (zero-dep HTTP API).
   Without RESEND_API_KEY the link is logged to the server console (dev). ---- */
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM    = process.env.RESEND_FROM || "Firas AI <onboarding@resend.dev>";
// Brevo (primary): single-sender verification reaches ALL members for free, no domain needed.
const BREVO_API_KEY   = process.env.BREVO_API_KEY || "";
const BREVO_FROM      = process.env.BREVO_FROM || "firasnozad@gmail.com"; // your VERIFIED single sender
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || "Firas AI";
const RESET_APP_URL  = (process.env.APP_URL || "").replace(/\/+$/, "");
const RESET_TTL_MS   = 30 * 60_000;
const VERIFY_TTL_MS  = 15 * 60_000; // signup email-verification code lifetime
function fmtNow(loc) {
  try { return new Date().toLocaleString(loc || "ar", { dateStyle: "long", timeStyle: "short" }); }
  catch (_) { return new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC"; }
}
// DARK, bold, professional, email-client-safe template (table layout + inline styles + RTL).
// Logo is rendered in-email (CSS) so it shows in ALL clients incl. Gmail — external image
// files are blocked by most clients until the site is on a real domain.
// Isolate a Latin/brand run inside RTL Arabic so the sentence doesn't scramble.
function ltr(s) { return '<span dir="ltr" style="unicode-bidi:isolate;">' + s + '</span>'; }
function bidiAuto(s) { return '<span dir="auto" style="unicode-bidi:isolate;">' + s + '</span>'; }
const EMAIL_FONT = "'IBM Plex Sans Arabic','Inter','Segoe UI',Tahoma,Arial,sans-serif";
function mailButton(link, label) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:16px auto 2px;"><tr>' +
    '<td style="border-radius:12px;background:#57AE9C;box-shadow:0 10px 26px rgba(87,174,156,0.34);" bgcolor="#57AE9C"><a href="' + link + '" style="display:inline-block;padding:15px 42px;font-family:' + EMAIL_FONT + ';font-size:16px;font-weight:700;color:#10221D;text-decoration:none;border-radius:12px;letter-spacing:.2px;">' + label + '</a></td>' +
    '</tr></table>';
}
function mailLink(link) {
  return '<p style="margin:20px 0 0;font-size:12.5px;color:#9C9A91;" dir="rtl">أو افتح هذا الرابط:<br><span dir="ltr" style="unicode-bidi:isolate;word-break:break-all;"><a href="' + link + '" style="color:#6BC0AE;">' + link + '</a></span></p>';
}
function brandedEmail(o) {
  // Matches the SITE's dark theme + the SITE's fonts (IBM Plex Sans Arabic / Inter, with system
  // fallbacks for clients that block web fonts). Text is bright + bold for clarity. Glow sits in
  // the TOP-RIGHT and BOTTOM-LEFT corners (page radial gradients + diagonal card box-shadows).
  const bg = "#262624", card = "#30302E", border = "#46453F", hair = "#3A3A36",
        ink = "#F6F4ED", body = "#DBD8CF", muted = "#C2BFB6", soft = "#8C8A81", accent = "#57AE9C", accent2 = "#6BC0AE", onacc = "#10221D";
  const font = EMAIL_FONT;
  const isEn = o.lang === "en";
  const cdir = isEn ? "ltr" : "rtl", calign = isEn ? "left" : "right";
  const time = o.time || fmtNow(isEn ? "en" : "ar");
  const sentLabel = isEn ? "Sent: " : "أُرسلت في: ";
  const tagline = isEn ? "Your intelligent assistant · Automated message, no need to reply." : "مساعدك الذكي · رسالة آلية، لا داعي للرد عليها.";
  const pageBg = "background:radial-gradient(60% 50% at 100% 0%,rgba(87,174,156,0.22),transparent 70%),radial-gradient(60% 50% at 0% 100%,rgba(87,174,156,0.17),transparent 70%)," + bg + ";";
  const cardGlow = "box-shadow:0 0 0 1px rgba(87,174,156,0.12),28px -28px 100px -16px rgba(87,174,156,0.24),-28px 28px 100px -16px rgba(87,174,156,0.20),0 28px 64px rgba(0,0,0,0.55);";
  return '<!doctype html><html dir="' + cdir + '" lang="' + (isEn ? "en" : "ar") + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">' +
    '<style>body,table,td,h1,p,a,span{font-family:' + font + ' !important;}</style></head>' +
    '<body bgcolor="' + bg + '" style="margin:0;padding:0;background:' + bg + ';' + pageBg + 'font-family:' + font + ';">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + bg + ';">' + (o.preheader || "") + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' + bg + '" style="' + pageBg + 'padding:42px 14px;"><tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="' + card + '" style="max-width:600px;width:100%;background:' + card + ';border:1px solid ' + border + ';border-radius:18px;overflow:hidden;' + cardGlow + '">' +
    '<tr><td style="height:3px;background:linear-gradient(90deg,' + accent + ',' + accent2 + ');font-size:0;line-height:0;" bgcolor="' + accent + '">&nbsp;</td></tr>' +
    '<tr><td style="padding:30px 34px 10px;"><table role="presentation" cellpadding="0" cellspacing="0" dir="ltr"><tr>' +
      '<td style="width:48px;height:48px;border-radius:14px;background:' + accent + ';text-align:center;font-family:' + font + ';font-size:25px;font-weight:800;line-height:48px;color:' + onacc + ';" bgcolor="' + accent + '">F</td>' +
      '<td style="padding-left:13px;font-family:' + font + ';font-size:21px;font-weight:700;line-height:1;letter-spacing:.3px;color:' + ink + ';" dir="ltr">Firas<span style="color:' + accent + ';"> AI</span></td>' +
    '</tr></table></td></tr>' +
    '<tr><td dir="' + cdir + '" style="padding:18px 34px 6px;font-family:' + font + ';color:' + ink + ';text-align:' + calign + ';">' +
      '<h1 style="margin:0 0 10px;font-size:23px;font-weight:700;color:' + ink + ';line-height:1.5;">' + o.heading + '</h1>' +
      '<div style="width:40px;height:3px;border-radius:3px;background:' + accent + ';margin:0 0 18px;"></div>' +
      '<p style="margin:0 0 18px;font-size:15.5px;line-height:1.95;color:' + muted + ';">' + o.lead + '</p>' +
      o.contentHtml +
      (o.note ? '<p style="margin:24px 0 0;font-size:13px;line-height:1.8;color:' + soft + ';">' + o.note + '</p>' : '') +
    '</td></tr>' +
    '<tr><td dir="' + cdir + '" style="padding:18px 34px 2px;font-family:' + font + ';font-size:12px;color:' + soft + ';text-align:' + calign + ';">' + sentLabel + time + '</td></tr>' +
    '<tr><td style="padding:18px 34px 0;"><div style="border-top:1px solid ' + hair + ';"></div></td></tr>' +
    '<tr><td style="padding:18px 34px 30px;font-family:' + font + ';text-align:center;">' +
      '<p style="margin:0 0 5px;font-family:' + font + ';font-size:13px;font-weight:700;letter-spacing:2px;color:' + accent + ';" dir="ltr">FIRAS AI</p>' +
      '<p style="margin:0;font-size:12px;color:' + soft + ';" dir="' + cdir + '">' + tagline + '</p>' +
    '</td></tr></table>' +
    '<p style="margin:18px 0 0;font-family:' + font + ';font-size:11px;color:#6b695f;" dir="ltr">© Firas AI</p>' +
    '</td></tr></table></body></html>';
}
function verifyEmailHtml(link) {
  return brandedEmail({
    preheader: "أكمل إنشاء حسابك في Firas AI",
    heading: "تأكيد بريدك الإلكتروني",
    lead: "أهلاً بك في " + ltr("Firas AI") + " — اضغط الزر لتأكيد بريدك وتفعيل حسابك، وتدخل مباشرةً.",
    contentHtml: mailButton(link, "تأكيد الحساب وبدء الاستخدام") + mailLink(link),
    note: "الرابط صالح لمدة 15 دقيقة. إذا لم تطلب إنشاء حساب، تجاهل هذه الرسالة.",
  });
}
function sha256hex(s) { return crypto.createHash("sha256").update(String(s)).digest("hex"); }
function escEmail(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
// Personal welcome from the developer (Firas), sent once the account is verified & created.
function welcomeEmailHtml(name, link) {
  const safe = escEmail(String(name || "").trim());
  const first = safe ? safe.split(/\s+/)[0] : "";
  const p = (t) => '<p style="margin:0 0 15px;font-size:15.5px;line-height:2;color:#DBD8CF;">' + t + '</p>';
  const brand = '<b style="color:#6BC0AE;font-weight:700;">Firas AI</b>';
  const content =
    p("I'm Firas, founder and developer of " + brand + ". I wanted to personally reach out and thank you for signing up and joining our community. We're truly delighted to have you on board!") +
    p("We built " + brand + " with the goal of providing the best possible experience — to help you achieve your tasks intelligently and efficiently, and explore the world of AI.") +
    p("As a new member, you can immediately start exploring the features we've developed specifically for you. We are constantly working to improve and develop the platform.") +
    p("Once again, thank you for your trust in us. We hope you have a fantastic and productive experience!") +
    mailButton(link, "Start exploring Firas AI") +
    '<p style="margin:28px 0 0;font-size:14.5px;line-height:1.85;color:#C2BFB6;">Best regards,<br><b style="color:#F6F4ED;font-weight:700;">Firas</b><br>Founder &amp; Developer, Firas AI</p>';
  return brandedEmail({
    lang: "en",
    preheader: "Welcome to Firas AI — a note from Firas",
    heading: "Welcome to Firas AI 👋",
    lead: "Hi " + (first || "there") + ",",
    contentHtml: content,
  });
}
async function sendViaBrevo(to, subject, html, fromName) {
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "api-key": BREVO_API_KEY },
      body: JSON.stringify({ sender: { name: fromName || BREVO_FROM_NAME, email: BREVO_FROM }, to: [{ email: to }], subject, htmlContent: html }),
    });
    if (!r.ok) { const e = await r.text().catch(() => ""); console.error("[firas] Brevo send failed " + r.status + " -> " + e.slice(0, 200)); return false; }
    return true;
  } catch (e) { console.error("[firas] Brevo send error: " + ((e && e.message) || e)); return false; }
}
async function sendViaResend(to, subject, html, fromName) {
  if (!RESEND_API_KEY) return false;
  const addr = (RESEND_FROM.match(/<([^>]+)>/) || [])[1] || "onboarding@resend.dev";
  const from = fromName ? (fromName + " <" + addr + ">") : RESEND_FROM;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + RESEND_API_KEY },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!r.ok) { const e = await r.text().catch(() => ""); console.error("[firas] Resend send failed " + r.status + " -> " + e.slice(0, 200)); return false; }
    return true;
  } catch (e) { console.error("[firas] Resend send error: " + ((e && e.message) || e)); return false; }
}
// Brevo first (free, reaches everyone via single-sender), then Resend as fallback.
// opts.fromName overrides the sender display name (e.g. "Firas" for the welcome email).
async function sendEmail(to, subject, html, opts) {
  const fromName = opts && opts.fromName;
  if (BREVO_API_KEY) { if (await sendViaBrevo(to, subject, html, fromName)) return true; }
  if (RESEND_API_KEY) { if (await sendViaResend(to, subject, html, fromName)) return true; }
  return false;
}
function resetAppBase(req) {
  if (RESET_APP_URL) return RESET_APP_URL;
  const o = req.headers.origin; if (o) return String(o).replace(/\/+$/, "");
  return "http://" + (req.headers.host || ("localhost:" + PORT));
}
function resetEmailHtml(link) {
  return brandedEmail({
    preheader: "رابط إعادة تعيين كلمة المرور — Firas AI",
    heading: "إعادة تعيين كلمة المرور",
    lead: "طلبت إعادة تعيين كلمة مرورك. اضغط الزر للمتابعة:",
    contentHtml: mailButton(link, "تعيين كلمة مرور جديدة") + mailLink(link),
    note: "الرابط صالح لمدة 30 دقيقة. إذا لم تطلب هذا، تجاهل الرسالة وكلمة مرورك تبقى كما هي.",
  });
}
async function handleForgot(req, res) {
  if (rateLimited("forgot:" + (clientIp(req) || "?"), 6, 60_000)) return sendJson(res, 429, { error: "too many requests" });
  const body = await readJson(req, 100_000);
  const email = String((body && body.email) || "").trim().toLowerCase();
  if (EMAIL_RE.test(email)) {
    const user = DB.users.find((u) => u.email === email && u.passHash); // password accounts only
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.reset = { hash: sha256hex(token), exp: Date.now() + RESET_TTL_MS };
      await persist();
      const link = resetAppBase(req) + "/?reset=" + token + "&uid=" + encodeURIComponent(user.id);
      const sent = await sendEmail(user.email, "إعادة تعيين كلمة المرور — Firas AI", resetEmailHtml(link));
      if (!sent) console.log("[firas] password-reset (not delivered — dev fallback) for " + user.email + " -> " + link);
    }
  }
  return sendJson(res, 200, { ok: true }); // anti-enumeration: ALWAYS ok
}
async function handleReset(req, res) {
  if (rateLimited("reset:" + (clientIp(req) || "?"), 10, 60_000)) return sendJson(res, 429, { error: "too many requests" });
  const body = await readJson(req, 100_000);
  const uid = String((body && body.uid) || "");
  const token = String((body && body.token) || "");
  const password = String((body && body.password) || "");
  if (password.length < 8) return sendJson(res, 400, { error: "password must be at least 8 characters" });
  if (password.length > 200) return sendJson(res, 400, { error: "password is too long" });
  const user = DB.users.find((u) => u.id === uid);
  if (!user || !user.reset || !user.reset.hash || Date.now() > user.reset.exp || sha256hex(token) !== user.reset.hash) {
    return sendJson(res, 400, { error: "invalid or expired link" });
  }
  const { salt, passHash } = await hashPassword(password);
  user.salt = salt; user.passHash = passHash;
  delete user.reset;
  await persist();
  setSessionCookie(res, user.id, req); // sign them in after a successful reset
  return sendJson(res, 200, { ok: true, user: publicUser(user) });
}

/* ---- Account management (require an authenticated session) ---- */
async function handleChangePassword(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  if (rateLimited("acct:" + user.id, 10, 60_000)) return sendJson(res, 429, { error: "too many requests" });
  const body = await readJson(req, 100_000);
  const current = String((body && body.current) || "");
  const next = String((body && body.password) || "");
  if (!user.passHash) return sendJson(res, 400, { error: "هذا الحساب يسجّل عبر Google ولا يملك كلمة مرور" });
  if (next.length < 8) return sendJson(res, 400, { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
  if (next.length > 200) return sendJson(res, 400, { error: "كلمة المرور طويلة جداً" });
  if (!(await verifyPassword(current, user.salt, user.passHash))) return sendJson(res, 403, { error: "كلمة المرور الحالية غير صحيحة" });
  const { salt, passHash } = await hashPassword(next);
  user.salt = salt; user.passHash = passHash;
  await persist();
  return sendJson(res, 200, { ok: true });
}
async function handleChangeEmail(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  if (rateLimited("acct:" + user.id, 10, 60_000)) return sendJson(res, 429, { error: "too many requests" });
  const body = await readJson(req, 100_000);
  const current = String((body && body.current) || "");
  const email = String((body && body.email) || "").trim().toLowerCase();
  if (!user.passHash) return sendJson(res, 400, { error: "هذا الحساب يسجّل عبر Google" });
  if (!EMAIL_RE.test(email) || email.length > 200) return sendJson(res, 400, { error: "أدخل بريداً صالحاً" });
  if (!(await verifyPassword(current, user.salt, user.passHash))) return sendJson(res, 403, { error: "كلمة المرور غير صحيحة" });
  if (email === user.email) return sendJson(res, 400, { error: "هذا هو بريدك الحالي" });
  if (DB.users.some((u) => u.email === email)) return sendJson(res, 409, { error: "هذا البريد مستخدم بالفعل" });
  user.email = email;
  await persist();
  return sendJson(res, 200, { ok: true, user: publicUser(user) });
}
async function handleDeleteAccount(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  if (rateLimited("acct:" + user.id, 10, 60_000)) return sendJson(res, 429, { error: "too many requests" });
  const body = await readJson(req, 100_000);
  const current = String((body && body.current) || "");
  if (user.passHash && !(await verifyPassword(current, user.salt, user.passHash))) {
    return sendJson(res, 403, { error: "كلمة المرور غير صحيحة" });
  }
  DB.chats = (DB.chats || []).filter((c) => c.userId !== user.id);
  DB.users = DB.users.filter((u) => u.id !== user.id);
  await persist();
  clearSessionCookie(res, req);
  return sendJson(res, 200, { ok: true });
}

// POST /api/auth/firebase — verify a Google/Firebase ID token and log in,
// issuing the SAME signed session cookie as email/password login.
async function handleFirebaseAuth(req, res) {
  // Same per-IP throttle as the other auth endpoints.
  if (rateLimited("auth:" + clientIp(req), 12, 60_000)) {
    return sendJson(res, 429, { error: "too many attempts, please wait a minute" });
  }
  // Social sign-in must be explicitly configured.
  if (!FIREBASE_PROJECT_ID) {
    return sendJson(res, 501, { error: "social sign-in not configured" });
  }

  const body = await readJson(req, 100_000);
  if (!body) return sendJson(res, 400, { error: "invalid JSON body" });

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  // Verify never throws/hangs; any failure -> generic 401.
  let payload = null;
  try {
    payload = await verifyFirebaseIdToken(idToken);
  } catch {
    payload = null;
  }
  if (!payload) return sendJson(res, 401, { error: "invalid token" });

  const email = String(payload.email).trim().toLowerCase();
  const name =
    (typeof payload.name === "string" && payload.name.trim() && payload.name.trim().slice(0, 80)) ||
    (typeof body.name === "string" && body.name.trim() && body.name.trim().slice(0, 80)) ||
    email.split("@")[0];

  // Link to an existing account by email, or create a Firebase-backed one.
  let user = DB.users.find((u) => u.email === email);
  if (user) {
    // ACCOUNT-TAKEOVER GUARD: Firebase email/password tokens carry
    // email_verified=false, so anyone could mint a token for a victim's email.
    // Only auto-link into an EXISTING account when the email is actually
    // verified (Google sign-in) OR the existing account is itself a social
    // account. Never let an unverified token take over a local PASSWORD account.
    const verified = payload.email_verified === true;
    const existingIsLocal = !!user.passHash; // password account
    if (existingIsLocal && !verified) {
      return sendJson(res, 409, {
        error: "An account with this email already exists. Please sign in with your password, or verify your email first.",
      });
    }
  } else {
    user = {
      id: crypto.randomUUID(),
      name,
      email,
      provider: "firebase", // social/Firebase account; NO passHash / salt fields
      createdAt: new Date().toISOString(),
    };
    DB.users.push(user);
    await persist();
  }

  setSessionCookie(res, user.id, req);
  return sendJson(res, 200, { user: publicUser(user) });
}

/* ===========================================================================
   CHAT HISTORY ENDPOINTS (per user)
   =========================================================================== */
function userChats(userId) {
  return DB.chats.filter((c) => c.userId === userId);
}

// Validate/cap messages stored in the DB so a client can't bloat db.json or
// inject odd shapes. Keeps only known fields, bounds counts and lengths.
const MAX_MESSAGES = 1000;
const MAX_CONTENT = 100_000;
const MAX_CHATS_PER_USER = 1000;
function sanitizeMessages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_MESSAGES).map((m) => {
    const o = {
      role: m && typeof m.role === "string" ? m.role.slice(0, 20) : "user",
      content: m && typeof m.content === "string" ? m.content.slice(0, MAX_CONTENT) : "",
    };
    if (m && typeof m.tier === "string") o.tier = m.tier.slice(0, 20);
    if (m && typeof m.lang === "string") o.lang = m.lang.slice(0, 5);
    if (m && typeof m.reasoning === "string") o.reasoning = m.reasoning.slice(0, MAX_CONTENT);
    // Keep small image thumbnails so attached images still show after reload
    // (bounded: up to 6 thumbs, each capped — full images are never persisted).
    if (m && Array.isArray(m.imageThumbs) && m.imageThumbs.length) {
      o.imageThumbs = m.imageThumbs
        .slice(0, 6)
        .filter((t) => typeof t === "string" && t.length <= 300_000);
    }
    return o;
  });
}

async function handleListChats(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  const list = userChats(user.id)
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, pinned: !!c.pinned }));
  return sendJson(res, 200, list);
}

async function handleGetChat(req, res, id) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  const chat = DB.chats.find((c) => c.id === id && c.userId === user.id);
  if (!chat) return sendJson(res, 404, { error: "not found" });
  return sendJson(res, 200, { id: chat.id, title: chat.title, messages: chat.messages || [] });
}

async function handleCreateChat(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  const body = await readJson(req, 2_000_000);
  if (!body) return sendJson(res, 400, { error: "invalid JSON body" });

  if (userChats(user.id).length >= MAX_CHATS_PER_USER) {
    return sendJson(res, 409, { error: "chat limit reached; delete some conversations" });
  }

  const now = new Date().toISOString();
  const chat = {
    id: crypto.randomUUID(),
    userId: user.id,
    title: String(body.title ?? "New chat").slice(0, 200) || "New chat",
    messages: sanitizeMessages(body.messages),
    pinned: !!body.pinned,
    createdAt: now,
    updatedAt: now,
  };
  DB.chats.push(chat);
  await persist();
  return sendJson(res, 201, {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  });
}

async function handleUpdateChat(req, res, id) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  const body = await readJson(req, 2_000_000);
  if (!body) return sendJson(res, 400, { error: "invalid JSON body" });

  const chat = DB.chats.find((c) => c.id === id && c.userId === user.id);
  if (!chat) return sendJson(res, 404, { error: "not found" });

  let touched = false;
  if (typeof body.title === "string") { chat.title = body.title.slice(0, 200); touched = true; }
  if (Array.isArray(body.messages)) { chat.messages = sanitizeMessages(body.messages); touched = true; }
  if (typeof body.pinned === "boolean") chat.pinned = body.pinned; // pin toggle alone must NOT bump updatedAt (would reorder)
  if (touched) chat.updatedAt = new Date().toISOString();
  await persist();
  return sendJson(res, 200, { ok: true });
}

async function handleDeleteChat(req, res, id) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  const idx = DB.chats.findIndex((c) => c.id === id && c.userId === user.id);
  if (idx === -1) return sendJson(res, 404, { error: "not found" });
  DB.chats.splice(idx, 1);
  await persist();
  return sendJson(res, 200, { ok: true });
}

/* ===========================================================================
   AI STREAM — POST /api/chat (auth required)
   Ollama native NDJSON -> frontend SSE transform, with pollinations fallback.
   =========================================================================== */
function sseInit(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
}

function sseWrite(res, content, reasoning) {
  if (res.writableEnded) return;
  const delta = {};
  if (content) delta.content = content;
  if (reasoning) delta.reasoning = reasoning;
  if (!("content" in delta) && !("reasoning" in delta)) return;
  res.write(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
}

function sseDone(res) {
  if (res.writableEnded) return;
  res.write("data: [DONE]\n\n");
  res.end();
}

// Call Ollama native /api/chat, transform NDJSON -> SSE. `think` toggles
// reasoning; when false we additionally DROP any thinking tokens so the toggle
// reliably hides thinking even for models that always reason.
// Returns true on success, false if Ollama was unreachable (-> caller falls back).
async function streamOllama(res, messages, tier, think, signal, modelOverride) {
  const t = TIERS[tier];
  const model = modelOverride || t.model;
  // Stronger thinking: gpt-oss accepts a reasoning LEVEL — use "high" when the
  // user has thinking on. Other models just take a boolean.
  const thinkVal = think ? (/gpt-oss/i.test(model) ? "high" : true) : false;
  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    think: thinkVal,
    options: { temperature: t.temperature, num_predict: t.num_predict },
  });

  // Retry a transient failure ONCE before any bytes are streamed.
  let upstream = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      upstream = await fetch(OLLAMA_CHAT_URL, {
        method: "POST",
        headers: ollamaHeaders(),
        body,
        signal,
      });
      if (upstream.ok && upstream.body) break;
      lastErr = new Error("ollama " + upstream.status);
      upstream = null;
      // a non-OK HTTP status from Ollama itself is not a "connect" failure;
      // retry once then give up (do NOT fall back to pollinations on a real
      // model error vs. connection error — but to keep the app working we let
      // the caller decide; here we signal unreachable only on fetch throw).
    } catch (e) {
      if (signal.aborted) return true; // client gone; nothing to do
      lastErr = e;
      upstream = null;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
  }

  if (!upstream) {
    // Could not reach Ollama at all -> let caller fall back.
    console.error("[firas] ollama unreachable:", (lastErr && lastErr.message) || lastErr);
    return false;
  }

  // Transform NDJSON stream line-by-line (buffer across chunks).
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for await (const chunk of upstream.body) {
      if (res.writableEnded) break;
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let obj;
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }
        const msg = obj.message || {};
        const content = msg.content || "";
        // Drop thinking entirely when think is off.
        const reasoning = think ? msg.thinking || "" : "";
        if (content || reasoning) sseWrite(res, content, reasoning);
        if (obj.done) {
          sseDone(res);
          return true;
        }
      }
    }
    // flush any trailing buffered line
    const tail = buffer.trim();
    if (tail) {
      try {
        const obj = JSON.parse(tail);
        const msg = obj.message || {};
        const reasoning = think ? msg.thinking || "" : "";
        if (msg.content || reasoning) sseWrite(res, msg.content || "", reasoning);
      } catch { /* ignore */ }
    }
    sseDone(res);
    return true;
  } catch (e) {
    if (signal.aborted) return true;
    // Stream broke mid-flight — we've already sent headers, so we can't cleanly
    // fall back; close out gracefully.
    console.error("[firas] ollama stream error:", (e && e.message) || e);
    sseDone(res);
    return true;
  }
}

// Fallback: free keyless pollinations (OpenAI-style SSE we can re-emit).
// The free fallback engine appends an ad / reveals its own brand. Strip it so
// the underlying engine is NEVER exposed to the user (only "Firas AI" shows).
function stripEngineAd(text) {
  if (!text) return text;
  let t = text;
  const cut = t.search(/\n*\s*(?:[-—*_]{2,}\s*)?\**\s*(?:support\s+|powered\s+by\s+)*pollinations|support our mission|🌸|free text api/i);
  if (cut !== -1) t = t.slice(0, cut);
  t = t.replace(/^.*pollinations.*$/gim, "");          // drop any stray brand line
  t = t.replace(/^\s*\**\s*ad\s*\**\s*$/gim, "");       // drop a lone "Ad" marker line
  return t.replace(/\s+$/, "");
}

// One-shot, non-streaming translation (keyless pollinations OpenAI-compat). Used for the
// AR/EN toggle on announcements. Falls back to the original text on any failure.
const TRANSLATE_TIMEOUT_MS = 22_000;
// Gemini first (reliable + fast), then keyless pollinations. Each call has a hard timeout so the
// UI never hangs on a stalled engine. Returns "" on total failure (caller falls back to original).
async function translateFetch(messages) {
  const tryOne = async (url, body, headers) => {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), TRANSLATE_TIMEOUT_MS);
    try {
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ac.signal });
      if (!r.ok) return "";
      const j = await r.json();
      return stripEngineAd(String((j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ""));
    } catch (_) { return ""; } finally { clearTimeout(to); }
  };
  if (GEMINI_API_KEY) {
    const g = await tryOne(GEMINI_OAI_URL, { model: GEMINI_TEXT_MODELS[0] || "gemini-2.5-flash", messages, temperature: 0.2 },
      { "Content-Type": "application/json", "Authorization": "Bearer " + GEMINI_API_KEY });
    if (g) return g;
  }
  return await tryOne(FALLBACK_URL, { model: "openai-fast", messages, stream: false, temperature: 0.2 }, { "Content-Type": "application/json" });
}
async function translateText(text, toLangName) {
  const sys = "You are a professional translator. Translate the user's text into " + toLangName +
    ". Output ONLY the translation — preserve line breaks, formatting and emoji, keep brand/product names as-is. No notes, no quotes.";
  return (await translateFetch([{ role: "system", content: sys }, { role: "user", content: text }])).trim();
}
// Translate a title + body together in ONE upstream call (avoids concurrent-call failures and
// is faster), parsing them back out via sentinel markers.
async function translatePair(title, bodyText, toLangName) {
  const sys = "You are a professional translator. Translate the update below into " + toLangName +
    ". Keep brand/product names as-is, preserve line breaks and emoji. Respond in EXACTLY this format and nothing else:\n<<<TITLE>>>\n{translated title}\n<<<BODY>>>\n{translated body}";
  const usr = "<<<TITLE>>>\n" + (title || "") + "\n<<<BODY>>>\n" + (bodyText || "");
  const out = await translateFetch([{ role: "system", content: sys }, { role: "user", content: usr }]);
  const tm = out.indexOf("<<<TITLE>>>"), bm = out.indexOf("<<<BODY>>>");
  if (tm !== -1 && bm !== -1 && bm > tm) return { title: out.slice(tm + 11, bm).trim(), body: out.slice(bm + 10).trim() };
  return { title, body: out.trim() || bodyText };
}
async function handleTranslate(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "not authenticated" });
  if (rateLimited("translate:" + user.id, 40, 60_000)) return sendJson(res, 429, { error: "too many requests" });
  const body = await readJson(req, 200_000);
  const to = String((body && body.to) || "").toLowerCase() === "en" ? "English" : "Arabic";
  if (body && (typeof body.title === "string" || typeof body.body === "string")) {
    const title = String(body.title || "").slice(0, 400);
    const btext = String(body.body || "").slice(0, 8000);
    if (!title.trim() && !btext.trim()) return sendJson(res, 200, { title: "", body: "" });
    try { return sendJson(res, 200, await translatePair(title, btext, to)); }
    catch (_) { return sendJson(res, 200, { title, body: btext }); }
  }
  const text = String((body && body.text) || "").slice(0, 8000);
  if (!text.trim()) return sendJson(res, 200, { text: "" });
  try { const out = await translateText(text, to); return sendJson(res, 200, { text: out || text }); }
  catch (_) { return sendJson(res, 200, { text }); }
}

/* ---------------------------------------------------------------------------
   Web search — keyless, server-side DuckDuckGo proxy. Returns up to 6 results
   as { title, url, snippet }. Done server-side to dodge browser CORS/Turnstile.
--------------------------------------------------------------------------- */
const SEARCH_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
function decodeEntities(s) {
  return String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
function stripTags(s) { return decodeEntities(String(s).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(); }
function decodeDdgUrl(href) {
  try {
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
    return href.startsWith("//") ? "https:" + href : href;
  } catch { return href; }
}
function parseDuckDuckGo(html) {
  const out = [];
  // Parse each result CONTAINER as a unit and pull its title/url + snippet from
  // WITHIN that block, so a missing/extra snippet can never shift snippets onto
  // the wrong title (the old parallel-index zip had that bug).
  const titleRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = titleRe.exec(html)) && out.length < 8) {
    const url = decodeDdgUrl(m[1]);
    const title = stripTags(m[2]);
    if (!title || !/^https?:\/\//i.test(url)) continue;
    // Look for a snippet in the slice that follows this title, but stop before
    // the next result's title so we never borrow a later block's snippet.
    const after = html.slice(titleRe.lastIndex, titleRe.lastIndex + 1500);
    const nextTitle = after.search(/<a[^>]+class="[^"]*result__a/i);
    const window = nextTitle >= 0 ? after.slice(0, nextTitle) : after;
    const sm = window.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    out.push({ title, url, snippet: sm ? stripTags(sm[1]) : "" });
  }
  return out;
}
/* Image generation — keyless, server-side pollinations proxy (avoids browser
   CORS/Turnstile). Returns the generated image bytes. */
// Per-user daily image-creation cap. Configurable via env; defaults to 5/day.
const IMAGE_DAILY_LIMIT = Math.max(1, parseInt(process.env.IMAGE_DAILY_LIMIT, 10) || 5);

// Local calendar day as YYYY-MM-DD, so the quota resets at local midnight.
function serverDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Reset the per-day creation set when the local day rolls over.
function imgRollDay(user) {
  const today = serverDay();
  if (user.imgDay !== today) { user.imgDay = today; user.imgCids = []; return true; }
  if (!Array.isArray(user.imgCids)) { user.imgCids = []; return true; }
  return false;
}

// Per-user daily cap for the Max tier (strongest model). Configurable via env.
const MAX_DAILY_LIMIT = Math.max(1, parseInt(process.env.MAX_DAILY_LIMIT, 10) || 10);
// Reset the per-day Max-request set when the local day rolls over.
function maxRollDay(user) {
  const today = serverDay();
  if (user.maxDay !== today) { user.maxDay = today; user.maxCids = []; return true; }
  if (!Array.isArray(user.maxCids)) { user.maxCids = []; return true; }
  return false;
}
/* Max is FREE & UNLIMITED for everyone now — always report capacity available. */
async function handleMaxQuota(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { ok: false, error: "auth required" });
  return sendJson(res, 200, { ok: true, limit: 0, used: 0, remaining: -1 });
}

/* PRE-CHECK only (read-only): tells the client whether the user can still create
   an image today. The slot is NOT charged here — it's charged in handleImage
   only when real bytes come back (so failed generations never cost a credit, and
   reloads of an existing image never re-count). */
async function handleImageQuota(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { ok: false, error: "auth required" });
  if (imgRollDay(user)) await persist();
  const used = user.imgCids.length;
  if (used >= IMAGE_DAILY_LIMIT) {
    return sendJson(res, 429, { ok: false, limit: IMAGE_DAILY_LIMIT, used, remaining: 0 });
  }
  return sendJson(res, 200, { ok: true, limit: IMAGE_DAILY_LIMIT, used, remaining: IMAGE_DAILY_LIMIT - used });
}

// Generate an image with Gemini (Google AI Studio). Returns {buf, mime} or null to
// fall back to pollinations. Free key, ~500 images/day, no card.
// --- Generated-image disk cache (DATA_DIR/imgcache) -------------------------
// Reloads of a saved image (same prompt+size+seed+engine) are served from disk so
// they're instant, don't re-spend Puter credits, and never silently change the
// picture. Keyed by the ENGINE config too, so switching models yields fresh images.
const IMG_CACHE_DIR = path.join(DATA_DIR, "imgcache");
function imgEngineTag() {
  if (!PUTER_AUTH_TOKEN) return "pollinations";
  const m = PUTER_MODEL_ALIASES[PUTER_IMAGE_MODEL] || PUTER_IMAGE_MODEL;
  return m + (/gpt-image-(2|1\.5)/i.test(m) ? ":" + PUTER_IMAGE_QUALITY : "");
}
function imgCacheKey(prompt, w, h, seed) {
  return crypto.createHash("sha1").update(imgEngineTag() + "|" + prompt + "|" + w + "x" + h + "|" + (seed || "")).digest("hex");
}
function imgCacheGet(key) {
  try {
    const f = path.join(IMG_CACHE_DIR, key), m = path.join(IMG_CACHE_DIR, key + ".t");
    if (existsSync(f) && existsSync(m)) {
      const buf = readFileSync(f);
      if (buf && buf.length) return { buf, mime: (readFileSync(m, "utf8").trim() || "image/png") };
    }
  } catch (_) {}
  return null;
}
async function imgCacheSet(key, buf, mime) {
  try {
    if (!buf || !buf.length || buf.length > 6_000_000) return; // skip empty/oversized
    if (!existsSync(IMG_CACHE_DIR)) await mkdir(IMG_CACHE_DIR, { recursive: true });
    await writeFile(path.join(IMG_CACHE_DIR, key), buf);
    await writeFile(path.join(IMG_CACHE_DIR, key + ".t"), mime || "image/png");
  } catch (_) {}
}

// Generate an image via Puter's driver API using the DEVELOPER's auth token (server-
// side → end users never sign in to Puter). Real GPT-Image / Gemini quality, free.
// Returns {buf, mime} or null on any failure (so the chain degrades to the next engine).
let _puterCooldownUntil = 0; // set when Puter is out of credits → skip it briefly so
                             // every image isn't slowed by a doomed 402 round-trip.
async function generateImagePuter(prompt) {
  if (!PUTER_AUTH_TOKEN) return null;
  if (Date.now() < _puterCooldownUntil) return null;
  const model = PUTER_MODEL_ALIASES[PUTER_IMAGE_MODEL] || PUTER_IMAGE_MODEL;
  const args = { prompt: String(prompt || "").slice(0, 4000), model };
  if (/gpt-image-(2|1\.5)/i.test(model) && PUTER_IMAGE_QUALITY) args.quality = PUTER_IMAGE_QUALITY;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 120_000); // gpt-image at "high" can be slow
  try {
    const r = await fetch(PUTER_DRIVER_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + PUTER_AUTH_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ interface: "puter-image-generation", driver: "ai-image", method: "generate", args }),
      signal: ac.signal,
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      if (r.status === 402 || /insufficient/i.test(body)) { _puterCooldownUntil = Date.now() + 10 * 60_000; } // out of credits → back off 10 min
      console.error("[firas] Puter image HTTP " + r.status + ": " + body.slice(0, 200));
      return null;
    }
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.startsWith("image/")) {
      const buf = Buffer.from(await r.arrayBuffer());
      return buf.length ? { buf, mime: ct } : null;
    }
    // Otherwise a JSON envelope or a bare string (data-URL / http URL / base64).
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (_) {}
    if (j && j.success === false) { console.error("[firas] Puter image error: " + txt.slice(0, 200)); return null; }
    const pick = (v) => {
      if (!v) return null;
      if (typeof v === "string") return v;
      if (typeof v === "object") return v.url || v.image_url || v.image || v.data || v.b64_json || v.base64 || pick(v.result) || null;
      return null;
    };
    let s = j ? (pick(j.result) || pick(j)) : txt;
    if (typeof s !== "string" || !s) return null;
    s = s.trim();
    if (s.startsWith("data:")) {
      const comma = s.indexOf(","), semi = s.indexOf(";");
      const mime = semi > 5 ? s.slice(5, semi) : "image/png";
      const buf = Buffer.from(s.slice(comma + 1), "base64");
      return buf.length ? { buf, mime } : null;
    }
    if (/^https?:\/\//i.test(s)) {
      const ir = await fetch(s, { signal: ac.signal });
      if (!ir.ok) return null;
      const buf = Buffer.from(await ir.arrayBuffer());
      return buf.length ? { buf, mime: ir.headers.get("content-type") || "image/png" } : null;
    }
    if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.replace(/\s+/g, "").length > 200) {
      try { const buf = Buffer.from(s.replace(/\s+/g, ""), "base64"); if (buf.length > 100) return { buf, mime: "image/png" }; } catch (_) {}
    }
    return null;
  } catch (e) { console.error("[firas] Puter image exception: " + (e && e.message || e)); return null; }
  finally { clearTimeout(to); }
}

// Detect image type from magic bytes (Cloudflare models return PNG or JPEG base64).
function sniffImageMime(buf) {
  if (!buf || buf.length < 4) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xFF && buf[1] === 0xD8) return "image/jpeg";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57) return "image/webp";
  return "image/jpeg";
}

// Generate an image via Cloudflare Workers AI (free daily quota, reliable). FLUX.2 models
// require multipart/form-data; flux-1/Leonardo take simple JSON. Response is base64 in
// {result:{image}} (or raw image bytes for some). Returns {buf,mime} or null.
// Pool of Cloudflare accounts → multiplies the free 10k-neuron/day quota. The primary
// CF_ACCOUNT_ID/CF_API_TOKEN plus any pairs in CF_ACCOUNTS ("id:token,id:token,..."). Each
// request tries them in order, skipping any in a 429 cooldown. NOTE: pooling many accounts
// to bypass a free tier may breach Cloudflare's ToS — the operator's choice.
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
  for (let i = 1; i <= 64; i++) add(process.env["CF_ACCOUNT_ID_" + i], process.env["CF_API_TOKEN_" + i]);
  // 3) Legacy combined string "id:token,id:token,…".
  for (const pair of (process.env.CF_ACCOUNTS || "").split(",")) {
    const s = pair.trim(); if (!s) continue;
    const i = s.indexOf(":"); if (i < 1) continue;
    add(s.slice(0, i), s.slice(i + 1));
  }
  return list;
})();
const _cfCooldown = new Map(); // accountId -> ms timestamp to skip until (its daily 429)

// One generation attempt against a SINGLE account. Returns {buf,mime}, the string "429"
// (quota exhausted → caller cools it down and tries the next), or null on other failure.
async function cfTryAccount(acct, prompt, w, h) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 90_000); // flux-2-klein ~4s; flux-2-dev ~80s
  try {
    const url = "https://api.cloudflare.com/client/v4/accounts/" + acct.id + "/ai/run/" + CF_IMAGE_MODEL;
    const text = String(prompt || "").slice(0, 2000);
    let r;
    if (/flux-2/i.test(CF_IMAGE_MODEL)) {
      // FLUX.2 needs multipart/form-data — don't set Content-Type (fetch adds the boundary).
      const fd = new FormData();
      fd.append("prompt", text); fd.append("steps", String(CF_IMAGE_STEPS));
      fd.append("width", String(w || 1024)); fd.append("height", String(h || 1024));
      r = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + acct.token }, body: fd, signal: ac.signal });
    } else {
      const body = { prompt: text };
      if (/flux-1|schnell/i.test(CF_IMAGE_MODEL)) body.steps = Math.min(8, CF_IMAGE_STEPS); // flux-schnell max 8
      r = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + acct.token, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
    }
    if (!r.ok) {
      const errBody = await r.text().catch(() => "");
      if (r.status === 429 || /allocation|neurons/i.test(errBody)) return "429";
      console.error("[firas] Cloudflare image HTTP " + r.status + ": " + errBody.slice(0, 160));
      return null;
    }
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.startsWith("image/")) { const buf = Buffer.from(await r.arrayBuffer()); return buf.length ? { buf, mime: ct } : null; }
    const j = await r.json().catch(() => null);
    const b64 = j && ((j.result && (j.result.image || (Array.isArray(j.result.images) && j.result.images[0]))) || j.image);
    if (typeof b64 === "string" && b64.length > 100) {
      const clean = b64.startsWith("data:") ? b64.slice(b64.indexOf(",") + 1) : b64;
      const buf = Buffer.from(clean, "base64");
      return buf.length ? { buf, mime: sniffImageMime(buf) } : null;
    }
    if (j && j.success === false) console.error("[firas] Cloudflare image error: " + JSON.stringify(j.errors || j).slice(0, 160));
    return null;
  } catch (e) { console.error("[firas] Cloudflare image exception: " + (e && e.message || e)); return null; }
  finally { clearTimeout(to); }
}

// Try each pooled account in turn; skip those in 429 cooldown. Returns {buf,mime} or null.
let _cfNext = 0; // round-robin cursor → spreads load across accounts (not always account #1)
async function generateImageCloudflare(prompt, w, h) {
  const n = CF_ACCOUNTS.length;
  if (!n) return null;
  for (let k = 0; k < n; k++) {
    const acct = CF_ACCOUNTS[(_cfNext + k) % n];
    if (Date.now() < (_cfCooldown.get(acct.id) || 0)) continue; // in 429 cooldown → skip
    const out = await cfTryAccount(acct, prompt, w, h);
    if (out === "429") { _cfCooldown.set(acct.id, Date.now() + 30 * 60_000); continue; } // exhausted → next account
    if (out && out.buf && out.buf.length) { _cfNext = (_cfNext + k + 1) % n; return out; } // advance cursor for next call
    // other failure → try the next account
  }
  return null;
}

async function generateImageGemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 45_000);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_IMAGE_MODEL + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: String(prompt || "").slice(0, 4000) }] }] }),
      signal: ac.signal,
    });
    if (!r.ok) { console.error("[firas] Gemini image HTTP " + r.status + ": " + (await r.text().catch(() => "")).slice(0, 160)); return null; }
    const j = await r.json();
    const parts = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        const inl = p.inlineData || p.inline_data;
        if (inl && inl.data) return { buf: Buffer.from(inl.data, "base64"), mime: inl.mimeType || inl.mime_type || "image/png" };
      }
    }
    return null;
  } catch (_) { return null; }
  finally { clearTimeout(to); }
}

// Generate an image with Hugging Face (FLUX.1-schnell). Returns {buf, mime} or null.
async function generateImageHF(prompt) {
  if (!HF_API_KEY) return null;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 60_000);
  try {
    const r = await fetch(HF_IMAGE_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + HF_API_KEY, "Content-Type": "application/json", "Accept": "image/png" },
      body: JSON.stringify({ inputs: String(prompt || "").slice(0, 2000) }),
      signal: ac.signal,
    });
    if (!r.ok) { console.error("[firas] HF image HTTP " + r.status + ": " + (await r.text().catch(() => "")).slice(0, 160)); return null; }
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) { console.error("[firas] HF non-image response (" + ct + ")"); return null; }
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length ? { buf, mime: ct } : null;
  } catch (_) { return null; }
  finally { clearTimeout(to); }
}

async function handleImage(req, res) {
  // Require a session so the proxy can't be used as an anonymous, unmetered relay
  // to pollinations. Authed reloads of saved images still carry the cookie, so
  // they keep working. A generous per-user rate cap bounds abuse loops without
  // tripping history reloads (image-heavy chats re-request every saved image).
  const user = currentUser(req);
  if (!user) { res.writeHead(401); return res.end("auth required"); }
  if (rateLimited("img:" + user.id, 240, 60_000)) { res.writeHead(429); return res.end("rate limited"); }
  const u = new URL(req.url, "http://localhost");
  const prompt = (u.searchParams.get("prompt") || "").trim().slice(0, 1000);
  if (!prompt) { res.writeHead(400); return res.end("no prompt"); }
  // Daily cap keyed by creation id: a NEW image (unseen cid) counts ONCE and only
  // on success; reloads (same cid) are free; failures never charge.
  const cid = (u.searchParams.get("cid") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  imgRollDay(user);
  const isNew = !!cid && !user.imgCids.includes(cid);
  if (isNew && user.imgCids.length >= IMAGE_DAILY_LIMIT) { res.writeHead(429); return res.end("daily limit reached"); }
  const w = Math.min(1280, Math.max(256, parseInt(u.searchParams.get("w"), 10) || 1024));
  const h = Math.min(1280, Math.max(256, parseInt(u.searchParams.get("h"), 10) || 1024));
  const seed = (u.searchParams.get("seed") || "").replace(/[^0-9]/g, "").slice(0, 12);
  // Serve a previously-generated identical image straight from disk: instant, stable
  // (the saved picture never changes), and zero extra Puter/engine spend on reloads.
  const ckey = imgCacheKey(prompt, w, h, seed);
  const cached = imgCacheGet(ckey);
  if (cached) {
    if (isNew) { user.imgCids.push(cid); persist(); }
    res.writeHead(200, { "Content-Type": cached.mime, "Cache-Control": "public, max-age=86400" });
    return res.end(cached.buf);
  }
  // 0) Cloudflare Workers AI (FREE FLUX.2, ~65/day) → PRIMARY: great quality + in-image
  // text at NO per-image cost and no user login. Falls through to Puter when its daily
  // quota is exhausted, so paid credits are only spent once the free pool is gone.
  try {
    const cf = await generateImageCloudflare(prompt, w, h);
    if (cf && cf.buf && cf.buf.length) {
      console.log("[firas] image served by Cloudflare (" + CF_IMAGE_MODEL + ")");
      await imgCacheSet(ckey, cf.buf, cf.mime);
      if (isNew) { user.imgCids.push(cid); persist(); }
      res.writeHead(200, { "Content-Type": cf.mime, "Cache-Control": "public, max-age=86400" });
      return res.end(cf.buf);
    }
  } catch (_) { /* fall through to Puter */ }
  // 1) Puter gpt-image-2 (paid credits) → premium fallback: the sharpest in-image text.
  try {
    const put = await generateImagePuter(prompt);
    if (put && put.buf && put.buf.length) {
      console.log("[firas] image served by Puter (" + imgEngineTag() + ")");
      await imgCacheSet(ckey, put.buf, put.mime);
      if (isNew) { user.imgCids.push(cid); persist(); }
      res.writeHead(200, { "Content-Type": put.mime, "Cache-Control": "public, max-age=86400" });
      return res.end(put.buf);
    }
    if (PUTER_AUTH_TOKEN) console.error("[firas] Puter returned no image → next engine");
  } catch (_) { if (PUTER_AUTH_TOKEN) console.error("[firas] Puter error → next engine"); }
  // 2) Gemini (free key) → actual Gemini-image quality. Falls back to pollinations.
  try {
    const gem = await generateImageGemini(prompt);
    if (gem && gem.buf && gem.buf.length) {
      console.log("[firas] image served by Gemini (" + GEMINI_IMAGE_MODEL + ")");
      await imgCacheSet(ckey, gem.buf, gem.mime);
      if (isNew) { user.imgCids.push(cid); persist(); }
      res.writeHead(200, { "Content-Type": gem.mime, "Cache-Control": "public, max-age=86400" });
      return res.end(gem.buf);
    }
    if (GEMINI_API_KEY) console.error("[firas] Gemini returned no image → next engine");
  } catch (_) { if (GEMINI_API_KEY) console.error("[firas] Gemini error → next engine"); }
  // 1b) Hugging Face FLUX.1-schnell (free token) → lossless PNG; ~on par with keyless.
  try {
    const hf = await generateImageHF(prompt);
    if (hf && hf.buf && hf.buf.length) {
      console.log("[firas] image served by Hugging Face (" + HF_IMAGE_MODEL + ")");
      await imgCacheSet(ckey, hf.buf, hf.mime);
      if (isNew) { user.imgCids.push(cid); persist(); }
      res.writeHead(200, { "Content-Type": hf.mime, "Cache-Control": "public, max-age=86400" });
      return res.end(hf.buf);
    }
  } catch (_) { /* fall through to pollinations */ }
  // 2) Keyless pollinations (flux) with LLM prompt-enhance + private/no-feed for the
  // best free quality (enhance≈doubles detail; private+nofeed keep it off the feed).
  const src = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) +
    "?width=" + w + "&height=" + h + "&nologo=true&enhance=true&private=true&nofeed=true&model=flux" + (seed ? "&seed=" + seed : "");
  try {
    const r = await fetch(src, { headers: { "User-Agent": SEARCH_UA, "Accept": "image/*" } });
    if (!r.ok) { res.writeHead(502); return res.end("image generation failed"); }
    const buf = Buffer.from(await r.arrayBuffer());
    const pmime = r.headers.get("content-type") || "image/jpeg";
    await imgCacheSet(ckey, buf, pmime);
    if (isNew) { user.imgCids.push(cid); persist(); } // charge only now (real bytes)
    res.writeHead(200, { "Content-Type": pmime, "Cache-Control": "public, max-age=86400" });
    res.end(buf);
  } catch (_) {
    res.writeHead(502);
    res.end("image generation error");
  }
}

async function handleWebSearch(req, res) {
  res.setHeader("Content-Type", "application/json");
  // Auth + rate limit so the DuckDuckGo proxy isn't an open anonymous scraper.
  const user = currentUser(req);
  if (!user) { res.writeHead(401); return res.end(JSON.stringify({ results: [], error: "auth" })); }
  if (rateLimited("search:" + user.id, 30, 60_000)) { res.writeHead(429); return res.end(JSON.stringify({ results: [], error: "rate" })); }
  const u = new URL(req.url, "http://localhost");
  const q = (u.searchParams.get("q") || "").trim().slice(0, 300);
  if (!q) { res.writeHead(400); return res.end(JSON.stringify({ results: [] })); }
  let results = [];
  try {
    const r = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), {
      headers: { "User-Agent": SEARCH_UA, "Accept-Language": "ar,en-US;q=0.8,en;q=0.6", "Accept": "text/html" },
    });
    if (r.ok) results = parseDuckDuckGo(await r.text()).slice(0, 6);
  } catch (_) { /* return empty on failure — the AI answers without search */ }
  res.writeHead(200);
  res.end(JSON.stringify({ q, results }));
}

/** Build version = newest mtime of the core static files. An open tab polls this
    and reloads itself when it changes, so stale SPA sessions can't linger. */
function handleVersion(req, res) {
  res.setHeader("Content-Type", "application/json");
  let v = 0;
  for (const f of ["app.js", "index.html", "styles.css"]) {
    try { v = Math.max(v, statSync(path.join(__dirname, f)).mtimeMs); } catch (_) {}
  }
  res.writeHead(200);
  res.end(JSON.stringify({ version: Math.floor(v) }));
}

// ── Max engine: Claude (Anthropic Messages API → our SSE) ───────────────────
// ── Max engine: Gemini (OpenAI-compatible, FREE Flash tier) ──────────────────
// Sniff an image mime from the base64 signature (for the data-URL Gemini expects).
function b64Mime(b64) {
  const s = String(b64 || "");
  if (s.startsWith("/9j/")) return "image/jpeg";
  if (s.startsWith("iVBOR")) return "image/png";
  if (s.startsWith("R0lGOD")) return "image/gif";
  if (s.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}
// Stream a prebuilt OpenAI-format messages array through the Gemini OpenAI-compat endpoint,
// trying each candidate model id. Returns true if any bytes streamed. Shared by text + vision.
async function _geminiStream(res, msgs, signal, label) {
  for (const model of GEMINI_TEXT_MODELS) {
    if (res.writableEnded) return true;
    const body = JSON.stringify({ model, messages: msgs, stream: true });
    let upstream;
    try {
      upstream = await fetch(GEMINI_OAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GEMINI_API_KEY },
        body, signal,
      });
    } catch (e) { if (signal.aborted) return true; continue; }
    if (!upstream.ok || !upstream.body) {
      console.error("[firas] " + (label || "Gemini") + " (" + model + ") HTTP " + (upstream && upstream.status) + " — trying next");
      try { upstream && upstream.body && upstream.body.cancel(); } catch (_) {}
      continue;
    }
    const decoder = new TextDecoder();
    let buffer = "", any = false;
    try {
      for await (const chunk of upstream.body) {
        if (res.writableEnded) break;
        buffer += decoder.decode(chunk, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let evt; try { evt = JSON.parse(payload); } catch { continue; }
          const delta = evt.choices && evt.choices[0] && evt.choices[0].delta;
          if (delta && delta.content) { sseWrite(res, delta.content); any = true; }
        }
      }
      if (any) { console.log("[firas] served by " + (label || "Gemini") + " (" + model + ")"); return true; }
    } catch (e) { return signal.aborted ? true : any; }
  }
  return false;
}
// Text: Max-tier first engine. Returns true if it streamed any bytes.
async function streamGemini(res, messages, signal) {
  if (!GEMINI_API_KEY) return false;
  const msgs = messages
    .filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "") }));
  if (!msgs.length) return false;
  return _geminiStream(res, msgs, signal, "Max→Gemini");
}
// Max-tier PRIMARY engine: DeepSeek V4 Pro via NVIDIA NIM (free, OpenAI-compatible) — frontier-class
// reasoning + coding, so Max is genuinely the strongest tier. Returns true if it streamed any bytes;
// false (no key / 401 / 402 / 429 rate-limit / error BEFORE any byte) so the caller falls back to Gemini.
async function streamDeepSeek(res, messages, signal) {
  if (!NVIDIA_API_KEY) return false;
  const msgs = messages
    .filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "") }));
  if (!msgs.length) return false;
  // Local abort linked to the caller's signal + a 15s "first response" timeout, so if NVIDIA is slow
  // or unreachable Max bails to Gemini within 15s instead of hanging. (A user Stop still aborts.)
  const ac = new AbortController();
  const fwd = () => { try { ac.abort(); } catch (_) {} };
  if (signal.aborted) ac.abort(); else signal.addEventListener("abort", fwd, { once: true });
  const cleanup = () => { try { signal.removeEventListener("abort", fwd); } catch (_) {} };
  const headTimer = setTimeout(() => { try { ac.abort(); } catch (_) {} }, 15000);
  let upstream;
  try {
    upstream = await fetch(NVIDIA_OAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + NVIDIA_API_KEY },
      body: JSON.stringify({
        model: NVIDIA_MODEL, messages: msgs,
        temperature: 0.6, top_p: 0.95, max_tokens: 16384,
        chat_template_kwargs: { thinking: false },
        stream: true,
      }),
      signal: ac.signal,
    });
  } catch (e) { clearTimeout(headTimer); cleanup(); return signal.aborted ? true : false; }
  clearTimeout(headTimer);
  if (!upstream.ok || !upstream.body) {
    console.error("[firas] Max→DeepSeek HTTP " + (upstream && upstream.status) + " — falling back to Gemini");
    try { upstream && upstream.body && upstream.body.cancel(); } catch (_) {}
    cleanup();
    return false;
  }
  const decoder = new TextDecoder();
  let buffer = "", any = false;
  try {
    for await (const chunk of upstream.body) {
      if (res.writableEnded) break;
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let evt; try { evt = JSON.parse(payload); } catch { continue; }
        const delta = evt.choices && evt.choices[0] && evt.choices[0].delta;
        if (delta && delta.content) { sseWrite(res, delta.content); any = true; }   // skip reasoning_content
      }
    }
    if (any) { console.log("[firas] served by Max→DeepSeek (" + NVIDIA_MODEL + ")"); cleanup(); return true; }
  } catch (e) { cleanup(); return signal.aborted ? true : any; }
  cleanup();
  return false;
}
// VISION: a strong, cloud, multimodal model (works on the deployed site, no local GPU). Sends
// the attached image(s) as data-URL image_url parts. Tried BEFORE the local Ollama vision model.
async function streamGeminiVision(res, messages, signal) {
  if (!GEMINI_API_KEY) return false;
  let budget = MAX_IMAGES_PER_REQUEST;
  const msgs = messages
    .filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant")
    .map((m) => {
      const text = String((m && m.content) || "");
      if (m && m.role === "user" && Array.isArray(m.images) && m.images.length && budget > 0) {
        const parts = text ? [{ type: "text", text }] : [];
        for (const raw of m.images) {
          if (budget <= 0) break;
          const norm = normalizeImage(raw);
          if (norm) { parts.push({ type: "image_url", image_url: { url: "data:" + b64Mime(norm) + ";base64," + norm } }); budget--; }
        }
        if (parts.length) return { role: m.role, content: parts };
      }
      return { role: m.role, content: text };
    });
  if (!msgs.length) return false;
  return _geminiStream(res, msgs, signal, "Vision→Gemini");
}

// Returns true if it streamed any answer, false if it failed BEFORE any bytes
// (no key / 402 no-credit / error) so the caller can fall back. Does NOT send the
// terminal [DONE] — handleChat's finally does that.
async function streamAnthropic(res, messages, signal) {
  if (!ANTHROPIC_API_KEY) return false;
  // Anthropic takes system text as a top-level field; messages must be user/assistant.
  const system = messages.filter((m) => m.role === "system").map((m) => String(m.content || "")).join("\n\n");
  const conv = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "") }));
  while (conv.length && conv[0].role !== "user") conv.shift(); // Anthropic must start with user
  if (!conv.length) return false;
  const body = JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: ANTHROPIC_MAX_TOK, stream: true, ...(system ? { system } : {}), messages: conv });
  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body, signal,
    });
  } catch (e) { return signal.aborted ? true : false; }
  if (!upstream.ok || !upstream.body) { console.error("[firas] Max→Claude HTTP " + (upstream && upstream.status) + " — falling back"); try { upstream && upstream.body && upstream.body.cancel(); } catch (_) {} return false; }
  const decoder = new TextDecoder();
  let buffer = "", any = false;
  try {
    for await (const chunk of upstream.body) {
      if (res.writableEnded) break;
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let evt; try { evt = JSON.parse(payload); } catch { continue; }
        if (evt.type === "content_block_delta" && evt.delta) {
          if (evt.delta.type === "text_delta" && evt.delta.text) { sseWrite(res, evt.delta.text); any = true; }
          else if (evt.delta.type === "thinking_delta" && evt.delta.thinking) { sseWrite(res, "", evt.delta.thinking); }
        } else if (evt.type === "error" && !any) {
          return false; // upstream error before any content → fall back
        }
      }
    }
    if (any) console.log("[firas] Max served by Claude (" + ANTHROPIC_MODEL + ")");
    return any; // true = served; false = nothing came → caller falls back
  } catch (e) { return signal.aborted ? true : any; }
}

// ── Max engine: OpenRouter (OpenAI-compatible, free DeepSeek-R1) ─────────────
async function streamOpenRouter(res, messages, signal) {
  if (!OPENROUTER_API_KEY) return false;
  const msgs = messages
    .filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "") }));
  if (!msgs.length) return false;
  const body = JSON.stringify({ model: OPENROUTER_MODEL, messages: msgs, stream: true });
  let upstream;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + OPENROUTER_API_KEY, "HTTP-Referer": "https://firasai.netlify.app", "X-Title": "Firas AI" },
      body, signal,
    });
  } catch (e) { return signal.aborted ? true : false; }
  if (!upstream.ok || !upstream.body) { console.error("[firas] Max→OpenRouter HTTP " + (upstream && upstream.status) + " — falling back"); try { upstream && upstream.body && upstream.body.cancel(); } catch (_) {} return false; }
  const decoder = new TextDecoder();
  let buffer = "", any = false;
  try {
    for await (const chunk of upstream.body) {
      if (res.writableEnded) break;
      buffer += decoder.decode(chunk, { stream: true });
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
          if (delta.reasoning) sseWrite(res, "", delta.reasoning);   // R1 thinking
          if (delta.content) { sseWrite(res, delta.content); any = true; }
        }
      }
    }
    if (any) console.log("[firas] Max served by OpenRouter (" + OPENROUTER_MODEL + ")");
    return any;
  } catch (e) { return signal.aborted ? true : any; }
}

async function streamFallback(res, messages, tier, think, signal) {
  const body = JSON.stringify({ model: FALLBACK_MODEL, messages, stream: true });
  let upstream;
  try {
    upstream = await fetch(FALLBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // no Origin server-side
      body,
      signal,
    });
  } catch (e) {
    if (signal.aborted) return;
    sseWrite(res, "The Firas AI engine is unavailable right now. Please try again.");
    sseDone(res);
    return;
  }

  if (!upstream.ok || !upstream.body) {
    sseWrite(res, "The Firas AI engine is busy right now. Please try again.");
    sseDone(res);
    return;
  }

  // Buffer the whole fallback answer, then strip the engine ad/brand before
  // sending (the ad arrives as a trailing block, so it can't be cleaned per-token).
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let reasoningAcc = "";
  try {
    for await (const chunk of upstream.body) {
      if (res.writableEnded) break;
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") { buffer = ""; break; }
        let evt;
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        const delta = (evt.choices && evt.choices[0] && evt.choices[0].delta) || {};
        if (delta.content) answer += delta.content;
        if (think && (delta.reasoning || delta.reasoning_content)) {
          reasoningAcc += delta.reasoning || delta.reasoning_content;
        }
      }
    }
    const cleaned = stripEngineAd(answer);
    if (reasoningAcc) sseWrite(res, "", reasoningAcc);
    if (cleaned) sseWrite(res, cleaned, "");
    else if (!reasoningAcc) sseWrite(res, "The Firas AI engine is busy right now. Please try again.");
    sseDone(res);
  } catch (e) {
    if (signal.aborted) return;
    console.error("[firas] fallback stream error:", (e && e.message) || e);
    sseDone(res);
  }
}

/* ===========================================================================
   PERSISTENT USER MEMORY — the assistant learns durable facts about each user
   from their conversations and recalls them in future chats (private, per-user,
   server-side). Extraction runs via the keyless pollinations engine.
   =========================================================================== */
const MEMORY_MAX = 60;
function userMemory(user) { if (!Array.isArray(user.memory)) user.memory = []; return user.memory; }
function memoryBlock(user) {
  const m = userMemory(user);
  if (!m.length) return "";
  return "PERSISTENT MEMORY — VERIFIED facts about the user you are talking to RIGHT NOW (saved from past chats). Treat them as TRUE:\n" +
    m.map((f) => "- " + f).join("\n") +
    "\nUse them to personalize naturally. When the user ASKS what you know/remember about them, answer using EXACTLY these facts and nothing invented — keep their exact name, country, city, age and numbers as written here; never substitute a different place or guess a value. If the user now says something that contradicts a fact, trust their newest statement.";
}
// Non-streaming completion for memory extraction. Prefers the STRONG Ollama model
// (accurate, deterministic at temperature 0 — no hallucination) and falls back to the
// keyless pollinations engine. Returns text or "".
async function llmComplete(messages, opts) {
  opts = opts || {};
  const tok = opts.maxTokens || 1500; // room for a reasoning model to think AND answer
  const temp = opts.temperature != null ? opts.temperature : 0;
  // 1) Ollama (strong, accurate) — gpt-oss reasoning model. num_predict must be large
  // enough that thinking + the JSON answer both fit, or .content comes back empty.
  try {
    const r = await fetch(OLLAMA_CHAT_URL, {
      method: "POST",
      headers: ollamaHeaders(),
      body: JSON.stringify({ model: (TIERS.pro && TIERS.pro.model) || "gpt-oss:120b-cloud", messages, stream: false, options: { temperature: temp, num_predict: tok } }),
      signal: opts.signal,
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      const c = j && j.message && j.message.content;
      if (typeof c === "string" && c.trim()) return c;
    }
  } catch (_) {}
  // 2) Keyless pollinations fallback.
  try {
    const r = await fetch(FALLBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: FALLBACK_MODEL, messages, stream: false, temperature: temp, max_tokens: tok }),
      signal: opts.signal,
    });
    if (!r.ok) return "";
    const j = await r.json().catch(() => null);
    const c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return typeof c === "string" ? c : "";
  } catch (_) { return ""; }
}
// Pull durable USER facts from one exchange and merge into the user's memory.
async function handleMemoryLearn(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "authentication required" });
  if (rateLimited("mem:" + user.id, 60, 60_000)) return sendJson(res, 429, { error: "rate limited" });
  let payload; try { payload = JSON.parse((await readBody(req, 200_000)) || "{}"); } catch { return sendJson(res, 400, { error: "invalid JSON" }); }
  const userText = String(payload.user || "").slice(0, 4000).trim();
  const aiText = String(payload.assistant || "").slice(0, 2000).trim();
  if (!userText) return sendJson(res, 200, { ok: true, added: 0 });
  const existing = userMemory(user);
  const sys =
    "You extract durable facts about a USER. Preserve name, age, country, city EXACTLY as stated " +
    "(from Iraq -> 'From Iraq'; age 16 -> 'Age: 16'; never change or guess). " +
    "Capture name, age, country, job, language, likes, projects, goals, interests, and any personal detail. " +
    "Return ONLY a JSON array of short strings. If nothing, []." +
    (existing.length ? " Skip facts already in: " + JSON.stringify(existing.slice(-50)) : "");
  const u = 'The USER said: "' + userText + '". Return JSON array of facts:';
  const msgs = [{ role: "system", content: sys }, { role: "user", content: u }];
  // The cloud model is non-deterministic and often returns PARTIAL facts on any single
  // call; run a few passes and UNION the results so we capture the full set.
  const collected = new Map();
  const temps = [0, 0.5, 0.8]; // varied temps so passes differ → fuller union; run in PARALLEL for speed
  const outs = await Promise.all(temps.map((t) => llmComplete(msgs, { maxTokens: 1500, temperature: t })));
  for (const out of outs) {
    let arr = []; try { const m = out.match(/\[[\s\S]*\]/); if (m) arr = JSON.parse(m[0]); } catch (_) {}
    if (Array.isArray(arr)) for (const f of arr) { const s = String(f || "").trim(); if (s && s.length <= 140) { const k = s.toLowerCase(); if (!collected.has(k)) collected.set(k, s); } }
  }
  let facts = [...collected.values()];
  if (!Array.isArray(facts)) facts = [];
  let added = 0;
  const seen = new Set(existing.map((f) => String(f).toLowerCase().trim()));
  const labelOf = (s) => { const i = String(s).indexOf(":"); return i > 0 ? String(s).slice(0, i).trim().toLowerCase() : ""; };
  for (let f of facts) {
    f = String(f || "").trim();
    if (!f || f.length > 140) continue;
    const key = f.toLowerCase();
    if (seen.has(key)) continue;
    // Correction-via-conversation: a new "Label: value" REPLACES any older fact with the
    // same label (so a fresh "City: Baghdad" removes a stale "City: Aleppo") — the user
    // can fix what Firas knows just by telling it, no manual editor needed.
    const lab = labelOf(f);
    if (lab) {
      for (let i = existing.length - 1; i >= 0; i--) {
        if (labelOf(existing[i]) === lab) { seen.delete(String(existing[i]).toLowerCase().trim()); existing.splice(i, 1); }
      }
    }
    seen.add(key); existing.push(f); added++;
  }
  if (added) { while (existing.length > MEMORY_MAX) existing.shift(); persist(); }
  return sendJson(res, 200, { ok: true, added, total: existing.length });
}
function handleMemoryGet(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "authentication required" });
  return sendJson(res, 200, { memory: userMemory(user) });
}
async function handleMemoryClear(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "authentication required" });
  // DELETE /api/memory clears all; DELETE /api/memory?i=N removes one by index.
  const u = new URL(req.url, "http://localhost");
  const idx = u.searchParams.get("i");
  const mem = userMemory(user);
  if (idx != null && idx !== "") { const n = parseInt(idx, 10); if (n >= 0 && n < mem.length) mem.splice(n, 1); }
  else user.memory = [];
  persist();
  return sendJson(res, 200, { ok: true, memory: userMemory(user) });
}

/* ============================================================================
   SITE UPDATES / ANNOUNCEMENTS — the owner (admin) publishes updates (text +
   image); every user sees them on every device. Stored in DB (file / Firebase).
   ========================================================================== */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "firasnozad@gmail.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
function isAdmin(user) { return !!(user && user.email && ADMIN_EMAILS.includes(String(user.email).toLowerCase())); }
function announcementsList() { if (!Array.isArray(DB.announcements)) DB.announcements = []; return DB.announcements; }
const ANN_IMG_OK = (s) => typeof s === "string" && /^(data:image\/(png|jpe?g|webp);base64,|https?:\/\/)/.test(s);
function handleAnnouncementsGet(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "authentication required" });
  const list = announcementsList().slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 50);
  return sendJson(res, 200, { announcements: list, admin: isAdmin(user) });
}
async function handleAnnouncementsPost(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "authentication required" });
  if (!isAdmin(user)) return sendJson(res, 403, { error: "admins only" });
  let p; try { p = JSON.parse((await readBody(req, CHAT_BODY_LIMIT)) || "{}"); } catch { return sendJson(res, 400, { error: "invalid JSON" }); }
  const title = String(p.title || "").slice(0, 200).trim();
  const body = String(p.body || "").slice(0, 4000).trim();
  let image = String(p.image || "").trim();
  if (image && !ANN_IMG_OK(image)) image = "";
  if (image.length > 600000) return sendJson(res, 413, { error: "image too large" });
  if (!title && !body && !image) return sendJson(res, 400, { error: "empty announcement" });
  const item = { id: "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title, body, image, ts: Date.now(), by: user.name || "Firas" };
  const list = announcementsList();
  list.unshift(item);
  while (list.length > 100) list.pop();
  await persist();
  return sendJson(res, 200, { ok: true, announcement: item });
}
async function handleAnnouncementsDelete(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "authentication required" });
  if (!isAdmin(user)) return sendJson(res, 403, { error: "admins only" });
  const id = new URL(req.url, "http://localhost").searchParams.get("id");
  const list = announcementsList();
  const i = list.findIndex((a) => a.id === id);
  if (i >= 0) { list.splice(i, 1); await persist(); }
  return sendJson(res, 200, { ok: true });
}
async function handleAnnouncementsPatch(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: "authentication required" });
  if (!isAdmin(user)) return sendJson(res, 403, { error: "admins only" });
  let p; try { p = JSON.parse((await readBody(req, CHAT_BODY_LIMIT)) || "{}"); } catch { return sendJson(res, 400, { error: "invalid JSON" }); }
  const item = announcementsList().find((a) => a.id === String(p.id || ""));
  if (!item) return sendJson(res, 404, { error: "not found" });
  if (typeof p.title === "string") item.title = p.title.slice(0, 200).trim();
  if (typeof p.body === "string") item.body = p.body.slice(0, 4000).trim();
  if (typeof p.image === "string") {
    let image = p.image.trim();
    if (image && !ANN_IMG_OK(image)) image = "";
    if (image.length > 600000) return sendJson(res, 413, { error: "image too large" });
    item.image = image; // "" removes the image
  }
  item.editedTs = Date.now();
  await persist();
  return sendJson(res, 200, { ok: true, announcement: item });
}

async function handleChat(req, res) {
  // AUTH REQUIRED.
  const user = currentUser(req);
  if (!user) {
    return sendJson(res, 401, { error: "authentication required" });
  }

  let payload;
  try {
    // Raise the body limit for /api/chat ONLY so image payloads fit.
    payload = JSON.parse((await readBody(req, CHAT_BODY_LIMIT)) || "{}");
  } catch {
    return sendJson(res, 400, { error: "invalid JSON body" });
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const tier = TIERS[payload.tier] ? payload.tier : "pro";

  if (!messages.length) {
    return sendJson(res, 400, { error: 'body must include a non-empty "messages" array' });
  }

  // Capped tier (Max): enforce the per-user daily limit and charge one slot per
  // distinct request id (idempotent on retry of the same cid).
  if (TIERS[tier] && TIERS[tier].capped) {
    maxRollDay(user);
    let cid = String(payload.cid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
    const isNew = !cid || !user.maxCids.includes(cid);
    if (isNew && user.maxCids.length >= MAX_DAILY_LIMIT) {
      return sendJson(res, 429, { error: "daily Max limit reached", limit: MAX_DAILY_LIMIT, used: user.maxCids.length, remaining: 0 });
    }
    if (isNew) { user.maxCids.push(cid || ("r" + Date.now())); persist(); }
  }

  // PERSISTENT MEMORY: inject what we know about this user as a system message
  // (right after the first system message) so every reply is personalized.
  // nomem=true on internal agent calls (file/PDF generation, prompt-enhance, batches)
  // so personal facts NEVER leak into generated documents — memory is for CHAT only.
  const memBlk = payload.nomem ? "" : memoryBlock(user);
  if (memBlk) {
    // Merge memory INTO the first system message (not a separate one) — some models
    // (e.g. the coder model on Ultra) ignore a second system message.
    const sysIdx = messages.findIndex((m) => m && m.role === "system");
    if (sysIdx >= 0) messages[sysIdx] = { role: "system", content: String(messages[sysIdx].content || "") + "\n\n" + memBlk };
    else messages.unshift({ role: "system", content: memBlk });
  }

  // VISION DETECTION: any message carrying a non-empty images array routes to
  // the vision model with think forced OFF and RAW base64 images attached.
  const vision = hasImages(messages);
  const think = vision ? false : !!payload.think;
  const ollamaMessages = vision ? buildVisionMessages(messages) : stripImages(messages);
  const modelOverride = vision ? OLLAMA_MODEL_VISION : undefined;

  // Never hang: hard timeout + abort upstream on client disconnect.
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
  res.on("close", () => ac.abort());
  res.on("error", () => {});

  sseInit(res);

  try {
    let served = false;
    // VISION → a strong CLOUD multimodal model FIRST (Gemini Flash): much better than the local
    // qwen2.5vl, and it works on the deployed site with NO local GPU. Falls back to local Ollama
    // vision only if Gemini isn't configured or fails before any bytes.
    if (vision && GEMINI_API_KEY) {
      served = await streamGeminiVision(res, messages, ac.signal);
    }
    // Max tier → premium external engines FIRST: Gemini Flash (free) → Claude Sonnet
    // (paid) → OpenRouter free (Nemotron). Each returns false if it failed before any
    // bytes, so the chain degrades cleanly to the next engine.
    if (tier === "max" && !vision && !served) {
      // Max = Qwen3.5 397B (free Ollama) FIRST — strongest tier, zero credit. External engines fall back.
      served = await streamOllama(res, ollamaMessages, tier, think, ac.signal);   // Qwen3.5 397B
      if (!served && !res.writableEnded) served = await streamGemini(res, messages, ac.signal);
      if (!served && !res.writableEnded) served = await streamAnthropic(res, messages, ac.signal);
      if (!served && !res.writableEnded) served = await streamOpenRouter(res, messages, ac.signal);
    }
    let ok = served ? true : await streamOllama(res, ollamaMessages, tier, think, ac.signal, modelOverride);
    if (!ok && vision && !res.writableEnded) {
      // The vision model can fail on a COLD START (it has to load into VRAM first) — the
      // first request times out/errors, the model loads, and a retry then succeeds. streamOllama
      // returns false only when it failed BEFORE writing any bytes, so a retry is safe.
      await new Promise((r) => setTimeout(r, 1200));
      ok = await streamOllama(res, ollamaMessages, tier, think, ac.signal, modelOverride);
    }
    if (!ok && !res.writableEnded) {
      if (vision) {
        // Pollinations fallback is text-only; it cannot see images. Tell the
        // user clearly and finish — never hang.
        sseWrite(res, "The Firas AI vision engine is offline right now, so I can't view images. Please try again shortly.");
        sseDone(res);
      } else {
        // For a capped tier (Max), first degrade to its known-good Ollama fallback
        // model (gpt-oss) before the last-resort pollinations text fallback.
        const fb = TIERS[tier] && TIERS[tier].fallbackModel;
        let recovered = false;
        if (fb) recovered = await streamOllama(res, ollamaMessages, tier, think, ac.signal, fb);
        if (!recovered && !res.writableEnded) {
          // Ollama unreachable -> resilient TEXT fallback (no bytes streamed yet).
          await streamFallback(res, messages, tier, think, ac.signal);
        }
      }
    }
  } catch (e) {
    console.error("[firas] chat handler error:", (e && e.message) || e);
    if (!res.writableEnded) {
      sseWrite(res, "Something went wrong with the Firas AI engine. Please try again.");
      sseDone(res);
    }
  } finally {
    clearTimeout(timeout);
    if (!res.writableEnded) sseDone(res);
  }
}

/* ===========================================================================
   Static file serving (path-traversal guard + index fallback + no-cache)
   =========================================================================== */
async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(__dirname, safe);
  // Use a path-separator boundary so a sibling dir with the same prefix
  // (e.g. ..\FirasAI-secrets) can't slip past a bare startsWith check.
  if (filePath !== __dirname && !filePath.startsWith(__dirname + path.sep)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  // Never serve the database or the data dir.
  if (filePath === DATA_DIR || filePath.startsWith(DATA_DIR + path.sep)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  if (!existsSync(filePath)) filePath = path.join(__dirname, "index.html");
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache", // always revalidate so edits show up immediately
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN", // clickjacking protection for the login UI
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
}

/* ===========================================================================
   Router
   =========================================================================== */
const server = http.createServer(async (req, res) => {
  try {
    const route = req.url.split("?")[0];
    const method = req.method;

    // ---- AI stream ----
    if (route === "/api/chat") {
      if (method === "POST") return await handleChat(req, res);
      if (method === "OPTIONS") {
        // Same-origin app: do not advertise a wildcard cross-origin policy.
        res.writeHead(204, { Allow: "POST, OPTIONS" });
        return res.end();
      }
      res.writeHead(405);
      return res.end("method not allowed");
    }

    // ---- Web search (keyless, server-proxied DuckDuckGo) ----
    if (route === "/api/search" && method === "GET") return await handleWebSearch(req, res);

    // ---- Image generation (keyless, server-proxied pollinations) ----
    if (route === "/api/image/quota" && method === "POST") return await handleImageQuota(req, res);
    if (route === "/api/image" && method === "GET") return await handleImage(req, res);

    // ---- Max tier daily quota (read-only pre-check) ----
    if (route === "/api/max/quota" && method === "POST") return await handleMaxQuota(req, res);

    if (route === "/api/memory" && method === "GET") return handleMemoryGet(req, res);
    if (route === "/api/memory" && method === "DELETE") return await handleMemoryClear(req, res);
    if (route === "/api/memory/learn" && method === "POST") return await handleMemoryLearn(req, res);
    if (route === "/api/announcements" && method === "GET") return handleAnnouncementsGet(req, res);
    if (route === "/api/announcements" && method === "POST") return await handleAnnouncementsPost(req, res);
    if (route === "/api/announcements" && method === "PATCH") return await handleAnnouncementsPatch(req, res);
    if (route === "/api/announcements" && method === "DELETE") return await handleAnnouncementsDelete(req, res);
    if (route === "/api/translate" && method === "POST") return await handleTranslate(req, res);

    // ---- Build version (lets an open tab auto-reload when code changes) ----
    if (route === "/api/version" && method === "GET") return handleVersion(req, res);

    // ---- Auth ----
    if (route === "/api/auth/signup" && method === "POST") return await handleSignup(req, res);
    if (route === "/api/auth/verify-signup" && method === "POST") return await handleVerifySignup(req, res);
    if (route === "/api/auth/verify-status" && method === "POST") return await handleVerifyStatus(req, res);
    if (route === "/api/auth/resend-code" && method === "POST") return await handleResendCode(req, res);
    if (route === "/api/auth/login" && method === "POST") return await handleLogin(req, res);
    if (route === "/api/auth/firebase" && method === "POST") return await handleFirebaseAuth(req, res);
    if (route === "/api/auth/forgot" && method === "POST") return await handleForgot(req, res);
    if (route === "/api/auth/reset" && method === "POST") return await handleReset(req, res);
    if (route === "/api/auth/change-password" && method === "POST") return await handleChangePassword(req, res);
    if (route === "/api/auth/change-email" && method === "POST") return await handleChangeEmail(req, res);
    if (route === "/api/auth/delete-account" && method === "POST") return await handleDeleteAccount(req, res);
    if (route === "/api/auth/logout" && method === "POST") return handleLogout(req, res);
    if (route === "/api/auth/me" && method === "GET") return handleMe(req, res);

    // ---- Chats ----
    if (route === "/api/chats") {
      if (method === "GET") return await handleListChats(req, res);
      if (method === "POST") return await handleCreateChat(req, res);
      res.writeHead(405);
      return res.end("method not allowed");
    }
    const chatMatch = route.match(/^\/api\/chats\/([^/]+)$/);
    if (chatMatch) {
      const id = decodeURIComponent(chatMatch[1]);
      if (method === "GET") return await handleGetChat(req, res, id);
      if (method === "PUT") return await handleUpdateChat(req, res, id);
      if (method === "DELETE") return await handleDeleteChat(req, res, id);
      res.writeHead(405);
      return res.end("method not allowed");
    }

    // ---- Static ----
    if (method === "GET" || method === "HEAD") return await serveStatic(req, res);

    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    console.error("[firas] request handler error:", (e && e.message) || e);
    if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
    else if (!res.writableEnded) {
      try { res.end(); } catch (_) {}
    }
  }
});

// A single dropped connection or stream hiccup must never take the server down.
process.on("uncaughtException", (e) => console.error("[firas] uncaught:", (e && e.message) || e));
process.on("unhandledRejection", (e) => console.error("[firas] rejection:", (e && e.message) || e));

// Boot: ensure DB exists, then listen.
initDb()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => { // bind all interfaces (required by Fly.io/containers)
      console.log(`\n  ✦ Firas AI  →  http://localhost:${PORT}`);
      console.log(`  engine: Ollama (${OLLAMA_HOST})  fallback: keyless pollinations`);
      console.log(`  db: ${fbEnabled() ? "Firebase RTDB (" + FB_DB_URL + ")" : DB_PATH}  (users: ${DB.users.length}, chats: ${DB.chats.length})`);
      // Production-readiness guardrails (warn loudly, don't crash).
      const prod = process.env.NODE_ENV === "production";
      if (!process.env.SESSION_SECRET) {
        console.warn("  ⚠ SESSION_SECRET is not set — sessions are signed with a DB-stored secret that is regenerated if the DB is wiped. Set SESSION_SECRET for production.");
      }
      if (OLLAMA_HOST.includes("localhost") && (OLLAMA_API_KEY || prod)) {
        console.warn("  ⚠ OLLAMA_HOST points at localhost but this looks like a deploy — the engine will be unreachable and chat will degrade to the keyless fallback. Set OLLAMA_HOST=https://ollama.com (+ OLLAMA_API_KEY).");
      }
      if (prod && !fbEnabled() && !process.env.DATA_DIR) {
        console.warn("  ⚠ No persistent storage — data/db.json is ephemeral on most hosts (accounts/chats reset). Set FIREBASE_DB_URL + FIREBASE_SERVICE_ACCOUNT (recommended), or point DATA_DIR at a persistent disk.");
      }
      console.log("");
    });
  })
  .catch((e) => {
    console.error("[firas] failed to start:", (e && e.message) || e);
    process.exit(1);
  });
