// Pre-deploy safety checks for DR ARVEEN. Runs in GitHub Actions before publishing.
// Usage: node tools/check.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const problems = [];
const fail = msg => problems.push(msg);

// 1. Professional content must never be in the public site.
if (fs.existsSync(path.join(root, "assets", "data.js"))) fail("assets/data.js exists: professional content must stay in dr-arveen-content, not the public site.");
if (fs.existsSync(path.join(root, "seed.sql"))) fail("seed.sql is in the site folder: it contains professional content.");
const pub = read("assets/patient-data.js");
for (const key of ["guidelines", "recommendations", "protocols", "drugs", "trials", "staging"]) {
  if (new RegExp(`"${key}"\\s*:`).test(pub)) fail(`assets/patient-data.js contains the professional collection "${key}".`);
}

// 2. No secret keys in config.
const cfg = read("assets/config.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
if (/service_role|sb_secret_/i.test(cfg)) fail("assets/config.js contains a secret (service_role) key. Only the public anon/publishable key is allowed.");
const jwt = cfg.match(/eyJ[\w-]+\.([\w-]+)\.[\w-]+/);
if (jwt) {
  try { const claims = JSON.parse(Buffer.from(jwt[1], "base64url").toString()); if (claims.role !== "anon") fail(`assets/config.js key has role "${claims.role}"; it must be "anon".`); } catch { /* not a JWT */ }
}

// 3. Every page the app links to exists.
const app = read("assets/app.js");
const files = [...app.matchAll(/:\s*"([a-z0-9-]+\.html)"/g)].map(m => m[1]);
for (const f of new Set(files)) if (!fs.existsSync(path.join(root, f))) fail(`app.js links to ${f}, which doesn't exist.`);

// 4. Every HTML page loads the shared scripts and has a title, language and description.
for (const f of fs.readdirSync(root).filter(f => f.endsWith(".html"))) {
  const h = read(f);
  if (!/<html lang="[a-z-]+">/.test(h)) fail(`${f}: missing <html lang>.`);
  if (!/<title>[^<]+<\/title>/.test(h)) fail(`${f}: missing <title>.`);
  if (!/<meta name="description" content="[^"]+">/.test(h)) fail(`${f}: missing meta description.`);
  for (const s of ["assets/config.js", "assets/patient-data.js", "assets/app.js"]) if (!h.includes(`src="${s}"`)) fail(`${f}: doesn't load ${s}.`);
}

// 5. Scripts parse.
for (const f of ["assets/app.js", "assets/patient-data.js", "assets/config.js"]) {
  try { new vm.Script(read(f), { filename: f }); } catch (e) { fail(`${f} has a syntax error: ${e.message}`); }
}

// 6. Sitemap only lists pages that exist.
if (fs.existsSync(path.join(root, "sitemap.xml"))) {
  for (const m of read("sitemap.xml").matchAll(/<loc>[^<]*\/([a-z0-9-]*\.html)?(?:\?[^<]*)?<\/loc>/g)) {
    if (m[1] && !fs.existsSync(path.join(root, m[1]))) fail(`sitemap.xml lists ${m[1]}, which doesn't exist.`);
  }
}

if (problems.length) { console.error("DR ARVEEN checks failed:\n- " + problems.join("\n- ")); process.exit(1); }
console.log("DR ARVEEN checks passed.");
