(() => {
/* Patient content is public (patient-data.js). Professional content is loaded from Supabase after sign-in. */
let D = { ...window.ARVEEN_PUBLIC };
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
  const c = { "VERIFIED AGAINST SOURCE": "ok", "CLINICALLY REVIEWED": "ok", "APPROVED": "ok", "PARTIALLY VERIFIED": "warn", "NOT VERIFIED": "warn", "DRAFT": "warn", "SUPERSEDED": "bad", "NOT STARTED": "", "DETECTED": "warn", "SEARCH TASK": "teal", "EXTRACTED": "teal", "PENDING PHARMACIST REVIEW": "warn" }[s] ?? "";
  return `<span class="pill ${c}">${esc(s)}</span>`;
};
const supPill = g => g.superseded === "superseded" ? `<span class="pill bad">Superseded</span>` : g.superseded === "uncertain" ? `<span class="pill warn">Currency uncertain</span>` : `<span class="pill ok">Active</span>`;
const orgs = g => g.org.join(" / ");

/* ---------- navigation ---------- */
const NAV_PRO = [["home", "Home"], ["guidelines", "Guidelines"], ["diseases", "Diseases"], ["staging", "Staging"], ["protocols", "Treatment Protocols"], ["drugs", "Drug Reference"], ["trials", "Clinical Trials"], ["algorithms", "Clinical Algorithms"], ["calculators", "Calculators"], ["compare", "Evidence and Research"], ["updates", "Guideline Updates"], ["education", "Education"], ["pt", "Patient Education"], ["sdm", "Shared Decision-Making"], ["workspace", "My Workspace"], ["admin", "Editorial"], ["accounts", "Accounts"], ["governance", "Governance"], ["about", "About"]];
const NAV_PT = [["pt", "Home"], ["ptcancers", "Your cancer"], ["leaflets", "Information leaflets"], ["articles", "Articles"], ["sdm", "Prepare for appointments"], ["tracker", "Side-effect tracker"], ["glossary", "Medical glossary"], ["workspace", "Saved"], ["governance", "How we check information"], ["about", "About"]];
/* Each route name maps to its own HTML file; records use ?id= */
const FILES = { welcome: "index.html", home: "professional.html", login: "login.html", register: "register.html", reset: "reset-password.html", accounts: "accounts.html", cms: "content-editor.html", governance: "governance.html", privacy: "privacy.html", guidelines: "guidelines.html", recs: "recommendations.html", g: "guideline.html", diseases: "diseases.html", d: "disease.html",
  staging: "staging.html", s: "staging-system.html", protocols: "protocols.html", p: "protocol.html", drugs: "drugs.html", dr: "drug.html", trials: "trials.html", t: "trial.html",
  algorithms: "algorithms.html", calculators: "calculators.html", compare: "evidence.html", updates: "updates.html", education: "education.html", workspace: "workspace.html",
  admin: "editorial.html", about: "about.html", search: "search.html", pt: "patients.html", ptcancers: "patient-cancers.html", ptd: "patient-cancer.html",
  leaflets: "leaflets.html", l: "leaflet.html", articles: "articles.html", a: "article.html", sdm: "decision-making.html", tracker: "tracker.html", glossary: "glossary.html" };
const PAGE_BY_FILE = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [f, k]));
function url(route) {
  const i = route.indexOf("."); const base = i < 0 ? route : route.slice(0, i); const arg = i < 0 ? "" : route.slice(i + 1);
  const f = FILES[base] || "index.html";
  return arg ? `${f}?id=${encodeURIComponent(arg)}` : f;
}
const PARAMS = new URLSearchParams(location.search);
const PAGE = document.body.dataset.page || PAGE_BY_FILE[location.pathname.split("/").pop()] || "welcome";
const PT_PAGES = ["pt", "ptcancers", "ptd", "leaflets", "l", "articles", "a", "tracker", "glossary"];
const SHARED_PAGES = ["welcome", "login", "register", "reset", "governance", "privacy", "workspace", "about", "sdm", "search"];
const PUBLIC_PAGES = [...PT_PAGES, ...SHARED_PAGES];
const GATED = !PUBLIC_PAGES.includes(PAGE);
if (PT_PAGES.includes(PAGE)) state.aud = "pt"; else if (!SHARED_PAGES.includes(PAGE)) state.aud = "pro";
store.set("aud", state.aud);
state.q = PARAMS.get("q") || "";

function renderShell() {
  $("#mast").innerHTML = `<div class="mast-in"><div class="mast-top">
    <a class="brand" href="index.html" aria-label="DR ARVEEN home">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="1" width="32" height="32" rx="7" fill="none" stroke="#7ee0e5" stroke-width="2"/><path d="M9 25 L17 8 L25 25" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><path d="M12.5 19 H21.5" stroke="#b9a7f0" stroke-width="2.4" stroke-linecap="round"/></svg>
      <span><b>DR ARVEEN</b><small id="tagline"></small></span></a>
    <form class="msearch" id="msearch" role="search" action="search.html"><input id="mq" name="q" type="search" aria-label="Search DR ARVEEN"><button type="submit">Search</button></form>
    <div class="aud" role="group" aria-label="Audience"><a id="aud-pro" href="professional.html">For healthcare professionals</a><a id="aud-pt" href="patients.html">For patients and caregivers</a></div>
    <select class="lang" id="lang" aria-label="Language"><option value="en">English</option><option value="ms">Bahasa Malaysia</option><option value="zh">中文</option><option value="ta">தமிழ்</option></select>
    <button class="theme-btn" id="theme" type="button" title="Switch light or dark mode">☾ Dark</button>
    <span class="acct" id="acct"></span>
  </div><nav class="mnav" id="nav" aria-label="Sections"></nav></div>`;
  $("#foot").innerHTML = `<div class="in">
    <section class="report" aria-labelledby="rp-h"><h2 id="rp-h" class="report-h">Report a problem with this page</h2>
      <p class="muted">Found an error, an out-of-date statement or a broken link? Tell us. Don't include any patient's personal or medical details.</p>
      <details><summary class="btn">Report a problem</summary>
      <form class="calc authbox" id="reportf">
        <label for="rp-cat">What kind of problem?<select id="rp-cat"><option>Clinical content may be wrong or out of date</option><option>Something is unclear</option><option>Broken link or page error</option><option>Accessibility problem</option><option>Other</option></select></label>
        <label for="rp-msg">Describe the problem<textarea id="rp-msg" maxlength="2000" required></textarea></label>
        <label for="rp-contact">Your email, if you'd like a reply (optional)<input id="rp-contact" type="email" maxlength="200" autocomplete="email"></label>
        <p class="result err" role="alert" id="rp-err" hidden></p><p class="banner info" id="rp-ok" role="status" hidden></p>
        <div><button class="btn primary" type="submit">Send report</button></div>
      </form></details></section>
    <p><b>DR ARVEEN</b> — Advanced Reference and Verified Evidence Network for Gynaecological Oncology.</p>
    <p>Educational reference only. It does not replace clinical assessment, an authorised prescription or your institution's protocols. Professional content is for registered healthcare professionals.</p>
    <p class="footlinks"><a href="about.html">About and disclosures</a><a href="governance.html">How content is checked and approved</a><a href="privacy.html">Privacy notice</a><a href="patients.html">Patient Education Centre</a></p></div>
    <div class="storage-note" id="storenote" hidden><p>DR ARVEEN keeps your settings, bookmarks, notes and tracker entries in this browser only. <a href="privacy.html">Privacy notice</a></p><button class="btn" type="button" id="storeok">OK</button></div>`;
  if (!store.get("storeok", false)) { $("#storenote").hidden = false; $("#storeok").onclick = () => { store.set("storeok", true); $("#storenote").hidden = true; }; }
  $("#reportf").onsubmit = async e => {
    e.preventDefault();
    const err = $("#rp-err"), ok = $("#rp-ok"); err.hidden = ok.hidden = true;
    const message = $("#rp-msg").value.trim();
    if (message.length < 5) { err.hidden = false; err.textContent = "Describe the problem in a few words."; return; }
    if (!sb) { err.hidden = false; err.textContent = "Reporting isn't connected yet. Please try again later."; return; }
    const { error } = await sb.from("feedback").insert({ page: (location.pathname.split("/").pop() || "index.html") + location.search, category: $("#rp-cat").value, message, contact: $("#rp-contact").value.trim() || null });
    if (error) { err.hidden = false; err.textContent = "Your report couldn't be sent. Please try again later."; return; }
    $("#reportf").reset(); ok.hidden = false; ok.textContent = "Thank you. Your report has been sent to the DR ARVEEN team.";
  };
}
renderShell();
/* Professional menu grouped so the bar stays short; patient menu stays flat */
const NAV_PRO_GROUPS = [["home", "Home"],
  { label: "Reference", items: [["guidelines", "Guidelines"], ["diseases", "Diseases"], ["staging", "Staging"], ["protocols", "Treatment protocols"], ["drugs", "Drug reference"], ["trials", "Clinical trials"]] },
  { label: "Tools", items: [["algorithms", "Clinical pathways"], ["calculators", "Calculators"], ["compare", "Evidence and comparisons"], ["education", "Education"]] },
  ["updates", "Updates"], ["pt", "Patient Education"], ["sdm", "Shared decisions"], ["workspace", "My Workspace"],
  { label: "More", items: [["cms", "Edit content"], ["admin", "Editorial"], ["accounts", "Accounts"], ["governance", "Governance"], ["about", "About"]] }];
function renderNav() {
  renderAcct();
  document.body.classList.toggle("aud-pt", state.aud === "pt");
  const map = { g: "guidelines", recs: "guidelines", d: "diseases", s: "staging", p: "protocols", dr: "drugs", t: "trials", l: "leaflets", ptd: "ptcancers", a: "articles" };
  const cur = map[PAGE] || PAGE;
  const link = ([r, t]) => `<a href="${url(r)}" ${r === cur ? 'aria-current="page"' : ""}>${t}</a>`;
  const allowed = ([r]) => (r !== "accounts" || isAdmin()) && (r !== "cms" || isEditor());
  $("#nav").innerHTML = state.aud === "pro"
    ? NAV_PRO_GROUPS.map(g => Array.isArray(g) ? link(g) : `<details class="navgrp"><summary class="${g.items.some(([r]) => r === cur) ? "cur" : ""}">${g.label}</summary><div class="navmenu">${g.items.filter(allowed).map(link).join("")}</div></details>`).join("")
    : NAV_PT.filter(allowed).map(link).join("");
  $("#nav").querySelectorAll(".navgrp").forEach(d => d.addEventListener("toggle", () => { if (d.open) $("#nav").querySelectorAll(".navgrp").forEach(o => { if (o !== d) o.open = false; }); }));
  state.aud === "pro" ? $("#aud-pro").setAttribute("aria-current", "page") : $("#aud-pro").removeAttribute("aria-current");
  state.aud === "pt" ? $("#aud-pt").setAttribute("aria-current", "page") : $("#aud-pt").removeAttribute("aria-current");
  $("#tagline").textContent = state.aud === "pro" ? "Evidence. Guidelines. Clinical Excellence." : "Understand Your Diagnosis. Navigate Your Care.";
  $("#mq").placeholder = state.aud === "pro" ? "Search a cancer, guideline, drug, trial or stage" : "Search for your cancer, treatment, test or question";
}
document.addEventListener("click", e => { if (!e.target.closest(".navgrp")) document.querySelectorAll(".navgrp[open]").forEach(d => d.open = false); });
document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".navgrp[open]").forEach(d => { d.open = false; d.querySelector("summary").focus(); }); });

/* ---------- illustrations: icons, cancer badges, anatomy diagram (original artwork) ---------- */
const ICON = {
  guidelines: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  staging: '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 4.5 9-4.5"/>',
  protocols: '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
  drugs: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m9.5 9.5 5 5"/>',
  trials: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="m7 15 4-4 3 3 5-6"/>',
  calculators: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h1M12 11h1M16 11h0M8 15h1M12 15h1M8 18h1M12 18h1M16 15v3"/>',
  algorithms: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="19" r="2"/><path d="M8 5h4a4 4 0 0 1 4 4v1M16 14v1a4 4 0 0 1-4 4H8"/>',
  education: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  compare: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
  updates: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  sdm: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  tracker: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  leaflets: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 12h6M10 15h6M10 18h4"/>',
  articles: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M9 7h6"/>',
  glossary: '<path d="M4 18 8 6l4 12M5.5 14h5"/><path d="M14 6h6l-6 12h6"/>'
};
ICON.recs = ICON.guidelines; ICON.diseases = ICON.articles;
const ic = name => ICON[name] ? `<span class="ticon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg></span>` : "";
const HUE = { cervical: "#0e7c86", ovarian: "#5f4dbf", tubal: "#7046a8", peritoneal: "#4b5bb0", endometrial: "#b04a26", vulvar: "#a3316f", vaginal: "#1f6aa8", sarcoma: "#2f7a3e", gtn: "#875800", rare: "#4a5868" };
const ABBR = { cervical: "CX", ovarian: "OV", tubal: "FT", peritoneal: "PP", endometrial: "EN", vulvar: "VU", vaginal: "VA", sarcoma: "US", gtn: "GTN", rare: "RG" };
const badge = (id, big) => `<span class="dbadge${big ? " big" : ""}" style="--hue:${HUE[id] || "#4a5868"}" aria-hidden="true">${ABBR[id] || "•"}</span>`;
/* Simplified front view of the female reproductive organs; the organ where the cancer starts is highlighted */
function anatomySvg(id) {
  const hl = { cervical: ["cervix"], ovarian: ["ovary"], tubal: ["tube"], peritoneal: ["peri"], endometrial: ["lining"], vulvar: ["vulva"], vaginal: ["vagina"], sarcoma: ["uterus"], gtn: ["uterus"], rare: [] }[id] || [];
  const c = part => hl.includes(part) ? "org hl" : "org";
  const lbl = (x, y, lx, ly, t, part, anchor = "start") => `<line class="lead${hl.includes(part) ? " hl" : ""}" x1="${x}" y1="${y}" x2="${lx}" y2="${ly}"/><text class="lab${hl.includes(part) ? " hl" : ""}" x="${x + (anchor === "end" ? -4 : 4)}" y="${y + 4}" text-anchor="${anchor}">${t}</text>`;
  return `<svg class="anat" viewBox="0 0 380 300" role="img" aria-labelledby="anat-t"><title id="anat-t">Diagram of the womb, cervix, ovaries, fallopian tubes, vagina and vulva${hl.length ? ", with the area where this cancer starts highlighted" : ""}</title>
    <rect class="${hl.includes("peri") ? "peri hl" : "peri"}" x="40" y="30" width="300" height="196" rx="46"/>
    <path class="${c("tube")}" fill="none" stroke-width="7" stroke-linecap="round" d="M158 76 Q118 48 88 66 Q72 76 76 96"/><path class="${c("tube")}" fill="none" stroke-width="7" stroke-linecap="round" d="M222 76 Q262 48 292 66 Q308 76 304 96"/>
    <ellipse class="${c("ovary")}" cx="98" cy="114" rx="20" ry="13"/><ellipse class="${c("ovary")}" cx="282" cy="114" rx="20" ry="13"/>
    <path class="${c("uterus")}" d="M158 70 Q190 54 222 70 Q248 86 240 128 Q232 164 206 182 L174 182 Q148 164 140 128 Q132 86 158 70 Z"/>
    <path class="${c("lining")} lining" d="M170 92 Q190 84 210 92 Q220 122 200 162 L180 162 Q160 122 170 92 Z"/>
    <path class="${c("cervix")}" d="M174 182 L206 182 L202 214 L178 214 Z"/>
    <path class="${c("vagina")}" d="M178 214 L202 214 L206 262 L174 262 Z"/>
    <ellipse class="${c("vulva")}" cx="190" cy="276" rx="36" ry="12"/>
    ${lbl(30, 50, 104, 58, "Fallopian tube", "tube", "start")}${lbl(30, 150, 84, 122, "Ovary", "ovary", "start")}
    ${lbl(250, 132, 236, 128, "Womb (uterus)", "uterus")}${lbl(250, 108, 212, 112, "Lining (endometrium)", "lining")}
    ${lbl(250, 198, 204, 196, "Cervix", "cervix")}${lbl(250, 240, 204, 238, "Vagina", "vagina")}${lbl(250, 286, 222, 278, "Vulva", "vulva")}
    ${lbl(30, 18, 70, 34, "Lining of the abdomen (peritoneum)", "peri", "start")}
  </svg>`;
}
function setAud(a) { state.aud = a; store.set("aud", a); location.href = a === "pro" ? "professional.html" : "patients.html"; }

