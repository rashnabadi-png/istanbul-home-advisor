// Visitor accounts with "Sign in with Google" (no extra packages).
// The browser gets a Google ID token; we check its signature against Google's public keys, then keep the
// visitor signed in with our own signed cookie. Env: GOOGLE_CLIENT_ID (OAuth web client ID).
import crypto from "node:crypto";

export const COOKIE = "iha_user";
const MAX_AGE = 180 * 24 * 3600; // 6 months

export const authConfigured = () => !!process.env.GOOGLE_CLIENT_ID;

// Secret for our cookie: SESSION_SECRET if set, otherwise derived from the service account key (already secret).
function secret() {
  const s = process.env.SESSION_SECRET || process.env.GOOGLE_SERVICE_ACCOUNT || "";
  if (!s) throw new Error("No session secret");
  return crypto.createHash("sha256").update("iha-session:" + s).digest();
}
const b64u = (b) => Buffer.from(b).toString("base64url");

let certs = null, certsExp = 0;
async function googleKeys() {
  if (certs && Date.now() < certsExp) return certs;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!r.ok) throw new Error("Google certs " + r.status);
  const age = Number((r.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
  certs = (await r.json()).keys; certsExp = Date.now() + age * 1000;
  return certs;
}

// Returns {sub, email, name, picture, locale} or throws.
export async function verifyGoogle(idToken) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("bad token");
  const head = JSON.parse(Buffer.from(parts[0], "base64url"));
  const claims = JSON.parse(Buffer.from(parts[1], "base64url"));
  const jwk = (await googleKeys()).find((k) => k.kid === head.kid);
  if (!jwk || head.alg !== "RS256") throw new Error("unknown key");
  const ok = crypto.verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"));
  if (!ok) throw new Error("bad signature");
  const now = Date.now() / 1000;
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("wrong audience");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) throw new Error("wrong issuer");
  if (!(claims.exp > now - 60)) throw new Error("expired");
  if (!claims.email || claims.email_verified === false || claims.email_verified === "false") throw new Error("email not verified");
  return { sub: String(claims.sub), email: String(claims.email).toLowerCase(), name: String(claims.name || claims.given_name || ""), picture: String(claims.picture || ""), locale: String(claims.locale || "") };
}

export function sessionCookie(u) {
  const payload = b64u(JSON.stringify({ s: u.sub, e: u.email, n: u.name, p: u.picture, x: Math.floor(Date.now() / 1000) + MAX_AGE }));
  const sig = b64u(crypto.createHmac("sha256", secret()).update(payload).digest());
  return `${COOKIE}=${payload}.${sig}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

// The signed-in visitor from the request cookie, or null.
export function currentUser(req) {
  try {
    const c = String(req.headers.cookie || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="));
    if (!c) return null;
    const [payload, sig] = c.slice(COOKIE.length + 1).split(".");
    const want = b64u(crypto.createHmac("sha256", secret()).update(payload).digest());
    if (!sig || sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
    const d = JSON.parse(Buffer.from(payload, "base64url"));
    if (!(d.x > Date.now() / 1000)) return null;
    return { sub: d.s, email: d.e, name: d.n, picture: d.p };
  } catch { return null; }
}
