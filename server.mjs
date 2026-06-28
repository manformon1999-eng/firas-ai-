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
// Max chain: Claude Sonnet (paid) → OpenRouter free (DeepSeek-R1) → Ollama/pollinations.
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL    = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_URL      = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MAX_TOK  = Math.max(1024, parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10) || 8192);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL   = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
const OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions";
// Gemini image model (Google AI Studio "Nano Banana") — actual Gemini-level quality.
// If GEMINI_API_KEY is set, /api/image uses it FIRST, falling back to keyless
// pollinations on error/quota. Free key, NO credit card (aistudio.google.com).
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY || "";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
// Hugging Face image model (FLUX.1-dev = stronger than keyless flux-schnell). Free
// token, no card. If HF_API_KEY is set, /api/image tries it after Gemini, before
// keyless pollinations. HF_IMAGE_URL overrides the endpoint if HF changes routing.
const HF_API_KEY     = process.env.HF_API_KEY || "";
const HF_IMAGE_MODEL = process.env.HF_IMAGE_MODEL || "black-forest-labs/FLUX.1-dev";
const HF_IMAGE_URL   = process.env.HF_IMAGE_URL || ("https://router.huggingface.co/hf-inference/models/" + HF_IMAGE_MODEL);

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
  max:   { model: process.env.OLLAMA_MODEL_MAX || "qwen3-coder:480b-cloud", temperature: 0.7, num_predict: 32768, fallbackModel: process.env.OLLAMA_MODEL_MAX_FALLBACK || "gpt-oss:120b-cloud", capped: true },
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

  const { salt, passHash } = await hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passHash,
    salt,
    createdAt: new Date().toISOString(),
  };
  DB.users.push(user);
  await persist();

  setSessionCookie(res, user.id, req);
  return sendJson(res, 200, { user: publicUser(user) });
}

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
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }));
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

  if (typeof body.title === "string") chat.title = body.title.slice(0, 200);
  if (Array.isArray(body.messages)) chat.messages = sanitizeMessages(body.messages);
  chat.updatedAt = new Date().toISOString();
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
/* PRE-CHECK only (read-only): whether the user can still use the Max tier today. */
async function handleMaxQuota(req, res) {
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { ok: false, error: "auth required" });
  if (maxRollDay(user)) await persist();
  const used = user.maxCids.length;
  if (used >= MAX_DAILY_LIMIT) return sendJson(res, 429, { ok: false, limit: MAX_DAILY_LIMIT, used, remaining: 0 });
  return sendJson(res, 200, { ok: true, limit: MAX_DAILY_LIMIT, used, remaining: MAX_DAILY_LIMIT - used });
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

// Generate an image with Hugging Face (FLUX.1-dev). Returns {buf, mime} or null.
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
  // 1) Gemini (free key) → actual Gemini-image quality. Falls back to pollinations.
  try {
    const gem = await generateImageGemini(prompt);
    if (gem && gem.buf && gem.buf.length) {
      console.log("[firas] image served by Gemini (" + GEMINI_IMAGE_MODEL + ")");
      if (isNew) { user.imgCids.push(cid); persist(); }
      res.writeHead(200, { "Content-Type": gem.mime, "Cache-Control": "public, max-age=86400" });
      return res.end(gem.buf);
    }
    if (GEMINI_API_KEY) console.error("[firas] Gemini returned no image → next engine");
  } catch (_) { if (GEMINI_API_KEY) console.error("[firas] Gemini error → next engine"); }
  // 1b) Hugging Face FLUX.1-dev (free token) → stronger than keyless flux-schnell.
  try {
    const hf = await generateImageHF(prompt);
    if (hf && hf.buf && hf.buf.length) {
      console.log("[firas] image served by Hugging Face (" + HF_IMAGE_MODEL + ")");
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
    if (isNew) { user.imgCids.push(cid); persist(); } // charge only now (real bytes)
    res.writeHead(200, {
      "Content-Type": r.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    });
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
    // Max tier → premium external engines FIRST: Claude Sonnet (paid), then
    // OpenRouter free (DeepSeek-R1) when Claude has no credit/fails. Each returns
    // false if it failed before any bytes, so the chain degrades cleanly.
    if (tier === "max" && !vision) {
      served = await streamAnthropic(res, messages, ac.signal);
      if (!served && !res.writableEnded) served = await streamOpenRouter(res, messages, ac.signal);
    }
    const ok = served ? true : await streamOllama(res, ollamaMessages, tier, think, ac.signal, modelOverride);
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

    // ---- Build version (lets an open tab auto-reload when code changes) ----
    if (route === "/api/version" && method === "GET") return handleVersion(req, res);

    // ---- Auth ----
    if (route === "/api/auth/signup" && method === "POST") return await handleSignup(req, res);
    if (route === "/api/auth/login" && method === "POST") return await handleLogin(req, res);
    if (route === "/api/auth/firebase" && method === "POST") return await handleFirebaseAuth(req, res);
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