/* ---------- accounts (Supabase) ---------- */
const CFG = window.ARVEEN_CONFIG || {};
const sb = (window.supabase && CFG.supabaseUrl && !/YOUR-/.test(CFG.supabaseUrl + CFG.supabaseAnonKey)) ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
state.user = null; state.profile = null; state.proLoaded = false;
const approved = () => state.profile?.status === "approved";
const isAdmin = () => approved() && state.profile.role === "admin";
const isEditor = () => approved() && ["editor", "reviewer", "admin"].includes(state.profile.role);
const canApprove = () => approved() && ["reviewer", "admin"].includes(state.profile.role);
/* Online edits to patient content (Supabase patient_items) are applied on top of the built-in content */
state.items = [];
async function loadPatientItems() {
  if (!sb) return;
  const { data, error } = await sb.from("patient_items").select("*");
  if (error || !data) return;
  state.items = data;
  const P = window.ARVEEN_PUBLIC;
  for (const row of data) {
    const [kind, ...rest] = row.id.split(":"); const id = rest.join(":");
    const meta = { reviewer: row.reviewer, lastReview: row.last_review, nextReview: row.next_review, online: true, updatedAt: row.updated_at };
    if (kind === "article") {
      const i = P.articles.findIndex(a => a.id === id);
      if (row.status === "WITHDRAWN") { if (i >= 0) P.articles.splice(i, 1); continue; }
      const item = { ...(i >= 0 ? P.articles[i] : {}), ...row.data, id, status: row.status, ...meta };
      i >= 0 ? (P.articles[i] = item) : P.articles.push(item);
    } else if (kind === "leaflet") {
      const i = P.leaflets.findIndex(l => l.id === id);
      if (row.status === "WITHDRAWN") { if (i >= 0) P.leaflets.splice(i, 1); continue; }
      const item = { ...(i >= 0 ? P.leaflets[i] : {}), ...row.data, id, approval: row.status, ...meta };
      i >= 0 ? (P.leaflets[i] = item) : P.leaflets.push(item);
    } else if (kind === "cancer") {
      const d = P.diseases.find(x => x.id === id); if (!d) continue;
      if (row.data.patient) d.patient = row.data.patient;
      if (row.data.sections) d.patientSections = row.data.sections;
      d.image = row.data.image || null; d.pageStatus = row.status; Object.assign(d, meta);
    }
  }
}
const photo = img => img && /^https:\/\//.test(img.url || "") ? `<figure class="photo"><img src="${esc(img.url)}" alt="${esc(img.alt || "")}" loading="lazy">${img.credit ? `<figcaption>${esc(img.credit)}</figcaption>` : ""}</figure>` : "";
const siteBase = () => location.origin + location.pathname.replace(/[^/]*$/, "");
async function loadSession() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user || null;
  if (state.user) { const { data } = await sb.from("profiles").select("*").eq("id", state.user.id).maybeSingle(); state.profile = data; }
}
async function loadPro() {
  const { data, error } = await sb.from("pro_content").select("key,data");
  if (error || !data?.length) return false;
  const pro = Object.fromEntries(data.map(r => [r.key, r.data])), pub = window.ARVEEN_PUBLIC;
  for (const k of ["leaflets", "articles", "glossary", "journey", "concerns", "sdmQuestions"]) delete pro[k]; // patient content always comes from the public file
  if (pro.diseases) pro.diseases = pro.diseases.map(d => { const p = pub.diseases.find(x => x.id === d.id) || {}; return { ...d, patient: p.patient || d.patient, patientSections: p.patientSections || null, image: p.image || null, pageStatus: p.pageStatus, online: p.online, reviewer: p.reviewer, lastReview: p.lastReview, nextReview: p.nextReview }; });
  D = { ...pub, ...pro };
  state.proLoaded = true; return true;
}
function renderAcct() {
  const el = $("#acct"); if (!el) return;
  el.innerHTML = state.user
    ? `<span class="acct-name" title="${esc(state.user.email)}">${esc(state.profile?.full_name || state.user.email)}</span><button class="theme-btn" id="signout" type="button">Sign out</button>`
    : `<a class="theme-btn" href="login.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}">Sign in</a>`;
  const so = $("#signout"); if (so) so.onclick = async () => { await sb.auth.signOut(); location.href = "index.html"; };
}
const authErr = (msg) => { const e = $("#autherr"); if (e) { e.hidden = false; e.textContent = msg; } };
const authOk = (msg) => { const e = $("#authok"); if (e) { e.hidden = false; e.innerHTML = msg; } };
const notConfigured = () => `<p class="banner bad">Sign-in isn't connected yet. The site owner needs to finish the Supabase setup (see SUPABASE-SETUP.md in the repository).</p>`;
const loginForm = () => `<form class="calc authbox" id="loginf"><h2>Sign in</h2>
  <p class="muted">Professional content is for registered healthcare professionals with an approved DR ARVEEN account.</p>
  <label for="li-email">Email<input id="li-email" type="email" autocomplete="email" required></label>
  <label for="li-pass">Password<input id="li-pass" type="password" autocomplete="current-password" required></label>
  <p class="result err" role="alert" id="autherr" hidden></p>
  <div class="toc"><button class="btn primary" type="submit">Sign in</button><a class="btn" href="register.html">Request an account</a><a class="btn" href="reset-password.html">Forgot password</a></div></form>`;
function gateView() {
  if (!sb) return `<h1>Healthcare professionals</h1>${notConfigured()}`;
  if (!state.user) return `<span class="eyebrow">Healthcare professionals</span><h1>Sign in to continue</h1>${loginForm()}<p class="muted">Patients and caregivers don't need an account: <a href="patients.html">go to the Patient Education Centre</a>.</p>`;
  const st = state.profile?.status;
  if (st === "pending" || !st) return `<span class="eyebrow">Account</span><h1>Your account is waiting for approval</h1><p class="prose">We check each professional registration before giving access. You'll be able to use the professional pages once an administrator approves your account.</p><p class="muted">Signed in as ${esc(state.user.email)}.</p>`;
  if (st === "rejected" || st === "suspended") return `<span class="eyebrow">Account</span><h1>Access not available</h1><p class="prose">This account doesn't have access to the professional pages. Contact the DR ARVEEN team if you think this is a mistake.</p>`;
  return `<h1>Professional content isn't loaded yet</h1><p class="banner">Your account is approved, but the professional content hasn't been added to the database. The site owner needs to run the content import (see SUPABASE-SETUP.md).</p>`;
}
function bindAuth() {
  const lf = $("#loginf");
  if (lf) lf.onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: $("#li-email").value.trim(), password: $("#li-pass").value });
    if (error) return authErr(error.message === "Email not confirmed" ? "Confirm your email first: open the link we sent you." : "That email and password don't match an account.");
    const next = PARAMS.get("next"); location.href = PAGE === "login" ? (next && !/^[a-z]+:|^\/\//i.test(next) ? next : "professional.html") : location.href;
  };
  const rf = $("#regf");
  if (rf) rf.onsubmit = async e => {
    e.preventDefault();
    const v = id => $("#" + id).value.trim();
    if ($("#rg-pass").value.length < 8) return authErr("Use a password of at least 8 characters.");
    if (!$("#rg-agree").checked) return authErr("Tick the confirmation box to continue.");
    const { error } = await sb.auth.signUp({ email: v("rg-email"), password: $("#rg-pass").value, options: {
      emailRedirectTo: siteBase() + "login.html",
      data: { full_name: v("rg-name"), profession: v("rg-prof"), registration_body: v("rg-body"), registration_number: v("rg-num"), institution: v("rg-inst") } } });
    if (error) return authErr(error.message);
    rf.hidden = true; authOk("Request received. Check your email and open the confirmation link. An administrator will then verify your registration and approve your account.");
  };
  const pf = $("#resetf");
  if (pf) pf.onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.resetPasswordForEmail($("#rs-email").value.trim(), { redirectTo: siteBase() + "reset-password.html" });
    if (error) return authErr(error.message);
    authOk("If that email has an account, a reset link is on its way.");
  };
  const nf = $("#newpassf");
  if (nf) nf.onsubmit = async e => {
    e.preventDefault();
    if ($("#np-pass").value.length < 8) return authErr("Use a password of at least 8 characters.");
    const { error } = await sb.auth.updateUser({ password: $("#np-pass").value });
    if (error) return authErr(error.message);
    nf.hidden = true; authOk(`Password updated. <a href="professional.html">Continue</a>`);
  };
  if (PAGE === "accounts" && isAdmin()) { loadAccounts(); loadFeedback(); }
}
async function loadFeedback() {
  const box = $("#fblist"); if (!box) return;
  const { data, error } = await sb.from("feedback").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) { box.innerHTML = `<p class="result err" role="alert">Reports couldn't be loaded. Check that the feedback table from supabase/setup.sql exists.</p>`; return; }
  box.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Received</th><th>Page</th><th>Type</th><th>Report</th><th>Contact</th><th>Status</th></tr></thead><tbody>
  ${data.map(f => `<tr><td class="mono">${esc((f.created_at || "").slice(0, 10))}</td><td>${/^[a-z0-9-]+\.html(\?[\w=&%.~-]*)?$/i.test(f.page || "") ? `<a href="${esc(f.page)}">${esc(f.page)}</a>` : esc(f.page)}</td><td>${esc(f.category)}</td><td style="max-width:40ch;white-space:pre-wrap">${esc(f.message)}</td><td>${esc(f.contact || "—")}</td>
    <td>${f.status === "open" ? `<button class="btn" data-fb="${f.id}">Mark resolved</button>` : `<span class="pill ok">Resolved</span>`}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No reports yet.</td></tr>`}</tbody></table></div>`;
  box.querySelectorAll("[data-fb]").forEach(b => b.onclick = async () => {
    const { error } = await sb.from("feedback").update({ status: "resolved", resolved_by: state.user.id, resolved_at: new Date().toISOString() }).eq("id", b.dataset.fb);
    if (error) alertBox(error.message); loadFeedback();
  });
}
async function loadAccounts() {
  const box = $("#acctlist"); if (!box) return;
  const { data, error } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) { box.innerHTML = `<p class="result err" role="alert">${esc(error.message)}</p>`; return; }
  const pill = s => `<span class="pill ${s === "approved" ? "ok" : s === "pending" ? "warn" : "bad"}">${esc(s)}</span>`;
  box.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Name and email</th><th>Profession</th><th>Registration</th><th>Institution</th><th>Requested</th><th>Status</th><th>Role</th><th>Action</th></tr></thead><tbody>
  ${data.map(p => `<tr><td><b>${esc(p.full_name)}</b><br><span class="muted">${esc(p.email)}</span></td><td>${esc(p.profession)}</td><td>${esc(p.registration_body)}<br><span class="mono">${esc(p.registration_number)}</span></td><td>${esc(p.institution)}</td>
    <td class="mono">${esc((p.created_at || "").slice(0, 10))}</td><td>${pill(p.status)}${p.reviewed_at ? `<div class="muted" style="font-size:.75rem">${esc(p.reviewed_at.slice(0, 10))}</div>` : ""}</td>
    <td><select data-role="${p.id}" aria-label="Role for ${esc(p.email)}">${["reader", "editor", "reviewer", "admin"].map(r => `<option ${r === p.role ? "selected" : ""}>${r}</option>`).join("")}</select></td>
    <td><div class="toc">${p.id === state.user.id ? `<span class="muted">You</span>` : `<button class="btn" data-acct="${p.id}" data-st="approved">Approve</button><button class="btn" data-acct="${p.id}" data-st="rejected">Reject</button>${p.status === "approved" ? `<button class="btn" data-acct="${p.id}" data-st="suspended">Suspend</button>` : ""}`}</div></td></tr>`).join("") || `<tr><td colspan="8" class="muted">No account requests yet.</td></tr>`}
  </tbody></table></div>`;
  const upd = async (id, patch) => {
    const { error } = await sb.from("profiles").update({ ...patch, reviewed_by: state.user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) alertBox(error.message); loadAccounts();
  };
  box.querySelectorAll("[data-acct]").forEach(b => b.onclick = () => upd(b.dataset.acct, { status: b.dataset.st }));
  box.querySelectorAll("[data-role]").forEach(s => s.onchange = () => upd(s.dataset.role, { role: s.value }));
}
const alertBox = msg => { const b = $("#acctmsg"); if (b) { b.hidden = false; b.textContent = msg; } };
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
  if (!state.proLoaded) {
    D.diseases.forEach(d => add("pt", "Patient information", d.id, "ptd." + d.id, d.name, d.patient + " " + (d.patientSections || []).flat(2).join(" "), "About this cancer", "DRAFT"));
    D.leaflets.forEach(l => add("pt", "Information leaflet", l.id, "l." + l.id, l.title, l.audience + " " + (l.sections || []).flat(2).join(" "), l.version, l.approval));
    D.glossary.forEach(([t, d]) => add("pt", "Glossary", t, "glossary", t, d, d, "DRAFT")); (D.articles || []).forEach(a => add("pt", "Article", a.id, "a." + a.id, a.title, a.summary + " " + a.category + " " + a.sections.flat(2).join(" "), a.category, a.status));
    return I;
  }
  D.guidelines.forEach(g => add("pro", "Guideline", g.id, "g." + g.id, g.title, [orgs(g), dname(g.disease), g.domain.join(" "), g.summary, g.version].join(" "), `${orgs(g)} · ${g.version || "version not recorded"} · ${dname(g.disease)}`, g.status, g.superseded === "superseded" ? "Superseded guidance" : ""));
  D.recommendations.forEach(r => add("pro", "Recommendation", r.id, "g." + r.guideline, r.text, [r.stage, r.biomarker, r.setting, dname(r.disease)].join(" "), `${r.id} · ${dname(r.disease)} · ${r.stage}`, r.status));
  D.diseases.forEach(d => { add("pro", "Disease reference", d.id, "d." + d.id, d.name, d.short, "Disease page", "NOT VERIFIED"); add("pt", "Patient information", d.id, "ptd." + d.id, d.name, d.patient + " " + (d.patientSections || []).flat(2).join(" "), "About this cancer", "DRAFT"); });
  D.staging.forEach(s => add("pro", "Staging system", s.id, "s." + s.id, `${s.name} (${s.authority} ${s.version})`, JSON.stringify(s.stages) + " " + s.notes + " " + dname(s.cancer), `${s.authority} ${s.version}`, "NOT VERIFIED", s.superseded ? "Superseded staging version" : ""));
  D.protocols.forEach(p => add("pro", "Treatment protocol", p.id, "p." + p.id, p.name, [p.indication, p.biomarker, p.modality, p.components.map(c => c.drug).join(" ")].join(" "), `${dname(p.disease)} · ${p.line}`, p.status));
  D.drugs.forEach(d => add("pro", "Drug monograph", d.id, "dr." + d.id, d.name, [d.cls, d.moa, d.ae].join(" "), d.cls, "NOT VERIFIED"));
  D.trials.forEach(t => add("pro", "Clinical trial", t.id, "t." + t.id, t.name, [t.reg, t.population, t.intervention, t.comparator, dname(t.disease)].join(" "), `${t.reg} · Phase ${t.phase}`, "NOT VERIFIED"));
  D.leaflets.forEach(l => add("pt", "Information leaflet", l.id, "l." + l.id, l.title, l.audience + " " + (l.sections || []).flat(2).join(" "), l.version, l.approval));
  D.glossary.forEach(([t, d]) => add("pt", "Glossary", t, "glossary", t, d, d, "DRAFT")); (D.articles || []).forEach(a => add("pt", "Article", a.id, "a." + a.id, a.title, a.summary + " " + a.category + " " + a.sections.flat(2).join(" "), a.category, a.status));
  return I;
}
let IDX = [];
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
const seedBanner = () => `<p class="banner">Content is awaiting clinical review. Trial results come from published abstracts (<b>PARTIALLY VERIFIED</b>); other records are <b>NOT VERIFIED</b> until a named reviewer checks them. Doses are shown with their source and are <b>PENDING PHARMACIST REVIEW</b>: check the product information and your local protocol before prescribing.</p>`;
/* One-line headline result for a trial, taken from its primary endpoint */
function headline(t) {
  const o = t.outcome; if (!o) return "";
  const txt = /overall survival/i.test(t.primary || "") && !/progression|disease-free|failure-free|recurrence/i.test(t.primary || "") ? (o.os || o.pfs) : (o.pfs && !/^not reported/i.test(o.pfs) ? o.pfs : o.os);
  const first = String(txt || "").split(/(?<=\))\.\s|(?<=\d)\.\s(?=[A-Z])/)[0];
  return first.length > 170 ? first.slice(0, 167) + "…" : first;
}
/* Review progress across professional records */
function verificationSummary() {
  const recs = [
    ...D.guidelines.map(g => g.status), ...D.recommendations.map(r => r.status), ...D.staging.map(() => "NOT VERIFIED"),
    ...D.protocols.map(p => p.status), ...D.drugs.map(() => "NOT VERIFIED"), ...D.trials.map(t => t.outcome?.status || "NOT VERIFIED"),
    ...D.diseases.filter(d => d.reference).map(() => "NOT VERIFIED")
  ];
  const n = s => recs.filter(x => x === s).length;
  const ver = n("VERIFIED AGAINST SOURCE") + n("CLINICALLY REVIEWED") + n("APPROVED"), part = n("PARTIALLY VERIFIED"), tot = recs.length;
  return { tot, ver, part, not: tot - ver - part };
}
const LANG_NAMES = { en: "English", ms: "Bahasa Malaysia", zh: "中文", ta: "தமிழ்" };
/* Fixed leaflet wording per language. Translated labels need the same language and clinical review as the leaflets themselves. */
const LEAFLET_LABELS = {
  en: { eyebrow: "Patient information leaflet", print: "Print or save as PDF", seekHelp: "When should I seek help?", emergency: "Emergency — seek emergency help now (call 999)",
    urgent: "Urgent — contact your treating team promptly", routine: "Routine — discuss at your next appointment", questions: "Questions to ask your doctor",
    further: "Further information", contact: "Treating team contact:", contactPh: "[to be added by your hospital]", glossary: "Medical glossary",
    watermark: "DRAFT — NOT YET CLINICALLY REVIEWED — NOT FOR PATIENT USE", printDraft: "DRAFT — NOT APPROVED FOR PATIENT USE",
    draftNote: "This leaflet is a draft. Printed copies are marked DRAFT on every page and must not be given to patients until it is approved.",
    patientInfo: "Patient information", version: "Version", language: "Language", status: "Status", lastReviewed: "Last reviewed", nextReview: "Next review", printed: "Printed",
    notYet: "not yet reviewed", notSet: "not set", otherLangs: "Other languages", draftTranslation: "" },
  ms: { eyebrow: "Risalah maklumat pesakit", print: "Cetak atau simpan sebagai PDF", seekHelp: "Bilakah saya perlu mendapatkan bantuan?", emergency: "Kecemasan — dapatkan bantuan kecemasan sekarang (hubungi 999)",
    urgent: "Segera — hubungi pasukan rawatan anda dengan segera", routine: "Biasa — bincangkan pada temu janji seterusnya", questions: "Soalan untuk ditanya kepada doktor anda",
    further: "Maklumat lanjut", contact: "Hubungan pasukan rawatan:", contactPh: "[akan ditambah oleh hospital anda]", glossary: "Glosari perubatan (dalam bahasa Inggeris)",
    watermark: "DRAF — BELUM DISEMAK OLEH DOKTOR — BUKAN UNTUK KEGUNAAN PESAKIT", printDraft: "DRAF — BELUM DILULUSKAN UNTUK KEGUNAAN PESAKIT",
    draftNote: "Risalah ini ialah draf. Salinan bercetak ditanda DRAF pada setiap halaman dan tidak boleh diberikan kepada pesakit sehingga diluluskan.",
    patientInfo: "Maklumat pesakit", version: "Versi", language: "Bahasa", status: "Status", lastReviewed: "Disemak terakhir", nextReview: "Semakan seterusnya", printed: "Dicetak",
    notYet: "belum disemak", notSet: "belum ditetapkan", otherLangs: "Bahasa lain",
    draftTranslation: "Draf terjemahan. Terjemahan ini belum disemak oleh penterjemah bertauliah dan doktor. Versi bahasa Inggeris kekal sebagai rujukan utama." }
};
const transBanner = () => state.lang === "en" ? "" : `<p class="banner info">Translation not yet available. English is shown. Any translation must pass qualified language and clinical review before it is labelled approved.</p>`;

