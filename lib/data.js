// Builds the bot's project list from the Google Sheet, with a bundled snapshot as fallback.
// Rules (the tier strategy):
//  - Tier 1 projects the bot recommends = rows in "Tier 1 Research" with Approved? = "Yes"
//    AND tier "1 - Offer" in Source Inventory column C.
//  - Tier 1 projects without approved research -> name recognition only (tier1x).
//  - Tier 2 / Tier 3 -> name recognition only (redirect to Tier 1 / "not currently offered").
import fs from "node:fs";
import { readRanges, sheetsConfigured } from "./sheet.js";

const COLS = ["id","name_in_list","official_name","match_confidence","sales_status","side","district","neighbourhood",
  "developer","property_types","segment","total_units","blocks_floors","land_area_m2","unit_types","unit_sizes_m2",
  "project_status","delivery_date","starting_price","price_by_unit_type","price_per_m2","payment_plan",
  "price_source_and_date","citizenship","title_deed","vat_rate","title_deed_fee","views","facilities",
  "nearby_transport","key_selling_points","best_for","description","official_url","sources","notes","approved"];

const TTL = 10 * 60 * 1000; // re-read the sheet at most every 10 minutes
let cache = null, cacheAt = 0;

const s = (v, n = 400) => {
  v = String(v ?? "").replace(/\s+/g, " ").trim();
  return v.length <= n ? v : v.slice(0, n - 1) + "…";
};
const list = (v) => s(v, 600).split("|").map((x) => x.trim()).filter(Boolean);

export function usdFrom(text) {
  const m = String(text || "").match(/\$\s?(\d[\d,.]*)\s*(k|m)?\b/i);
  if (!m) return null;
  let digits = m[1];
  digits = (digits.match(/\./g) || []).length > 1 ? digits.replace(/[.,]/g, "") : digits.replace(/,/g, "");
  let n = parseFloat(digits);
  if (m[2]) n *= m[2].toLowerCase() === "k" ? 1e3 : 1e6;
  return n > 1000 ? Math.round(n) : null;
}

function toProject(o) {
  const name = o.name_in_list;
  const risk = [];
  if (/babacan/i.test(name + " " + o.developer)) risk.push("developer-investigation");
  const sales = s(o.sales_status);
  if (/^(sold|resale)/i.test(sales)) risk.push("no-developer-stock");
  const from_ = s(o.starting_price, 220);
  return {
    id: o.id, name: s(o.official_name) || name, listName: name, conf: s(o.match_confidence).toLowerCase(),
    sales, side: s(o.side), district: s(o.district), hood: s(o.neighbourhood), dev: s(o.developer, 120),
    type: s(o.property_types, 120), seg: s(o.segment), units: s(o.total_units, 80), status: s(o.project_status),
    delivery: s(o.delivery_date, 120), unitTypes: s(o.unit_types, 150), sizes: s(o.unit_sizes_m2, 200),
    from_, prices: s(o.price_by_unit_type, 400), pay: s(o.payment_plan, 220), priceSrc: s(o.price_source_and_date, 220),
    cit: s(o.citizenship, 200), deed: s(o.title_deed, 80), vat: s(o.vat_rate, 100), views: s(o.views, 100),
    fac: s(o.facilities, 260), transport: s(o.nearby_transport, 220), ksp: list(o.key_selling_points),
    bestFor: list(o.best_for), desc: s(o.description, 500), url: s(o.official_url, 200),
    caution: s(o.notes, 600), risk, fromUSD: usdFrom(from_),
  };
}

function snapshot() {
  const read = (f) => JSON.parse(fs.readFileSync(new URL("./snapshot/" + f, import.meta.url), "utf8"));
  return { projects: read("data.json"), names: read("names.json"), source: "snapshot" };
}

async function fromSheet() {
  const [research, inventory] = await readRanges(["'Tier 1 Research'!A2:AK1000", "'Source Inventory'!A2:C3000"]);
  return buildFromRows(research, inventory);
}

export function buildFromRows(research, inventory) {
  const tierOf = new Map(inventory.map((r) => [String(r[0] || "").trim(), String(r[2] || "")]));
  const nameOf = new Map(inventory.map((r) => [String(r[0] || "").trim(), String(r[1] || "")]));
  const projects = [];
  const live = new Set();
  for (const row of research) {
    const o = Object.fromEntries(COLS.map((c, i) => [c, row[i] ?? ""]));
    o.id = String(o.id).trim();
    if (!o.id || !/^1/.test(tierOf.get(o.id) || "")) continue;
    if (String(o.approved).trim().toLowerCase() !== "yes") continue;
    if (["not found", "not researched", ""].includes(String(o.match_confidence).trim().toLowerCase())) continue;
    projects.push(toProject(o));
    live.add(o.id);
  }
  const names = { tier1x: [], tier2: [], tier3: [] };
  for (const [id, tier] of tierOf) {
    if (!id || live.has(id)) continue;
    const key = /^1/.test(tier) ? "tier1x" : /^2/.test(tier) ? "tier2" : /^3/.test(tier) ? "tier3" : null;
    if (key) names[key].push([id, nameOf.get(id)]);
  }
  if (projects.length < 10) throw new Error("Too few approved projects in the sheet (" + projects.length + ")");
  return { projects, names, source: "sheet" };
}

export async function getData() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  let d;
  if (sheetsConfigured()) {
    try { d = await fromSheet(); }
    catch (e) { console.error("Sheet load failed, using snapshot:", e.message); d = cache || snapshot(); }
  } else d = snapshot();
  cache = d; cacheAt = Date.now();
  return d;
}

// Public view: never send internal notes to the browser.
export const publicProject = ({ caution, ...p }) => p;
