// Local test server: serves public/ and the api/ routes the same way Vercel does.
// Usage: node test/server.mjs  (env vars as in .env.example)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".js": "text/javascript" };
const port = Number(process.env.PORT || 3000);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
    try { const mod = await import(path.join(root, "api", name + ".js")); return mod.default(req, res); }
    catch (e) { console.error(e); res.statusCode = 404; return res.end("not found"); }
  }
  let f = path.join(root, "public", url.pathname === "/" ? "index.html" : url.pathname);
  if (!f.startsWith(path.join(root, "public")) || !fs.existsSync(f)) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("content-type", types[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log("http://localhost:" + port));