/* ---------- views: professional ---------- */
const V = {};
V.home = () => `
  <section class="hero hero-pro">
    <span class="eyebrow">Gynaecological oncology reference · Malaysia</span>
    <h1>DR ARVEEN — Evidence-Based Gynaecological Oncology.</h1>
    <p>Find clinical guidelines, staging criteria, treatment protocols, clinical trial evidence, and patient education resources in one integrated platform.</p>
    <form class="bigsearch" id="hs"><input id="hq" type="search" aria-label="Search" placeholder="Search a cancer, guideline, treatment, biomarker, drug, or clinical question."><button>Search</button></form>
    <div class="chips">${["Ovarian cancer", "FIGO 2023 endometrial staging", "Recurrent cervical cancer", "Carboplatin and paclitaxel", "Sentinel lymph node", "BRCA1 and BRCA2", "Endometrial molecular classification"].map(s => `<button class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>
  </section>
  ${(() => { const v = verificationSummary(); const pct = x => (100 * x / v.tot).toFixed(1); return `<section class="section progress-panel" aria-label="Review progress">
    <div class="section-h"><h2>Review progress</h2><span class="muted">${v.tot} professional records</span></div>
    <div class="vbar" role="img" aria-label="${v.ver} verified, ${v.part} partially verified, ${v.not} not yet verified"><span class="v-ok" style="width:${pct(v.ver)}%"></span><span class="v-part" style="width:${pct(v.part)}%"></span><span class="v-not" style="width:${pct(v.not)}%"></span></div>
    <div class="vlegend"><span><i class="v-ok"></i>Verified ${v.ver}</span><span><i class="v-part"></i>Partially verified ${v.part}</span><span><i class="v-not"></i>Not yet verified ${v.not}</span>${isAdmin() ? `<a href="${url(`admin`)}">Open the review tracker</a>` : ""}</div>
    <p class="muted" style="font-size:.84rem">Doses are pending pharmacist review and recommendation grades are transcribed from the source but await clinical review. Check every record's status label before relying on it.</p></section>`; })()}
  <section class="section"><div class="section-h"><h2>Disease hubs</h2><a href="${url(`diseases`)}">All diseases</a></div>
    <div class="grid">${D.diseases.map(d => { const nt = D.trials.filter(t => t.disease === d.id).length, ng = D.guidelines.filter(g => g.disease === d.id).length, ns = D.staging.filter(s => s.cancer === d.id && !s.superseded).length;
      return `<a class="tile hub" href="${url(`d.${d.id}`)}">${badge(d.id)}<b>${esc(d.name)}</b><span>${esc(d.short)}</span><span class="hubmeta">${[ng && `${ng} guideline${ng > 1 ? "s" : ""}`, ns && `${ns} staging`, nt && `${nt} trial${nt > 1 ? "s" : ""}`, d.reference && "24-section reference"].filter(Boolean).join(" · ") || "Reference in progress"}</span></a>`; }).join("")}</div></section>
  <section class="section band"><div class="section-h"><h2>Key evidence</h2><a href="${url(`trials`)}">All trials</a></div>
    <div class="tablewrap"><table><thead><tr><th>Trial</th><th>Question</th><th>Headline result</th><th>Status</th></tr></thead><tbody>
    ${D.trials.filter(t => t.outcome).map(t => `<tr><td><a href="${url(`t.${t.id}`)}"><b>${esc(t.name)}</b></a><div class="muted" style="font-size:.78rem">${dname(t.disease)}</div></td><td style="font-size:.86rem">${esc(t.intervention)} vs ${esc(t.comparator)}</td><td style="font-size:.86rem">${esc(headline(t))}</td><td>${statusPill(t.outcome.status)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Trial results load from the database. If this is empty, the latest seed.sql has not been run.</td></tr>`}
    </tbody></table></div></section>
  <section class="section"><h2>Clinical tools</h2><div class="grid">
    <a class="tile" href="${url(`calculators`)}">${ic("calculators")}<b>Calculators</b><span>BSA, BMI, Cockcroft–Gault, CKD-EPI 2021, RMI, Calvert dose support.</span></a>
    <a class="tile" href="${url(`staging`)}">${ic("staging")}<b>Staging systems</b><span>${D.staging.filter(s => !s.superseded).length} current FIGO systems with searchable criteria.</span></a>
    <a class="tile" href="${url(`algorithms`)}">${ic("algorithms")}<b>Clinical pathways</b><span>Six step-by-step pathways: cervical work-up, suspected ovarian and endometrial cancer, endometrial risk group, recurrence, biomarkers.</span></a>
    <a class="tile" href="${url(`education`)}">${ic("education")}<b>Staging exercises</b><span>${D.quiz.length} questions with explanations.</span></a></div></section>
  <section class="section"><h2>Browse by resource</h2>
    <div class="grid">${[["guidelines", "Clinical guidelines", D.guidelines.length + " records"], ["staging", "Staging systems", D.staging.length + " systems"], ["protocols", "Treatment protocols", D.protocols.length + " regimens"], ["algorithms", "Clinical algorithms", D.algorithms.length + " pathway"], ["drugs", "Drug monographs", D.drugs.length + " drugs"], ["trials", "Clinical trials", D.trials.length + " trials"], ["compare", "Guideline comparisons", "By clinical question"], ["calculators", "Calculators", "BSA, BMI, renal function, Calvert"], ["education", "Educational resources", "Staging exercises"], ["updates", "Recent updates", D.updates.length + " surveillance items"]].map(([r, t, s]) => `<a class="tile" href="${url(`${r}`)}">${ic(r)}<b>${t}</b><span>${s}</span></a>`).join("")}</div></section>
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
  ${(D.organisations || []).length ? `<details class="section"><summary><b>Guideline organisations and official websites (${D.organisations.length})</b></summary><div class="tablewrap"><table><thead><tr><th>Abbreviation</th><th>Full name</th><th>Official website</th></tr></thead><tbody>${D.organisations.map(o => `<tr><td><b>${esc(o.id)}</b></td><td>${esc(o.name)}</td><td><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.label || new URL(o.url).hostname.replace(/^www\./, ""))} ↗</a></td></tr>`).join("")}</tbody></table></div></details>` : ""}
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
    <td>${/^Not /.test(r.grade) ? `<span class="na">${esc(r.grade)}</span>` : `<b>${esc(r.grade)}</b>`}<br>${/^Not /.test(r.strength) ? `<span class="na">${esc(r.strength)}</span>` : esc(r.strength)}</td><td>${myLabel(r.malaysia)}</td>
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
    ${[["Guideline ID", `<span class="mono">${g.id}</span>`], ["Organisation", esc(orgs(g))], ["Disease", dname(g.disease)], ["Clinical domain", na(g.domain)], ["Document type", na(g.type)], ["Publication date (issuer)", na(g.pubDate)], ["Version", na(g.version)], ["Revision date", na(g.revisionDate)], ["Jurisdiction", na(g.jurisdiction)], ["Patient population", na(g.population)], ["Clinical setting", na(g.setting)], ["Source", `<a href="${esc(g.sourceUrl)}" target="_blank" rel="noopener">${esc(g.sourceUrl)}</a> <span class="muted">(organisation index; record-level link pending)</span>`], ["Full-text access", na(g.access)], ["Evidence-grading framework", na(g.evidenceFramework)], ["Recommendation-grading framework", na(g.recFramework)], ["ARVEEN verification date", g.verifiedOn ? esc(g.verifiedOn) : '<span class="na">Not yet verified</span>'], ["Reviewer", g.reviewer ? esc(g.reviewer) : '<span class="na">Unassigned</span>'], ["Content status", statusPill(g.status)], ...(g.authors ? [["Authors", esc(g.authors)]] : []), ...(g.citations ? [["Published in", g.citations.map(c => esc(c)).join("<br>")]] : []), ...(g.extraction ? [["Extraction", `${esc(g.extraction.on)} · ${esc(g.extraction.by)}`]] : [])].map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}
  </div></section>
  <section class="section"><h2>Executive summary</h2><p class="prose"><span class="pill teal">ARVEEN educational summary</span> ${esc(g.summary)}</p></section>
  <section class="section"><h2>Recommendations</h2>${recs.length ? recTable(recs) : `<p class="muted">No recommendations have been extracted from this guideline yet.</p>`}</section>
  ${g.extraction?.protocolCandidates?.length ? `<section class="section"><h2>Protocol details found in this guideline</h2><p class="banner bad">Awaiting pharmacist and clinical verification. These are not shown in the protocol library until verified.</p><div class="tablewrap"><table><thead><tr><th>Protocol</th><th>Field</th><th>What the guideline says</th><th>Where</th></tr></thead><tbody>${g.extraction.protocolCandidates.map(c => `<tr><td><a href="${url(`p.${c.protocol}`)}">${esc(c.protocol)}</a></td><td>${esc(c.field)}</td><td>${esc(c.value)}</td><td style="font-size:.82rem">${esc(c.location)}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
  <section class="section"><h2>Malaysian applicability</h2><p class="prose">${myLabel(g.malaysia)} No Malaysian MOH guidance, NPRA registration or local availability data has been linked to this record.</p></section>
  <section class="section"><h2>Important limitations</h2><p class="prose">${esc(g.limitations)}</p></section>
  <section class="section"><h2>Version history</h2>${g.history.length ? `<div class="list">${g.history.map(h => `<div class="row"><span class="row-t mono">${esc(h.v)}</span><span class="row-m">${esc(h.note)}</span></div>`).join("")}</div>` : `<p class="muted">No versions recorded.</p>`}</section>
  ${noteBox(g.id)}</article>`;
};

V.diseases = () => `<span class="eyebrow">Disease reference library</span><h1>Diseases</h1>
  <div class="grid">${D.diseases.map(d => `<a class="tile" href="${url(`d.${d.id}`)}">${badge(d.id)}<b>${esc(d.name)}</b><span>${esc(d.short)}</span></a>`).join("")}</div>`;
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
  const quick = ["Staging", "Management by stage and subtype", "Systemic therapy", "Pivotal trials", "Current guideline references", "Malaysian applicability", "Clinical pearls", "Patient education links"];
  const secs = mode === "quick" ? quick : DTEMPLATE;
  const ref = d.reference || {};
  const body = s => { const txt = ref[s] || [], lk = linked[s] || [];
    if (!txt.length && !lk.length) return `<span class="na" style="font-size:.86rem">Content not yet authored. Requires source-linked authoring and clinical review.</span>`;
    return `${txt.length ? `<ul class="plist" style="font-size:.92rem">${txt.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${lk.length ? `<div style="display:grid;gap:4px;font-size:.9rem">${lk.map(x => `<span>${x}</span>`).join("")}</div>` : ""}`; };
  return `<article class="detail"><div class="dhead"><div class="dtitle">${badge(d.id, true)}<div><span class="eyebrow">Disease reference</span><h1>${esc(d.name)}</h1></div></div><p class="prose muted">${esc(d.short)}</p>
    <div class="actions"><button class="btn" data-mode="quick" aria-pressed="${mode === "quick"}">Quick reference</button><button class="btn" data-mode="comp" aria-pressed="${mode !== "quick"}">Comprehensive reference</button>${bmBtn("Disease", d.id, d.name)}</div></div>
  <section class="glance" aria-label="At a glance">
    <div><span class="eyebrow">Staging</span>${st.filter(s => !s.superseded).map(s => `<a href="${url(`s.${s.id}`)}">${esc(s.authority)} ${esc(s.version)}</a>`).join("") || `<span class="na">Not entered</span>`}</div>
    <div><span class="eyebrow">Key trials</span>${tr.length ? tr.map(t => `<a href="${url(`t.${t.id}`)}"><b>${esc(t.name)}</b></a>${t.outcome ? `<span class="glance-res">${esc(headline(t))}</span>` : ""}`).join("") : `<span class="na">None entered</span>`}</div>
    <div><span class="eyebrow">Guidelines</span>${gl.map(g => `<a href="${url(`g.${g.id}`)}">${esc(orgs(g))} ${esc(g.version || "")}</a>`).join("") || `<span class="na">None entered</span>`}</div>
    <div><span class="eyebrow">For patients</span><a href="${url(`ptd.${d.id}`)}">Patient page</a>${D.leaflets.filter(l => l.disease === id && (l.sections || []).length).map(l => `<a href="${url(`l.${l.id}`)}">${esc(l.title)}</a>`).join("")}</div>
  </section>
  ${d.reference ? `<p class="banner"><span class="pill teal">ARVEEN educational summary</span> ${statusPill("NOT VERIFIED")} Written for education and awaiting clinical review against the cited guidelines. For doses see the drug and protocol pages. Do not use for prescribing.</p>` : ""}
  ${mode !== "quick" ? `<p class="banner info">Comprehensive reference uses the standard 24-section template.</p>` : ""}
  <div class="list">${secs.map((s, i) => `<div class="row"><span class="row-t">${mode !== "quick" ? `<span class="mono muted">${String(DTEMPLATE.indexOf(s) + 1).padStart(2, "0")}</span>` : ""} ${s}</span>
    ${body(s)}</div>`).join("")}</div>
  ${noteBox("d-" + d.id)}</article>`;
};

