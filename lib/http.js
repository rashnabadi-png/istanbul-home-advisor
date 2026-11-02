// Small helpers shared by the API routes.

export function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) break; }
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export const ip = (req) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();

// Best-effort limit per server instance. Your real cost cap is the monthly spend limit in the Anthropic Console.
const hits = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}

// If ALLOWED_ORIGINS is set (comma-separated), only those sites may call the API.
export function originOk(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!allowed.length) return true;
  const o = req.headers.origin;
  return !o || allowed.includes(o);
}

export const clip = (v, n) => String(v ?? "").slice(0, n);
