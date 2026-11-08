// Saves a lead (only after the visitor gave KVKK consent) as a new row in the "Leads" tab.
import { appendRow, sheetsConfigured } from "../lib/sheet.js";
import { json, body, ip, limited, originOk, clip } from "../lib/http.js";
import { currentUser } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!originOk(req)) return json(res, 403, { error: "origin" });
  if (limited("lead:" + ip(req), 5, 60 * 60 * 1000)) return json(res, 429, { error: "rate_limited" });
  const b = await body(req);
  if (b.website) return json(res, 200, { ok: true }); // hidden honeypot field: bots fill it, people don't
  if (b.consentGiven !== true) return json(res, 400, { error: "consent" });
  const phone = clip(b.phone, 40).trim();
  if (phone.replace(/\D/g, "").length < 7) return json(res, 400, { error: "phone" });
  if (!sheetsConfigured()) return json(res, 503, { error: "not_configured" });

  const row = [
    new Date().toISOString(), clip(b.name, 80), phone, clip(b.language, 20), clip(b.interest, 120),
    (Array.isArray(b.shortlist) ? b.shortlist : []).slice(0, 6).map((x) => clip(x, 80)).join("; "),
    clip(b.viewing, 20), clip(b.when, 20), clip(JSON.stringify(b.answers || {}), 1500),
    (Array.isArray(b.questions) ? b.questions : []).slice(0, 3).map((x) => clip(x, 300)).join(" || "),
    clip(b.consentText, 80), "New",
    (currentUser(req) || {}).email || "", // column M: the visitor's account email when signed in with Google
  ];
  try { await appendRow("Leads", row); return json(res, 200, { ok: true }); }
  catch (e) { console.error(e.message); return json(res, 502, { error: "save_failed" }); }
}