V.staging = () => `<span class="eyebrow">Staging module</span><h1>Staging systems</h1>
  <p class="banner info">Definitions are <b>ARVEEN educational paraphrases</b> of the FIGO criteria, not the published text, and are NOT VERIFIED. Formal staging is kept separate from treatment recommendations. Do not mix criteria between versions.</p>
  <div class="list">${D.staging.map(s => `<a class="row" href="${url(`s.${s.id}`)}"><span class="row-t">${esc(s.name)} <span class="mono">${esc(s.authority)} ${esc(s.version)}</span> ${s.superseded ? '<span class="pill bad">Superseded</span>' : '<span class="pill ok">Current per seed</span>'} ${statusPill("NOT VERIFIED")}</span><span class="row-m">${dname(s.cancer)} · ${s.stages.length ? s.stages.length + " main stages" : "criteria not entered"}</span></a>`).join("")}</div>
  <p><a class="btn" href="${url(`education`)}">Practise with staging exercises →</a></p>`;
function stageTree(list) {
  return list.map(x => x.sub ? `<details class="stage" open><summary><span class="code">${esc(x.s)}</span><span>${esc(x.d)}</span></summary><div class="kids">${stageTree(x.sub)}</div></details>`
    : `<div class="stage leaf"><div class="sum"><span class="code">${esc(x.s)}</span><span>${esc(x.d)}</span></div></div>`).join("");
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
  <p class="banner bad"><b>Doses are pending pharmacist review.</b> Each dose shows its source (guideline, product information or trial). Check it against the Malaysian product information and your institutional protocol before prescribing.</p>
  <div class="list">${D.protocols.map(p => `<a class="row" href="${url(`p.${p.id}`)}"><span class="row-t">${esc(p.name)} ${statusPill(p.status)} ${p.labels.map(l => `<span class="pill bad">${esc(l)}</span>`).join("")}</span>
    <span class="row-m"><span>${dname(p.disease)}</span><span>${esc(p.line)}</span><span>${esc(p.modality)}</span><span>Biomarker: ${esc(p.biomarker)}</span></span></a>`).join("")}</div>`;
V.p = id => {
  const p = byId(D.protocols, id); if (!p) return notFound();
  recent("Protocol", p.id, p.name);
  const W = `<span class="withheld">withheld · not verified</span>`;
  const fields = [["Regimen", esc(p.name)], ["Clinical indication", esc(p.indication)], ["Disease and histology", `${dname(p.disease)} · ${esc(p.histology)}`], ["Stage", na(p.stage)], ["Treatment intent", na(p.intent)], ["Treatment line", na(p.line)], ["Eligibility", W], ["Biomarker requirements", na(p.biomarker)], ["Cycle length", na(p.cycle)], ["Treatment duration", na(p.duration)], ["Premedication", W], ["Supportive medications", W], ["Baseline investigations", W], ["Monitoring", W], ["Renal adjustments", W], ["Hepatic adjustments", W], ["Haematological criteria", W], ["Dose modifications", W], ["Contraindications", W], ["Important interactions", W], ["Toxicity management", W], ["Interruption / restart criteria", W], ["Source protocol", esc(p.sourceType)], ["Version", '<span class="na">Not recorded</span>'], ["Verification status", statusPill(p.status)], ["Malaysian applicability", myLabel(p.malaysia)]];
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Treatment protocol · ${esc(p.modality)}</span><h1>${esc(p.name)}</h1><div class="row-m">${statusPill(p.status)} ${myLabel(p.malaysia)} ${p.labels.map(l => `<span class="pill bad">${esc(l)}</span>`).join("")}</div><div class="actions">${bmBtn("Protocol", p.id, p.name)}</div></div>
  ${p.doseStatus ? `<p class="banner bad">${statusPill(p.doseStatus)} Not for prescribing until a pharmacist has checked these doses. Dose source: ${esc(p.doseSource)}.</p>` : `<p class="banner bad">Not for prescribing. This record has no verified source protocol. Dose fields stay empty until a reviewer enters them from an authoritative source and clinical approval is recorded.</p>`}
  <section class="section"><h2>Regimen components</h2><div class="tablewrap"><table><thead><tr><th>Drug</th><th>Calculation basis</th><th>Dose</th><th>Route</th><th>Schedule</th></tr></thead><tbody>
    ${p.components.map(c => `<tr><td><a href="${url(`dr.${c.drug}`)}">${esc(byId(D.drugs, c.drug)?.name || c.drug)}</a></td><td>${esc(c.basis)}</td><td>${c.dose ? `<b>${esc(c.dose)}</b>` : W}</td><td>${esc(c.route)}</td><td>${c.schedule ? esc(c.schedule) : W}</td></tr>`).join("")}</tbody></table></div></section>
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
  <div class="kv">${[["Generic name", esc(d.name)], ["Drug class", esc(d.cls)], ["Mechanism of action", esc(d.moa)], ["Cancer types", d.cancers.map(c => `<a href="${url(`d.${c}`)}">${dname(c)}</a>`).join(", ")], ["Major adverse effects", esc(d.ae)], ["Renal considerations", esc(d.renal)], ["Dose by indication", d.doses ? `${statusPill(d.doseStatus)}<ul class="doses">${d.doses.map(x => `<li><b>${esc(x.indication)}:</b> ${esc(x.dose)} <span class="muted">Source: ${esc(x.source)}</span></li>`).join("")}</ul>` : `<span class="withheld">not entered</span>`], ["Administration", d.admin ? esc(d.admin) : W], ["Contraindications", d.contra ? esc(d.contra) : W], ["Drug interactions", d.interactions ? esc(d.interactions) : W], ["Hepatic considerations", d.hepatic ? esc(d.hepatic) : W], ["Pregnancy and breastfeeding", d.pregnancy ? esc(d.pregnancy) : W], ["Fertility considerations", d.fertility ? esc(d.fertility) : W], ["Monitoring", d.monitoring ? esc(d.monitoring) : W], ["Dose modifications", `<span class="withheld">withheld · per verified protocol only</span>`], ["Patient counselling", d.counselling ? esc(d.counselling) : W], ["Product information", '<span class="na">Not linked</span>'], ["Malaysian regulatory status (NPRA)", `<span class="pill warn">${esc(d.npra)}</span>`], ["Used in ARVEEN protocols", pr.map(p => `<a href="${url(`p.${p.id}`)}">${esc(p.name)}</a>`).join("<br>") || na(null)]].map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}</div>
  ${noteBox(d.id)}</article>`;
};

