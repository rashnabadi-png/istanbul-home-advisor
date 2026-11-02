// Fake Claude API for local tests: asks for one tool call, then answers. Logs each request body size.
import http from "node:http";
const port = Number(process.env.MOCK_PORT || 3100);
http.createServer(async (req, res) => {
  let raw = ""; for await (const c of req) raw += c;
  const b = JSON.parse(raw);
  const last = b.messages.at(-1);
  const sys = b.system.map((s) => s.text).join("\n");
  console.log("MOCK", JSON.stringify({ model: b.model, msgs: b.messages.length, sysChars: sys.length, cached: !!b.system[0].cache_control, key: req.headers["x-api-key"] }));
  res.setHeader("content-type", "application/json");
  if (typeof last.content === "string") {
    return res.end(JSON.stringify({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "get_project", input: { id: "IST-E-490" } }] }));
  }
  const tool = last.content[0].content;
  const lang = (sys.match(/ALWAYS reply in (\w+)/) || [])[1];
  res.end(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: `MOCK(${lang}) tool:${tool.slice(0, 60)} internal:${tool.includes("internal_caution_do_not_quote")}` }] }));
}).listen(port, () => console.log("mock on " + port));
