// Preload for local tests: answers Google token + Sheets append calls, logs appended rows.
const real = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith("https://oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "fake", expires_in: 3600 }));
  if (u.includes("sheets.googleapis.com") && u.includes(":append")) { console.log("APPEND", u.split("/values/")[1].split(":")[0], opts.body); return new Response("{}"); }
  if (u.includes("sheets.googleapis.com")) return new Response("{}", { status: 500 });
  return real(url, opts);
};