V.trials = () => {
  const f = state.filters.trialDisease || "";
  const list = D.trials.filter(t => !f || t.disease === f);
  return `<span class="eyebrow">Clinical trials and evidence</span><h1>Clinical trials</h1>
  <p class="banner">Outcomes are entered from the published abstracts on PubMed, with the PubMed ID on each trial page. They are <b>PARTIALLY VERIFIED</b> until a clinical reviewer checks them against the full paper. Subgroup and interim results are labelled as such.</p>
  <div class="chips"><button class="chip" data-td="" aria-pressed="${!f}">All</button>${[...new Set(D.trials.map(t => t.disease))].map(d => `<button class="chip" data-td="${d}" aria-pressed="${f === d}">${dname(d)}</button>`).join("")}</div>
  <div class="tablewrap"><table><thead><tr><th>Trial</th><th>Intervention vs comparator</th><th>Primary endpoint</th><th>Headline result</th><th>Source</th></tr></thead><tbody>
  ${list.map(t => `<tr><td><a href="${url(`t.${t.id}`)}"><b>${esc(t.name)}</b></a><div class="muted" style="font-size:.78rem">${dname(t.disease)} · Phase ${esc(t.phase)}</div><div class="mono muted" style="font-size:.74rem">${esc(t.reg)}</div></td><td>${esc(t.intervention)}<div class="muted">vs ${esc(t.comparator)}</div></td><td>${esc(t.primary)}</td><td style="font-size:.86rem">${t.outcome ? esc(headline(t)) : '<span class="na">Not entered</span>'}</td><td style="font-size:.82rem">${esc(t.pub)}<div>${statusPill(t.outcome?.status || "NOT VERIFIED")}</div></td></tr>`).join("")}
  </tbody></table></div>`;
};
V.t = id => {
  const t = byId(D.trials, id); if (!t) return notFound();
  recent("Trial", t.id, t.name);
  const N = `<span class="withheld">not entered · pending verification</span>`;
  const recs = D.recommendations.filter(r => r.trials.includes(id));
  const o = t.outcome || {}; const f = v => v ? esc(v) : N;
  const pmids = String(o.pmid || "").split(/;\s*/).filter(Boolean);
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Clinical trial · ${dname(t.disease)}</span><h1>${esc(t.name)}</h1><div class="row-m"><span class="mono">${esc(t.reg)}</span> ${statusPill(o.status || "NOT VERIFIED")}</div><div class="actions">${bmBtn("Trial", t.id, t.name)}${/^NCT\d{8}$/.test(t.reg) ? `<a class="btn" target="_blank" rel="noopener" href="https://clinicaltrials.gov/study/${t.reg}">Registry record ↗</a>` : ""}</div></div>
  <div class="kv">${[["Study design", esc(t.design)], ["Phase", esc(t.phase)], ["Population", esc(t.population)], ["Intervention", esc(t.intervention)], ["Comparator", esc(t.comparator)], ["Primary endpoint", esc(t.primary)], ["Patients", f(o.n)], ["Trial regimen (as published, not a protocol)", f(o.regimen)], ["Progression-free / disease-free outcome", f(o.pfs)], ["Overall survival", f(o.os)], ["Other outcomes", o.other ? esc(o.other) : na(null)], ["Major adverse events", f(o.ae)], ["Follow-up", f(o.followUp)], ["Limitations", f(o.limitations)], ["Publication", esc(t.pub)], ["Report type", esc(t.pubType)], ["Source", pmids.length ? pmids.map(p => `<a href="https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(p)}/" target="_blank" rel="noopener">PubMed ${esc(p)} ↗</a>`).join(" · ") + (o.doi ? ` <span class="mono muted">doi ${esc(o.doi)}</span>` : "") : N], ["Cited by ARVEEN recommendations", recs.map(r => `<a href="${url(`g.${r.guideline}`)}">${r.id}</a>`).join(", ") || na(null)]].map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}</div>
  ${o.note ? `<p class="banner">${esc(o.note)}</p>` : ""}
  <section class="section"><h2>Evidence appraisal</h2>${o.limitations ? `<p class="prose">Population: ${esc(t.population)}. Comparator: ${esc(t.comparator)}. Main limitation: ${esc(o.limitations)}</p><p class="prose muted">A full appraisal (applicability to current Malaysian practice, risk of bias, interpretation of subgroups) is pending clinical review.</p>` : `<p class="prose na">Not yet written.</p>`}</section>
  ${noteBox(t.id)}</article>`;
};

let algoPath = [], algoId = new URLSearchParams(location.search).get("id");
const refLink = id => {
  const r = byId(D.recommendations, id); if (r) return `<a href="${url(`g.${r.guideline}`)}#${esc(id)}">${esc(id)}</a> <span class="muted">(${esc(r.grade)}, ${esc(r.strength)})</span>`;
  if (byId(D.trials, id)) return `<a href="${url(`t.${id}`)}">${esc(byId(D.trials, id).name)}</a>`;
  if (byId(D.guidelines, id)) return `<a href="${url(`g.${id}`)}">${esc(id)}</a>`;
  if (byId(D.protocols, id)) return `<a href="${url(`p.${id}`)}">${esc(byId(D.protocols, id).name)}</a>`;
  const l = (D.literature || []).find(x => x.id === id); if (l) return `<a href="https://doi.org/${esc(l.doi)}" target="_blank" rel="noopener">${esc(l.authors.split(",")[0])} ${esc(l.citation.match(/20\d\d/)?.[0] || "")} ↗</a>`;
  return esc(id);
};
V.algorithms = () => {
  const a = byId(D.algorithms, algoId) || D.algorithms[0];
  if (!algoPath.length || !a.nodes[algoPath[0]]) algoPath = ["start"];
  const picker = D.algorithms.length > 1 ? `<div class="chips" role="group" aria-label="Choose a pathway">${D.algorithms.map(x => `<button class="chip" data-algo="${esc(x.id)}" aria-pressed="${x.id === a.id}">${esc(x.title.split(":")[0])}</button>`).join("")}</div>` : "";
  const steps = algoPath.map((k, i) => {
    const n = a.nodes[k]; const last = i === algoPath.length - 1;
    if (n.end) return `<div class="step end ${n.kind}"><span class="eyebrow">${n.kind === "missing" ? "Missing information" : n.kind === "escalate" ? "Referral / escalation" : n.kind === "action" ? "Required investigation" : "Outcome"}</span><p>${esc(n.end)}</p>${n.refs?.length ? `<p class="muted" style="font-size:.84rem">Based on: ${n.refs.map(refLink).join(" · ")}</p>` : ""}</div>`;
    const chosen = algoPath[i + 1];
    return `<div class="step ${last ? "" : "past"}"><p><b>${esc(n.q)}</b></p><div class="opts">${n.options.map(([t, to]) => `<button class="btn" data-step="${i}" data-to="${to}" aria-pressed="${chosen === to}">${esc(t)}</button>`).join("")}</div></div>`;
  }).join("");
  const g = byId(D.guidelines, a.source);
  return `<span class="eyebrow">Clinical algorithms</span>${picker}<h1>${esc(a.title)}</h1>
  <div class="row-m">${statusPill(a.status)} <span>Main source: <a href="${url(`g.${a.source}`)}">${esc(a.source)}</a>${g ? ` (${esc(g.version || "")}, ${esc(g.status || "not verified")})` : ""}</span><span>Verification date: <span class="na">Not yet verified</span></span></div>
  ${a.sourceNote ? `<p class="muted" style="font-size:.86rem">${esc(a.sourceNote)}</p>` : ""}
  <p class="banner info">Educational pathway. Where information is missing it says so instead of forcing a conclusion. It does not select treatment: the MDT decides.</p>
  <p class="prose"><b>Entry criteria:</b> ${esc(a.entry)}</p>
  <div class="algo" aria-live="polite">${steps}<div><button class="btn" id="algoreset">Start again</button></div></div>`;
};

V.calculators = () => `<span class="eyebrow">Calculator library</span><h1>Calculators</h1>
  <p class="banner bad">Calculation support only. Results are not a prescription. Rounding, capping and the choice of renal-function estimate follow your institution's protocol, which this tool does not apply.</p>
  <div class="calcs">
    ${calcCard("bsa", "Body surface area", [["h", "Height (cm)", 100, 230], ["w", "Weight (kg)", 25, 250]], "Mosteller: √(height cm × weight kg / 3600). Du Bois: 0.007184 × W^0.425 × H^0.725.", "Adults. Some protocols cap BSA or use adjusted weight; not applied here.")}
    ${calcCard("bmi", "Body mass index", [["h", "Height (cm)", 100, 230], ["w", "Weight (kg)", 25, 250]], "Weight (kg) / height (m)². WHO adult categories; Asian populations may use lower action thresholds.", "Adults only. Does not reflect body composition.")}
    ${calcCard("crcl", "Creatinine clearance (Cockcroft–Gault)", [["age", "Age (years)", 18, 110], ["w", "Weight (kg)", 25, 250], ["cr", "Serum creatinine (µmol/L)", 20, 1500], ["sex", "Sex", null, null, ["female", "male"]]], "((140 − age) × weight × K) / creatinine (µmol/L); K = 1.04 female, 1.23 male.", "Unreliable with unstable renal function, extremes of body weight or low muscle mass. The weight used (actual, ideal, adjusted) varies by protocol.")}
    ${calcCard("egfr", "eGFR (CKD-EPI 2021, race-free)", [["age", "Age (years)", 18, 110], ["cr", "Serum creatinine (µmol/L)", 20, 1500], ["sex", "Sex", null, null, ["female", "male"]]], "142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^age × 1.012 if female. κ 0.7 F / 0.9 M; α −0.241 F / −0.302 M. Scr in mg/dL (µmol/L ÷ 88.4).", "Indexed to 1.73 m². Do not substitute into the Calvert formula without de-indexing per protocol.")}
    ${calcCard("rmi", "Risk of Malignancy Index (RMI I)", [["f", "Ultrasound features present (0–5)", 0, 5], ["meno", "Menopausal status", null, null, ["postmenopausal", "premenopausal"]], ["ca", "Serum CA125 (IU/mL)", 0, 100000]], "RMI = U × M × CA125. U = 0 (no features), 1 (one feature) or 3 (two to five) of: multilocular cyst, solid areas, metastases, ascites, bilateral lesions. M = 3 postmenopausal, 1 premenopausal. NICE CG122: refer to the specialist MDT if RMI is 250 or more.", "Adnexal masses only. Not valid in pregnancy. CA125 can rise in benign conditions (endometriosis, infection, menstruation). Threshold from NICE CG122 (not yet verified against the PDF).")}
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
  calvert: v => `${(v.auc * (v.gfr + 25)).toFixed(0)} mg (unrounded, uncapped)`,
  rmi: v => { if (!Number.isInteger(v.f)) return "Features must be a whole number from 0 to 5."; const u = v.f === 0 ? 0 : v.f === 1 ? 1 : 3, m = v.meno === "postmenopausal" ? 3 : 1, r = u * m * v.ca; return `RMI ${r.toFixed(0)} (U ${u} × M ${m} × CA125 ${v.ca}) — ${r >= 250 ? "250 or more: refer to the specialist MDT (NICE CG122)" : "below 250"}`; }
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
  <p class="muted" style="font-size:.84rem">Where only one guideline has been extracted for a question, no differences can be shown yet.</p>
  ${litSection("evidence", "Research library", "Recent studies relevant to practice, summarised from the articles. Each summary is NOT VERIFIED until a reviewer checks it against the full paper; read the original before applying any finding.")}`;
};

// Research library (journal articles summarised by ARVEEN), shown on the Evidence and Education pages.
const litSection = (place, title, intro) => {
  const items = (D.literature || []).filter(x => x.place === place);
  if (!items.length) return "";
  const dn = d => d === "all" ? "All gynaecological cancers" : dname(d);
  const link = id => id.startsWith("T-") ? `<a href="${url(`t.${id}`)}">${esc(byId(D.trials, id)?.name || id)}</a>` : id.startsWith("G-") ? `<a href="${url(`g.${id}`)}">${esc(id)}</a>` : esc(id);
  const groups = [...new Set(items.map(x => x.disease))];
  return `<section class="section"><h2>${esc(title)}</h2><p class="muted">${esc(intro)}</p>
    ${groups.map(g => `<h3>${esc(dn(g))}</h3><div class="list">${items.filter(x => x.disease === g).map(x => `<details class="row lit">
      <summary><span class="row-t">${esc(x.title)} ${statusPill(x.status)}</span><span class="row-m"><span>${esc(x.type)}</span><span>${esc(x.topic)}</span><span>${esc(x.authors)} ${esc(x.citation)}</span></span></summary>
      <p class="prose">${esc(x.summary)}</p><ul>${x.findings.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
      <p class="muted"><b>Caveat:</b> ${esc(x.caveat)}</p>
      ${x.related.length || x.drugs.length ? `<p class="muted">Related: ${[...x.related.map(link), ...x.drugs.map(d => `<a href="${url(`dr.${d}`)}">${esc(byId(D.drugs, d)?.name || d)}</a>`)].join(", ")}</p>` : ""}
      <p><a href="https://doi.org/${encodeURIComponent(x.doi).replace(/%2F/g, "/")}" target="_blank" rel="noopener">Read the article (doi ${esc(x.doi)}) ↗</a></p></details>`).join("")}</div>`).join("")}</section>`;
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
    <div style="display:grid;gap:6px">${q.options.map((o, i) => `<button class="btn opt" data-qi="${i}">${esc(o)}</button>`).join("")}</div><p class="why muted" role="status" hidden>${esc(q.why)} <a href="${url(`s.${s.id}`)}">Reference: ${esc(s.authority)} ${esc(s.version)}</a></p></div>` }).join("")}</div>
  ${litSection("education", "Reviews, surgical videos and case learning", "Reviews, video articles, images and case reports for teaching. Videos play on the journal website.")}`;
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
  const link = x => { const p = { Guideline: "g.", Disease: "d.", Staging: "s.", Protocol: "p.", Drug: "dr.", Trial: "t.", Leaflet: "l.", "Patient page": "ptd.", Article: "a." }[x.type] || ""; const sup = x.type === "Guideline" && byId(D.guidelines, x.id)?.superseded === "superseded"; return `<a class="row" href="${url(`${p}${x.id}`)}"><span class="row-t">${esc(x.title)} ${sup ? '<span class="pill bad">Now superseded</span>' : ""}</span><span class="row-m"><span class="eyebrow">${esc(x.type)}</span>${x.at ? `<span>${x.at}</span>` : ""}</span></a>` };
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
/* Review status of every patient leaflet, article and cancer page, for the editorial team */
function contentTracker() {
  const rows = [
    ...D.leaflets.map(l => ({ kind: "Leaflet", route: "l." + l.id, title: l.title, status: l.approval, reviewer: l.reviewer, last: l.lastReview, next: l.nextReview,
      trans: l.translations ? Object.entries(l.translations).map(([lg, t]) => `${LANG_NAMES[lg]}: ${t.status}`).join("; ") : "None" })),
    ...(D.articles || []).map(a => ({ kind: "Article", route: "a." + a.id, title: a.title, status: a.status, reviewer: a.reviewer, last: a.lastReview, next: a.nextReview, trans: "None" })),
    ...D.diseases.map(d => ({ kind: "Cancer page", route: "ptd." + d.id, title: d.name, status: d.patientSections ? "DRAFT" : ["tubal", "peritoneal"].includes(d.id) ? "USES OVARIAN PAGE" : "NOT STARTED", reviewer: null, last: null, next: null, trans: "None" }))
  ];
  const count = s => rows.filter(r => r.status === s).length;
  const today = new Date().toISOString().slice(0, 10);
  return `<section class="section"><h2>Patient content review tracker</h2>
  <div class="tracker-sum">${[["Total", rows.length], ["Draft", count("DRAFT")], ["Approved", count("APPROVED") + count("PUBLISHED")], ["Not started", count("NOT STARTED")], ["Review overdue", rows.filter(r => r.next && r.next < today).length]].map(([k, v]) => `<div><span class="eyebrow">${k}</span><b>${v}</b></div>`).join("")}</div>
  <div class="tablewrap"><table><thead><tr><th>Type</th><th>Title</th><th>Status</th><th>Clinical reviewer</th><th>Last reviewed</th><th>Next review</th><th>Translations</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td>${r.kind}</td><td><a href="${url(r.route)}">${esc(r.title)}</a></td><td>${statusPill(r.status)}</td><td>${r.reviewer ? esc(r.reviewer) : '<span class="na">Unassigned</span>'}</td><td>${na(r.last)}</td><td>${r.next && r.next < today ? `<span class="pill bad">${esc(r.next)}</span>` : na(r.next)}</td><td style="font-size:.82rem">${esc(r.trans)}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="muted" style="font-size:.84rem">To record a review, update the item in dr-arveen-content (status, reviewer, lastReview, nextReview), rebuild and publish. Only mark an item APPROVED after the clinical review is complete.</p></section>`;
}
V.admin = () => {
  const queue = [...D.guidelines.map(g => ({ t: g.title, k: "Guideline", at: "STRUCTURED", flow: PRO_FLOW })), ...D.protocols.map(p => ({ t: p.name, k: "Protocol · high-risk", at: "STRUCTURED", flow: PRO_FLOW })), ...D.leaflets.filter(l => l.approval === "DRAFT").map(l => ({ t: l.title, k: "Patient leaflet", at: "DRAFT", flow: PT_FLOW }))];
  return `<span class="eyebrow">Editorial and governance</span><h1>Editorial dashboard</h1>
  <p class="banner info">Prototype view. In production this area requires an editor or reviewer role, checked on the server, and every change is written to the audit log.</p>
  <section class="section"><h2>Review queue</h2><div class="list">${queue.slice(0, 8).map(q => `<div class="row"><span class="row-t">${esc(q.t)} <span class="pill">${q.k}</span></span>${pipe(q.flow, q.at)}<span class="row-m">Reviewer: <span class="na">Unassigned</span></span></div>`).join("")}</div><p class="muted">${queue.length} items in queue; first 8 shown.</p></section>
  ${contentTracker()}
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
  <h2>Who runs DR ARVEEN</h2><p class="todo">[To be completed by the owner: name, qualifications, registration body and number, and the institution, if any, that DR ARVEEN is affiliated with.]</p>
  <h2>Clinical lead and reviewers</h2><p class="todo">[To be completed: the clinical lead responsible for content, and the reviewers for each content type, with their qualifications.]</p>
  <h2>Funding</h2><p class="todo">[To be completed: how DR ARVEEN is funded. If it is self-funded, say so.]</p>
  <h2>Advertising and sponsorship</h2><p>DR ARVEEN does not carry advertising and does not accept sponsorship that could influence its content. No pharmaceutical or device company reviews or approves content before publication.</p>
  <h2>Conflicts of interest</h2><p class="todo">[To be completed: any financial or professional interests of the owner and reviewers (for example speaker fees, advisory boards, research funding). If there are none, write "None declared" and the date.]</p>
  <h2>Corrections</h2><p>Use "Report a problem with this page" at the bottom of any page. Clinical errors are reviewed by a clinician, and corrections are recorded in each record's version history.</p>
  <h2>Privacy</h2><p>See the <a href="privacy.html">privacy notice</a>.</p></article>`;

V.privacy = () => `<article class="detail prose" style="max-width:820px"><span class="eyebrow">Privacy</span><h1>Privacy notice</h1>
  <p class="banner">Draft for legal review. Have a Malaysian lawyer check this notice against the Personal Data Protection Act 2010 (as amended) before relying on it.</p>
  <h2>Who is responsible</h2><p class="todo">[To be completed: the name and contact address of the person or organisation responsible for DR ARVEEN (the data user), and the data protection officer if one is appointed.]</p>
  <h2>Patients and caregivers</h2><p>You don't need an account, and DR ARVEEN doesn't ask for your name or medical details. Bookmarks, notes, checklists and side-effect tracker entries stay in your own browser. They are not sent to DR ARVEEN or anyone else, and they are lost if you clear your browser data.</p>
  <h2>Healthcare professional accounts</h2><p>When you request an account, DR ARVEEN collects your name, work email, profession, registering body, registration number, institution and password. The password is stored only in encrypted (hashed) form by our sign-in provider.</p>
  <p>We use these details to verify your professional registration, decide whether to approve access, keep you signed in, and contact you about your account. We record who approved or changed each account, and when.</p>
  <h2>Problem reports</h2><p>If you report a problem, we store the page address, your description and, if you give it, your email address. Please don't include any patient's personal or medical details.</p>
  <h2>Where your data is stored</h2><p>Account details and problem reports are stored by Supabase, our database and sign-in provider, in its Singapore data centre. The website files are hosted by GitHub Pages. Fonts are loaded from Google Fonts and the sign-in code from the jsDelivr network, which can see your IP address when they deliver these files.</p>
  <h2>How long we keep it</h2><p class="todo">[To be completed: for example, account details for as long as the account is active plus 12 months; problem reports for 24 months.]</p>
  <h2>Your rights</h2><p>You can ask to see the personal data we hold about you, ask us to correct it, withdraw your consent and close your account. <span class="todo">[To be completed: how to contact us to make a request.]</span></p>
  <h2>Cookies and browser storage</h2><p>DR ARVEEN uses no advertising or tracking cookies and no analytics. It uses your browser's storage only for your settings, saved items and, if you have an account, keeping you signed in.</p>
  <h2>Changes to this notice</h2><p>We will update the date below when this notice changes. <span class="todo">[Last updated: to be completed]</span></p></article>`;

/* Review details shown at the end of every record page */
const REVIEW_SRC = { g: "guidelines", d: "diseases", s: "staging", p: "protocols", dr: "drugs", t: "trials", l: "leaflets", ptd: "diseases", a: "articles" };
function reviewBlock(rec) {
  const by = rec.reviewer, last = rec.verifiedOn || rec.lastReview, next = rec.nextReview;
  return `<aside class="reviewed" aria-label="Review information"><div><span class="eyebrow">Reviewed by</span><span>${by ? esc(by) : '<span class="na">Not yet reviewed</span>'}</span></div>
    <div><span class="eyebrow">Last reviewed</span><span>${last ? esc(last) : '<span class="na">—</span>'}</span></div>
    <div><span class="eyebrow">Next review due</span><span>${next ? esc(next) : '<span class="na">Set at first review</span>'}</span></div>
    <div><span class="eyebrow">Status</span><span>${statusPill(rec.status || rec.approval || "NOT VERIFIED")}</span></div></aside>`;
}

/* ---------- views: patient ---------- */
V.pt = () => `<div class="patient detail">${transBanner()}
  <section class="hero hero-pt"><span class="eyebrow">DR ARVEEN Patient Education Centre</span><h1>Understanding Your Cancer. Understanding Your Care.</h1>
  <p>Clear, reliable information to help you understand your diagnosis, prepare for treatment, manage side effects, and navigate life during and after gynaecological cancer.</p>
  <form class="bigsearch" id="hs"><input id="hq" type="search" aria-label="Search" placeholder="Search for your cancer, treatment, test, symptom, or question."><button>Search</button></form></section>
  <p class="banner">This information is being written and has not yet been reviewed by a clinician. It does not replace advice from your own treating team. In an emergency in Malaysia, call <b>999</b>.</p>
  <section class="section band"><h2>Where are you in your journey?</h2><div class="journey">${(D.journey || []).map((j, i) => `<a class="tile jstep" href="${url(`articles`)}?stage=${j.id}"><span class="jnum" aria-hidden="true">${i + 1}</span><b>${esc(j.title)}</b><span>${esc(j.text)}</span><span class="muted jcount">${journeyItems(j.id).length} guides</span></a>`).join("")}</div></section>
  <section class="section"><h2>Browse by cancer type</h2><div class="grid">${D.diseases.map(d => `<a class="tile" href="${url(`ptd.${d.id}`)}">${badge(d.id)}<b>${esc(d.name)}</b><span>${esc(d.patient)}</span></a>`).join("")}</div></section>
  <section class="section"><h2>Treatment explained</h2><div class="chips">${TREATMENT_LINKS.map(([t, id]) => id ? `<a class="chip" href="${url(`l.${id}`)}">${t}</a>` : `<button class="chip" data-q="${t}">${t}</button>`).join("")}</div></section>
  <section class="section"><h2>Browse by concern</h2><div class="chips">${(D.concerns || []).map(([t, id]) => `<a class="chip" href="${url(`a.${id}`)}">${esc(t)}</a>`).join("")}</div></section>
  <section class="section"><h2>Tools to use with your care team</h2><div class="grid">
    <a class="tile" href="${url(`sdm`)}">${ic("sdm")}<b>Questions for my oncologist</b><span>A checklist to bring to your next appointment.</span></a>
    <a class="tile" href="${url(`tracker`)}">${ic("tracker")}<b>Side-effect tracker</b><span>Note changes so you can tell your team accurately.</span></a>
    <a class="tile" href="${url(`leaflets`)}">${ic("leaflets")}<b>Information leaflets</b><span>${D.leaflets.filter(l => (l.sections || []).length).length} leaflets you can read and print.</span></a>
    <a class="tile" href="${url(`articles`)}">${ic("articles")}<b>Articles</b><span>${(D.articles || []).length} guides on tests, side effects and living with cancer.</span></a>
    <a class="tile" href="${url(`glossary`)}">${ic("glossary")}<b>Medical glossary</b><span>${D.glossary.length} terms explained in plain language.</span></a></div></section></div>`;
const TREATMENT_LINKS = [["Surgery", "PIL-SX-HYST"], ["Chemotherapy", "PIL-TX-CHEMO"], ["Radiotherapy", "PIL-TX-RT"], ["Brachytherapy", "PIL-TX-BT"], ["Immunotherapy", "PIL-TX-IO"], ["Targeted therapy", null], ["Hormonal therapy", null], ["Fertility-sparing treatment", null], ["Maintenance treatment", null], ["Palliative treatment", null]];
const journeyItems = stage => [...(D.articles || []).filter(a => a.journey === stage).map(a => ({ kind: "Article", route: "a." + a.id, title: a.title, summary: a.summary, status: a.status })),
  ...D.leaflets.filter(l => l.journey === stage && (l.sections || []).length).map(l => ({ kind: "Leaflet", route: "l." + l.id, title: l.title, summary: l.audience, status: l.approval }))];
const sectionsHtml = secs => secs.map(([h, ps]) => `<section><h2>${esc(h)}</h2>${ps.length > 1 ? `<ul>${ps.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : `<p>${esc(ps[0])}</p>`}</section>`).join("");
V.articles = () => {
  const stage = new URLSearchParams(location.search).get("stage") || "";
  const cats = [...new Set((D.articles || []).map(a => a.category))];
  const st = (D.journey || []).find(j => j.id === stage);
  const list = stage ? journeyItems(stage) : null;
  return `<div class="patient detail"><span class="eyebrow">Patient Education Centre</span><h1>${st ? esc(st.title) : "Articles"}</h1>${transBanner()}
  <div class="chips" role="navigation" aria-label="Journey stage"><a class="chip" href="${url(`articles`)}" ${!stage ? 'aria-current="page"' : ""}>All articles</a>${(D.journey || []).map(j => `<a class="chip" href="${url(`articles`)}?stage=${j.id}" ${stage === j.id ? 'aria-current="page"' : ""}>${esc(j.title)}</a>`).join("")}</div>
  ${list ? `<p class="prose muted">${esc(st.text)}</p><div class="list">${list.map(x => `<a class="row" href="${url(x.route)}"><span class="row-t">${esc(x.title)} ${statusPill(x.status)}</span><span class="row-m"><span class="eyebrow">${x.kind}</span><span>${esc(x.summary)}</span></span></a>`).join("")}</div>`
  : cats.map(c => `<section class="section"><h2>${esc(c)}</h2><div class="list">${D.articles.filter(a => a.category === c).map(a => `<a class="row" href="${url(`a.${a.id}`)}"><span class="row-t">${esc(a.title)} ${statusPill(a.status)}</span><span class="row-m"><span>${esc(a.summary)}</span></span></a>`).join("")}</div></section>`).join("")}</div>`;
};
V.a = id => {
  const a = byId(D.articles || [], id); if (!a) return notFound();
  recent("Article", a.id, a.title);
  const related = (D.articles || []).filter(x => x.id !== a.id && (x.journey === a.journey || x.category === a.category)).slice(0, 4);
  const cancers = (a.cancers || []).map(c => disease(c)).filter(Boolean);
  return `<article class="patient leaflet">${transBanner()}
  <div class="dhead"><span class="eyebrow">${esc(a.category)}</span><h1>${esc(a.title)}</h1><p class="prose" style="font-size:1.05rem">${esc(a.summary)}</p>
    <div class="actions">${bmBtn("Article", a.id, a.title)}<button class="btn" type="button" data-print>Print or save as PDF</button></div></div>
  ${photo(a.image)}
  ${a.status !== "APPROVED" ? `<p class="banner">Draft article, not yet clinically reviewed. It gives general information and does not replace advice from your treating team. In an emergency in Malaysia, call 999.</p>` : ""}
  ${sectionsHtml(a.sections)}
  ${cancers.length ? `<section><h2>Related cancers</h2><div class="chips">${cancers.map(d => `<a class="chip" href="${url(`ptd.${d.id}`)}">${esc(d.name)}</a>`).join("")}</div></section>` : ""}
  ${related.length ? `<section class="no-print"><h2>You might also find helpful</h2><div class="list">${related.map(x => `<a class="row" href="${url(`a.${x.id}`)}"><span class="row-t">${esc(x.title)}</span><span class="row-m"><span>${esc(x.summary)}</span></span></a>`).join("")}</div></section>` : ""}
  <p class="print-only print-foot">General information from the DR ARVEEN Patient Education Centre. It does not replace advice from your own treating team. In an emergency in Malaysia, call 999. Online version: ${esc(location.href.split("#")[0])}</p></article>`;
};
V.ptcancers = () => `<div class="patient detail"><span class="eyebrow">Understanding your cancer</span><h1>Your cancer</h1><div class="grid">${D.diseases.map(d => `<a class="tile" href="${url(`ptd.${d.id}`)}">${badge(d.id)}<b>${esc(d.name)}</b><span>${esc(d.patient)}</span></a>`).join("")}</div></div>`;
V.ptd = id => {
  const d = disease(id); if (!d) return notFound();
  recent("Patient page", d.id, d.name);
  const ls = D.leaflets.filter(l => l.disease === id || (["tubal", "peritoneal"].includes(id) && l.disease === "ovarian"));
  const secs = d.patientSections || (["tubal", "peritoneal"].includes(id) ? disease("ovarian")?.patientSections : null);
  const arts = (D.articles || []).filter(a => (a.cancers || []).includes(id) || (["tubal", "peritoneal"].includes(id) && (a.cancers || []).includes("ovarian")));
  return `<article class="patient detail">${transBanner()}<div class="dhead"><div class="ptd-intro"><div><div class="dtitle">${badge(d.id, true)}<div><span class="eyebrow">Understanding your cancer</span><h1>${esc(d.name)}</h1></div></div><p class="prose" style="font-size:1.05rem">${esc(d.patient)}</p></div><figure class="anatomy">${anatomySvg(d.id)}<figcaption>${id === "rare" ? "The organs of the female reproductive system." : "The highlighted area shows where this cancer starts."}</figcaption></figure></div>${photo(d.image)}<div class="row-m">${statusPill("DRAFT")} <span>Not yet clinically reviewed</span></div><div class="actions">${bmBtn("Patient page", d.id, d.name)}</div></div>
  ${["tubal", "peritoneal"].includes(id) && secs ? `<p class="banner info">This cancer is usually staged and treated in the same way as ovarian cancer, so the information below covers all three.</p>` : ""}
  <div class="cols">${secs ? secs.map(([h, ps]) => `<section class="section"><h2>${esc(h)}</h2><ul class="plist">${ps.map(p => `<li>${esc(p)}</li>`).join("")}</ul></section>`).join("")
    : ["What stage means", "Tests you may have", "Treatment options", "Living with and after cancer"].map(h => `<section class="section"><h2>${h}</h2><p class="na">This section is being written and reviewed. Your treating team is the best source of information about this cancer.</p></section>`).join("")}</div>
  <section class="section"><h2>Leaflets</h2><div class="list">${ls.map(l => `<a class="row" href="${url(`l.${l.id}`)}"><span class="row-t">${esc(l.title)} ${statusPill(l.approval)}</span></a>`).join("") || `<div class="row muted">No leaflet for this cancer yet.</div>`}</div></section>
  ${arts.length ? `<section class="section"><h2>Articles</h2><div class="list">${arts.map(a => `<a class="row" href="${url(`a.${a.id}`)}"><span class="row-t">${esc(a.title)}</span><span class="row-m"><span>${esc(a.summary)}</span></span></a>`).join("")}</div></section>` : ""}
  <p><a class="btn" href="${url(`sdm`)}">Prepare questions for your doctor →</a></p></article>`;
};
V.leaflets = () => `<div class="patient detail"><span class="eyebrow">Patient information leaflets</span><h1>Information leaflets</h1>${transBanner()}
  <p class="prose muted">Every leaflet follows the same structure, so you always know where to find what to expect, risks, and when to get help.</p>
  <div class="list">${D.leaflets.map(l => `<a class="row" href="${url(`l.${l.id}`)}"><span class="row-t">${esc(l.title)} ${statusPill(l.approval)}</span><span class="row-m"><span>${esc(l.audience)}</span><span class="mono">${esc(l.id)} · ${esc(l.version)}</span></span></a>`).join("")}</div></div>`;
