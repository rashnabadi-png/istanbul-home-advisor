// Private-test gate (Vercel Routing Middleware). While ACCESS_CODE is set, only people who know the
// code can open the chat or call the API. Remove ACCESS_CODE in Vercel to go public.
export const config = { matcher: "/((?!privacy\\.html|favicon\\.ico).*)" };

const COOKIE = "iha_access";

// Codes are compared without spaces and ignoring capitals (phones auto-capitalise the first letter).
const norm = (c) => String(c || "").normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("en-US");

async function digest(code) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("iha:" + norm(code)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const page = (wrong) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Private preview</title>
<style>:root{--bg:#EEF3F4;--s:#fff;--i:#13212B;--m:#5A6B76;--l:#D3DDE1;--a:#1D4E9E}
@media (prefers-color-scheme:dark){:root{--bg:#0E171D;--s:#15212A;--i:#E6EEF2;--m:#93A6B2;--l:#2A3B46;--a:#7EA8F2;color-scheme:dark}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--i);font:16px/1.5 system-ui,sans-serif}
form{background:var(--s);border:1px solid var(--l);border-radius:14px;padding:24px;width:min(340px,calc(100vw - 32px))}
h1{font-size:1.2rem;margin:0 0 6px}p{color:var(--m);margin:0 0 16px;font-size:.92rem}
input,button{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--l);background:var(--bg);color:var(--i)}
button{margin-top:10px;background:var(--a);color:#fff;border:0;font-weight:600;cursor:pointer}.e{color:#A1302B}</style></head>
<body><form method="get" action="/"><h1>Private preview</h1><p ${wrong ? 'class="e">That code didn\'t work. Try again.' : ">Enter the access code to try the advisor."}</p>
<input name="access" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off" autofocus required aria-label="Access code"><button>Open</button></form></body></html>`;

export default async function middleware(request) {
  const code = process.env.ACCESS_CODE;
  if (!code) return; // public mode
  const want = await digest(code);
  const url = new URL(request.url);
  const cookie = (request.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (cookie && cookie.slice(COOKIE.length + 1) === want) return; // allowed

  const given = url.searchParams.get("access");
  if (given && (await digest(given)) === want) {
    url.searchParams.delete("access");
    return new Response(null, { status: 303, headers: {
      location: url.pathname + url.search,
      "set-cookie": `${COOKIE}=${want}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
    } });
  }
  if (url.pathname.startsWith("/api/")) return new Response('{"error":"private"}', { status: 401, headers: { "content-type": "application/json" } });
  return new Response(page(!!given), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-store" } });
}
