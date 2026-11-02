// Google Sheets access with a service account (no extra packages).
// Env: GOOGLE_SERVICE_ACCOUNT = the full JSON key file contents; SHEET_ID = spreadsheet id.
import crypto from "node:crypto";

let token = null, tokenExp = 0;

function creds() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw || !process.env.SHEET_ID) return null;
  const c = JSON.parse(raw);
  return { email: c.client_email, key: String(c.private_key).replace(/\\n/g, "\n") };
}

export const sheetsConfigured = () => !!creds();

const b64url = (x) => Buffer.from(x).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function getToken() {
  if (token && Date.now() < tokenExp - 60_000) return token;
  const c = creds();
  if (!c) throw new Error("Google Sheets not configured");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: c.email, scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const sig = crypto.createSign("RSA-SHA256").update(head + "." + claim).sign(c.key);
  const jwt = head + "." + claim + "." + b64url(sig);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!r.ok) throw new Error("Google auth failed: " + r.status);
  const j = await r.json();
  token = j.access_token; tokenExp = Date.now() + j.expires_in * 1000;
  return token;
}

const base = () => `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}`;

export async function readRanges(ranges) {
  const q = ranges.map((r) => "ranges=" + encodeURIComponent(r)).join("&");
  const r = await fetch(`${base()}/values:batchGet?${q}`, { headers: { authorization: "Bearer " + (await getToken()) } });
  if (!r.ok) throw new Error("Sheets read failed: " + r.status);
  const j = await r.json();
  return j.valueRanges.map((v) => v.values || []);
}

// RAW input: values are stored as plain text, so nothing a visitor types can become a formula.
export async function appendRow(tab, row) {
  const url = `${base()}/values/${encodeURIComponent(tab + "!A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: "Bearer " + (await getToken()), "content-type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
  if (!r.ok) throw new Error("Sheets append failed: " + r.status);
}