V.l = id => {
  const l = byId(D.leaflets, id); if (!l) return notFound();
  recent("Leaflet", l.id, l.title);
  if (!l.sections.length) return `<article class="patient leaflet"><span class="eyebrow">Patient information leaflet</span><h1>${esc(l.title)}</h1>${statusPill(l.approval)}<p class="muted">This leaflet has not been written yet.</p><a href="${url(`leaflets`)}">All leaflets</a></article>`;
  const tr = state.lang !== "en" && l.translations && l.translations[state.lang];
  const T = tr ? LEAFLET_LABELS[state.lang] || LEAFLET_LABELS.en : LEAFLET_LABELS.en;
  const s = tr ? tr.safety : l.safety, sections = tr ? tr.sections : l.sections, questions = tr ? tr.questions : l.questions, title = tr ? tr.title : l.title;
  const approvedLeaflet = ["APPROVED", "PUBLISHED"].includes(l.approval) && (!tr || tr.status === "APPROVED");
  const today = new Date().toISOString().slice(0, 10);
  const langBanner = tr ? `<p class="banner" lang="${state.lang}">${esc(T.draftTranslation)} <button class="btn" type="button" data-showlang="en">Show the English version</button></p>` : transBanner();
  return `<article class="patient leaflet" lang="${tr ? state.lang : "en"}">${langBanner}
  <div class="print-only print-head"><b>DR ARVEEN</b> · ${esc(T.patientInfo)} · ${esc(l.id)} · ${esc(T.version)} ${esc(l.version)}${tr ? ` · ${esc(T.language)}: ${esc(LANG_NAMES[state.lang])} (${esc(tr.status)})` : ""}<br>
    ${esc(T.status)}: ${esc(l.approval)} · ${esc(T.lastReviewed)}: ${esc(l.lastReview || T.notYet)} · ${esc(T.nextReview)}: ${esc(l.nextReview || T.notSet)} · ${esc(T.printed)}: ${today}</div>
  ${approvedLeaflet ? "" : `<p class="watermark">${esc(T.watermark)}</p><div class="print-only print-draft" aria-hidden="true">${esc(T.printDraft)}</div>`}
  <div class="dhead"><span class="eyebrow">${esc(T.eyebrow)}</span><h1>${esc(title)}</h1><div class="actions">${bmBtn("Leaflet", l.id, l.title)}<button class="btn" type="button" data-print>${esc(T.print)}</button></div>
  ${approvedLeaflet ? "" : `<p class="muted no-print" style="font-size:.86rem">${esc(T.draftNote)}</p>`}</div>
  ${photo(l.image)}
  ${sectionsHtml(sections)}
  <section><h2>${esc(T.seekHelp)}</h2><div class="safety">
    <div class="em"><b>${esc(T.emergency)}</b><ul>${s.emergency.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="ur"><b>${esc(T.urgent)}</b><ul>${s.urgent.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="ro"><b>${esc(T.routine)}</b><ul>${s.routine.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <p class="muted" style="font-size:.84rem">${esc(s.note)}</p></div></section>
  <section><h2>${esc(T.questions)}</h2><ul>${questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul></section>
  <section><h2>${esc(T.further)}</h2><p>${esc(T.contact)} <b>${esc(T.contactPh)}</b>. <a href="${url(`glossary`)}">${esc(T.glossary)}</a>.</p></section>
  ${l.translations ? `<section class="no-print"><h2>${esc(T.otherLangs)}</h2><div class="chips"><button class="chip" type="button" data-showlang="en" ${!tr ? 'aria-pressed="true"' : ""}>English</button>${Object.entries(l.translations).map(([lg, t]) => `<button class="chip" type="button" data-showlang="${lg}" lang="${lg}" ${tr && state.lang === lg ? 'aria-pressed="true"' : ""}>${esc(LANG_NAMES[lg])} · ${esc(t.status)}</button>`).join("")}</div></section>` : ""}
  <section lang="en"><h2>Editorial information</h2><div class="kv">${[["Leaflet ID", `<span class="mono">${l.id}</span>`], ["Intended audience", esc(l.audience)], ["Author", esc(l.author)], ["Clinical reviewer", l.reviewer ? esc(l.reviewer) : '<span class="na">Not yet assigned</span>'], ["Publication date", na(l.pubDate)], ["Last review", na(l.lastReview)], ["Next review", na(l.nextReview)], ["Version", esc(l.version)], ["Source records", l.sources.map(x => `<a href="${url(`${x.startsWith("G-") ? "g." : "s."}${x}`)}">${x}</a>`).join(", ")], ["Jurisdiction", esc(l.jurisdiction)], ["Language", esc(l.language)], ["Translation status", esc(l.translation)], ["Approval status", statusPill(l.approval)]].map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}</div></section>
  <p class="print-only print-foot">This leaflet gives general information. It does not replace advice from your own treating team, who know your situation. In an emergency in Malaysia, call 999. Online version: ${esc(location.href.split("#")[0])}</p></article>`;
};
V.sdm = () => {
  const done = store.get("sdmq", []), ws = store.get("ws", {});
  return `<div class="patient detail"><span class="eyebrow">Shared decision-making</span><h1>Prepare for your appointment</h1>
  <div class="no-print"><button class="btn" type="button" data-print>Print this checklist</button></div>
  <p class="banner info">These tools help you talk with your treating team. They do not recommend a treatment. Anything you type stays only on this device.</p>
  <div class="cols"><section class="section"><h2>Questions for my oncologist</h2><div class="checklist">${D.sdmQuestions.map((q, i) => `<label for="sq${i}"><input type="checkbox" id="sq${i}" data-sq="${i}" ${done.includes(i) ? "checked" : ""}> ${esc(q)}</label>`).join("")}</div></section>
  <section class="section"><h2>Treatment discussion worksheet</h2><form class="calc" id="ws">${[["goals", "What matters most to me"], ["benefits", "Benefits my team described"], ["risks", "Risks and side effects I want to understand"], ["alts", "Other options we discussed"], ["unsure", "Things I am still unsure about"]].map(([k, t]) => `<label for="ws-${k}">${t}<textarea id="ws-${k}" data-ws="${k}">${esc(ws[k] || "")}</textarea></label>`).join("")}</form></section></div>
  <section class="section"><h2>More discussion guides</h2><div class="grid">${["Understanding my diagnosis", "Surgery preparation checklist", "Chemotherapy diary", "Fertility discussion guide", "Menopause and sexual health guide", "Follow-up planner", "Caregiver guide"].map(t => `<div class="tile"><b>${t}</b><span>Being written.</span></div>`).join("")}<a class="tile" href="${url(`tracker`)}">${ic("tracker")}<b>Side-effect tracker</b><span>Available now.</span></a></div></section></div>`;
};
function bindSdm() {
  app.querySelectorAll("[data-sq]").forEach(c => c.onchange = () => { let d = store.get("sdmq", []); const i = +c.dataset.sq; d = c.checked ? [...d, i] : d.filter(x => x !== i); store.set("sdmq", d); });
  app.querySelectorAll("[data-ws]").forEach(t => t.oninput = () => { const w = store.get("ws", {}); w[t.dataset.ws] = t.value; store.set("ws", w); });
}
V.tracker = () => {
  const rows = store.get("fx", []);
  return `<div class="patient detail"><span class="eyebrow">Shared decision-making</span><h1>Side-effect tracker</h1>
  <div class="no-print"><button class="btn" type="button" data-print>Print my entries</button></div>
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
  ${!state.proLoaded ? `<p class="banner info">Showing patient education results. <a href="login.html?next=${encodeURIComponent("search.html?q=" + state.q)}">Sign in</a> as an approved healthcare professional to search guidelines, staging, protocols, drugs and trials.</p>` : ""}
  ${!res.length ? `<p class="muted">No results. Try a disease name, a drug, an organisation (ESGO, FIGO) or a stage such as IIIC.</p>` : ""}
  ${aud !== "pt" ? block("Professional clinical results", pro) : ""}${aud !== "pro" ? block("Patient education results", pt) : ""}`;
};
const notFound = () => `<h1>Record not found</h1><p><a href="index.html">Return home</a></p>`;

