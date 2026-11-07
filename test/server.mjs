// Local test server: serves public/ and the api/ routes the same way Vercel does.
// Usage: node test/server.mjs  (env vars as in .env.example)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".js": "text/javascript", ".mp4": "video/mp4", ".webp": "image/webp" };
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
  res.setHeader("accept-ranges", "bytes");
  // Byte ranges, like Vercel: browsers need them to seek inside the scroll-driven video.
  const size = fs.statSync(f).size, m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) {
    const start = m[1] ? +m[1] : size - +m[2], end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    res.writeHead(206, { "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.setHeader("content-length", size);
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log("http://localhost:" + port));
