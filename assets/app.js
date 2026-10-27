(() => {
const D = window.ARVEEN_DATA;
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const na = v => (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) ? `<span class="na">Not recorded</span>` : esc(Array.isArray(v) ? v.join(", ") : v);
const byId = (arr, id) => arr.find(x => x.id === id);
const disease = id => byId(D.diseases, id);
const dname = id => disease(id)?.name || "—";

/* ---------- per-viewer storage (convenience only) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem("arveen." + k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem("arveen." + k, JSON.stringify(v)) } catch {} }
};
let state = { aud: store.get("aud", "pro"), q: "", lang: store.get("lang", "en"), filters: {} };

/* ---------- labels ---------- */
const MY = {
  "established": ["Established in Malaysian guidance", "ok"],
  "intl-not-verified": ["International recommendation; Malaysian implementation not verified", "warn"],
  "regulatory": ["Regulatory status not verified", "warn"],
  "availability": ["Availability or reimbursement requires confirmation", "warn"],
  "offlabel": ["Off-label use", "bad"], "investigational": ["Investigational treatment", "bad"],
  "institution": ["Institution-specific protocol", "teal"], "not-verified": ["Not verified", "warn"]
};
const myLabel = k => { const [t, c] = MY[k] || MY["not-verified"]; return `<span class="pill ${c}">${esc(t)}</span>` };
const statusPill = s => {
  const c = { "VERIFIED AGAINST SOURCE": "ok", "CLINICALLY REVIEWED": "ok", "APPROVED": "ok", "PARTIALLY VERIFIED": "warn", "NOT VERIFIED": "warn", "DRAFT": "warn", "SUPERSEDED": "bad", "NOT STARTED": "", "DETECTED": "warn", "SEARCH TASK": "teal" }[s] ?? "";
  return `<span class="pill ${c}">${esc(s)}</span>`;
};
const supPill = g => g.superseded === "superseded" ? `<span class="pill bad">Superseded</span>` : g.superseded === "uncertain" ? `<span class="pill warn">Currency uncertain</span>` : `<span class="pill ok">Active</span>`;
const orgs = g => g.org.join(" / ");

/* ---------- navigation ---------- */
const NAV_PRO = [["home", "Home"], ["guidelines", "Guidelines"], ["diseases", "Diseases"], ["staging", "Staging"], ["protocols", "Treatment Protocols"], ["drugs", "Drug Reference"], ["trials", "Clinical Trials"], ["algorithms", "Clinical Algorithms"], ["calculators", "Calculators"], ["compare", "Evidence and Research"], ["updates", "Guideline Updates"], ["education", "Education"], ["pt", "Patient Education"], ["sdm", "Shared Decision-Making"], ["workspace", "My Workspace"], ["admin", "Editorial"], ["about", "About"]];
const NAV_PT = [["pt", "Home"], ["ptcancers", "Your cancer"], ["leaflets", "Information leaflets"], ["sdm", "Prepare for appointments"], ["tracker", "Side-effect tracker"], ["glossary", "Medical glossary"], ["workspace", "Saved"], ["about", "About"]];
/* Each route name maps to its own HTML file; records use ?id= */
const FILES = { home: "index.html", guidelines: "guidelines.html", recs: "recommendations.html", g: "guideline.html", diseases: "diseases.html", d: "disease.html",
  staging: "staging.html", s: "staging-system.html", protocols: "protocols.html", p: "protocol.html", drugs: "drugs.html", dr: "drug.html", trials: "trials.html", t: "trial.html",
  algorithms: "algorithms.html", calculators: "calculators.html", compare: "evidence.html", updates: "updates.html", education: "education.html", workspace: "workspace.html",
  admin: "editorial.html", about: "about.html", search: "search.html", pt: "patients.html", ptcancers: "patient-cancers.html", ptd: "patient-cancer.html",
  leaflets: "leaflets.html", l: "leaflet.html", sdm: "decision-making.html", tracker: "tracker.html", glossary: "glossary.html" };
const PAGE_BY_FILE = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [f, k]));
function url(route) {
  const i = route.indexOf("."); const base = i < 0 ? route : route.slice(0, i); const arg = i < 0 ? "" : route.slice(i + 1);
  const f = FILES[base] || "index.html";
  return arg ? `${f}?id=${encodeURIComponent(arg)}` : f;
}
const PARAMS = new URLSearchParams(location.search);
const PAGE = document.body.dataset.page || PAGE_BY_FILE[location.pathname.split("/").pop()] || "home";
const PT_PAGES = ["pt", "ptcancers", "ptd", "leaflets", "l", "tracker", "glossary"];
const SHARED_PAGES = ["workspace", "about", "sdm", "search"];
if (PT_PAGES.includes(PAGE)) state.aud = "pt"; else if (!SHARED_PAGES.includes(PAGE)) state.aud = "pro";
store.set("aud", state.aud);
state.q = PARAMS.get("q") || "";

function renderShell() {
  $("#mast").innerHTML = `<div class="mast-in"><div class="mast-top">
    <a class="brand" href="index.html" aria-label="DR ARVEEN home">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="1" width="32" height="32" rx="7" fill="none" stroke="#7ee0e5" stroke-width="2"/><path d="M9 25 L17 8 L25 25" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><path d="M12.5 19 H21.5" stroke="#b9a7f0" stroke-width="2.4" stroke-linecap="round"/></svg>
      <span><b>DR ARVEEN</b><small id="tagline"></small></span></a>
    <form class="msearch" id="msearch" role="search" action="search.html"><input id="mq" name="q" type="search" aria-label="Search DR ARVEEN"><button type="submit">Search</button></form>
    <div class="aud" role="group" aria-label="Audience"><a id="aud-pro" href="index.html">For healthcare professionals</a><a id="aud-pt" href="patients.html">For patients and caregivers</a></div>
    <select class="lang" id="lang" aria-label="Language"><option value="en">English</option><option value="ms">Bahasa Malaysia</option><option value="zh">中文</option><option value="ta">தமிழ்</option></select>
    <button class="theme-btn" id="theme" type="button" aria-label="Switch light or dark mode">☾ Dark</button>
  </div><nav class="mnav" id="nav" aria-label="Sections"></nav></div>`;
  $("#foot").innerHTML = `<div class="in"><p><b>DR ARVEEN</b> — Advanced Reference and Verified Evidence Network for Gynaecological Oncology.</p>
    <p>Educational reference only. It does not replace clinical assessment, an authorised prescription or your institution's protocols. Every clinical record is a seed record marked NOT VERIFIED. Always confirm against the original source.</p></div>`;
}
renderShell();
function renderNav() {
  const items = state.aud === "pro" ? NAV_PRO : NAV_PT;
  const map = { g: "guidelines", recs: "guidelines", d: "diseases", s: "staging", p: "protocols", dr: "drugs", t: "trials", l: "leaflets", ptd: "ptcancers" };
  const cur = map[PAGE] || PAGE;
  $("#nav").innerHTML = items.map(([r, t]) => `<a href="${url(r)}" ${r === cur ? 'aria-current="page"' : ""}>${t}</a>`).join("");
  $("#aud-pro").setAttribute("aria-pressed", state.aud === "pro");
  $("#aud-pt").setAttribute("aria-pressed", state.aud === "pt");
  $("#tagline").textContent = state.aud === "pro" ? "Evidence. Guidelines. Clinical Excellence." : "Understand Your Diagnosis. Navigate Your Care.";
  $("#mq").placeholder = state.aud === "pro" ? "Search a cancer, guideline, drug, trial or stage" : "Search for your cancer, treatment, test or question";
}
function setAud(a) { state.aud = a; store.set("aud", a); location.href = a === "pro" ? "index.html" : "patients.html"; }
const root = document.documentElement;
const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
function applyTheme(t) { if (t) root.dataset.theme = t; $("#theme").textContent = isDark() ? "☀ Light" : "☾ Dark"; }
applyTheme(store.get("theme", null));
$("#theme").onclick = () => { const t = isDark() ? "light" : "dark"; store.set("theme", t); applyTheme(t); };
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => applyTheme());
$("#lang").value = state.lang;
$("#lang").onchange = e => { state.lang = e.target.value; store.set("lang", state.lang); render(); };
function go(r) { if (r === "search") { location.href = "search.html?q=" + encodeURIComponent(state.q); return; } if (url(r) === url(PAGE)) render(); else location.href = url(r); }