/* ---------- views: welcome, accounts, governance ---------- */
V.welcome = () => `<section class="hero hero-welcome"><span class="eyebrow">Gynaecological oncology · Malaysia</span>
  <h1>DR ARVEEN — Evidence-Based Gynaecological Oncology.</h1>
  <p>Clinical guidelines, staging, treatment protocols and trial evidence for healthcare professionals, and clear, reliable information for patients and the people who care for them.</p></section>
  <div class="cols">
    <a class="tile entry" href="professional.html"><span class="eyebrow">For healthcare professionals</span><b>Clinical reference</b><span>Guidelines, recommendations, FIGO staging, protocols, drug monographs, trials, calculators and education. Sign-in required: accounts are approved after we verify your professional registration.</span><span class="btn primary">${state.user ? "Open the clinical reference" : "Sign in"}</span></a>
    <a class="tile entry" href="patients.html"><span class="eyebrow">For patients and caregivers</span><b>Patient Education Centre</b><span>Understand your diagnosis, prepare for treatment and appointments, and track side effects. No account needed.</span><span class="btn">Go to patient information</span></a>
  </div>
  <p class="muted"><a href="governance.html">How DR ARVEEN checks and approves its information</a></p>`;
V.login = () => !sb ? `<h1>Sign in</h1>${notConfigured()}` : state.user ? `<h1>You're signed in</h1><p><a class="btn primary" href="professional.html">Open the clinical reference</a></p>` : `<span class="eyebrow">Healthcare professionals</span><h1>Sign in</h1>${loginForm()}`;
V.register = () => !sb ? `<h1>Request an account</h1>${notConfigured()}` : `<span class="eyebrow">Healthcare professionals</span><h1>Request an account</h1>
  <p class="prose muted">Accounts are for registered healthcare professionals. After you confirm your email, an administrator checks your registration with the relevant Malaysian board or council before approving access. Patients don't need an account.</p>
  <form class="calc authbox" id="regf">
    <label for="rg-name">Full name<input id="rg-name" type="text" autocomplete="name" required></label>
    <label for="rg-email">Work email<input id="rg-email" type="email" autocomplete="email" required></label>
    <label for="rg-pass">Password (at least 8 characters)<input id="rg-pass" type="password" autocomplete="new-password" required></label>
    <label for="rg-prof">Profession<select id="rg-prof"><option>Doctor</option><option>Pharmacist</option><option>Nurse</option><option>Medical trainee</option><option>Other healthcare professional</option></select></label>
    <label for="rg-body">Registering body<select id="rg-body"><option>Malaysian Medical Council (MMC)</option><option>Pharmacy Board Malaysia</option><option>Malaysia Nursing Board</option><option>Other</option></select></label>
    <label for="rg-num">Registration number<input id="rg-num" type="text" required></label>
    <label for="rg-inst">Hospital or institution<input id="rg-inst" type="text" required></label>
    <label class="check" for="rg-agree"><input id="rg-agree" type="checkbox"> I confirm I am a registered healthcare professional, and I agree that DR ARVEEN stores these details to verify my registration, as described on the <a href="governance.html#privacy">governance page</a>.</label>
    <p class="result err" role="alert" id="autherr" hidden></p>
    <div class="toc"><button class="btn primary" type="submit">Request account</button><a class="btn" href="login.html">I already have an account</a></div>
  </form><p class="banner info" id="authok" role="status" hidden></p>`;
V.reset = () => !sb ? `<h1>Reset password</h1>${notConfigured()}` : `<span class="eyebrow">Account</span><h1>Reset your password</h1>
  ${state.user ? `<form class="calc authbox" id="newpassf"><label for="np-pass">New password (at least 8 characters)<input id="np-pass" type="password" autocomplete="new-password" required></label><p class="result err" role="alert" id="autherr" hidden></p><div><button class="btn primary" type="submit">Save new password</button></div></form>`
  : `<form class="calc authbox" id="resetf"><label for="rs-email">Email<input id="rs-email" type="email" autocomplete="email" required></label><p class="result err" role="alert" id="autherr" hidden></p><div><button class="btn primary" type="submit">Send reset link</button></div></form>`}
  <p class="banner info" id="authok" role="status" hidden></p>`;
V.accounts = () => `<span class="eyebrow">Administration</span><h1>Account approvals</h1>
  <p class="prose muted">Before approving, check the registration number on the relevant public register (MMC, Pharmacy Board or Nursing Board) and that the name matches. Every change is recorded in the account audit log.</p>
  <p class="result err" role="alert" id="acctmsg" hidden></p><div id="acctlist"><p class="muted">Loading account requests…</p></div>
  <section class="section"><h2>Reported problems</h2><p class="prose muted">Reports sent from "Report a problem with this page". Clinical reports need a clinician to review the record before you mark them resolved.</p><div id="fblist"><p class="muted">Loading reports…</p></div></section>`;

const GOV_PRO = [
  ["Discovered", "A new or revised source is identified (surveillance, reviewer, user report).", "Editor", "Source, date found"],
  ["Source retrieved", "The official document is obtained and its licence checked.", "Editor", "Source URL, access and licence status"],
  ["Extracted", "Metadata and recommendations are entered; wording marked as quotation or ARVEEN paraphrase.", "Editor", "Fields entered, text type"],
  ["Structured", "Linked to disease, stage, biomarker, trials and protocols.", "Editor", "Links"],
  ["Clinically reviewed", "A clinician checks every field against the source.", "Clinical reviewer (not the editor)", "Reviewer name, date, comments"],
  ["Approved", "Final sign-off. High-risk prescribing content needs a second clinician or pharmacist.", "Clinical lead (+ pharmacist for doses)", "Approver, date"],
  ["Published", "Visible to approved professionals.", "Editor", "Version, publish date"],
  ["Monitored", "Watched for new editions, corrections and withdrawals.", "Editor", "Last check date"],
  ["Revised or superseded", "Updates go back through review. Superseded records stay visible with a warning.", "Clinical reviewer", "Change summary, affected records"]];
const GOV_PT = [
  ["Draft", "Written in plain language from approved clinical records only.", "Author", "Sources used, reading level"],
  ["Editorial review", "Checks readability, structure, tone and cultural sensitivity.", "Editorial reviewer", "Comments"],
  ["Clinical review", "Checks medical accuracy, risks and the 'when to seek help' section.", "Clinical reviewer", "Reviewer, date"],
  ["Language review", "For translations: a qualified translator and a clinician fluent in the language.", "Language reviewer + clinician", "Translation version"],
  ["Approved", "Final sign-off. Only now can 'Approved' appear on the leaflet or its PDF.", "Clinical lead", "Approver, date"],
  ["Published", "Visible to everyone.", "Editor", "Version, publish date"],
  ["Review due", "Scheduled re-check, or triggered by a guideline change.", "Editor", "Next review date"],
  ["Revised or withdrawn", "Changes go back through review; outdated leaflets are withdrawn.", "Clinical lead", "Decision, date"]];
const GOV_TYPES = [
  ["Guideline record", "Clinical reviewer", "Metadata matches the official source; licence recorded"],
  ["Recommendation", "Clinical reviewer", "Text matches source meaning; original grade and strength transcribed"],
  ["Staging system", "Clinical reviewer", "Definitions checked against the staging publication; no mixing of versions"],
  ["Treatment protocol (high risk)", "Two people: clinician and pharmacist", "Doses from an authoritative protocol, never a trial paper alone"],
  ["Drug monograph", "Pharmacist", "Checked against official product information; NPRA status confirmed"],
  ["Clinical trial", "Clinical reviewer", "Numbers taken from the full publication; report type recorded"],
  ["Algorithm or calculator", "Clinician + tested", "Formula tested; source version recorded; regulatory status checked"],
  ["Patient leaflet", "Editorial + clinical (+ language)", "Plain language; safety section clinically reviewed"],
  ["Guideline update alert", "Clinical reviewer", "Decides whether linked records and leaflets must change"]];
const GOV_LAUNCH = [
  ["Clinical governance", "Name a clinical lead responsible for content, and reviewers for each content type. Record who approved what."],
  ["Personal Data Protection Act 2010 (as amended)", "Accounts collect names, emails and registration numbers. You need a privacy notice, consent at registration, security safeguards, a retention period, and a process for access and correction requests. Check whether you must appoint a data protection officer and notify data breaches, and whether storing data with Supabase outside Malaysia meets the cross-border transfer rules."],
  ["Supabase data processing terms", "Choose the Singapore region, accept Supabase's data processing agreement, and turn on multi-factor sign-in for administrator accounts."],
  ["Medical Device Authority (MDA) Malaysia", "Calculators and decision pathways may count as medical-device software under the Medical Device Act 2012. Get MDA advice before presenting them as clinical decision support."],
  ["Medicine advertising rules", "The Medicines (Advertisement and Sale) Act 1956 restricts advertising treatments for cancer to the public. Keep patient pages educational, never promotional, and get advice from the Medicine Advertisements Board if unsure."],
  ["Malaysian Medical Council guidance", "A doctor-named site must follow MMC guidance on professional conduct and on how doctors may present information and services to the public."],
  ["Copyright Act 1987 and source licences", "Link to guidelines and write original summaries. Get written permission before reproducing tables, figures or text (for example NCCN or FIGO material)."],
  ["Terms of use and disclaimer", "Have a lawyer review the disclaimer, terms of use and privacy notice."],
  ["Employer or institution approval", "If you work for a hospital or university, check its policies on external publications and use of its name."],
  ["Professional indemnity", "Confirm with your indemnity provider that publishing clinical educational content is covered."],
  ["Accessibility and security", "Check pages meet WCAG 2.1 AA; test that unapproved accounts cannot read professional content."]];
