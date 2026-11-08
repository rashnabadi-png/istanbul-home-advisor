// Coordinates from Google Maps links. Full links carry them in the URL; short links (goo.gl/maps, maps.app.goo.gl)
// are followed to their full form first.
const inIstanbul = (lat, lng) => lat > 40.6 && lat < 41.8 && lng > 27.8 && lng < 30.2;

export function parseMapLink(url) {
  const u = decodeURIComponent(String(url || ""));
  const pick = (a, b) => { const lat = parseFloat(a), lng = parseFloat(b); return inIstanbul(lat, lng) ? [lat, lng] : null; };
  let m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); if (m) return pick(m[1], m[2]);          // the place itself
  m = u.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/); if (m) return pick(m[1], m[2]);
  m = u.match(/\/search\/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/); if (m) return pick(m[1], m[2]);
  m = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/); if (m && parseFloat(m[3]) >= 15) return pick(m[1], m[2]); // close-up view centre
  return null;
}

export async function resolveMapLink(url, hops = 4) {
  let u = String(url || "").trim();
  if (!/^https?:\/\/(goo\.gl|maps\.app\.goo\.gl|g\.co|(www\.)?google\.[a-z.]+)\//i.test(u)) return null;
  for (let i = 0; i < hops; i++) {
    const ll = parseMapLink(u); if (ll) return ll;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
    try {
      const r = await fetch(u, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (IstanbulHomeAdvisor location check)" } });
      const next = r.headers.get("location");
      if (!next) { const html = r.status === 200 ? await r.text() : ""; return parseMapLink(html.slice(0, 200000)); }
      u = new URL(next, u).toString();
    } catch { return null; } finally { clearTimeout(t); }
  }
  return parseMapLink(u);
}