/* ---------- bookmarks / recent / notes ---------- */
const bm = () => store.get("bm", []);
function bmBtn(type, id, title) {
  const on = bm().some(b => b.id === id);
  return `<button class="btn" data-bm='${esc(JSON.stringify({ type, id, title }))}' aria-pressed="${on}">${on ? "★ Saved" : "☆ Save"}</button>`;
}
function recent(type, id, title) {
  const r = store.get("recent", []).filter(x => x.id !== id); r.unshift({ type, id, title, at: new Date().toISOString().slice(0, 10) }); store.set("recent", r.slice(0, 12));
}
function noteBox(id) {
  const n = store.get("notes", {})[id] || "";
  return `<details class="calc"><summary><b>My private note</b> <span class="muted">(kept only in this browser)</span></summary><textarea id="note-${esc(id)}" data-note="${esc(id)}" aria-label="Private note">${esc(n)}</textarea></details>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-bm]"); if (!b) return;
  const it = JSON.parse(b.dataset.bm); let l = bm();
  l = l.some(x => x.id === it.id) ? l.filter(x => x.id !== it.id) : [...l, it];
  store.set("bm", l); const on = l.some(x => x.id === it.id);
  b.setAttribute("aria-pressed", on); b.textContent = on ? "★ Saved" : "☆ Save";
});
document.addEventListener("input", e => {
  const t = e.target.closest("[data-note]"); if (!t) return;
  const n = store.get("notes", {}); n[t.dataset.note] = t.value; store.set("notes", n);
});

/* ---------- search ---------- */
const SYN = { uterine: ["endometrial", "womb", "uterus"], endometrial: ["uterine", "womb"], womb: ["endometrial", "uterine"], ovary: ["ovarian"], ovarian: ["ovary", "tubal", "peritoneal"], cervix: ["cervical"], cervical: ["cervix"],
  chemo: ["chemotherapy", "carboplatin", "paclitaxel", "cisplatin"], carbo: ["carboplatin"], taxol: ["paclitaxel"], gtn: ["trophoblastic", "gtn"], molar: ["trophoblastic"], sln: ["sentinel"], sentinel: ["sln"],
  "pd-1": ["pembrolizumab", "dostarlimab", "immunotherapy"], immunotherapy: ["pembrolizumab", "dostarlimab", "pd-1"], parp: ["olaparib", "niraparib"], brca: ["brca1", "brca2", "olaparib"], brca1: ["brca"], brca2: ["brca"],
  mmr: ["msi", "mmrd", "dmmr"], dmmr: ["mmr"], radiotherapy: ["radiation", "brachytherapy", "chemoradiotherapy"], rt: ["radiotherapy"], hysterectomy: ["surgery"], staging: ["figo", "stage"], figo: ["staging", "stage"] };
function index() {
  const I = [];
  const add = (aud, type, id, route, title, text, meta, status, warn) => I.push({ aud, type, id, route, title, text: (title + " " + text).toLowerCase(), meta, status, warn });
  D.guidelines.forEach(g => add("pro", "Guideline", g.id, "g." + g.id, g.title, [orgs(g), dname(g.disease), g.domain.join(" "), g.summary, g.version].join(" "), `${orgs(g)} · ${g.version || "version not recorded"} · ${dname(g.disease)}`, g.status, g.superseded === "superseded" ? "Superseded guidance" : ""));
  D.recommendations.forEach(r => add("pro", "Recommendation", r.id, "g." + r.guideline, r.text, [r.stage, r.biomarker, r.setting, dname(r.disease)].join(" "), `${r.id} · ${dname(r.disease)} · ${r.stage}`, r.status));
  D.diseases.forEach(d => { add("pro", "Disease reference", d.id, "d." + d.id, d.name, d.short, "Disease page", "NOT VERIFIED"); add("pt", "Patient information", d.id, "ptd." + d.id, d.name, d.patient, "About this cancer", "DRAFT"); });
  D.staging.forEach(s => add("pro", "Staging system", s.id, "s." + s.id, `${s.name} (${s.authority} ${s.version})`, JSON.stringify(s.stages) + " " + s.notes + " " + dname(s.cancer), `${s.authority} ${s.version}`, "NOT VERIFIED", s.superseded ? "Superseded staging version" : ""));
  D.protocols.forEach(p => add("pro", "Treatment protocol", p.id, "p." + p.id, p.name, [p.indication, p.biomarker, p.modality, p.components.map(c => c.drug).join(" ")].join(" "), `${dname(p.disease)} · ${p.line}`, p.status));
  D.drugs.forEach(d => add("pro", "Drug monograph", d.id, "dr." + d.id, d.name, [d.cls, d.moa, d.ae].join(" "), d.cls, "NOT VERIFIED"));
  D.trials.forEach(t => add("pro", "Clinical trial", t.id, "t." + t.id, t.name, [t.reg, t.population, t.intervention, t.comparator, dname(t.disease)].join(" "), `${t.reg} · Phase ${t.phase}`, "NOT VERIFIED"));
  D.leaflets.forEach(l => add("pt", "Information leaflet", l.id, "l." + l.id, l.title, l.audience + " " + (l.sections || []).flat(2).join(" "), l.version, l.approval));
  D.glossary.forEach(([t, d]) => add("pt", "Glossary", t, "glossary", t, d, d, "DRAFT"));
  return I;
}
const IDX = index();
function search(q) {
  const terms = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!terms.length) return [];
  const phrase = q.toLowerCase().replace(/^"|"$/g, "");
  return IDX.map(it => {
    let score = 0;
    for (const t of terms) {
      const alts = [t, ...(SYN[t] || [])];
      const hit = alts.some(a => it.text.includes(a));
      if (!hit) return null;
      score += it.title.toLowerCase().includes(t) ? 3 : 1;
    }
    if (it.text.includes(phrase)) score += 2;
    return { ...it, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}
function resultRow(r) {
  return `<a class="row" href="${url(`${r.route}`)}"><span class="row-t">${esc(r.title)} ${statusPill(r.status)} ${r.warn ? `<span class="pill bad">${esc(r.warn)}</span>` : ""}</span>
    <span class="row-m"><span class="eyebrow">${esc(r.type)}</span><span>${esc(r.meta)}</span></span></a>`;
}

/* ---------- shared bits ---------- */
const seedBanner = () => `<p class="banner">Prototype seed content. Every clinical record is <b>NOT VERIFIED</b>. Doses, numerical trial results and recommendation grades are not entered until a named reviewer verifies them against the source.</p>`;
const transBanner = () => state.lang === "en" ? "" : `<p class="banner info">Translation not yet available. English is shown. Any translation must pass qualified language and clinical review before it is labelled approved.</p>`;

/* ---------- views: professional ---------- */
const V = {};
V.home = () => `
  <section class="hero">
    <span class="eyebrow">Gynaecological oncology reference · Malaysia</span>
    <h1>DR ARVEEN — Evidence-Based Gynaecological Oncology.</h1>
    <p>Find clinical guidelines, staging criteria, treatment protocols, clinical trial evidence, and patient education resources in one integrated platform.</p>
    <form class="bigsearch" id="hs"><input id="hq" type="search" aria-label="Search" placeholder="Search a cancer, guideline, treatment, biomarker, drug, or clinical question."><button>Search</button></form>
    <div class="chips">${["Ovarian cancer", "FIGO 2023 endometrial staging", "Recurrent cervical cancer", "Carboplatin and paclitaxel", "Sentinel lymph node", "BRCA1 and BRCA2", "Endometrial molecular classification"].map(s => `<button class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>
  </section>
  ${seedBanner()}
  <section class="section"><div class="section-h"><h2>Browse by disease</h2><a href="${url(`diseases`)}">All diseases</a></div>
    <div class="grid">${D.diseases.map(d => `<a class="tile" href="${url(`d.${d.id}`)}"><b>${esc(d.name)}</b><span>${esc(d.short)}</span></a>`).join("")}</div></section>
  <section class="section"><h2>Browse by resource</h2>
    <div class="grid">${[["guidelines", "Clinical guidelines", D.guidelines.length + " records"], ["staging", "Staging systems", D.staging.length + " systems"], ["protocols", "Treatment protocols", D.protocols.length + " regimens"], ["algorithms", "Clinical algorithms", D.algorithms.length + " pathway"], ["drugs", "Drug monographs", D.drugs.length + " drugs"], ["trials", "Clinical trials", D.trials.length + " trials"], ["compare", "Guideline comparisons", "By clinical question"], ["calculators", "Calculators", "BSA, BMI, renal function, Calvert"], ["education", "Educational resources", "Staging exercises"], ["updates", "Recent updates", D.updates.length + " surveillance items"]].map(([r, t, s]) => `<a class="tile" href="${url(`${r}`)}"><b>${t}</b><span>${s}</span></a>`).join("")}</div></section>
  <section class="section"><div class="section-h"><h2>Recent updates</h2><a href="${url(`updates`)}">All updates</a></div>${updatesTable(D.updates.slice(0, 3))}</section>
  <section class="section"><a class="tile" href="${url(`pt`)}" style="padding:20px"><span class="eyebrow">For patients and caregivers</span><b style="font-size:1.3rem">DR ARVEEN Patient Education Centre</b><span>Clear, reliable information to help patients understand their diagnosis, prepare for treatment, manage side effects, and navigate life during and after gynaecological cancer.</span></a></section>`;

function updatesTable(list) {
  return `<div class="tablewrap"><table><thead><tr><th>Update</th><th>Organisation</th><th>Version change</th><th>Issuer publication date</th><th>Detected</th><th>ARVEEN verification</th><th>State</th></tr></thead><tbody>
  ${list.map(u => `<tr><td>${u.target ? `<a href="${url(`${u.target.startsWith("G-") ? "g." : "s."}${u.target}`)}">${esc(u.title)}</a>` : esc(u.title)}<div class="muted" style="font-size:.8rem">${esc(u.summary)}</div></td><td>${esc(u.org)}</td><td class="mono">${na(u.prev)} → ${na(u.next)}</td><td>${na(u.pubDate)}</td><td>${na(u.detected)}</td><td>${u.verifiedOn ? esc(u.verifiedOn) : '<span class="na">Not yet verified</span>'}</td><td>${statusPill(u.state)}</td></tr>`).join("")}
  </tbody></table></div>`;
}

V.guidelines = () => {
  const f = state.filters;
  const opts = (k, vals) => `<option value="">All</option>` + vals.map(v => `<option ${f[k] === v ? "selected" : ""} value="${esc(v)}">${esc(v)}</option>`).join("");
  const orgList = [...new Set(D.guidelines.flatMap(g => g.org))];
  const years = [...new Set(D.guidelines.map(g => g.pubDate).filter(Boolean))].sort().reverse();
  const domains = [...new Set(D.guidelines.flatMap(g => g.domain))].sort();
  const list = D.guidelines.filter(g => (!f.disease || dname(g.disease) === f.disease) && (!f.org || g.org.includes(f.org)) && (!f.year || g.pubDate === f.year) && (!f.domain || g.domain.includes(f.domain)) && (!f.cur || (f.cur === "Active" ? g.superseded === "active" : f.cur === "Superseded" ? g.superseded === "superseded" : g.superseded === "uncertain")));
  return `<div class="section-h"><div><span class="eyebrow">Repository</span><h1>Clinical guidelines</h1></div><div class="toc"><a class="btn" aria-pressed="true" href="${url(`guidelines`)}">Guidelines</a><a class="btn" href="${url(`recs`)}">Recommendations (${D.recommendations.length})</a></div></div>
  ${seedBanner()}
  <div class="layout"><aside class="filters" id="gf">
    <label>Disease<select data-f="disease">${opts("disease", D.diseases.map(d => d.name))}</select></label>
    <label>Organisation<select data-f="org">${opts("org", orgList)}</select></label>
    <label>Publication year<select data-f="year">${opts("year", years)}</select></label>
    <label>Clinical domain<select data-f="domain">${opts("domain", domains)}</select></label>
    <label>Currency<select data-f="cur">${opts("cur", ["Active", "Superseded", "Uncertain"])}</select></label>
    <label>Verification status<select disabled><option>All records: NOT VERIFIED</option></select></label>
    <button class="btn" id="clearf" type="button">Clear filters</button>
  </aside>
  <div class="section"><p class="muted">${list.length} of ${D.guidelines.length} records. Original grading frameworks are kept as published; ARVEEN does not map them onto a common scale.</p>
  <div class="list">${list.map(g => `<a class="row" href="${url(`g.${g.id}`)}"><span class="row-t">${esc(g.title)}</span>
    <span class="row-m"><span>${esc(orgs(g))}</span><span>${dname(g.disease)}</span><span>${g.pubDate ? esc(g.pubDate) : "Date not recorded"}</span><span class="mono">${esc(g.id)}</span></span>
    <span class="row-m">${supPill(g)} ${statusPill(g.status)} ${myLabel(g.malaysia)}</span></a>`).join("") || `<div class="row muted">No guidelines match these filters.</div>`}</div></div></div>`;
};
function bindFilters() {
  app.querySelectorAll("[data-f]").forEach(s => s.onchange = () => { state.filters[s.dataset.f] = s.value; render(); });
  const c = $("#clearf"); if (c) c.onclick = () => { state.filters = {}; render(); };
}

V.recs = () => `<div class="section-h"><div><span class="eyebrow">Recommendation-level database</span><h1>Recommendations</h1></div><div class="toc"><a class="btn" href="${url(`guidelines`)}">Guidelines</a><a class="btn" aria-pressed="true" href="${url(`recs`)}">Recommendations</a></div></div>
  ${seedBanner()}<p class="banner info">Recommendation text below is an <b>ARVEEN paraphrase</b>, not a quotation. Grades and strengths are blank until transcribed from the source in its original framework.</p>
  ${recTable(D.recommendations)}`;
function recTable(recs) {
  return `<div class="tablewrap"><table><thead><tr><th>ID</th><th>Recommendation</th><th>Context</th><th>Original grade / strength</th><th>Malaysia</th><th>Links</th></tr></thead><tbody>
  ${recs.map(r => { const g = byId(D.guidelines, r.guideline); return `<tr><td class="mono">${r.id}</td><td>${esc(r.text)}<div class="muted" style="font-size:.78rem">${esc(r.textType)} · ${statusPill(r.status)}</div></td>
    <td style="font-size:.82rem">${dname(r.disease)}<br>${esc(r.stage)}<br>${esc(r.setting)} · ${esc(r.intent)}<br>Biomarker: ${esc(r.biomarker)}</td>
    <td><span class="na">${esc(r.grade)}</span><br><span class="na">${esc(r.strength)}</span></td><td>${myLabel(r.malaysia)}</td>
    <td style="font-size:.82rem"><a href="${url(`g.${g.id}`)}">${esc(orgs(g))} ${esc(g.version || "")}</a><br>${r.trials.map(t => `<a href="${url(`t.${t}`)}">${esc(byId(D.trials, t)?.name)}</a>`).join(", ")}${r.protocols.map(p => `<br><a href="${url(`p.${p}`)}">${p}</a>`).join("")}</td></tr>` }).join("")}
  </tbody></table></div>`;
}

V.g = id => {
  const g = byId(D.guidelines, id); if (!g) return notFound();
  recent("Guideline", g.id, g.title);
  const recs = D.recommendations.filter(r => r.guideline === g.id);
  const sup = g.supersededBy ? byId(D.guidelines, g.supersededBy) : null;
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Guideline · ${esc(g.type)}</span><h1>${esc(g.title)}</h1>
    <div class="row-m">${supPill(g)} ${statusPill(g.status)} ${myLabel(g.malaysia)}</div>
    <div class="actions">${bmBtn("Guideline", g.id, g.title)}<a class="btn" href="${esc(g.sourceUrl)}" target="_blank" rel="noopener">Issuing organisation ↗</a></div></div>
  ${g.superseded === "superseded" ? `<p class="banner bad">This guideline is superseded${sup ? ` by <a href="${url(`g.${sup.id}`)}">${esc(sup.title)}</a>` : ""}. It is kept for version history and must not be used as current guidance.</p>` : ""}
  ${g.superseded === "uncertain" ? `<p class="banner">Currency uncertain: a newer edition may exist. Check the issuing organisation before relying on this record.</p>` : ""}
  <section class="section"><h2>Record</h2><div class="kv">
    ${[["Guideline ID", `<span class="mono">${g.id}</span>`], ["Organisation", esc(orgs(g))], ["Disease", dname(g.disease)], ["Clinical domain", na(g.domain)], ["Document type", na(g.type)], ["Publication date (issuer)", na(g.pubDate)], ["Version", na(g.version)], ["Revision date", na(g.revisionDate)], ["Jurisdiction", na(g.jurisdiction)], ["Patient population", na(g.population)], ["Clinical setting", na(g.setting)], ["Source", `<a href="${esc(g.sourceUrl)}" target="_blank" rel="noopener">${esc(g.sourceUrl)}</a> <span class="muted">(organisation index; record-level link pending)</span>`], ["Full-text access", na(g.access)], ["Evidence-grading framework", na(g.evidenceFramework)], ["Recommendation-grading framework", na(g.recFramework)], ["ARVEEN verification date", g.verifiedOn ? esc(g.verifiedOn) : '<span class="na">Not yet verified</span>'], ["Reviewer", g.reviewer ? esc(g.reviewer) : '<span class="na">Unassigned</span>'], ["Content status", statusPill(g.status)]].map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}
  </div></section>
  <section class="section"><h2>Executive summary</h2><p class="prose"><span class="pill teal">ARVEEN educational summary</span> ${esc(g.summary)}</p></section>
  <section class="section"><h2>Recommendations</h2>${recs.length ? recTable(recs) : `<p class="muted">No recommendations have been extracted from this guideline yet.</p>`}</section>
  <section class="section"><h2>Malaysian applicability</h2><p class="prose">${myLabel(g.malaysia)} No Malaysian MOH guidance, NPRA registration or local availability data has been linked to this record.</p></section>
  <section class="section"><h2>Important limitations</h2><p class="prose">${esc(g.limitations)}</p></section>
  <section class="section"><h2>Version history</h2>${g.history.length ? `<div class="list">${g.history.map(h => `<div class="row"><span class="row-t mono">${esc(h.v)}</span><span class="row-m">${esc(h.note)}</span></div>`).join("")}</div>` : `<p class="muted">No versions recorded.</p>`}</section>
  ${noteBox(g.id)}</article>`;
};

V.diseases = () => `<span class="eyebrow">Disease reference library</span><h1>Diseases</h1>
  <div class="grid">${D.diseases.map(d => `<a class="tile" href="${url(`d.${d.id}`)}"><b>${esc(d.name)}</b><span>${esc(d.short)}</span></a>`).join("")}</div>`;
const DTEMPLATE = ["Definition and epidemiology", "Risk factors and hereditary predisposition", "Histological classification", "Molecular classification and biomarkers", "Clinical presentation", "Diagnostic pathway", "Imaging and pathology", "Staging", "Risk stratification", "Treatment intent", "Management by stage and subtype", "Surgery", "Radiotherapy", "Systemic therapy", "Recurrent and metastatic disease", "Follow-up", "Survivorship", "Pivotal trials", "Current guideline references", "Malaysian applicability", "Clinical pearls", "Case-based learning", "Examination questions", "Patient education links"];
V.d = id => {
  const d = disease(id); if (!d) return notFound();
  recent("Disease", d.id, d.name);
  const mode = store.get("dmode", "quick");
  const gl = D.guidelines.filter(g => g.disease === id || (["tubal", "peritoneal"].includes(id) && g.disease === "ovarian"));
  const st = D.staging.filter(s => s.cancer === id || (["tubal", "peritoneal"].includes(id) && s.cancer === "ovarian"));
  const tr = D.trials.filter(t => t.disease === id);
  const pr = D.protocols.filter(p => p.disease === id);
  const linked = {
    "Staging": st.map(s => `<a href="${url(`s.${s.id}`)}">${esc(s.authority)} ${esc(s.version)} — ${esc(s.name)}</a>${s.superseded ? ' <span class="pill bad">Superseded</span>' : ""}`),
    "Pivotal trials": tr.map(t => `<a href="${url(`t.${t.id}`)}">${esc(t.name)}</a> — ${esc(t.intervention)} vs ${esc(t.comparator)}`),
    "Current guideline references": gl.map(g => `<a href="${url(`g.${g.id}`)}">${esc(orgs(g))} ${esc(g.version || "")}</a> ${supPill(g)}`),
    "Systemic therapy": pr.map(p => `<a href="${url(`p.${p.id}`)}">${esc(p.name)}</a> — ${esc(p.indication)}`),
    "Malaysian applicability": [MY["intl-not-verified"][0] + " for all linked recommendations."],
    "Patient education links": [`<a href="${url(`ptd.${d.id}`)}">Patient page: ${esc(d.name)}</a>`, ...D.leaflets.filter(l => l.disease === id).map(l => `<a href="${url(`l.${l.id}`)}">${esc(l.title)}</a>`)]
  };
  const quick = ["Staging", "Systemic therapy", "Pivotal trials", "Current guideline references", "Malaysian applicability", "Patient education links"];
  const secs = mode === "quick" ? quick : DTEMPLATE;
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Disease reference</span><h1>${esc(d.name)}</h1><p class="prose muted">${esc(d.short)}</p>
    <div class="actions"><button class="btn" data-mode="quick" aria-pressed="${mode === "quick"}">Quick reference</button><button class="btn" data-mode="comp" aria-pressed="${mode !== "quick"}">Comprehensive reference</button>${bmBtn("Disease", d.id, d.name)}</div></div>
  ${mode !== "quick" ? `<p class="banner info">Comprehensive reference uses the standard 24-section template. Sections without authored, source-linked content say so instead of showing unverified text.</p>` : ""}
  <div class="list">${secs.map((s, i) => `<div class="row"><span class="row-t">${mode !== "quick" ? `<span class="mono muted">${String(DTEMPLATE.indexOf(s) + 1).padStart(2, "0")}</span>` : ""} ${s}</span>
    ${linked[s]?.length ? `<div style="display:grid;gap:4px;font-size:.9rem">${linked[s].map(x => `<span>${x}</span>`).join("")}</div>` : `<span class="na" style="font-size:.86rem">Content not yet authored. Requires source-linked authoring and clinical review.</span>`}</div>`).join("")}</div>
  ${noteBox("d-" + d.id)}</article>`;
};

V.staging = () => `<span class="eyebrow">Staging module</span><h1>Staging systems</h1>
  <p class="banner info">Definitions are <b>ARVEEN educational paraphrases</b> of the FIGO criteria, not the published text, and are NOT VERIFIED. Formal staging is kept separate from treatment recommendations. Do not mix criteria between versions.</p>
  <div class="list">${D.staging.map(s => `<a class="row" href="${url(`s.${s.id}`)}"><span class="row-t">${esc(s.name)} <span class="mono">${esc(s.authority)} ${esc(s.version)}</span> ${s.superseded ? '<span class="pill bad">Superseded</span>' : '<span class="pill ok">Current per seed</span>'} ${statusPill("NOT VERIFIED")}</span><span class="row-m">${dname(s.cancer)} · ${s.stages.length ? s.stages.length + " main stages" : "criteria not entered"}</span></a>`).join("")}</div>
  <p><a class="btn" href="${url(`education`)}">Practise with staging exercises →</a></p>`;
function stageTree(list) {
  return list.map(x => x.sub ? `<details class="stage" open><summary><span class="code">${esc(x.s)}</span><span>${esc(x.d)}</span></summary><div class="kids">${stageTree(x.sub)}</div></details>`
    : `<div class="stage leaf"><summary><span class="code">${esc(x.s)}</span><span>${esc(x.d)}</span></summary></div>`).join("");
}
V.s = id => {
  const s = byId(D.staging, id); if (!s) return notFound();
  recent("Staging", s.id, `${s.authority} ${s.version} ${dname(s.cancer)}`);
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Staging · ${dname(s.cancer)}</span><h1>${esc(s.name)}</h1>
    <div class="row-m"><span class="mono">${esc(s.authority)} · version ${esc(s.version)}</span> ${statusPill("NOT VERIFIED")} <span class="pill teal">ARVEEN educational paraphrase</span></div>
    <div class="actions">${bmBtn("Staging", s.id, s.name + " " + s.version)}<input type="text" id="sfilter" placeholder="Filter stages, e.g. IIIC or node" aria-label="Filter stages" style="max-width:280px"></div></div>
  ${s.superseded ? `<p class="banner bad">Superseded by <a href="${url(`s.${s.supersededBy}`)}">${esc(byId(D.staging, s.supersededBy).name)} ${esc(byId(D.staging, s.supersededBy).version)}</a>. Use only to interpret older reports.</p>` : ""}
  <p class="prose">${esc(s.notes)}</p>
  ${s.stages.length ? `<div class="list" id="stree">${stageTree(s.stages)}</div>` : `<p class="muted">Criteria not entered.</p>`}
  <p class="muted" style="font-size:.84rem">Source: ${esc(s.authority)} ${esc(s.version)} staging publication (citation to be recorded by reviewer). Any staging assignment requires clinician verification.</p></article>`;
};

V.protocols = () => `<span class="eyebrow">Treatment protocol library</span><h1>Treatment protocols</h1>
  <p class="banner bad"><b>No doses are shown.</b> Doses and schedules are published only after verification against an authoritative protocol source and the required clinical approval. A trial publication alone is not treated as a prescribing protocol.</p>
  <div class="list">${D.protocols.map(p => `<a class="row" href="${url(`p.${p.id}`)}"><span class="row-t">${esc(p.name)} ${statusPill(p.status)} ${p.labels.map(l => `<span class="pill bad">${esc(l)}</span>`).join("")}</span>
    <span class="row-m"><span>${dname(p.disease)}</span><span>${esc(p.line)}</span><span>${esc(p.modality)}</span><span>Biomarker: ${esc(p.biomarker)}</span></span></a>`).join("")}</div>`;
V.p = id => {
  const p = byId(D.protocols, id); if (!p) return notFound();
  recent("Protocol", p.id, p.name);
  const W = `<span class="withheld">withheld · not verified</span>`;
  const fields = [["Regimen", esc(p.name)], ["Clinical indication", esc(p.indication)], ["Disease and histology", `${dname(p.disease)} · ${esc(p.histology)}`], ["Stage", na(p.stage)], ["Treatment intent", na(p.intent)], ["Treatment line", na(p.line)], ["Eligibility", W], ["Biomarker requirements", na(p.biomarker)], ["Cycle length", na(p.cycle)], ["Treatment duration", na(p.duration)], ["Premedication", W], ["Supportive medications", W], ["Baseline investigations", W], ["Monitoring", W], ["Renal adjustments", W], ["Hepatic adjustments", W], ["Haematological criteria", W], ["Dose modifications", W], ["Contraindications", W], ["Important interactions", W], ["Toxicity management", W], ["Interruption / restart criteria", W], ["Source protocol", esc(p.sourceType)], ["Version", '<span class="na">Not recorded</span>'], ["Verification status", statusPill(p.status)], ["Malaysian applicability", myLabel(p.malaysia)]];
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Treatment protocol · ${esc(p.modality)}</span><h1>${esc(p.name)}</h1><div class="row-m">${statusPill(p.status)} ${myLabel(p.malaysia)} ${p.labels.map(l => `<span class="pill bad">${esc(l)}</span>`).join("")}</div><div class="actions">${bmBtn("Protocol", p.id, p.name)}</div></div>
  <p class="banner bad">Not for prescribing. This record has no verified source protocol. Dose fields stay empty until a reviewer enters them from an authoritative source and clinical approval is recorded.</p>
  <section class="section"><h2>Regimen components</h2><div class="tablewrap"><table><thead><tr><th>Drug</th><th>Calculation basis</th><th>Dose</th><th>Route</th><th>Schedule</th></tr></thead><tbody>
    ${p.components.map(c => `<tr><td><a href="${url(`dr.${c.drug}`)}">${esc(byId(D.drugs, c.drug)?.name || c.drug)}</a></td><td>${esc(c.basis)}</td><td>${W}</td><td>${esc(c.route)}</td><td>${c.schedule ? esc(c.schedule) : W}</td></tr>`).join("")}</tbody></table></div></section>
  <section class="section"><h2>Protocol fields</h2><div class="kv">${fields.map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}</div></section>
  ${noteBox(p.id)}</article>`;
};

V.drugs = () => `<span class="eyebrow">Oncology drug reference</span><h1>Drug monographs</h1>
  <p class="banner info">Monographs are <b>ARVEEN educational summaries</b>, not official product information. Malaysian (NPRA) registration is not verified for any drug.</p>
  <div class="list">${D.drugs.map(d => `<a class="row" href="${url(`dr.${d.id}`)}"><span class="row-t">${esc(d.name)} ${statusPill("NOT VERIFIED")}</span><span class="row-m"><span>${esc(d.cls)}</span><span>${d.cancers.map(dname).join(", ")}</span></span></a>`).join("")}</div>`;
V.dr = id => {
  const d = byId(D.drugs, id); if (!d) return notFound();
  recent("Drug", d.id, d.name);
  const W = `<span class="withheld">not entered · verify against product information</span>`;
  const pr = D.protocols.filter(p => p.components.some(c => c.drug === id));
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Drug monograph</span><h1>${esc(d.name)}</h1><div class="row-m"><span class="pill teal">ARVEEN educational summary</span> ${statusPill("NOT VERIFIED")} ${myLabel("regulatory")}</div><div class="actions">${bmBtn("Drug", d.id, d.name)}</div></div>
  <div class="kv">${[["Generic name", esc(d.name)], ["Drug class", esc(d.cls)], ["Mechanism of action", esc(d.moa)], ["Cancer types", d.cancers.map(c => `<a href="${url(`d.${c}`)}">${dname(c)}</a>`).join(", ")], ["Major adverse effects", esc(d.ae)], ["Renal considerations", esc(d.renal)], ["Dose by indication", W], ["Administration", W], ["Contraindications", W], ["Drug interactions", W], ["Hepatic considerations", W], ["Pregnancy and breastfeeding", W], ["Fertility considerations", W], ["Monitoring", W], ["Dose modifications", W], ["Patient counselling", W], ["Product information", '<span class="na">Not linked</span>'], ["Malaysian regulatory status (NPRA)", `<span class="pill warn">${esc(d.npra)}</span>`], ["Used in ARVEEN protocols", pr.map(p => `<a href="${url(`p.${p.id}`)}">${esc(p.name)}</a>`).join("<br>") || na(null)]].map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}</div>
  ${noteBox(d.id)}</article>`;
};

V.trials = () => {
  const f = state.filters.trialDisease || "";
  const list = D.trials.filter(t => !f || t.disease === f);
  return `<span class="eyebrow">Clinical trials and evidence</span><h1>Clinical trials</h1>
  <p class="banner">Numerical outcomes (hazard ratios, medians, response rates) are <b>not entered</b> until verified against the full publication. Registry IDs and citations are seed values awaiting verification.</p>
  <div class="chips"><button class="chip" data-td="" aria-pressed="${!f}">All</button>${[...new Set(D.trials.map(t => t.disease))].map(d => `<button class="chip" data-td="${d}" aria-pressed="${f === d}">${dname(d)}</button>`).join("")}</div>
  <div class="tablewrap"><table><thead><tr><th>Trial</th><th>Registration</th><th>Phase / design</th><th>Intervention vs comparator</th><th>Primary endpoint</th><th>Report type</th></tr></thead><tbody>
  ${list.map(t => `<tr><td><a href="${url(`t.${t.id}`)}"><b>${esc(t.name)}</b></a><div class="muted" style="font-size:.78rem">${dname(t.disease)}</div></td><td class="mono">${esc(t.reg)}</td><td>${esc(t.phase)}<div class="muted" style="font-size:.78rem">${esc(t.design)}</div></td><td>${esc(t.intervention)}<div class="muted">vs ${esc(t.comparator)}</div></td><td>${esc(t.primary)}</td><td>${esc(t.pubType)}</td></tr>`).join("")}
  </tbody></table></div>`;
};
V.t = id => {
  const t = byId(D.trials, id); if (!t) return notFound();
  recent("Trial", t.id, t.name);
  const N = `<span class="withheld">not entered · pending verification</span>`;
  const recs = D.recommendations.filter(r => r.trials.includes(id));
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Clinical trial · ${dname(t.disease)}</span><h1>${esc(t.name)}</h1><div class="row-m"><span class="mono">${esc(t.reg)}</span> ${statusPill("NOT VERIFIED")}</div><div class="actions">${bmBtn("Trial", t.id, t.name)}${/^NCT\d{8}$/.test(t.reg) ? `<a class="btn" target="_blank" rel="noopener" href="https://clinicaltrials.gov/study/${t.reg}">Registry record ↗</a>` : ""}</div></div>
  <div class="kv">${[["Study design", esc(t.design)], ["Phase", esc(t.phase)], ["Population", esc(t.population)], ["Intervention", esc(t.intervention)], ["Comparator", esc(t.comparator)], ["Primary endpoint", esc(t.primary)], ["Secondary endpoints", N], ["Overall survival", N], ["Progression-free survival", N], ["Major adverse events", N], ["Follow-up", N], ["Limitations", N], ["Publication", esc(t.pub)], ["Report type", esc(t.pubType)], ["Cited by ARVEEN recommendations", recs.map(r => `<a href="${url(`g.${r.guideline}`)}">${r.id}</a>`).join(", ") || na(null)]].map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}</div>
  <section class="section"><h2>Evidence appraisal</h2><p class="prose na">Not yet written. An appraisal will cover the studied population, comparator, principal outcomes, limitations and applicability, without overstating subgroup or exploratory findings.</p></section>
  ${noteBox(t.id)}</article>`;
};

let algoPath = [];
V.algorithms = () => {
  const a = D.algorithms[0];
  if (!algoPath.length) algoPath = ["start"];
  const steps = algoPath.map((k, i) => {
    const n = a.nodes[k]; const last = i === algoPath.length - 1;
    if (n.end) return `<div class="step end ${n.kind}"><span class="eyebrow">${n.kind === "missing" ? "Missing information" : n.kind === "escalate" ? "Referral / escalation" : n.kind === "action" ? "Required investigation" : "Outcome"}</span><p>${esc(n.end)}</p></div>`;
    const chosen = algoPath[i + 1];
    return `<div class="step ${last ? "" : "past"}"><p><b>${esc(n.q)}</b></p><div class="opts">${n.options.map(([t, to]) => `<button class="btn" data-step="${i}" data-to="${to}" aria-pressed="${chosen === to}">${esc(t)}</button>`).join("")}</div></div>`;
  }).join("");
  return `<span class="eyebrow">Clinical algorithms</span><h1>${esc(a.title)}</h1>
  <div class="row-m">${statusPill(a.status)} <span>Source: <a href="${url(`g.${a.source}`)}">${esc(a.source)}</a> (version Update 2023, not verified)</span><span>Verification date: <span class="na">Not yet verified</span></span></div>
  <p class="banner info">Educational pathway. Where information is missing it says so instead of forcing a conclusion. It does not select treatment.</p>
  <p class="prose"><b>Entry criteria:</b> ${esc(a.entry)}</p>
  <div class="algo">${steps}<div><button class="btn" id="algoreset">Start again</button></div></div>
  <p class="muted">Further pathways planned: suspected ovarian malignancy, suspected endometrial malignancy, endometrial risk stratification, suspected recurrence, biomarker-directed selection.</p>`;
};

V.calculators = () => `<span class="eyebrow">Calculator library</span><h1>Calculators</h1>
  <p class="banner bad">Calculation support only. Results are not a prescription. Rounding, capping and the choice of renal-function estimate follow your institution's protocol, which this tool does not apply.</p>
  <div class="calcs">
    ${calcCard("bsa", "Body surface area", [["h", "Height (cm)", 100, 230], ["w", "Weight (kg)", 25, 250]], "Mosteller: √(height cm × weight kg / 3600). Du Bois: 0.007184 × W^0.425 × H^0.725.", "Adults. Some protocols cap BSA or use adjusted weight; not applied here.")}
    ${calcCard("bmi", "Body mass index", [["h", "Height (cm)", 100, 230], ["w", "Weight (kg)", 25, 250]], "Weight (kg) / height (m)². WHO adult categories; Asian populations may use lower action thresholds.", "Adults only. Does not reflect body composition.")}
    ${calcCard("crcl", "Creatinine clearance (Cockcroft–Gault)", [["age", "Age (years)", 18, 110], ["w", "Weight (kg)", 25, 250], ["cr", "Serum creatinine (µmol/L)", 20, 1500], ["sex", "Sex", null, null, ["female", "male"]]], "((140 − age) × weight × K) / creatinine (µmol/L); K = 1.04 female, 1.23 male.", "Unreliable with unstable renal function, extremes of body weight or low muscle mass. The weight used (actual, ideal, adjusted) varies by protocol.")}
    ${calcCard("egfr", "eGFR (CKD-EPI 2021, race-free)", [["age", "Age (years)", 18, 110], ["cr", "Serum creatinine (µmol/L)", 20, 1500], ["sex", "Sex", null, null, ["female", "male"]]], "142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^age × 1.012 if female. κ 0.7 F / 0.9 M; α −0.241 F / −0.302 M. Scr in mg/dL (µmol/L ÷ 88.4).", "Indexed to 1.73 m². Do not substitute into the Calvert formula without de-indexing per protocol.")}
    ${calcCard("calvert", "Carboplatin dose support (Calvert)", [["auc", "Target AUC (mg/mL·min)", 1, 8], ["gfr", "GFR (mL/min)", 5, 200]], "Dose (mg) = target AUC × (GFR + 25).", "Target AUC comes from the verified protocol only. Many protocols cap GFR (for example at 125 mL/min); no cap is applied here.")}
  </div>`;
function calcCard(id, title, fields, formula, limits) {
  return `<form class="calc" data-calc="${id}"><h3>${title}</h3><div class="fields">${fields.map(([k, l, mn, mx, opts]) => opts
    ? `<label for="${id}-${k}">${l}<select id="${id}-${k}" name="${k}">${opts.map(o => `<option>${o}</option>`).join("")}</select></label>`
    : `<label for="${id}-${k}">${l}<input id="${id}-${k}" name="${k}" type="number" step="any" min="${mn}" max="${mx}" inputmode="decimal"></label>`).join("")}</div>
    <div class="result" id="${id}-out" aria-live="polite">Enter values</div>
    <details><summary>Formula, population and limitations</summary><p><b>Formula:</b> ${esc(formula)}</p><p><b>Limitations:</b> ${esc(limits)}</p><p><b>Testing status:</b> unit-tested formula; not clinically validated in this build.</p></details></form>`;
}
const CALC = {
  bsa: v => { const m = Math.sqrt(v.h * v.w / 3600), d = 0.007184 * Math.pow(v.w, .425) * Math.pow(v.h, .725); return `Mosteller ${m.toFixed(2)} m² · Du Bois ${d.toFixed(2)} m²`; },
  bmi: v => { const b = v.w / Math.pow(v.h / 100, 2); return `${b.toFixed(1)} kg/m²`; },
  crcl: v => { const k = v.sex === "female" ? 1.04 : 1.23; return `${((140 - v.age) * v.w * k / v.cr).toFixed(0)} mL/min`; },
  egfr: v => { const f = v.sex === "female", s = v.cr / 88.4, k = f ? .7 : .9, a = f ? -.241 : -.302; const e = 142 * Math.pow(Math.min(s / k, 1), a) * Math.pow(Math.max(s / k, 1), -1.2) * Math.pow(.9938, v.age) * (f ? 1.012 : 1); return `${e.toFixed(0)} mL/min/1.73 m²`; },
  calvert: v => `${(v.auc * (v.gfr + 25)).toFixed(0)} mg (unrounded, uncapped)`
};
function bindCalcs() {
  app.querySelectorAll("[data-calc]").forEach(f => {
    f.onsubmit = e => e.preventDefault();
    f.oninput = () => {
      const id = f.dataset.calc, out = $("#" + id + "-out"), v = {}; let err = "";
      f.querySelectorAll("input,select").forEach(i => {
        if (i.tagName === "SELECT") { v[i.name] = i.value; return; }
        if (i.value === "") { err = err || "Enter all values."; return; }
        const n = Number(i.value);
        if (!isFinite(n) || n < +i.min || n > +i.max) err = `${i.labels[0].firstChild.textContent.trim()} must be between ${i.min} and ${i.max}.`;
        v[i.name] = n;
      });
      out.className = "result" + (err && err !== "Enter all values." ? " err" : "");
      out.textContent = err || CALC[id](v);
    };
  });
}

V.compare = () => {
  const qs = [...new Set(D.recommendations.map(r => `${dname(r.disease)} — ${r.setting}`))];
  const sel = state.filters.cmp || qs[0];
  const recs = D.recommendations.filter(r => `${dname(r.disease)} — ${r.setting}` === sel);
  return `<span class="eyebrow">Evidence and research</span><h1>Guideline comparison</h1>
  <p class="prose muted">Compare recommendations on the same clinical question. Original grades, dates and context are kept. The newest guideline is not assumed to be the most appropriate for Malaysia.</p>
  <label style="display:grid;gap:4px;max-width:480px;font-weight:600;font-size:.84rem" for="cmpq">Clinical question<select id="cmpq">${qs.map(q => `<option ${q === sel ? "selected" : ""}>${esc(q)}</option>`).join("")}</select></label>
  <div class="tablewrap"><table><thead><tr><th>Clinical question</th>${recs.map(r => `<th>${esc(orgs(byId(D.guidelines, r.guideline)))} ${esc(byId(D.guidelines, r.guideline).version || "")}</th>`).join("")}<th>Malaysian guidance</th><th>Interpretation</th></tr></thead>
  <tbody><tr><td>${esc(sel)}</td>${recs.map(r => `<td>${esc(r.text)}<div class="muted" style="font-size:.78rem">Grade: ${esc(r.grade)} · ${esc(r.textType)}</div></td>`).join("")}<td><span class="na">No Malaysian guidance recorded</span></td><td><span class="na">Not written. Requires a reviewer once a second source is extracted for this question.</span></td></tr></tbody></table></div>
  <p class="muted" style="font-size:.84rem">Only one guideline has been extracted per question in the seed data, so no differences can be shown yet.</p>`;
};

V.updates = () => `<span class="eyebrow">Guideline update intelligence</span><h1>Guideline updates</h1>
  <p class="prose muted">The issuing organisation's publication date is shown separately from the date ARVEEN detected and verified the change. Detected changes do not alter approved content until a reviewer decides.</p>
  ${updatesTable(D.updates)}
  <section class="section"><h2>Linked content flagged for review</h2><div class="list">${D.updates.map(u => `<div class="row"><span class="row-t">${esc(u.title)} ${statusPill(u.state)}</span><span class="row-m">${u.affected.map(a => `<span>${esc(a)}</span>`).join("")}</span><span class="row-m">Reviewer: <span class="na">Unassigned</span> · Decision: <span class="na">Pending</span> · Clinical significance: ${esc(u.significance)}</span></div>`).join("")}</div></section>
  <section class="section"><h2>Subscribe to updates</h2><p class="muted">Subscriptions need an account and are not active in this prototype. Chosen topics are remembered in this browser only.</p>
  <div class="chips">${D.diseases.slice(0, 6).map(d => { const s = store.get("subs", []).includes(d.id); return `<button class="chip" data-sub="${d.id}" aria-pressed="${s}">${esc(d.name)}</button>` }).join("")}</div></section>`;

V.education = () => `<span class="eyebrow">Postgraduate education</span><h1>Staging exercises</h1>
  <p class="banner info">Educational exercises. They are not a validated clinical decision-support tool. Answers follow the ARVEEN paraphrase of each FIGO version, which is NOT VERIFIED.</p>
  <div class="cols quiz">${D.quiz.map(q => { const s = byId(D.staging, q.system); return `<div class="calc" data-quiz="${q.id}"><span class="eyebrow">${esc(s.authority)} ${esc(s.version)} · ${dname(s.cancer)}</span><p><b>${esc(q.q)}</b></p>
    <div style="display:grid;gap:6px">${q.options.map((o, i) => `<button class="btn opt" data-qi="${i}">${esc(o)}</button>`).join("")}</div><p class="why muted" hidden>${esc(q.why)} <a href="${url(`s.${s.id}`)}">Reference: ${esc(s.authority)} ${esc(s.version)}</a></p></div>` }).join("")}</div>`;
function bindQuiz() {
  app.querySelectorAll("[data-quiz]").forEach(c => c.onclick = e => {
    const b = e.target.closest("[data-qi]"); if (!b) return;
    const q = byId(D.quiz, c.dataset.quiz);
    c.querySelectorAll("[data-qi]").forEach(x => { x.classList.remove("right", "wrong"); if (+x.dataset.qi === q.answer) x.classList.add("right"); });
    if (+b.dataset.qi !== q.answer) b.classList.add("wrong");
    c.querySelector(".why").hidden = false;
  });
}

V.workspace = () => {
  const b = bm(), r = store.get("recent", []), n = store.get("notes", {});
  const link = x => { const p = { Guideline: "g.", Disease: "d.", Staging: "s.", Protocol: "p.", Drug: "dr.", Trial: "t.", Leaflet: "l.", "Patient page": "ptd." }[x.type] || ""; const sup = x.type === "Guideline" && byId(D.guidelines, x.id)?.superseded === "superseded"; return `<a class="row" href="${url(`${p}${x.id}`)}"><span class="row-t">${esc(x.title)} ${sup ? '<span class="pill bad">Now superseded</span>' : ""}</span><span class="row-m"><span class="eyebrow">${esc(x.type)}</span>${x.at ? `<span>${x.at}</span>` : ""}</span></a>` };
  return `<span class="eyebrow">${state.aud === "pro" ? "My Workspace" : "Saved"}</span><h1>${state.aud === "pro" ? "My Workspace" : "Things you have saved"}</h1>
  <p class="banner info">Saved items, notes and history are kept only in this browser on this device. Accounts with secure sign-in are planned for the production build.</p>
  <div class="cols"><section class="section"><h2>Bookmarks</h2><div class="list">${b.map(link).join("") || `<div class="row muted">Nothing saved yet. Use ☆ Save on any record.</div>`}</div></section>
  <section class="section"><h2>Recently viewed</h2><div class="list">${r.map(link).join("") || `<div class="row muted">No history yet.</div>`}</div></section></div>
  ${state.aud === "pro" ? `<section class="section"><h2>Private notes</h2><div class="list">${Object.entries(n).filter(([, v]) => v).map(([k, v]) => `<div class="row"><span class="row-t mono">${esc(k)}</span><span>${esc(v)}</span></div>`).join("") || `<div class="row muted">No notes yet.</div>`}</div></section>` : ""}`;
};

/* ---------- editorial ---------- */
const PRO_FLOW = ["DISCOVERED", "SOURCE RETRIEVED", "EXTRACTED", "STRUCTURED", "CLINICALLY REVIEWED", "APPROVED", "PUBLISHED", "MONITORED"];
const PT_FLOW = ["DRAFT", "EDITORIAL REVIEW", "CLINICAL REVIEW", "LANGUAGE REVIEW", "APPROVED", "PUBLISHED", "REVIEW DUE"];
const pipe = (flow, at) => `<div class="pipeline">${flow.map((s, i) => `${i ? "<i>→</i>" : ""}<span class="${s === at ? "on" : ""}">${s}</span>`).join("")}</div>`;
let genOut = "";
V.admin = () => {
  const queue = [...D.guidelines.map(g => ({ t: g.title, k: "Guideline", at: "STRUCTURED", flow: PRO_FLOW })), ...D.protocols.map(p => ({ t: p.name, k: "Protocol · high-risk", at: "STRUCTURED", flow: PRO_FLOW })), ...D.leaflets.filter(l => l.approval === "DRAFT").map(l => ({ t: l.title, k: "Patient leaflet", at: "DRAFT", flow: PT_FLOW }))];
  return `<span class="eyebrow">Editorial and governance</span><h1>Editorial dashboard</h1>
  <p class="banner info">Prototype view. In production this area requires an editor or reviewer role, checked on the server, and every change is written to the audit log.</p>
  <section class="section"><h2>Review queue</h2><div class="list">${queue.slice(0, 8).map(q => `<div class="row"><span class="row-t">${esc(q.t)} <span class="pill">${q.k}</span></span>${pipe(q.flow, q.at)}<span class="row-m">Reviewer: <span class="na">Unassigned</span></span></div>`).join("")}</div><p class="muted">${queue.length} items in queue; first 8 shown.</p></section>
  <section class="section"><h2>Patient leaflet generator</h2>
  <p class="prose muted">Builds a draft from approved ARVEEN clinical records using the standard 13-section template. Output stays a draft until editorial, clinical and (if needed) language review are complete.</p>
  <form class="calc" id="gen"><div class="fields">
    <label for="g-dis">Cancer type<select id="g-dis">${D.diseases.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select></label>
    <label for="g-topic">Topic<select id="g-topic"><option>Understanding the diagnosis</option><option>Surgery</option><option>Chemotherapy</option><option>Radiotherapy</option><option>Immunotherapy</option></select></label>
    <label for="g-level">Reading level<select id="g-level"><option>Basic</option><option selected>Standard</option><option>Detailed</option></select></label>
    <label for="g-lang">Language<select id="g-lang"><option>English</option><option>Bahasa Malaysia</option><option>Mandarin Chinese</option><option>Tamil</option></select></label>
    <label for="g-contact">Local contact details<input id="g-contact" type="text" placeholder="Leave blank to keep a placeholder"></label>
  </div><button class="btn primary" type="submit">Generate draft</button></form>
  <div id="genout">${genOut}</div></section>`;
};
function bindGen() {
  const f = $("#gen"); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault();
    const dis = $("#g-dis").value, topic = $("#g-topic").value, lang = $("#g-lang").value;
    const src = [...D.guidelines.filter(g => g.disease === dis), ...D.staging.filter(s => s.cancer === dis)];
    const approved = src.filter(s => s.status === "APPROVED");
    const gaps = [];
    if (!approved.length) gaps.push(`No APPROVED clinical source records for ${dname(dis)} (${src.length} records exist, all NOT VERIFIED). Clinical sections are left as headings only.`);
    if (!$("#g-contact").value.trim()) gaps.push("Local contact details missing: placeholder kept.");
    gaps.push("Safety section (emergency / urgent / routine) needs condition-specific criteria from a clinical reviewer.");
    if (lang !== "English") gaps.push(`${lang}: English draft must be approved first, then translated and reviewed by a qualified language and clinical reviewer.`);
    const S = ["Title", "At a glance", "What is it?", "Why has it been recommended?", "What will happen?", "Benefits and limitations", "Risks and side effects", "How can I prepare?", "Recovery and self-care", "When should I seek help?", "Questions to ask your doctor", "Further information", "Editorial information"];
    genOut = `<div class="leaflet" style="margin-top:12px"><p class="watermark">DRAFT — NOT FOR PATIENT USE — NOT APPROVED</p>
      <h2>${esc(topic)}: ${esc(dname(dis))}</h2>
      <div class="banner"><b>Gaps flagged (${gaps.length})</b><ul>${gaps.map(g => `<li>${esc(g)}</li>`).join("")}</ul></div>
      <div class="list">${S.map((s, i) => `<div class="row"><span class="row-t"><span class="mono muted">${String(i + 1).padStart(2, "0")}</span> ${s}</span><span class="na" style="font-size:.86rem">${i === 0 ? esc(topic + ": " + dname(dis)) : i === 12 ? `Leaflet ID: assigned on save · Status: DRAFT · Language: ${esc(lang)} · Sources: ${src.map(x => x.id).join(", ") || "none"}` : approved.length ? "Drafted from approved records" : "Awaiting approved source content"}</span></div>`).join("")}</div>
      ${pipe(PT_FLOW, "DRAFT")}</div>`;
    $("#genout").innerHTML = genOut;
  };
}

V.about = () => `<article class="detail prose" style="max-width:820px"><span class="eyebrow">About</span><h1>About DR ARVEEN</h1>
  <p>DR ARVEEN (Advanced Reference and Verified Evidence Network for Gynaecological Oncology) is a specialist reference for gynaecological oncology professionals in Malaysia, with a patient education centre built on the same clinical records.</p>
  <h2>How content is labelled</h2>
  <div class="chips">${["VERIFIED AGAINST SOURCE", "CLINICALLY REVIEWED", "GUIDELINE RECOMMENDATION", "REGULATORY PRODUCT INFORMATION", "ARVEEN EDUCATIONAL SUMMARY", "PATIENT INFORMATION", "INSTITUTION-SPECIFIC PROTOCOL", "OFF-LABEL USE", "INVESTIGATIONAL TREATMENT", "PARTIALLY VERIFIED", "NOT VERIFIED", "SUPERSEDED"].map(statusPill).join(" ")}</div>
  <h2>Malaysian applicability labels</h2><div class="chips">${Object.keys(MY).map(myLabel).join(" ")}</div>
  <h2>Editorial workflow</h2><p><b>Professional content</b></p>${pipe(PRO_FLOW, "")}<p><b>Patient content</b></p>${pipe(PT_FLOW, "")}
  <h2>Copyright and licensing</h2><p>DR ARVEEN links to official sources and writes its own summaries. It does not reproduce restricted guidelines or proprietary pocket guides. Every imported item records its source and licence.</p>
  <h2>Privacy</h2><p>This prototype stores bookmarks, notes and tracker entries only in your browser. Nothing is sent to a server or a third party.</p></article>`;

/* ---------- views: patient ---------- */
V.pt = () => `<div class="patient detail">${transBanner()}
  <section class="hero"><span class="eyebrow">DR ARVEEN Patient Education Centre</span><h1>Understanding Your Cancer. Understanding Your Care.</h1>
  <p>Clear, reliable information to help you understand your diagnosis, prepare for treatment, manage side effects, and navigate life during and after gynaecological cancer.</p>
  <form class="bigsearch" id="hs"><input id="hq" type="search" aria-label="Search" placeholder="Search for your cancer, treatment, test, symptom, or question."><button>Search</button></form></section>
  <p class="banner">This information is being written and has not yet been reviewed by a clinician. It does not replace advice from your own treating team. In an emergency in Malaysia, call <b>999</b>.</p>
  <section class="section"><h2>Browse by cancer type</h2><div class="grid">${D.diseases.map(d => `<a class="tile" href="${url(`ptd.${d.id}`)}"><b>${esc(d.name)}</b><span>${esc(d.patient)}</span></a>`).join("")}</div></section>
  <section class="section"><h2>Browse by treatment</h2><div class="chips">${["Surgery", "Chemotherapy", "Radiotherapy", "Brachytherapy", "Immunotherapy", "Targeted therapy", "Hormonal therapy", "Fertility-sparing treatment", "Maintenance treatment", "Palliative treatment"].map(t => `<button class="chip" data-q="${t}">${t}</button>`).join("")}</div></section>
  <section class="section"><h2>Browse by concern</h2><div class="chips">${["Understanding my diagnosis", "Preparing for surgery", "Pain and fatigue", "Managing side effects", "Nutrition", "Fertility", "Sexual health", "Menopause", "Emotional distress", "Returning to work", "Supporting a loved one", "Life after cancer"].map(t => `<button class="chip" data-q="${t}">${t}</button>`).join("")}</div></section>
  <section class="section"><h2>Tools to use with your care team</h2><div class="grid">
    <a class="tile" href="${url(`sdm`)}"><b>Questions for my oncologist</b><span>A checklist to bring to your next appointment.</span></a>
    <a class="tile" href="${url(`tracker`)}"><b>Side-effect tracker</b><span>Note changes so you can tell your team accurately.</span></a>
    <a class="tile" href="${url(`leaflets`)}"><b>Information leaflets</b><span>${D.leaflets.length} leaflets planned; 1 draft available.</span></a>
    <a class="tile" href="${url(`glossary`)}"><b>Medical glossary</b><span>${D.glossary.length} terms explained in plain language.</span></a></div></section></div>`;
V.ptcancers = () => `<div class="patient detail"><span class="eyebrow">Understanding your cancer</span><h1>Your cancer</h1><div class="grid">${D.diseases.map(d => `<a class="tile" href="${url(`ptd.${d.id}`)}"><b>${esc(d.name)}</b><span>${esc(d.patient)}</span></a>`).join("")}</div></div>`;
V.ptd = id => {
  const d = disease(id); if (!d) return notFound();
  recent("Patient page", d.id, d.name);
  const ls = D.leaflets.filter(l => l.disease === id);
  return `<article class="patient detail">${transBanner()}<div class="dhead"><span class="eyebrow">Understanding your cancer</span><h1>${esc(d.name)}</h1><p class="prose" style="font-size:1.05rem">${esc(d.patient)}</p><div class="row-m">${statusPill("DRAFT")} <span>Not yet clinically reviewed</span></div><div class="actions">${bmBtn("Patient page", d.id, d.name)}</div></div>
  <div class="cols">${["What stage means", "Tests you may have", "Treatment options", "Living with and after cancer"].map(h => `<section class="section"><h2>${h}</h2><p class="na">This section is being written and reviewed.</p></section>`).join("")}</div>
  <section class="section"><h2>Leaflets</h2><div class="list">${ls.map(l => `<a class="row" href="${url(`l.${l.id}`)}"><span class="row-t">${esc(l.title)} ${statusPill(l.approval)}</span></a>`).join("") || `<div class="row muted">No leaflet for this cancer yet.</div>`}</div></section>
  <p><a class="btn" href="${url(`sdm`)}">Prepare questions for your doctor →</a></p></article>`;
};
V.leaflets = () => `<div class="patient detail"><span class="eyebrow">Patient information leaflets</span><h1>Information leaflets</h1>${transBanner()}
  <p class="prose muted">Every leaflet follows the same structure, so you always know where to find what to expect, risks, and when to get help.</p>
  <div class="list">${D.leaflets.map(l => `<a class="row" href="${url(`l.${l.id}`)}"><span class="row-t">${esc(l.title)} ${statusPill(l.approval)}</span><span class="row-m"><span>${esc(l.audience)}</span><span class="mono">${esc(l.id)} · ${esc(l.version)}</span></span></a>`).join("")}</div></div>`;
V.l = id => {
  const l = byId(D.leaflets, id); if (!l) return notFound();
  recent("Leaflet", l.id, l.title);
  if (!l.sections.length) return `<article class="patient leaflet"><span class="eyebrow">Patient information leaflet</span><h1>${esc(l.title)}</h1>${statusPill(l.approval)}<p class="muted">This leaflet has not been written yet.</p><a href="${url(`leaflets`)}">All leaflets</a></article>`;
  const s = l.safety;
  return `<article class="patient leaflet">${transBanner()}<p class="watermark">DRAFT — NOT YET CLINICALLY REVIEWED</p>
  <div class="dhead"><span class="eyebrow">Patient information leaflet</span><h1>${esc(l.title)}</h1><div class="actions">${bmBtn("Leaflet", l.id, l.title)}</div></div>
  ${l.sections.map(([h, ps]) => `<section><h2>${esc(h)}</h2>${ps.length > 1 ? `<ul>${ps.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : `<p>${esc(ps[0])}</p>`}</section>`).join("")}
  <section><h2>When should I seek help?</h2><div class="safety">
    <div class="em"><b>Emergency — seek emergency help now (call 999)</b><ul>${s.emergency.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="ur"><b>Urgent — contact your treating team promptly</b><ul>${s.urgent.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="ro"><b>Routine — discuss at your next appointment</b><ul>${s.routine.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <p class="muted" style="font-size:.84rem">${esc(s.note)}</p></div></section>
  <section><h2>Questions to ask your doctor</h2><ul>${l.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul></section>
  <section><h2>Further information</h2><p>Treating team contact: <b>[to be added by your hospital]</b>. See also the <a href="${url(`glossary`)}">medical glossary</a>.</p></section>
  <section><h2>Editorial information</h2><div class="kv">${[["Leaflet ID", `<span class="mono">${l.id}</span>`], ["Intended audience", esc(l.audience)], ["Author", esc(l.author)], ["Clinical reviewer", l.reviewer ? esc(l.reviewer) : '<span class="na">Not yet assigned</span>'], ["Publication date", na(l.pubDate)], ["Last review", na(l.lastReview)], ["Next review", na(l.nextReview)], ["Version", esc(l.version)], ["Source records", l.sources.map(x => `<a href="${url(`${x.startsWith("G-") ? "g." : "s."}${x}`)}">${x}</a>`).join(", ")], ["Jurisdiction", esc(l.jurisdiction)], ["Language", esc(l.language)], ["Translation status", esc(l.translation)], ["Approval status", statusPill(l.approval)]].map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}</div></section></article>`;
};
V.sdm = () => {
  const done = store.get("sdmq", []), ws = store.get("ws", {});
  return `<div class="patient detail"><span class="eyebrow">Shared decision-making</span><h1>Prepare for your appointment</h1>
  <p class="banner info">These tools help you talk with your treating team. They do not recommend a treatment. Anything you type stays only on this device.</p>
  <div class="cols"><section class="section"><h2>Questions for my oncologist</h2><div class="checklist">${D.sdmQuestions.map((q, i) => `<label for="sq${i}"><input type="checkbox" id="sq${i}" data-sq="${i}" ${done.includes(i) ? "checked" : ""}> ${esc(q)}</label>`).join("")}</div></section>
  <section class="section"><h2>Treatment discussion worksheet</h2><form class="calc" id="ws">${[["goals", "What matters most to me"], ["benefits", "Benefits my team described"], ["risks", "Risks and side effects I want to understand"], ["alts", "Other options we discussed"], ["unsure", "Things I am still unsure about"]].map(([k, t]) => `<label for="ws-${k}">${t}<textarea id="ws-${k}" data-ws="${k}">${esc(ws[k] || "")}</textarea></label>`).join("")}</form></section></div>
  <section class="section"><h2>More discussion guides</h2><div class="grid">${["Understanding my diagnosis", "Surgery preparation checklist", "Chemotherapy diary", "Fertility discussion guide", "Menopause and sexual health guide", "Follow-up planner", "Caregiver guide"].map(t => `<div class="tile"><b>${t}</b><span>Being written.</span></div>`).join("")}<a class="tile" href="${url(`tracker`)}"><b>Side-effect tracker</b><span>Available now.</span></a></div></section></div>`;
};
function bindSdm() {
  app.querySelectorAll("[data-sq]").forEach(c => c.onchange = () => { let d = store.get("sdmq", []); const i = +c.dataset.sq; d = c.checked ? [...d, i] : d.filter(x => x !== i); store.set("sdmq", d); });
  app.querySelectorAll("[data-ws]").forEach(t => t.oninput = () => { const w = store.get("ws", {}); w[t.dataset.ws] = t.value; store.set("ws", w); });
}
V.tracker = () => {
  const rows = store.get("fx", []);
  return `<div class="patient detail"><span class="eyebrow">Shared decision-making</span><h1>Side-effect tracker</h1>
  <p class="banner info">Record how you feel so you can describe changes accurately to your team. This does not assess how serious a symptom is. If you are worried, contact your treating team. In an emergency call 999.</p>
  <form class="calc" id="fxf"><div class="fields">
    <label for="fx-date">Date<input id="fx-date" type="text" value="${new Date().toISOString().slice(0, 10)}"></label>
    <label for="fx-sym">Symptom<input id="fx-sym" type="text" placeholder="e.g. tiredness, nausea"></label>
    <label for="fx-sev">How much it affects you<select id="fx-sev"><option>A little</option><option>Quite a bit</option><option>A lot</option></select></label>
  </div><label for="fx-note">Notes or questions<input id="fx-note" type="text"></label><div><button class="btn primary">Add entry</button></div></form>
  <div class="tablewrap"><table><thead><tr><th>Date</th><th>Symptom</th><th>Effect</th><th>Notes</th><th></th></tr></thead><tbody>${rows.map((r, i) => `<tr><td class="mono">${esc(r.d)}</td><td>${esc(r.s)}</td><td>${esc(r.v)}</td><td>${esc(r.n)}</td><td><button class="btn" data-fxdel="${i}">Remove</button></td></tr>`).join("") || `<tr><td colspan="5" class="muted">No entries yet. Example: 2026-10-24 · Tiredness · Quite a bit · "Worse two days after treatment".</td></tr>`}</tbody></table></div></div>`;
};
function bindTracker() {
  const f = $("#fxf"); if (!f) return;
  f.onsubmit = e => { e.preventDefault(); if (!$("#fx-sym").value.trim()) { $("#fx-sym").focus(); return; } const r = store.get("fx", []); r.unshift({ d: $("#fx-date").value, s: $("#fx-sym").value, v: $("#fx-sev").value, n: $("#fx-note").value }); store.set("fx", r); render(); };
  app.querySelectorAll("[data-fxdel]").forEach(b => b.onclick = () => { const r = store.get("fx", []); r.splice(+b.dataset.fxdel, 1); store.set("fx", r); render(); });
}
V.glossary = () => `<div class="patient detail"><span class="eyebrow">Medical glossary</span><h1>Medical words explained</h1>${transBanner()}
  <input type="text" id="gq" placeholder="Find a word" aria-label="Find a word" style="max-width:360px">
  <div class="list" id="gl">${D.glossary.map(([t, d]) => `<div class="row" data-term="${esc((t + " " + d).toLowerCase())}"><span class="row-t">${esc(t)}</span><span>${esc(d)}</span></div>`).join("")}</div></div>`;

V.search = () => {
  const res = search(state.q);
  const aud = state.filters.saud || "all";
  const pro = res.filter(r => r.aud === "pro"), pt = res.filter(r => r.aud === "pt");
  const block = (t, l) => l.length ? `<section class="section"><h2>${t} <span class="muted" style="font-size:.9rem">${l.length}</span></h2><div class="list">${l.map(resultRow).join("")}</div></section>` : "";
  return `<span class="eyebrow">Search</span><h1>Results for “${esc(state.q)}”</h1>
  <div class="chips">${[["all", "All audiences"], ["pro", "Professional clinical"], ["pt", "Patient education"]].map(([k, t]) => `<button class="chip" data-saud="${k}" aria-pressed="${aud === k}">${t}</button>`).join("")}</div>
  ${!res.length ? `<p class="muted">No results. Try a disease name, a drug, an organisation (ESGO, FIGO) or a stage such as IIIC.</p>` : ""}
  ${aud !== "pt" ? block("Professional clinical results", pro) : ""}${aud !== "pro" ? block("Patient education results", pt) : ""}`;
};
const notFound = () => `<h1>Record not found</h1><p><a href="${url(`home`)}">Return home</a></p>`;

/* ---------- router ---------- */
function render() {
  const base = PAGE, arg = PARAMS.get("id") || "";
  renderNav();
  const view = V[base]; app.innerHTML = view ? view(arg) : notFound();
  const h1 = app.querySelector("h1"); if (h1 && base !== "home" && base !== "pt") document.title = h1.textContent.trim() + " · DR ARVEEN";
  $("#mq").value = base === "search" ? state.q : "";
  const hs = $("#hs"); if (hs) hs.onsubmit = e => { e.preventDefault(); state.q = $("#hq").value.trim(); go("search"); };
  app.querySelectorAll("[data-q]").forEach(c => c.onclick = () => { state.q = c.dataset.q; go("search"); });
  app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { store.set("dmode", b.dataset.mode); render(); });
  app.querySelectorAll("[data-td]").forEach(b => b.onclick = () => { state.filters.trialDisease = b.dataset.td; render(); });
  app.querySelectorAll("[data-saud]").forEach(b => b.onclick = () => { state.filters.saud = b.dataset.saud; render(); });
  app.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => { let s = store.get("subs", []); s = s.includes(b.dataset.sub) ? s.filter(x => x !== b.dataset.sub) : [...s, b.dataset.sub]; store.set("subs", s); b.setAttribute("aria-pressed", s.includes(b.dataset.sub)); });
  app.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { algoPath = algoPath.slice(0, +b.dataset.step + 1).concat(b.dataset.to); render(); });
  const ar = $("#algoreset"); if (ar) ar.onclick = () => { algoPath = []; render(); };
  const cq = $("#cmpq"); if (cq) cq.onchange = () => { state.filters.cmp = cq.value; render(); };
  const sf = $("#sfilter"); if (sf) sf.oninput = () => { const q = sf.value.toLowerCase(); $("#stree").querySelectorAll(".stage").forEach(s => { s.hidden = q && !s.textContent.toLowerCase().includes(q); }); };
  const gq = $("#gq"); if (gq) gq.oninput = () => app.querySelectorAll("[data-term]").forEach(r => r.hidden = !r.dataset.term.includes(gq.value.toLowerCase()));
  bindFilters(); bindCalcs(); bindQuiz(); bindGen(); bindSdm(); bindTracker();
}
render();
})();
