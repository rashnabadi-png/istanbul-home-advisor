// Visitor accounts. GET = who is signed in; POST {credential} = sign in with Google; DELETE = sign out.
// Every account is a row in the sheet's "Users" tab, so the team sees who signed up and what they were looking for.
import { verifyGoogle, sessionCookie, clearCookie, currentUser, authConfigured } from "../lib/auth.js";
import { readRanges, appendRow, writeRanges, sheetsConfigured } from "../lib/sheet.js";
import { json, body, ip, limited, originOk, clip } from "../lib/http.js";

const pub = (u) => u && { email: u.email, name: u.name, picture: u.picture };

export default async function handler(req, res) {
  const nocache = { "cache-control": "no-store" };
  if (req.method === "GET") return json(res, 200, { enabled: authConfigured(), user: pub(currentUser(req)) }, nocache);
  if (!originOk(req)) return json(res, 403, { error: "origin" });
  if (req.method === "DELETE") return json(res, 200, { ok: true }, { ...nocache, "set-cookie": clearCookie() });
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!authConfigured()) return json(res, 503, { error: "not_configured" });
  if (limited("auth:" + ip(req), 20, 60 * 60 * 1000)) return json(res, 429, { error: "rate_limited" });

  const b = await body(req);
  let u;
  try { u = await verifyGoogle(b.credential); }
  catch (e) { console.error("auth:", e.message); return json(res, 401, { error: "invalid" }); }

  let isNew = true;
  if (sheetsConfigured()) {
    try {
      const now = new Date().toISOString();
      const [rows, counts] = await readRanges(["Users!B2:B5000", "Users!H2:H5000"]);
      const at = rows.findIndex((r) => String(r[0] || "").toLowerCase() === u.email);
      if (at >= 0) {
        isNew = false;
        const row = at + 2, count = parseInt((counts[at] || [])[0], 10) || 0;
        await writeRanges([{ range: `Users!G${row}:H${row}`, values: [[now, String(count + 1)]] }]);
      } else {
        await appendRow("Users", [
          now, u.email, clip(u.name, 80), clip(b.language, 20), clip(b.goal, 40),
          clip(JSON.stringify(b.answers || {}), 1500), now, "1", "New", clip(b.page, 40), u.sub,
        ]);
      }
    } catch (e) { console.error("users sheet:", e.message); } // signing in still works if the sheet is busy
  }
  return json(res, 200, { user: pub(u), isNew }, { ...nocache, "set-cookie": sessionCookie(u) });
}
