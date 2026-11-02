import { getData, publicProject } from "../lib/data.js";
import { json } from "../lib/http.js";
import { config } from "../lib/config.js";

export default async function handler(req, res) {
  const d = await getData();
  json(res, 200, { projects: d.projects.map(publicProject), names: d.names, config: config(), source: d.source },
    { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" });
}
