// Answers typed questions with Claude. The API key stays on the server.
import { getData } from "../lib/data.js";
import { staticPrompt, visitorPrompt } from "../lib/prompt.js";
import { json, body, ip, limited, originOk, clip } from "../lib/http.js";
import { config } from "../lib/config.js";

const API = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const LANGS = ["English", "Turkish", "Arabic", "Persian", "Russian"];

const norm = (s) => String(s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/ı/g, "i").replace(/[^a-z0-9]+/g, " ").trim();

function lookupName(d, q) {
  const n = norm(q); if (n.length < 3) return [];
  const hit = (name) => { const m = norm(name); return m && (m.includes(n) || (m.length > 4 && n.includes(m))); };
  const out = [];
  d.projects.forEach((p) => { if (hit(p.name) || hit(p.listName)) out.push({ tier: 1, id: p.id, name: p.name }); });
  d.names.tier1x.forEach(([id, name]) => { if (hit(name)) out.push({ tier: 1, id, name, note: "details being confirmed by an agent" }); });
  d.names.tier2.forEach(([id, name]) => { if (hit(name)) out.push({ tier: 2, id, name }); });
  d.names.tier3.forEach(([id, name]) => { if (hit(name)) out.push({ tier: 3, id, name }); });
  return out.slice(0, 8);
}

function fullRecord(d, id) {
  const p = d.projects.find((x) => x.id === String(id || "").trim());
  if (!p) return { error: "No Tier 1 project with that id" };
  const { caution, ...pub } = p;
  return { ...pub, internal_caution_do_not_quote: caution };
}

const TOOLS = [
  { name: "get_project", description: "Full details of one Tier 1 project by id: prices by unit type, payment plan, sizes, facilities, transport, title deed, VAT, sources.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "lookup_name", description: "Find a project by name across all tiers. tier 1 = we offer it, 2 = reference only, 3 = not offered.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
];

async function callClaude(payload) {
  const r = await fetch(API + "/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) { const t = await r.text(); throw Object.assign(new Error("Claude API " + r.status + ": " + t.slice(0, 300)), { status: r.status }); }
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  if (!originOk(req)) return json(res, 403, { error: "origin" });
  if (!process.env.ANTHROPIC_API_KEY) return json(res, 503, { error: "not_configured" });
  const who = ip(req);
  if (limited("chat:" + who, 20, 10 * 60 * 1000) || limited("chatday:" + who, 80, 24 * 3600 * 1000)) return json(res, 429, { error: "rate_limited" });

  const b = await body(req);
  const lang = LANGS.includes(b.lang) ? b.lang : "English";
  const messages = (Array.isArray(b.messages) ? b.messages : []).slice(-10)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: clip(m.content, m.role === "user" ? 1500 : 2500) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages.at(-1).role !== "user") return json(res, 400, { error: "bad_request" });

  const d = await getData();
  const c = config();
  const system = [
    { type: "text", text: staticPrompt(d.projects, c.brand, c.dataCheckedOn), cache_control: { type: "ephemeral" } },
    { type: "text", text: visitorPrompt({ lang, answers: b.answers, shown: (b.shown || []).slice(0, 12).map((x) => clip(x, 80)), current: clip(b.current, 300) }) },
  ];

  try {
    const convo = [...messages];
    for (let round = 0; round < 4; round++) {
      const r = await callClaude({ model: MODEL, max_tokens: 700, system, tools: TOOLS, messages: convo });
      if (r.stop_reason !== "tool_use") {
        const text = r.content.filter((x) => x.type === "text").map((x) => x.text).join("").trim();
        return json(res, 200, { text });
      }
      convo.push({ role: "assistant", content: r.content });
      convo.push({ role: "user", content: r.content.filter((x) => x.type === "tool_use").map((x) => ({
        type: "tool_result", tool_use_id: x.id,
        content: JSON.stringify(x.name === "get_project" ? fullRecord(d, x.input?.id) : lookupName(d, x.input?.name)),
      })) });
    }
    return json(res, 200, { text: "" });
  } catch (e) {
    console.error(e.message);
    return json(res, e.status === 429 ? 429 : 502, { error: e.status === 429 ? "rate_limited" : "upstream" });
  }
}