const govTable = (head, rows) => `<div class="tablewrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td>${i === 0 ? `<b>${esc(c)}</b>` : esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
V.governance = () => `<article class="detail"><div class="dhead"><span class="eyebrow">Governance</span><h1>How DR ARVEEN checks and approves information</h1>
  <p class="prose muted">Every piece of content passes named review steps before it is published. This page lists those steps, who signs off, how professional accounts are approved, and the approvals needed before launch.</p></div>
  <section class="section"><h2>1. Professional content workflow</h2>${govTable(["Stage", "What happens", "Who signs off", "What is recorded"], GOV_PRO)}</section>
  <section class="section"><h2>2. Patient content workflow</h2>${govTable(["Stage", "What happens", "Who signs off", "What is recorded"], GOV_PT)}</section>
  <section class="section"><h2>3. Sign-off by content type</h2>${govTable(["Content", "Required sign-off", "Checks"], GOV_TYPES)}</section>
  <section class="section"><h2>4. Who can see what</h2>${govTable(["Area", "Access", "Why"], [["Patient Education Centre", "Everyone, no account", "Patients and caregivers need open access to reliable information"], ["Professional clinical reference", "Approved healthcare professionals only", "Doses, protocols and recommendations need clinical context and are not patient advice"], ["Account approvals", "Administrators only", "Verifying registrations and roles"], ["Editing content", "Editors and reviewers", "Separation between authoring and approval"]])}</section>
  <section class="section"><h2>5. Professional account approval</h2><ol class="prose steps">
    <li>The professional requests an account with name, work email, profession, registering body, registration number and institution.</li>
    <li>They confirm their email address through the link sent to them.</li>
    <li>An administrator checks the registration number on the public register of the Malaysian Medical Council, Pharmacy Board Malaysia or Malaysia Nursing Board, and that the name matches.</li>
    <li>The administrator approves or rejects the request. The decision, reviewer and date are recorded in the audit log.</li>
    <li>Approved accounts are re-checked every year; accounts are suspended if registration lapses or access is misused.</li></ol></section>
  <section class="section" id="privacy"><h2>6. Privacy for account holders</h2><p class="prose">DR ARVEEN stores your name, email, profession, registering body, registration number and institution only to verify your registration and manage access. It does not store patient information. You can ask to see, correct or delete your details. Bookmarks, notes and side-effect tracker entries stay in your own browser and are not sent to DR ARVEEN.</p></section>
  <section class="section"><h2>7. Approvals needed before public launch</h2>
    <p class="banner">This checklist is a starting point, not legal advice. Confirm each item with a Malaysian lawyer and the relevant authority.</p>
    ${govTable(["Approval", "What to do"], GOV_LAUNCH)}</section></article>`;

/* ---------- router ---------- */
function render() {
  const base = PAGE, arg = PARAMS.get("id") || "";
  renderNav();
  const view = V[base]; app.innerHTML = view ? view(arg) : notFound();
  const h1 = app.querySelector("h1"); if (h1 && !["home", "pt", "welcome"].includes(base)) document.title = h1.textContent.trim() + " · DR ARVEEN";
  const rec = REVIEW_SRC[base] && (D[REVIEW_SRC[base]] || []).find(x => x.id === arg);
  if (rec) app.insertAdjacentHTML("beforeend", reviewBlock(rec));
  $("#mq").value = base === "search" ? state.q : "";
  const hs = $("#hs"); if (hs) hs.onsubmit = e => { e.preventDefault(); state.q = $("#hq").value.trim(); go("search"); };
  app.querySelectorAll("[data-q]").forEach(c => c.onclick = () => { state.q = c.dataset.q; go("search"); });
  app.querySelectorAll("[data-print]").forEach(b => b.onclick = () => window.print());
  app.querySelectorAll("[data-showlang]").forEach(b => b.onclick = () => { state.lang = b.dataset.showlang; store.set("lang", state.lang); $("#lang").value = state.lang; render(); });
  app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { store.set("dmode", b.dataset.mode); render(); });
  app.querySelectorAll("[data-td]").forEach(b => b.onclick = () => { state.filters.trialDisease = b.dataset.td; render(); });
  app.querySelectorAll("[data-saud]").forEach(b => b.onclick = () => { state.filters.saud = b.dataset.saud; render(); });
  app.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => { let s = store.get("subs", []); s = s.includes(b.dataset.sub) ? s.filter(x => x !== b.dataset.sub) : [...s, b.dataset.sub]; store.set("subs", s); b.setAttribute("aria-pressed", s.includes(b.dataset.sub)); });
  app.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { algoPath = algoPath.slice(0, +b.dataset.step + 1).concat(b.dataset.to); render(); });
  const ar = $("#algoreset"); if (ar) ar.onclick = () => { algoPath = []; render(); };
  app.querySelectorAll("[data-algo]").forEach(b => b.onclick = () => { algoId = b.dataset.algo; algoPath = []; history.replaceState(null, "", "?id=" + encodeURIComponent(algoId)); render(); });
  const cq = $("#cmpq"); if (cq) cq.onchange = () => { state.filters.cmp = cq.value; render(); };
  const sf = $("#sfilter"); if (sf) sf.oninput = () => { const q = sf.value.toLowerCase(); $("#stree").querySelectorAll(".stage").forEach(s => { s.hidden = q && !s.textContent.toLowerCase().includes(q); }); };
  const gq = $("#gq"); if (gq) gq.oninput = () => app.querySelectorAll("[data-term]").forEach(r => r.hidden = !r.dataset.term.includes(gq.value.toLowerCase()));
  bindFilters(); bindCalcs(); bindQuiz(); bindGen(); bindSdm(); bindTracker(); bindAuth(); bindCms();
}
/* ---------- content editor (editors, reviewers, admins) ---------- */
const CMS_KINDS = [["article", "Articles"], ["leaflet", "Leaflets"], ["cancer", "Cancer pages"]];
const CMS_STATUSES = ["DRAFT", "EDITORIAL REVIEW", "CLINICAL REVIEW", "APPROVED", "WITHDRAWN"];
const slug = s => String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);
function cmsItems() {
  const rows = Object.fromEntries(state.items.map(r => [r.id, r]));
  const withdrawn = state.items.filter(r => r.status === "WITHDRAWN");
  const list = [
    ...D.articles.map(a => ({ key: "article:" + a.id, kind: "article", title: a.title, status: a.status || "DRAFT" })),
    ...D.leaflets.filter(l => (l.sections || []).length).map(l => ({ key: "leaflet:" + l.id, kind: "leaflet", title: l.title, status: l.approval || "DRAFT" })),
    ...D.diseases.map(d => ({ key: "cancer:" + d.id, kind: "cancer", title: d.name, status: d.pageStatus || "DRAFT" })),
    ...withdrawn.map(r => ({ key: r.id, kind: r.kind, title: (r.data.title || r.id) + " (withdrawn)", status: "WITHDRAWN" }))
  ];
  return list.map(x => ({ ...x, online: !!rows[x.key] }));
}
function cmsCurrent(key) {
  const [kind, ...rest] = key.split(":"); const id = rest.join(":");
  const row = state.items.find(r => r.id === key);
  if (kind === "article") return { kind, id, row, item: row?.status === "WITHDRAWN" ? { id, ...row.data } : (D.articles.find(a => a.id === id) || { id, title: PARAMS.get("title") || "", summary: "", category: "Living with cancer", journey: "during", cancers: [], sections: [["", [""]]] }) };
  if (kind === "leaflet") return { kind, id, row, item: row?.status === "WITHDRAWN" ? { id, ...row.data } : D.leaflets.find(l => l.id === id) };
  if (kind === "cancer") { const d = disease(id); return { kind, id, row, item: d && { id, title: d.name, patient: d.patient, sections: d.patientSections || [], image: d.image } }; }
  return null;
}
const secEditor = secs => `<div id="secs" class="secs">${(secs.length ? secs : [["", [""]]]).map(([h, ps], i) => `<div class="secblock">
  <div class="sec-top"><label>Section heading<input type="text" class="sec-h" value="${esc(h)}"></label>
  <div class="sec-tools"><button class="btn" type="button" data-secmv="-1" aria-label="Move section up">↑</button><button class="btn" type="button" data-secmv="1" aria-label="Move section down">↓</button><button class="btn" type="button" data-secdel aria-label="Remove section">Remove</button></div></div>
  <label>Text, one point per line<textarea class="sec-b" rows="${Math.min(10, Math.max(3, ps.length + 1))}">${esc(ps.join("\n"))}</textarea></label></div>`).join("")}</div>
  <button class="btn" type="button" id="secadd">+ Add section</button>`;
const lines = v => String(v || "").split("\n").map(s => s.trim()).filter(Boolean);
V.cms = () => {
  const items = cmsItems();
  const sel = PARAMS.get("id");
  const cur = sel ? cmsCurrent(sel) : null;
  const listHtml = CMS_KINDS.map(([k, t]) => `<details class="cms-group" ${!sel || sel.startsWith(k + ":") ? "open" : ""}><summary>${t} <span class="muted">${items.filter(x => x.kind === k).length}</span></summary>
    ${items.filter(x => x.kind === k).map(x => `<a class="cms-item" href="${FILES.cms}?id=${encodeURIComponent(x.key)}" ${x.key === sel ? 'aria-current="page"' : ""}><span>${esc(x.title)}</span><span class="row-m">${statusPill(x.status)}${x.online ? '<span class="pill teal">Edited online</span>' : ""}</span></a>`).join("")}</details>`).join("");
  let form = `<div class="cms-empty"><h2>Choose something to edit</h2><p class="muted">Pick an article, leaflet or cancer page on the left, or start a new article.</p>
    <div class="cms-new"><label for="new-title">New article title<input type="text" id="new-title" placeholder="Coping with sleep problems"></label><button class="btn primary" type="button" id="new-article">Create draft</button></div></div>`;
  if (cur && cur.item) {
    const it = cur.item, row = cur.row || {}, img = it.image || {};
    const status = row.status || (cur.kind === "leaflet" ? it.approval : cur.kind === "article" ? it.status : "DRAFT") || "DRAFT";
    const viewRoute = cur.kind === "article" ? `a.${cur.id}` : cur.kind === "leaflet" ? `l.${cur.id}` : `ptd.${cur.id}`;
    form = `<form id="cmsf" class="cms-form" data-key="${esc(sel)}">
    <div class="section-h"><div><span class="eyebrow">${cur.kind === "cancer" ? "Cancer page" : cur.kind === "leaflet" ? "Leaflet" : "Article"} · ${esc(cur.id)}</span><h2>${esc(it.title || "New article")}</h2></div>
      <div class="toc"><a class="btn" href="${url(viewRoute)}" target="_blank" rel="noopener">View page ↗</a></div></div>
    ${cur.row ? `<p class="banner info">This item has online edits (last saved ${esc((row.updated_at || "").slice(0, 16).replace("T", " "))}). The site shows this version.</p>` : `<p class="muted">Not edited online yet: you are looking at the built-in version. Saving creates an online version.</p>`}
    <fieldset><legend>Text</legend>
      ${cur.kind !== "cancer" ? `<label>Title<input type="text" id="f-title" value="${esc(it.title)}" required></label>` : ""}
      ${cur.kind === "article" ? `<label>Short summary<textarea id="f-summary" rows="2">${esc(it.summary)}</textarea></label>
        <div class="fields"><label>Category<select id="f-category">${["Tests and investigations", "Treatment explained", "Living with cancer", "Support"].map(c => `<option ${c === it.category ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        <label>Journey stage<select id="f-journey">${(D.journey || []).map(j => `<option value="${j.id}" ${j.id === it.journey ? "selected" : ""}>${esc(j.title)}</option>`).join("")}</select></label></div>
        <div class="chips" role="group" aria-label="Related cancers">${D.diseases.map(d => `<label class="chip"><input type="checkbox" class="f-cancer" value="${d.id}" ${(it.cancers || []).includes(d.id) ? "checked" : ""}> ${esc(d.name)}</label>`).join("")}</div>` : ""}
      ${cur.kind === "leaflet" ? `<label>Intended audience<textarea id="f-audience" rows="2">${esc(it.audience)}</textarea></label>` : ""}
      ${cur.kind === "cancer" ? `<label>Introduction (shown under the title)<textarea id="f-patient" rows="3">${esc(it.patient)}</textarea></label>` : ""}
    </fieldset>
    <fieldset><legend>Sections</legend>${secEditor(it.sections || [])}</fieldset>
    ${cur.kind === "leaflet" ? `<fieldset><legend>When to seek help (needs clinical review)</legend>
      <label>Emergency — one per line<textarea id="f-em" rows="3">${esc((it.safety?.emergency || []).join("\n"))}</textarea></label>
      <label>Urgent — one per line<textarea id="f-ur" rows="4">${esc((it.safety?.urgent || []).join("\n"))}</textarea></label>
      <label>Routine — one per line<textarea id="f-ro" rows="3">${esc((it.safety?.routine || []).join("\n"))}</textarea></label>
      <label>Note<textarea id="f-note" rows="2">${esc(it.safety?.note || "")}</textarea></label></fieldset>
      <fieldset><legend>Questions to ask your doctor</legend><label>One per line<textarea id="f-q" rows="5">${esc((it.questions || []).join("\n"))}</textarea></label></fieldset>
      ${it.translations ? `<p class="banner">This leaflet has translations. Changing the English text means the translations need updating and re-review.</p>` : ""}` : ""}
    <fieldset><legend>Picture</legend>
      <div class="img-slot"><div class="img-prev" id="img-prev">${img.url ? `<img src="${esc(img.url)}" alt="">` : `<span class="muted">No picture</span>`}</div>
      <div class="img-fields"><input type="hidden" id="img-url" value="${esc(img.url || "")}">
        <label>Upload a picture (JPEG, PNG or WebP, up to 3 MB)<input type="file" id="img-file" accept="image/jpeg,image/png,image/webp"></label>
        <label>Description for screen readers (required with a picture)<input type="text" id="img-alt" value="${esc(img.alt || "")}" placeholder="Nurse explaining a leaflet to a patient"></label>
        <label>Credit or caption (optional)<input type="text" id="img-credit" value="${esc(img.credit || "")}" placeholder="Photo: DR ARVEEN clinic"></label>
        <div class="toc"><button class="btn" type="button" id="img-remove">Remove picture</button></div>
        <p class="muted" style="font-size:.84rem">Only upload pictures you own or have permission to use. Get written consent from anyone identifiable, and never show patient information.</p></div></div>
    </fieldset>
    <fieldset><legend>Review and status</legend><div class="fields">
      <label>Status<select id="f-status">${CMS_STATUSES.map(s => `<option ${s === status ? "selected" : ""} ${s === "APPROVED" && !canApprove() ? "disabled" : ""}>${s}</option>`).join("")}</select></label>
      <label>Clinical reviewer<input type="text" id="f-reviewer" value="${esc(row.reviewer || it.reviewer || "")}"></label>
      <label>Last reviewed<input type="date" id="f-last" value="${esc(row.last_review || it.lastReview || "")}"></label>
      <label>Next review due<input type="date" id="f-next" value="${esc(row.next_review || it.nextReview || "")}"></label></div>
      ${canApprove() ? "" : `<p class="muted" style="font-size:.84rem">Only reviewers and administrators can set APPROVED.</p>`}</fieldset>
    <p class="result err" id="cms-err" role="alert" hidden></p><p class="banner info" id="cms-ok" role="status" hidden></p>
    <div class="toc cms-actions"><button class="btn primary" type="submit">Save</button>
      ${cur.row ? `<button class="btn" type="button" id="cms-revert">Discard online edits…</button><span id="cms-revert-confirm" hidden>Go back to the built-in version? <button class="btn" type="button" id="cms-revert-yes">Yes, discard</button> <button class="btn" type="button" id="cms-revert-no">Cancel</button></span>` : ""}</div>
  </form>`;
  }
  return `<span class="eyebrow">Content</span><h1>Edit content</h1>
  <p class="prose muted">Edit patient articles, leaflets and cancer pages, add pictures, and record reviews. Saved changes appear on the site straight away. Every save is logged.</p>
  <div class="cms">${`<nav class="cms-list" aria-label="Content items">${listHtml}</nav>`}<div>${form}</div></div>`;
};
function bindCms() {
  if (PAGE !== "cms" || !isEditor()) return;
  const nb = $("#new-article");
  if (nb) nb.onclick = () => { const t = $("#new-title").value.trim(); if (!t) { $("#new-title").focus(); return; } const id = slug(t) || "article-" + Date.now();
    D.articles.push({ id, title: t, summary: "", category: "Living with cancer", journey: "during", cancers: [], sections: [["", [""]]], status: "DRAFT" }); location.href = `${FILES.cms}?id=${encodeURIComponent("article:" + id)}&title=${encodeURIComponent(t)}`; };
  const f = $("#cmsf"); if (!f) return;
  const key = f.dataset.key, cur = cmsCurrent(key);
  const err = m => { const e = $("#cms-err"); e.hidden = !m; e.textContent = m || ""; if (m) $("#cms-ok").hidden = true; };
  const ok = m => { const o = $("#cms-ok"); o.hidden = false; o.textContent = m; err(""); };
  const secs = $("#secs");
  const newBlock = () => { const t = document.createElement("div"); t.innerHTML = secEditor([["", [""]]]); return t.querySelector(".secblock"); };
  $("#secadd").onclick = () => secs.appendChild(newBlock());
  secs.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return; const blk = b.closest(".secblock");
    if (b.hasAttribute("data-secdel")) { if (secs.children.length > 1) blk.remove(); else { blk.querySelector(".sec-h").value = ""; blk.querySelector(".sec-b").value = ""; } }
    if (b.dataset.secmv === "-1" && blk.previousElementSibling) secs.insertBefore(blk, blk.previousElementSibling);
    if (b.dataset.secmv === "1" && blk.nextElementSibling) secs.insertBefore(blk.nextElementSibling, blk);
  });
  $("#img-file").onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return err("Choose a JPEG, PNG or WebP picture.");
    if (file.size > 3 * 1024 * 1024) return err("That picture is over 3 MB. Resize it and try again.");
    ok("Uploading picture…");
    const path = `${cur.kind}/${cur.id}-${Date.now()}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
    const { error } = await sb.storage.from("site-images").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) return err("The picture couldn't be uploaded: " + error.message);
    const u = sb.storage.from("site-images").getPublicUrl(path).data.publicUrl;
    $("#img-url").value = u; $("#img-prev").innerHTML = `<img src="${esc(u)}" alt="">`;
    ok("Picture uploaded. Add a description, then Save.");
  };
  $("#img-remove").onclick = () => { $("#img-url").value = ""; $("#img-prev").innerHTML = `<span class="muted">No picture</span>`; };
  const revert = $("#cms-revert");
  if (revert) {
    revert.onclick = () => { $("#cms-revert-confirm").hidden = false; revert.hidden = true; };
    $("#cms-revert-no").onclick = () => { $("#cms-revert-confirm").hidden = true; revert.hidden = false; };
    $("#cms-revert-yes").onclick = async () => { const { error } = await sb.from("patient_items").delete().eq("id", key); if (error) return err(error.message); location.reload(); };
  }
  f.onsubmit = async e => {
    e.preventDefault();
    const sections = [...secs.querySelectorAll(".secblock")].map(b => [b.querySelector(".sec-h").value.trim(), lines(b.querySelector(".sec-b").value)]).filter(([h, ps]) => h || ps.length);
    if (sections.some(([h, ps]) => !h || !ps.length)) return err("Every section needs a heading and at least one line of text.");
    const imgUrl = $("#img-url").value, alt = $("#img-alt").value.trim();
    if (imgUrl && !alt) return err("Add a description of the picture for people using screen readers.");
    const image = imgUrl ? { url: imgUrl, alt, credit: $("#img-credit").value.trim() } : null;
    const status = $("#f-status").value, reviewer = $("#f-reviewer").value.trim(), last = $("#f-last").value || null, next = $("#f-next").value || null;
    if (status === "APPROVED" && (!reviewer || !last)) return err("To approve, enter the clinical reviewer's name and the review date.");
    const it = cur.item; let data;
    if (cur.kind === "article") {
      const title = $("#f-title").value.trim(); if (!title) return err("Add a title.");
      data = { title, summary: $("#f-summary").value.trim(), category: $("#f-category").value, journey: $("#f-journey").value, cancers: [...document.querySelectorAll(".f-cancer:checked")].map(c => c.value), sections, image };
    } else if (cur.kind === "leaflet") {
      const title = $("#f-title").value.trim(); if (!title) return err("Add a title.");
      const { approval, reviewer: _r, lastReview: _l, nextReview: _n, online, updatedAt, ...base } = it;
      data = { ...base, title, audience: $("#f-audience").value.trim(), sections, questions: lines($("#f-q").value), image,
        safety: { emergency: lines($("#f-em").value), urgent: lines($("#f-ur").value), routine: lines($("#f-ro").value), note: $("#f-note").value.trim() } };
    } else {
      data = { patient: $("#f-patient").value.trim(), sections, image };
    }
    const { error } = await sb.from("patient_items").upsert({ id: key, kind: cur.kind, data, status, reviewer: reviewer || null, last_review: last, next_review: next });
    if (error) return err(/approve/i.test(error.message) ? error.message : "Couldn't save: " + error.message);
    ok("Saved. The page now shows this version.");
    await loadPatientItems(); setTimeout(() => location.reload(), 900);
  };
}

async function boot() {
  renderNav();
  app.innerHTML = `<p class="muted">Loading…</p>`;
  try { await loadSession(); await loadPatientItems(); if (approved() && (GATED || PAGE === "search" || PAGE === "workspace")) await loadPro(); } catch (e) { console.error(e); }
  IDX = index();
  if ((GATED && !state.proLoaded) || (PAGE === "accounts" && !isAdmin()) || (PAGE === "cms" && !isEditor())) {
    renderNav();
    app.innerHTML = PAGE === "accounts" && state.proLoaded ? `<h1>Administrators only</h1><p class="prose">Account approvals are limited to administrators.</p>`
      : PAGE === "cms" && state.proLoaded ? `<h1>Editors only</h1><p class="prose">The content editor is for accounts with the editor, reviewer or admin role. An administrator can change your role on the Accounts page.</p>` : gateView();
    document.title = "Sign in · DR ARVEEN";
    bindAuth(); return;
  }
  render();
}
boot();
})();
