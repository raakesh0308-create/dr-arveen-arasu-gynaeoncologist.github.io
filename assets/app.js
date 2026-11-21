(() => {
// Clickjacking protection (M6): never run inside another website's frame (see assets/theme-init.js).
if (window.top !== window.self) return;
/* Patient content is public (patient-data.js). Professional content is loaded from Supabase after sign-in. */
let D = { ...window.ARVEEN_PUBLIC };
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* Readable points: a short label before a colon is shown in bold on its own line, and each sentence or
   semicolon-separated part starts on a new line. Abbreviations (e.g., i.e., vs., et al., Dr.) never cause a break. */
const ABBR_END = /(?:\be\.g|\bi\.e|\bvs|\bet al|\bDr|\bNo|\bapprox|\bFig|\bSt|\bMr|\bMrs|\bMs|\bcf)\.$/i;
function fmt(text) {
  let s = String(text ?? "").trim(); if (!s) return "";
  let lead = "";
  const m = s.match(/^([^:.;]{3,90}):\s+(.+)$/s);
  if (m && !/https?$/i.test(m[1]) && !(/\d$/.test(m[1]) && /^\d/.test(m[2]))) { lead = m[1]; s = m[2]; }
  const parts = []; let buf = "";
  for (const tok of s.split(/(?<=[.;])\s+/)) {
    buf = buf ? buf + " " + tok : tok;
    if (/;$/.test(buf) || (/\.$/.test(buf) && !ABBR_END.test(buf) && !/\b[A-Z]\.$/.test(buf))) { parts.push(buf); buf = ""; }
  }
  if (buf) parts.push(buf);
  const body = parts.length > 1 ? parts.map(p => `<span class="ln">${esc(p)}</span>`).join("") : esc(parts[0] || "");
  return lead ? `<span class="ln lead">${esc(lead)}:</span>${parts.length > 1 ? body : `<span class="ln">${body}</span>`}` : body;
}
// @test:SAFE_ID — record ids are used inside links and HTML attributes, so only these characters are allowed.
const SAFE_ID = /^[A-Za-z0-9._:-]{1,120}$/;
// @end
/* Allow-list cleaner for the textbook-note HTML (M1): keeps simple formatting and tables, removes scripts,
   event handlers, styles, embedded objects and unsafe links. Runs on an inert <template>, so nothing executes. */
// @test:cleanHtml
const CLEAN_TAGS = new Set(["section", "h2", "h3", "h4", "h5", "ul", "ol", "li", "strong", "em", "b", "i", "p", "div", "span", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "br", "hr", "sup", "sub", "code", "pre", "blockquote", "a", "mark", "caption"]);
const DROP_TAGS = /^(script|style|iframe|frame|frameset|object|embed|link|meta|base|svg|math|template|form|input|button|textarea|select|option|img|picture|video|audio|source|track|noscript|applet|portal)$/i;
function cleanHtml(html) {
  const t = document.createElement("template"); t.innerHTML = String(html ?? "");
  const walk = node => {
    for (const el of [...node.children]) {
      const tag = el.tagName.toLowerCase();
      if (DROP_TAGS.test(tag)) { el.remove(); continue; }
      walk(el);
      if (!CLEAN_TAGS.has(tag)) { el.replaceWith(...el.childNodes); continue; }
      for (const a of [...el.attributes]) {
        const n = a.name.toLowerCase(), v = a.value.trim();
        const ok = (n === "class" && /^[\w\s-]{0,200}$/.test(v)) || (n === "id" && /^[\w-]{1,120}$/.test(v)) || ((n === "colspan" || n === "rowspan") && /^\d{1,2}$/.test(v))
          || (n === "href" && tag === "a" && /^(https:\/\/[^\s"'<>]+|#[\w-]+|[a-z0-9-]+\.html(\?[\w=&%.-]*)?(#[\w-]*)?)$/i.test(v));
        if (!ok) el.removeAttribute(a.name);
      }
      if (tag === "a" && /^https:/i.test(el.getAttribute("href") || "")) { el.setAttribute("rel", "noopener noreferrer"); el.setAttribute("target", "_blank"); }
    }
  };
  walk(t.content);
  return t.innerHTML;
}
// @end
const na = v =>(v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) ? `<span class="na">Not recorded</span>` : esc(Array.isArray(v) ? v.join(", ") : v);
const byId = (arr, id) => arr.find(x => x.id === id);
const disease = id => byId(D.diseases, id);
const dname = id => disease(id)?.name || "—";

/* ---------- per-viewer storage (convenience only) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem("arveen." + k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem("arveen." + k, JSON.stringify(v)) } catch {} }
};
let state = { aud: store.get("aud", "pro"), q: "", lang: store.get("lang", "en"), filters: {} };

/* ---------- personal workspace (bookmarks, recently viewed, private notes), sandboxed per account ----------
   Signed in: kept under the account (Supabase table user_workspace, readable only by its owner), with a
   per-account cache in this browser that is wiped on sign-out. Signed out (patients): kept in this browser only. */
const WS_KEYS = ["bm", "recent", "notes"];
let wsTimer = null;
const wsKey = k => state.user ? `u.${state.user.id}.${k}` : k;
const pstore = {
  get(k, d) { return store.get(wsKey(k), d); },
  set(k, v) { store.set(wsKey(k), v); if (state.user) { clearTimeout(wsTimer); wsTimer = setTimeout(wsPush, 1200); } }
};
async function wsPush() {
  if (!sb || !state.user || state.wsCloud === false) return;
  const data = Object.fromEntries(WS_KEYS.map(k => [k, store.get(wsKey(k), k === "notes" ? {} : [])]));
  const { error } = await sb.from("user_workspace").upsert({ user_id: state.user.id, data, updated_at: new Date().toISOString() });
  if (error) state.wsCloud = false;
}
async function wsPull() {
  if (!sb || !state.user) return;
  const { data, error } = await sb.from("user_workspace").select("data").eq("user_id", state.user.id).maybeSingle();
  if (error) { state.wsCloud = false; return; }
  state.wsCloud = true;
  if (data?.data) for (const k of WS_KEYS) if (data.data[k] !== undefined) store.set(wsKey(k), data.data[k]);
}
function wsWipeLocal(uid) {
  try { Object.keys(localStorage).filter(k => k.startsWith(`arveen.u.${uid}.`)).forEach(k => localStorage.removeItem(k)); } catch {}
}
/* Items saved in this browser before workspaces were tied to accounts (shared, unscoped keys) */
const legacyWs = () => ({ bm: store.get("bm", []), recent: store.get("recent", []), notes: store.get("notes", {}) });
const legacyCount = () => { const l = legacyWs(); return l.bm.length + Object.values(l.notes).filter(Boolean).length; };

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
  const c = { "VERIFIED AGAINST SOURCE": "ok", "CLINICALLY REVIEWED": "ok", "APPROVED": "ok", "PARTIALLY VERIFIED": "warn", "NOT VERIFIED": "warn", "DRAFT": "warn", "SUPERSEDED": "bad", "NOT STARTED": "", "DETECTED": "warn", "SEARCH TASK": "teal", "EXTRACTED": "teal", "PENDING PHARMACIST REVIEW": "warn", "PHARMACIST VERIFIED": "ok", "CHANGES NEEDED": "bad" }[s] ?? "";
  return `<span class="pill ${c}">${esc(s)}</span>`;
};
/* In lists, only show labels that carry news (signed off, or needing attention); the page banner covers the rest. */
const QUIET = ["NOT VERIFIED", "EXTRACTED", "PARTIALLY VERIFIED", "DRAFT", "NOT STARTED", "PENDING PHARMACIST REVIEW", "EDITORIAL REVIEW", "CLINICAL REVIEW"];
const listPill = s => !s || QUIET.includes(s) ? "" : statusPill(s);
const reviewStrip = (pt) => pt
  ? `<p class="banner slim">This information is still being reviewed by our clinical team. It does not replace advice from your own doctors. <a href="guide.html#g-labels">What the labels mean</a></p>`
  : `<p class="banner slim">Everything here is awaiting clinical review unless it carries a green label. Doses are not for prescribing until marked <b>PHARMACIST VERIFIED</b>. <a href="guide.html#g-labels">What the labels mean</a></p>`;
const supPill = g => g.superseded === "superseded" ? `<span class="pill bad">Superseded</span>` : g.superseded === "uncertain" ? `<span class="pill warn">Currency uncertain</span>` : `<span class="pill ok">Active</span>`;
const orgs = g => g.org.join(" / ");

/* ---------- navigation ---------- */
const NAV_PRO = [["home", "Home"], ["guidelines", "Guidelines"], ["diseases", "Diseases"], ["staging", "Staging"], ["protocols", "Treatment Protocols"], ["drugs", "Drug Reference"], ["trials", "Clinical Trials"], ["algorithms", "Clinical Algorithms"], ["calculators", "Calculators"], ["compare", "Evidence and Research"], ["updates", "Guideline Updates"], ["education", "Education"], ["pt", "Patient Education"], ["sdm", "Shared Decision-Making"], ["workspace", "My Workspace"], ["admin", "Editorial"], ["accounts", "Accounts"], ["governance", "Governance"], ["about", "About"]];
const NAV_PT = [["pt", "Home"], ["ptcancers", "Your cancer"],
  { label: "Articles & leaflets", items: [["articles", "Articles"], ["leaflets", "Information leaflets"], ["glossary", "Medical glossary"]] },
  { label: "Tools", items: [["sdm", "Prepare for appointments"], ["tool", "Planning guides"], ["tracker", "Side-effect tracker"], ["workspace", "Saved pages"]] },
  ["portfolio", "Dr Arveen"], ["guide", "Help"]];
/* Each route name maps to its own HTML file; records use ?id= */
const FILES = { welcome: "index.html", home: "professional.html", login: "login.html", register: "register.html", reset: "reset-password.html", accounts: "accounts.html", cms: "content-editor.html", review: "review-queue.html", adminws: "admin-workspace.html", security: "two-step.html", tool: "patient-tool.html", portfolio: "dr-arveen.html", guide: "guide.html", notes: "textbook-notes.html", governance: "governance.html", privacy: "privacy.html", guidelines: "guidelines.html", recs: "recommendations.html", g: "guideline.html", diseases: "diseases.html", d: "disease.html",
  staging: "staging.html", s: "staging-system.html", protocols: "protocols.html", p: "protocol.html", drugs: "drugs.html", dr: "drug.html", trials: "trials.html", t: "trial.html",
  algorithms: "algorithms.html", visuals: "tables.html", calculators: "calculators.html", compare: "evidence.html", updates: "updates.html", education: "education.html", workspace: "workspace.html",
  admin: "editorial.html", about: "about.html", search: "search.html", pt: "patients.html", ptcancers: "patient-cancers.html", ptd: "patient-cancer.html",
  leaflets: "leaflets.html", l: "leaflet.html", articles: "articles.html", a: "article.html", sdm: "decision-making.html", tracker: "tracker.html", glossary: "glossary.html" };
const PAGE_BY_FILE = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [f, k]));
function url(route) {
  const i = route.indexOf("."); const base = i < 0 ? route : route.slice(0, i); const arg = i < 0 ? "" : route.slice(i + 1);
  const f = FILES[base] || "index.html";
  return arg ? `${f}?id=${encodeURIComponent(arg)}` : f;
}
const PARAMS = new URLSearchParams(location.search);
// @test:safeNext — where to go after sign-in: only a page of this site ("name.html", optional ?query and #anchor).
// Anything else (javascript:, other websites, tricks with spaces, tabs or backslashes) falls back to the default.
const safeNext = (n, dflt) => typeof n === "string" && /^[a-z0-9-]+\.html(\?[\w=&%.~+,-]*)?(#[\w-]*)?$/i.test(n) ? n : dflt;
// @end
const PAGE = document.body.dataset.page || PAGE_BY_FILE[location.pathname.split("/").pop()] || "welcome";
const PT_PAGES = ["pt", "ptcancers", "ptd", "leaflets", "l", "articles", "a", "tracker", "glossary", "tool"];
const SHARED_PAGES = ["welcome", "login", "register", "reset", "governance", "privacy", "workspace", "about", "sdm", "search", "guide", "portfolio"];
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
  </div>
  <div class="mast-row2"><nav class="mnav" id="nav" aria-label="Sections"></nav>
    <div class="mast-ctrl">
      <span class="acct" id="acct"></span>
      <div class="mast-prefs">
        <span class="tsize" role="group" aria-label="Text size"><button class="theme-btn" id="ts-down" type="button" title="Smaller text">A<span aria-hidden="true">−</span><span class="sr-only"> Smaller text</span></button><button class="theme-btn" id="ts-up" type="button" title="Bigger text">A<span aria-hidden="true">+</span><span class="sr-only"> Bigger text</span></button></span>
        <select class="lang" id="lang" aria-label="Language"><option value="en">English</option><option value="ms">Bahasa Malaysia</option><option value="zh">中文</option><option value="ta">தமிழ்</option></select>
        <button class="theme-btn" id="theme" type="button" title="Switch light or dark mode">☾ Dark</button>
      </div>
    </div>
  </div></div>`;
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
    <p class="footlinks"><a href="guide.html">Site guide and help</a><a href="about.html">About and disclosures</a><a href="governance.html">How content is checked and approved</a><a href="privacy.html">Privacy notice</a><a href="patients.html">Patient Education Centre</a></p></div>
    <div class="storage-note" id="storenote" hidden><p>DR ARVEEN keeps your settings and side-effect tracker entries in this browser only. If you sign in, your bookmarks and private notes are saved to your own account. <a href="privacy.html">Privacy notice</a></p><button class="btn" type="button" id="storeok">OK</button></div>`;
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
  { label: "Reference", items: [["notes", "Textbook notes"], ["guidelines", "Guidelines"], ["updates", "↳ Guideline updates"], ["recs", "↳ Recommendations"], ["visuals", "↳ Tables & flowcharts"], ["diseases", "Diseases"], ["staging", "Staging"], ["protocols", "Treatment protocols"], ["drugs", "Drug reference"], ["trials", "Clinical trials"]] },
  { label: "Tools", items: [["calculators", "Calculators"], ["algorithms", "Clinical pathways"], ["education", "Education"], ["compare", "Evidence and comparisons"], ["sdm", "Shared decisions"]] },
  ["portfolio", "Dr Arveen"], ["pt", "Patients"], ["guide", "Help"]];
/* Account menu (top right): personal and admin pages, shown only to the roles that can use them */
const ACCT_PERSONAL = [["workspace", "My Workspace"], ["security", "Two-step sign-in"]];
const ACCT_ADMIN = [["adminws", "Admin workspace"], ["review", "Review queue"], ["cms", "Edit content"], ["admin", "Editorial dashboard"], ["accounts", "Accounts"]];
const ACCT_INFO = [["governance", "Governance"], ["about", "About"]];
function renderNav() {
  renderAcct();
  document.body.classList.toggle("aud-pt", state.aud === "pt");
  const map = { g: "guidelines", recs: "guidelines", d: "diseases", s: "staging", p: "protocols", dr: "drugs", t: "trials", l: "leaflets", ptd: "ptcancers", a: "articles" };
  const cur = map[PAGE] || PAGE;
  const link = ([r, t]) => `<a href="${url(r)}" ${r === cur ? 'aria-current="page"' : ""}>${t}</a>`;
  $("#nav").innerHTML = (state.aud === "pro" ? NAV_PRO_GROUPS : NAV_PT).map(g => Array.isArray(g) ? link(g)
    : `<details class="navgrp"><summary class="${g.items.some(([r]) => r === cur) ? "cur" : ""}">${g.label}</summary><div class="navmenu">${g.items.map(link).join("")}</div></details>`).join("");
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
const ic = name => Object.hasOwn(ICON, name) ? `<span class="ticon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg></span>` : "";
const HUE = { cervical: "#0e7c86", ovarian: "#5f4dbf", tubal: "#7046a8", peritoneal: "#4b5bb0", endometrial: "#b04a26", vulvar: "#a3316f", vaginal: "#1f6aa8", sarcoma: "#2f7a3e", gtn: "#875800", rare: "#4a5868" };
const ABBR = { cervical: "CX", ovarian: "OV", tubal: "FT", peritoneal: "PP", endometrial: "EN", vulvar: "VU", vaginal: "VA", sarcoma: "US", gtn: "GTN", rare: "RG" };
/* One order everywhere: the disease list order (cervical, ovarian, tubal, peritoneal, endometrial, vulvar, vaginal, sarcoma, GTN, rare), general items last. */
const DIS_ORDER = id => { const i = D.diseases.findIndex(d => d.id === id); return i < 0 ? 999 : i; };
const disLabel = (k, pt) => k === "all" || !k ? (pt ? "For all gynaecological cancers" : "All gynaecological cancers / general") : dname(k);
function byDisease(items, dis, renderGroup, pt) {
  const keyOf = x => { const v = [].concat(dis(x)).filter(Boolean); return v.length ? v : ["all"]; };
  const keys = [...new Set(items.flatMap(keyOf))].sort((a, b) => DIS_ORDER(a) - DIS_ORDER(b));
  if (!keys.length) return "";
  const jump = keys.length > 1 ? `<nav class="djump" aria-label="Jump to cancer type">${keys.map(k => `<a href="#dg-${k}">${badge(k)}<span>${esc(disLabel(k, pt))}</span></a>`).join("")}</nav>` : "";
  return jump + keys.map(k => { const its = items.filter(x => keyOf(x).includes(k)); return `<section class="dgroup" id="dg-${k}"><h2 class="dgroup-h">${badge(k)}<span>${esc(disLabel(k, pt))}</span><span class="dcount">${its.length}</span></h2>${renderGroup(its)}</section>`; }).join("");
}
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
const isReviewer = () => approved() && ["reviewer", "admin"].includes(state.profile.role);
/* Staff (editor, reviewer, admin) must complete two-step sign-in (authenticator app) before using staff tools. */
const staffRole = () => approved() && ["editor", "reviewer", "admin"].includes(state.profile.role);
const needsMfa = () => staffRole() && state.aal !== "aal2";
const STAFF_PAGES = ["adminws", "review", "cms", "accounts", "admin"];
const isPharmacist = () => approved() && state.profile.profession === "Pharmacist";
const canApprove = () => approved() && ["reviewer", "admin"].includes(state.profile.role);
/* Online edits to patient content (Supabase patient_items) are applied on top of the built-in content */
state.items = [];
async function loadPatientItems() {
  if (!sb) return;
  // Signed-out visitors may only read the public columns (upgrade-10-hardening.sql hides staff names and ids).
  const { data, error } = await sb.from("patient_items").select(state.user ? "*" : "id,kind,data,status,reviewer,last_review,next_review,updated_at");
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
  const se = await sb.from("site_edits").select(state.user ? "*" : "id,scope,data,updated_at"); // upgrade-9-site-edits.sql
  state.editsTable = !se.error; state.edits = Object.fromEntries((se.data || []).map(r => [r.id, r]));
  applyEdits(P);
}
/* ---------- site-wide online edits (site_edits): any record, page banner, carousel or the portfolio ----------
   Row id "collection:recordId" patches that record; "page:<route>" adds a picture/intro to a page;
   "slides:pro|pt" replaces the carousel; "portfolio:main" patches the portfolio. Originals are kept for diffing and revert. */
state.edits = {}; const ORIG = {};
const EDIT_COLLS = [["guidelines", "Guidelines"], ["recommendations", "Recommendations"], ["diseases", "Disease reference"], ["staging", "Staging systems"], ["protocols", "Treatment protocols"], ["drugs", "Drugs"], ["trials", "Clinical trials"], ["algorithms", "Clinical pathways"], ["literature", "Research library"], ["notes", "Textbook note chapters"]];
const editList = (target, coll) => coll === "notes" ? (target.notes?.chapters || null) : target[coll];
// @test:cleanEdit — an online edit can never set a record's id, raw HTML or sign-off fields (those come only from the
// Review queue). The database refuses them too (upgrade-10-hardening.sql); this is the second line of defence.
const RESERVED_EDIT_KEYS = ["id", "html", "status", "approval", "reviewer", "verifiedOn", "nextReview", "reviewNote", "reviewedOn", "doseStatus", "doseReviewer", "doseReviewedOn", "doseNote", "refReview", "reviewStatus", "editedAt", "editedBy", "editKeys", "editedAfterReview", "doseEditedAfterReview", "__proto__", "constructor", "prototype"];
const cleanEdit = data => { const out = {}; if (!data || typeof data !== "object" || Array.isArray(data)) return out;
  for (const [k, v] of Object.entries(data)) if (!RESERVED_EDIT_KEYS.includes(k)) out[k] = v; return out; };
// @end
function applyEdits(target) {
  state.slides = {}; state.pageEdits = {};
  for (const row of Object.values(state.edits)) {
    const i = row.id.indexOf(":"), coll = row.id.slice(0, i), id = row.id.slice(i + 1), data = cleanEdit(row.data);
    if (coll === "slides") { if (Array.isArray(data.slides)) state.slides[id] = data.slides; continue; }
    if (coll === "page") { state.pageEdits[id] = data; continue; }
    if (coll === "portfolio") { const p = window.ARVEEN_PUBLIC.portfolio || (window.ARVEEN_PUBLIC.portfolio = {}); if (!ORIG[row.id]) ORIG[row.id] = JSON.parse(JSON.stringify(p)); Object.assign(p, data); continue; }
    const list = editList(target, coll); if (!Array.isArray(list)) continue;
    const x = list.find(r => r.id === id); if (!x) continue;
    if (!ORIG[row.id] || ORIG[row.id].__src !== list) ORIG[row.id] = { ...JSON.parse(JSON.stringify(x)), __src: list };
    Object.assign(x, data, { editedAt: row.updated_at, editedBy: row.editor, editKeys: Object.keys(data) });
  }
}
const origOf = key => { const o = ORIG[key]; if (!o) return null; const { __src, ...r } = o; return r; };
const photo = img => img && /^https:\/\//.test(img.url || "") ? `<figure class="photo"><img src="${esc(img.url)}" alt="${esc(img.alt || "")}" loading="lazy">${img.credit ? `<figcaption>${esc(img.credit)}</figcaption>` : ""}</figure>` : "";
const siteBase = () => location.origin + location.pathname.replace(/[^/]*$/, "");
async function loadSession() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user || null;
  if (state.user) { const { data } = await sb.from("profiles").select("*").eq("id", state.user.id).maybeSingle(); state.profile = data; await wsPull();
    try { const a = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); state.aal = a.data?.currentLevel || "aal1"; state.aalNext = a.data?.nextLevel || "aal1"; } catch { state.aal = "aal1"; } }
}
async function loadPro() {
  const { data, error } = await sb.from("pro_content").select("key,data");
  if (error || !data?.length) return false;
  const pro = Object.fromEntries(data.map(r => [r.key, r.data])), pub = window.ARVEEN_PUBLIC;
  for (const k of ["leaflets", "articles", "glossary", "journey", "concerns", "sdmQuestions"]) delete pro[k]; // patient content always comes from the public file
  if (pro.diseases) pro.diseases = pro.diseases.map(d => { const p = pub.diseases.find(x => x.id === d.id) || {}; return { ...d, patient: p.patient || d.patient, patientSections: p.patientSections || null, image: p.image || null, pageStatus: p.pageStatus, online: p.online, reviewer: p.reviewer, lastReview: p.lastReview, nextReview: p.nextReview }; });
  D = { ...pub, ...pro };
  // Defence in depth (M1): drop records whose id could break out of an HTML attribute, and clean note HTML.
  for (const [k, v] of Object.entries(D)) if (Array.isArray(v) && v.some(x => x && typeof x === "object" && "id" in x)) D[k] = v.filter(x => !x || typeof x !== "object" || !("id" in x) || SAFE_ID.test(String(x.id)) || (console.warn("Skipped a record with an unsafe id in", k), false));
  if (D.notes?.chapters) D.notes.chapters = D.notes.chapters.filter(c => SAFE_ID.test(String(c.id))).map(c => ({ ...c, html: cleanHtml(c.html) }));
  applyEdits(D);
  state.proLoaded = true;
  const rv = await sb.from("pro_reviews").select("*"); // table exists after upgrade-4-reviews.sql
  state.reviews = {}; state.reviewsTable = !rv.error; if (!rv.error) applyReviews(rv.data || []);
  const mc = await sb.from("my_cpg").select("*"); // Malaysian positions (upgrade-8-malaysia-cpg.sql)
  state.mycpgTable = !mc.error; state.mycpg = Object.fromEntries((mc.data || []).map(r => [r.rec_id, r]));
  return true;
}
/* Online sign-offs (pro_reviews) are laid over the built-in records. Item ids look like "recommendation:R-EN-A01". */
const REVIEW_KINDS = { guideline: "guidelines", recommendation: "recommendations", staging: "staging", protocol: "protocols", drug: "drugs", trial: "trials", literature: "literature", algorithm: "algorithms", disease: "diseases" };
function applyReviews(rows) {
  for (const r of rows) {
    state.reviews[r.item_id] = r;
    const id = r.item_id.slice(r.item_id.indexOf(":") + 1);
    const info = { status: r.status, reviewer: r.reviewer, verifiedOn: r.reviewed_on, nextReview: r.next_review, reviewNote: r.note };
    if (r.kind === "notes") {
      const c = (D.notes?.chapters || []).find(x => x.id === id); if (c) Object.assign(c, info);
      continue;
    }
    if (r.kind === "dose") {
      const x = byId(D.drugs, id) || byId(D.protocols, id); if (!x) continue;
      // A dose edited online after the pharmacist's sign-off goes back to pending until verified again.
      if (x.editedAt && String(x.editedAt) > String(r.updated_at) && (x.editKeys || []).some(k => /dose|regimen|schedule/i.test(k))) { x.doseEditedAfterReview = true; continue; }
      Object.assign(x, { doseStatus: r.status, doseReviewer: r.reviewer, doseReviewedOn: r.reviewed_on, doseNote: r.note });
      continue;
    }
    const x = byId(D[REVIEW_KINDS[r.kind]] || [], id); if (!x) continue;
    if (x.editedAt && String(x.editedAt) > String(r.updated_at)) x.editedAfterReview = true;
    if (r.kind === "disease") { x.refReview = info; continue; }
    Object.assign(x, info);
    if (r.kind === "trial" && x.outcome) x.outcome.status = r.status;
  }
}
function renderAcct() {
  const el = $("#acct"); if (!el) return;
  const allowed = ([r]) => (r !== "accounts" || isAdmin()) && (r !== "cms" || isEditor()) && (r !== "review" || isReviewer()) && (r !== "admin" || isEditor()) && (r !== "adminws" || isEditor());
  const name = state.profile?.full_name || state.user?.email || "";
  el.innerHTML = state.user
    ? `<details class="navgrp acctgrp"><summary class="acct-name" title="${esc(state.user.email)}"><span class="avatar" aria-hidden="true">${esc(name.trim().charAt(0).toUpperCase())}</span><span class="acct-label">${esc(name)}</span></summary>
      <div class="navmenu"><span class="menu-h">${esc(state.user.email)}${state.profile?.role && state.profile.role !== "reader" ? ` · ${esc(state.profile.role)}` : ""}</span>
      ${[["Personal", ACCT_PERSONAL], ["Administration", ACCT_ADMIN], ["", ACCT_INFO]].map(([h, items]) => { const its = items.filter(allowed); return its.length ? `${h ? `<span class="menu-sec">${h}</span>` : `<span class="menu-sep"></span>`}${its.map(([r, t]) => `<a href="${url(r)}" ${r === PAGE ? 'aria-current="page"' : ""}>${t}</a>`).join("")}` : ""; }).join("")}
      <button class="menu-btn" id="signout" type="button">Sign out</button></div></details>`
    : `<a class="theme-btn" href="${url("workspace")}">Saved</a><a class="theme-btn" href="login.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}">Sign in</a>`;
  const so = $("#signout"); if (so) so.onclick = () => signOutNow();
}
/* Sign out: save the workspace to the account, then remove the local copy (shared computers). */
async function signOutNow() {
  clearTimeout(wsTimer); try { await wsPush(); } catch {}
  const uid = state.user?.id; try { await sb.auth.signOut(); } catch {}
  if (uid && state.wsCloud !== false) wsWipeLocal(uid);
  location.href = "index.html";
}
const authErr = (msg) => { const e = $("#autherr"); if (e) { e.hidden = false; e.textContent = msg; } };
const authOk = (msg) => { const e = $("#authok"); if (e) { e.hidden = false; e.innerHTML = msg; } };
const notConfigured = () => `<p class="banner bad">Sign-in isn't connected yet. The site owner needs to finish the Supabase setup (see SUPABASE-SETUP.md in the repository).</p>`;
const loginForm = () => `<form class="calc authbox" id="loginf"><h2>Sign in</h2>
  <p class="muted">Professional content is for registered healthcare professionals with an approved DR ARVEEN account.</p>
  <label for="li-email">Email<input id="li-email" type="email" autocomplete="email" required></label>
  <label for="li-pass">Password<input id="li-pass" type="password" autocomplete="current-password" required></label>
  <p class="result err" role="alert" id="autherr" hidden></p>
  <div class="captcha-box" data-captcha></div><div class="toc"><button class="btn primary" type="submit">Sign in</button><a class="btn" href="register.html">Request an account</a><a class="btn" href="reset-password.html">Forgot password</a></div></form>`;
function gateView() {
  if (!sb) return `<h1>Healthcare professionals</h1>${notConfigured()}`;
  if (!state.user) return `<span class="eyebrow">Healthcare professionals</span><h1>Sign in to continue</h1>${loginForm()}<p class="muted">Patients and caregivers don't need an account: <a href="patients.html">go to the Patient Education Centre</a>.</p>`;
  const st = state.profile?.status;
  if (st === "pending" || !st) return `<span class="eyebrow">Account</span><h1>Your account is waiting for approval</h1><p class="prose">We check each professional registration before giving access. You'll be able to use the professional pages once an administrator approves your account.</p><p class="muted">Signed in as ${esc(state.user.email)}.</p>`;
  if (st === "rejected" || st === "suspended") return `<span class="eyebrow">Account</span><h1>Access not available</h1><p class="prose">This account doesn't have access to the professional pages. Contact the DR ARVEEN team if you think this is a mistake.</p>`;
  return `<h1>Professional content isn't loaded yet</h1><p class="banner">Your account is approved, but the professional content hasn't been added to the database. The site owner needs to run the content import (see SUPABASE-SETUP.md).</p>`;
}
/* CAPTCHA (Cloudflare Turnstile): with CAPTCHA protection on in Supabase, sign-in, sign-up and password reset need a
   token. The script loads only on pages with one of these forms. Without a site key in config.js, forms work as before. */
let tsLoad = null;
function loadTurnstile() { if (!tsLoad) tsLoad = new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); return tsLoad; }
function captcha(form) {
  const st = { token: null, id: null }, el = form && form.querySelector("[data-captcha]");
  if (!el || !CFG.turnstileSiteKey) return { needed: false, get: () => undefined, reset() {} };
  loadTurnstile().then(() => { st.id = window.turnstile.render(el, { sitekey: CFG.turnstileSiteKey, theme: isDark() ? "dark" : "light",
    callback: t => { st.token = t; }, "expired-callback": () => { st.token = null; }, "error-callback": () => { st.token = null; } }); })
    .catch(() => { el.textContent = "The security check couldn't load. Check your connection and reload the page."; });
  return { needed: true, get: () => st.token || undefined, reset() { st.token = null; try { if (st.id !== null) window.turnstile.reset(st.id); } catch {} } };
}
const CAPTCHA_MSG = "Please complete the security check above the button.";
function bindAuth() {
  const lf = $("#loginf");
  const lc = captcha(lf);
  if (lf) lf.onsubmit = async e => {
    e.preventDefault();
    if (lc.needed && !lc.get()) return authErr(CAPTCHA_MSG);
    const { error } = await sb.auth.signInWithPassword({ email: $("#li-email").value.trim(), password: $("#li-pass").value, options: { captchaToken: lc.get() } });
    lc.reset();
    if (error) return authErr(/captcha/i.test(error.message) ? "The security check failed or expired. Please try again." :error.message === "Email not confirmed" ? "Confirm your email first: open the link we sent you." : "That email and password don't match an account.");
    location.href = PAGE === "login" ? safeNext(PARAMS.get("next"), "professional.html") : location.href;
  };
  const rf = $("#regf");
  const rc = captcha(rf);
  if (rf) rf.onsubmit = async e => {
    e.preventDefault();
    const v = id => $("#" + id).value.trim();
    if ($("#rg-pass").value.length < 10 || !/[a-z]/.test($("#rg-pass").value) || !/[A-Z]/.test($("#rg-pass").value) || !/\d/.test($("#rg-pass").value)) return authErr("Use a password of at least 10 characters with upper- and lower-case letters and a number.");
    if (!$("#rg-agree").checked) return authErr("Tick the confirmation box to continue.");
    if (rc.needed && !rc.get()) return authErr(CAPTCHA_MSG);
    const tok = rc.get(); rc.reset();
    const { error } = await sb.auth.signUp({ email: v("rg-email"), password: $("#rg-pass").value, options: { captchaToken: tok,
      emailRedirectTo: siteBase() + "login.html",
      data: { full_name: v("rg-name"), profession: v("rg-prof"), registration_body: v("rg-body"), registration_number: v("rg-num"), institution: v("rg-inst") } } });
    if (error) return authErr(error.message);
    rf.hidden = true; authOk("Request received. Check your email and open the confirmation link. An administrator will then verify your registration and approve your account.");
  };
  const pf = $("#resetf");
  const pc = captcha(pf);
  if (pf) pf.onsubmit = async e => {
    e.preventDefault();
    if (pc.needed && !pc.get()) return authErr(CAPTCHA_MSG);
    const tok = pc.get(); pc.reset();
    const { error } = await sb.auth.resetPasswordForEmail($("#rs-email").value.trim(), { redirectTo: siteBase() + "reset-password.html", captchaToken: tok });
    if (error) return authErr(error.message);
    authOk("If that email has an account, a reset link is on its way.");
  };
  const nf = $("#newpassf");
  if (nf) nf.onsubmit = async e => {
    e.preventDefault();
    if ($("#np-pass").value.length < 10 || !/[a-z]/.test($("#np-pass").value) || !/[A-Z]/.test($("#np-pass").value) || !/\d/.test($("#np-pass").value)) return authErr("Use a password of at least 10 characters with upper- and lower-case letters and a number.");
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
/* Larger text: remembered in this browser */
/* Text size: A− and A+ step the whole page from 87.5% to 150%, remembered in this browser */
const TS_STEPS = [87.5, 100, 112.5, 125, 137.5, 150];
function applyTextSize(level) { level = Math.max(-1, Math.min(4, level | 0)); root.style.fontSize = TS_STEPS[level + 1] + "%"; const d = $("#ts-down"), u = $("#ts-up"); if (d) d.disabled = level <= -1; if (u) u.disabled = level >= 4; return level; }
applyTextSize(store.get("textlevel", store.get("bigtext", false) ? 2 : 0));
$("#ts-down").onclick = () => store.set("textlevel", applyTextSize(store.get("textlevel", 0) - 1));
$("#ts-up").onclick = () => store.set("textlevel", applyTextSize(store.get("textlevel", 0) + 1));
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => applyTheme());
$("#lang").value = state.lang;
$("#lang").onchange = e => { state.lang = e.target.value; store.set("lang", state.lang); render(); };
function go(r) { if (r === "search") { location.href = "search.html?q=" + encodeURIComponent(state.q); return; } if (url(r) === url(PAGE)) render(); else location.href = url(r); }

/* ---------- bookmarks / recent / notes ---------- */
const bm = () => pstore.get("bm", []);
function bmBtn(type, id, title) {
  const on = bm().some(b => b.id === id);
  return `<button class="btn" data-bm='${esc(JSON.stringify({ type, id, title }))}' aria-pressed="${on}">${on ? "★ Saved" : "☆ Save"}</button>`;
}
function recent(type, id, title) {
  const r = pstore.get("recent", []).filter(x => x.id !== id); r.unshift({ type, id, title, at: new Date().toISOString().slice(0, 10) }); pstore.set("recent", r.slice(0, 12));
}
/* "Continue where you left off": the last pages opened in this browser */
const RECENT_ROUTE = { Guide: "tool", Article: "a", Disease: "d", Drug: "dr", Guideline: "g", Leaflet: "l", "Patient page": "ptd", Protocol: "p", Staging: "s", Trial: "t" };
function continueBlock(types) {
  const r = pstore.get("recent", []).filter(x => types.includes(x.type)).slice(0, 5);
  if (!r.length) return "";
  return `<section class="section continue"><div class="section-h"><h2>Continue where you left off</h2><a href="${url("workspace")}">My Workspace</a></div>
    <div class="chips">${r.map(x => `<a class="chip" href="${url(`${RECENT_ROUTE[x.type]}.${x.id}`)}"><span class="muted">${esc(x.type)}</span>&nbsp;${esc(x.title.length > 60 ? x.title.slice(0, 58) + "…" : x.title)}</a>`).join("")}</div></section>`;
}
function noteBox(id) {
  const n = pstore.get("notes", {})[id] || "";
  return `<details class="calc"><summary><b>My private note</b> <span class="muted">(${state.user ? "visible only to you" : "kept only in this browser"})</span></summary><textarea id="note-${esc(id)}" data-note="${esc(id)}" aria-label="Private note">${esc(n)}</textarea></details>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-bm]"); if (!b) return;
  const it = JSON.parse(b.dataset.bm); let l = bm();
  l = l.some(x => x.id === it.id) ? l.filter(x => x.id !== it.id) : [...l, it];
  pstore.set("bm", l); const on = l.some(x => x.id === it.id);
  b.setAttribute("aria-pressed", on); b.textContent = on ? "★ Saved" : "☆ Save";
});
document.addEventListener("input", e => {
  const t = e.target.closest("[data-note]"); if (!t) return;
  const n = pstore.get("notes", {}); n[t.dataset.note] = t.value; pstore.set("notes", n);
});

/* ---------- search ----------
   Query → normalise (case, accents, hyphens) → expand phrases and abbreviations (English, clinical shorthand, Malay)
   → each term must match (short terms as whole words only) → unknown words are corrected to the nearest word in
   the index (typo tolerance) → ranked: exact ID, title phrase, title words, whole-word body matches, current over superseded. */
// @test:searchcore
const SEARCH_PHRASES = [
  // multi-word synonyms, applied to the whole query first
  ["pap smear", "cytology"], ["sentinel node", "sentinel"], ["sentinel lymph node", "sentinel"], ["lymph node", "node"],
  ["radical hysterectomy", "radical hysterectomy"], ["primary debulking", "primary cytoreductive"], ["interval debulking", "interval cytoreductive"],
  ["fertility sparing", "fertility-sparing"], ["fertility preservation", "fertility"], ["borderline tumour", "borderline"], ["borderline tumor", "borderline"],
  ["molar pregnancy", "molar trophoblastic"], ["germ cell", "germ cell"], ["clear cell", "clear-cell"], ["blood clot", "thromboembolism"],
  ["barah serviks", "cervical"], ["kanser serviks", "cervical"], ["kanser pangkal rahim", "cervical"], ["kanser rahim", "endometrial uterine"],
  ["kanser ovari", "ovarian"], ["kanser faraj", "vaginal"], ["kanser vulva", "vulvar"], ["ujian pap", "cytology"]
];
const SYN = {
  // organs and cancers (incl. Malay)
  uterine: ["endometrial", "womb", "uterus"], uterus: ["uterine", "endometrial"], endometrial: ["uterine", "womb", "endometrium"], endometrium: ["endometrial"], womb: ["endometrial", "uterine"],
  ovary: ["ovarian"], ovarian: ["ovary", "tubal", "peritoneal", "tubo-ovarian"], ovaries: ["ovarian"], cervix: ["cervical"], cervical: ["cervix"], vulva: ["vulvar"], vulval: ["vulvar"], vulvar: ["vulva"], vagina: ["vaginal"], vaginal: ["vagina"],
  rahim: ["uterine", "endometrial", "womb"], serviks: ["cervical"], ovari: ["ovarian"], faraj: ["vaginal"], barah: ["cancer"], kanser: ["cancer"], tumor: ["tumour"], tumour: ["tumor"],
  kemoterapi: ["chemotherapy"], radioterapi: ["radiotherapy"], pembedahan: ["surgery"], saringan: ["screening"], ubat: ["drug"], hamil: ["pregnancy"], kehamilan: ["pregnancy"], kesuburan: ["fertility"],
  gtn: ["trophoblastic"], gtd: ["trophoblastic"], molar: ["trophoblastic", "mole"], choriocarcinoma: ["trophoblastic"], sarcoma: ["sarcomas", "leiomyosarcoma"], lms: ["leiomyosarcoma"], ess: ["stromal"],
  // treatments and drugs
  chemo: ["chemotherapy", "carboplatin", "paclitaxel", "cisplatin"], chemotherapy: ["chemo"], carbo: ["carboplatin"], taxol: ["paclitaxel"], cis: ["cisplatin"], pld: ["liposomal doxorubicin", "pegylated"], caelyx: ["liposomal doxorubicin"],
  bev: ["bevacizumab"], avastin: ["bevacizumab"], keytruda: ["pembrolizumab"], pembro: ["pembrolizumab"], dostar: ["dostarlimab"], lynparza: ["olaparib"], zejula: ["niraparib"],
  "pd-1": ["pembrolizumab", "dostarlimab", "immunotherapy", "checkpoint"], pd1: ["pembrolizumab", "dostarlimab", "immunotherapy"], immunotherapy: ["pembrolizumab", "dostarlimab", "checkpoint"], ici: ["checkpoint", "immunotherapy"],
  parp: ["olaparib", "niraparib", "rucaparib"], parpi: ["parp", "olaparib", "niraparib"], adc: ["antibody-drug"], hipec: ["hyperthermic"],
  radiotherapy: ["radiation", "brachytherapy", "chemoradiotherapy"], radiation: ["radiotherapy"], rt: ["radiotherapy"], ebrt: ["external beam"], bt: ["brachytherapy"], igabt: ["brachytherapy"], igbt: ["brachytherapy"],
  crt: ["chemoradiotherapy", "chemoradiation"], ctrt: ["chemoradiotherapy"], ccrt: ["chemoradiotherapy"], chemoradiation: ["chemoradiotherapy"], nact: ["neoadjuvant"], neoadjuvant: ["nact"],
  pds: ["primary cytoreductive", "primary debulking"], ids: ["interval cytoreductive", "interval debulking"], debulking: ["cytoreductive", "cytoreduction"], cytoreduction: ["cytoreductive", "debulking"],
  rh: ["radical hysterectomy"], tah: ["hysterectomy"], hysterectomy: ["surgery"], bso: ["salpingo-oophorectomy"], rrso: ["risk-reducing", "salpingo-oophorectomy"], trachelectomy: ["fertility-sparing"], cone: ["conisation", "conization"], conisation: ["conization", "cone"], conization: ["conisation"], leep: ["conisation", "loop"], lletz: ["conisation", "loop"],
  sln: ["sentinel"], slnb: ["sentinel"], sentinel: ["sln"], lnd: ["lymphadenectomy"], lymphadenectomy: ["lymph node", "lnd"], ifl: ["inguinofemoral"], eras: ["enhanced recovery"], vte: ["thromboembolism", "thromboprophylaxis"], dvt: ["thromboembolism"], lmwh: ["heparin"], hrt: ["hormone replacement"],
  // pathology and biomarkers
  lvsi: ["lymphovascular"], hgsc: ["high-grade serous"], lgsc: ["low-grade serous"], ccc: ["clear-cell", "clear cell"], stic: ["serous tubal intraepithelial"], bot: ["borderline"], mogct: ["germ cell"], gct: ["germ cell", "granulosa"], scst: ["sex cord"],
  brca: ["brca1", "brca2"], brca1: ["brca"], brca2: ["brca"], hrd: ["homologous recombination", "genomic instability"], gis: ["genomic instability"], mmr: ["mismatch repair", "msi", "dmmr"], dmmr: ["mmr", "mismatch repair"], msi: ["microsatellite", "mmr"], lynch: ["mmr", "mismatch repair"],
  pole: ["pole"], p53: ["p53abn", "tp53"], tcga: ["molecular classification"], her2: ["her2"], hpv: ["papillomavirus"], cin: ["intraepithelial"], ais: ["adenocarcinoma in situ"],
  // tests, staging, scores
  ca125: ["ca-125", "ca 125"], "ca-125": ["ca125"], he4: ["he4"], rmi: ["risk of malignancy"], roma: ["risk of ovarian malignancy"], afp: ["alpha-fetoprotein"], hcg: ["chorionic gonadotropin", "hcg"],
  pet: ["pet-ct"], petct: ["pet-ct"], mri: ["magnetic resonance"], ct: ["computed tomography", "ct"], us: ["ultrasound"], tvs: ["transvaginal"], iota: ["adnex"],
  staging: ["figo", "stage"], figo: ["staging", "stage"], tnm: ["staging"], stage: ["staging", "figo"], icr: ["iccr"], ecog: ["performance status"], bsa: ["body surface"], crcl: ["creatinine clearance"], egfr: ["kidney", "creatinine"], auc: ["calvert", "carboplatin"],
  recurrence: ["recurrent", "relapse"], recurrent: ["recurrence", "relapse"], relapse: ["recurrence", "recurrent"], metastatic: ["metastases", "advanced"], pregnancy: ["pregnant"], pregnant: ["pregnancy"], fertility: ["fertility-sparing"],
  mdt: ["multidisciplinary"], esgo: ["esgo"], nice: ["nice"], esmo: ["esmo"]
};
const normQ = s => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[‐-―−]/g, "-").replace(/[“”"']/g, "").replace(/\s+/g, " ").trim();
// expand a query into terms; each term carries its alternatives
function expandQuery(q) {
  let s = normQ(q); const extra = [];
  for (const [p, rep] of SEARCH_PHRASES) if (s.includes(p)) { s = s.replace(p, " " + p.replace(/\s+/g, "_") + " "); extra.push([p.replace(/\s+/g, "_"), rep]); }
  return s.split(/[\s,;/]+/).filter(t => t && !/^(the|and|of|for|in|with|a|an|to|on|or|vs|dan|untuk|yang)$/.test(t)).map(t => {
    const ph = extra.find(([k]) => k === t);
    if (ph) return { raw: ph[0].replace(/_/g, " "), alts: [ph[0].replace(/_/g, " "), ...ph[1].split(" ")] };
    const base = t.replace(/[^\p{L}\p{N}-]/gu, ""); if (!base) return null;
    return { raw: base, alts: [...new Set([base, base.replace(/-/g, ""), ...(SYN[base] || [])])] };
  }).filter(Boolean);
}
// short alternatives (3 letters or fewer, e.g. "rt", "ct", "pds") only match whole words
const altRe = a => new RegExp((a.length <= 3 ? "(^|[^\\p{L}\\p{N}-])" : "") + a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (a.length <= 3 ? "($|[^\\p{L}\\p{N}-])" : ""), "u");
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j), prev2 = null;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
// nearest vocabulary word for a misspelt term (1 edit for 4–6 letters, 2 for 7+); prefers frequent words
function nearestWord(term, vocab) {
  if (term.length < 4 || /\d/.test(term)) return null;
  const max = term.length >= 7 ? 2 : 1; let best = null, bd = max + 1, bf = 0;
  for (const [w, f] of vocab) {
    if (w[0] !== term[0] && w[1] !== term[1]) continue;
    const d = editDistance(term, w, max);
    if (d < bd || (d === bd && f > bf)) { best = w; bd = d; bf = f; }
  }
  return bd <= max ? best : null;
}
// @end
let IDX = [], VOCAB = new Map();
function buildVocab() {
  VOCAB = new Map();
  for (const it of IDX) for (const w of it.text.match(/[\p{L}][\p{L}\p{N}-]{3,}/gu) || []) VOCAB.set(w, (VOCAB.get(w) || 0) + 1);
}
function search(q, opts = {}) {
  const terms = expandQuery(q); const out = []; out.corrections = [];
  if (!terms.length) return out;
  const nq = normQ(q), idq = nq.toUpperCase(); let nqFix = nq;
  // typo tolerance: a term that matches nothing anywhere is replaced by the nearest indexed word
  for (const t of terms) {
    const res = t.alts.map(altRe);
    t.res = res;
    if (!IDX.some(it => res.some(r => r.test(it.text)))) {
      const fix = nearestWord(t.raw, VOCAB);
      if (fix) { out.corrections.push([t.raw, fix]); nqFix = nqFix.replace(t.raw, fix); t.alts = [fix, ...(SYN[fix] || [])]; t.res = t.alts.map(altRe); }
    }
  }
  for (const it of IDX) {
    if (opts.aud && it.aud !== opts.aud) continue;
    let score = 0; const tl = it.title.toLowerCase();
    for (const t of terms) {
      if (!t.res.some(r => r.test(it.text))) { score = -1; break; }
      score += t.res.some(r => r.test(tl)) ? 4 : 1;
      if (t.res[0].test(tl)) score += 1; // the word itself, not only a synonym, is in the title
    }
    if (score < 0) continue;
    if (String(it.id).toUpperCase() === idq) score += 50;           // exact record ID, e.g. R-CX-E09
    if (tl === nq || tl === nqFix) score += 12;                      // title is exactly the query (e.g. the drug page)
    if (nqFix.length > 3 && tl.includes(nqFix)) score += 8;               // whole query in the title
    else if (nqFix.length > 3 && it.text.includes(nqFix)) score += 3;
    if (it.warn) score -= 3;                                         // superseded versions sink
    score += ({ Guideline: 1.5, "Clinical pathway": 1.2, Calculator: 1.2, "Staging system": 1, "Drug monograph": 1, "Treatment protocol": 1 }[it.type] || 0);
    out.push({ ...it, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
// highlight the matched words in a title (after escaping, never inside an HTML entity)
function hlTitle(title, q) {
  let s = esc(title);
  const words = [...new Set(expandQuery(q).flatMap(t => t.alts))].filter(w => w.length >= 3 && !/^(amp|quot|lt|gt|39)$/.test(w)).sort((a, b) => b.length - a.length);
  for (const w of words) s = s.replace(new RegExp(`(^|[^&#\\w])(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "giu"), "$1<mark>$2</mark>");
  return s;
}

function index() {
  const I = [];
  const add = (aud, type, id, route, title, text, meta, status, warn, dis, href) => I.push({ aud, type, id, route, href, title, text: normQ(title + " " + text + " " + id), meta, status, warn, dis: dis || "" });
  if (!state.proLoaded) {
    D.diseases.forEach(d => add("pt", "Patient information", d.id, "ptd." + d.id, d.name, d.patient + " " + (d.patientSections || []).flat(2).join(" "), "About this cancer", "DRAFT", "", d.id));
    D.leaflets.forEach(l => add("pt", "Information leaflet", l.id, "l." + l.id, l.title, l.audience + " " + (l.sections || []).flat(2).join(" "), l.version, l.approval));
    D.glossary.forEach(([t, d]) => add("pt", "Glossary", t, "glossary", t, d, d, "DRAFT")); (D.articles || []).forEach(a => add("pt", "Article", a.id, "a." + a.id, a.title, a.summary + " " + a.category + " " + a.sections.flat(2).join(" "), a.category, a.status));
    return I;
  }
  D.guidelines.forEach(g => add("pro", "Guideline", g.id, "g." + g.id, g.title, [orgs(g), dname(g.disease), (g.domain || []).join(" "), g.summary, g.version, g.citation || ""].join(" "), `${orgs(g)} · ${g.version || "version not recorded"} · ${g.disease === "all" ? "All cancers" : dname(g.disease)}`, g.status, g.superseded === "superseded" ? "Superseded guidance" : "", g.disease));
  D.recommendations.forEach(r => add("pro", "Recommendation", r.id, "g." + r.guideline, r.text, [r.stage, r.biomarker, r.setting, r.location, r.guideline, dname(r.disease)].join(" "), `${r.id} · ${r.disease === "all" ? "All cancers" : dname(r.disease)} · ${r.stage}`, r.status, "", r.disease, `${url("g." + r.guideline)}#${encodeURIComponent(r.id)}`));
  D.diseases.forEach(d => { add("pro", "Disease reference", d.id, "d." + d.id, d.name, d.short, "Disease page", "NOT VERIFIED", "", d.id); add("pt", "Patient information", d.id, "ptd." + d.id, d.name, d.patient + " " + (d.patientSections || []).flat(2).join(" "), "About this cancer", "DRAFT"); });
  D.staging.forEach(s => add("pro", "Staging system", s.id, "s." + s.id, `${s.name} (${s.authority} ${s.version})`, JSON.stringify(s.stages) + " " + s.notes + " " + dname(s.cancer), `${s.authority} ${s.version}`, "NOT VERIFIED", s.superseded ? "Superseded staging version" : "", s.cancer));
  D.protocols.forEach(p => add("pro", "Treatment protocol", p.id, "p." + p.id, p.name, [p.indication, p.biomarker, p.modality, p.components.map(c => c.drug).join(" ")].join(" "), `${dname(p.disease)} · ${p.line}`, p.status, "", p.disease));
  D.drugs.forEach(d => add("pro", "Drug monograph", d.id, "dr." + d.id, d.name, [d.cls, d.moa, d.ae, (d.cancers || []).map(dname).join(" ")].join(" "), d.cls, "NOT VERIFIED", "", (d.cancers || [])[0]));
  D.trials.forEach(t => add("pro", "Clinical trial", t.id, "t." + t.id, t.name, [t.reg, t.population, t.intervention, t.comparator, dname(t.disease)].join(" "), `${t.reg} · Phase ${t.phase}`, "NOT VERIFIED", "", t.disease));
  (D.algorithms || []).forEach(a => add("pro", "Clinical pathway", a.id, "algorithms." + a.id, a.title, a.entry + " " + Object.values(a.nodes).map(n => n.q || n.end).join(" "), `${algoDis(a)} · ${a.source}`, a.status, "", a.disease));
  (D.visuals || []).forEach(v => add("pro", "Table", v.id, "visuals", v.title, [v.source, ...v.columns, ...v.rows.flat(), v.note || ""].join(" "), v.source, v.status, "", v.disease, `${url("visuals")}#vt-${v.id}`));
  Object.entries(CALCS).forEach(([id, c]) => add("pro", "Calculator", "calc-" + id, "calculators", c.title, c.formula + " " + c.limits, "Calculator", "NOT VERIFIED", "", "", `${url("calculators")}#calc-${id}`));
  (D.literature || []).forEach(x => add("pro", "Research library", x.id, x.place === "education" ? "education" : "compare", x.title, [x.summary, ...(x.findings || []), x.topic, x.citation, x.authors].join(" "), x.citation, x.status, "", x.disease));
  (D.notes?.chapters || []).forEach(c => add("pro", "Textbook notes", c.id, "notes", `Ch ${c.n} — ${c.title}`, String(c.html || "").replace(/<[^>]+>/g, " "), "Berek & Novak's notes", c.status || "NOT VERIFIED", "", c.disease, `${url("notes")}#nb-${c.id}`));
  D.leaflets.forEach(l => add("pt", "Information leaflet", l.id, "l." + l.id, l.title, l.audience + " " + (l.sections || []).flat(2).join(" "), l.version, l.approval, "", l.disease));
  D.glossary.forEach(([t, d]) => add("pt", "Glossary", t, "glossary", t, d, d, "DRAFT")); (D.articles || []).forEach(a => add("pt", "Article", a.id, "a." + a.id, a.title, a.summary + " " + a.category + " " + a.sections.flat(2).join(" "), a.category, a.status));
  return I;
}
function resultRow(r, q) {
  return `<a class="row" href="${esc(r.href || url(`${r.route}`))}"><span class="row-t">${q ? hlTitle(r.title.length > 220 ? r.title.slice(0, 218) + "…" : r.title, q) : esc(r.title)} ${listPill(r.status)} ${r.warn ? `<span class="pill bad">${esc(r.warn)}</span>` : ""}</span>
    <span class="row-m"><span class="eyebrow">${esc(r.type)}</span><span>${esc(r.meta)}</span></span></a>`;
}

/* ---------- shared bits ---------- */
const seedBanner = () => reviewStrip(false);
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
    ...D.guidelines.map(g => g.status), ...D.recommendations.map(r => r.status), ...D.staging.map(s => s.status || "NOT VERIFIED"),
    ...D.protocols.map(p => p.status), ...D.drugs.map(d => d.status || "NOT VERIFIED"), ...D.trials.map(t => t.outcome?.status || t.status || "NOT VERIFIED"),
    ...D.diseases.filter(d => d.reference).map(d => d.refReview?.status || "NOT VERIFIED")
  ];
  const n = s => recs.filter(x => x === s).length;
  const ver = n("VERIFIED AGAINST SOURCE") + n("CLINICALLY REVIEWED") + n("APPROVED"), part = n("PARTIALLY VERIFIED") + n("EXTRACTED"), tot = recs.length;
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
/* ---------- feature carousel (top of the professional and patient home pages) ----------
   Each slide: eyebrow, title, text, button label, route, icon, optional photo (https://, e.g. from Edit content → pictures). */
const SLIDES = {
  pro: [
    { eyebrow: "New in the clinical reference", title: "Textbook notes, chapters 37–42", text: "Searchable revision notes, with flags wherever they differ from current guidelines.", cta: "Open the notes", route: "notes", icon: "education", tone: "teal" },
    { eyebrow: "Clinical pathways", title: "From first symptom to biomarker testing", text: "Six step-by-step pathways linked to the recommendations behind each step.", cta: "Start a pathway", route: "algorithms", icon: "algorithms", tone: "lav" },
    { eyebrow: "Guideline update", title: "NICE NG12, April 2026: age-specific CA125 thresholds", text: "The suspected ovarian cancer pathway now follows the new thresholds.", cta: "See the change", route: "g.G-NICE-NG12", icon: "updates", tone: "navy" },
    { eyebrow: "Building the Malaysian CPG", title: "Record the Malaysian position on each recommendation", text: "Reviewers can adopt, adapt or set aside each recommendation for Malaysian practice.", cta: "Go to recommendations", route: "recs", icon: "guidelines", tone: "teal" },
    { eyebrow: "Calculators", title: "RMI, BSA, creatinine clearance and Calvert", text: "Formulas checked against their sources, with limitations shown.", cta: "Open calculators", route: "calculators", icon: "calculators", tone: "lav" }],
  pt: [
    { eyebrow: "New for families and caregivers", title: "A guide for the people who care for you", text: "Practical ways to help, looking after yourself, and talking together.", cta: "Open the caregiver guide", route: "tool.caregiver", icon: "sdm", tone: "teal" },
    { eyebrow: "Before your appointment", title: "Questions to ask your doctor", text: "Tick the questions that matter to you, then print the list and take it along.", cta: "Prepare now", route: "sdm", icon: "sdm", tone: "lav" },
    { eyebrow: "During chemotherapy", title: "Keep a chemotherapy diary", text: "Note how you feel each day, so your team can help with side effects.", cta: "Start my diary", route: "tool.chemo", icon: "tracker", tone: "navy" },
    { eyebrow: "Just diagnosed", title: "Understanding my diagnosis", text: "Write down your diagnosis in your own words, with the questions to ask.", cta: "Open the guide", route: "tool.diagnosis", icon: "articles", tone: "teal" }]
};
function carousel(aud) {
  const s = state.slides?.[aud] || SLIDES[aud] || []; if (!s.length) return "";
  return `<section class="carousel" aria-roledescription="carousel" aria-label="Featured" data-carousel>
    <div class="car-track">${s.map((x, i) => `<div class="car-slide tone-${["teal", "lav", "navy"].includes(x.tone) ? x.tone : "teal"}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${s.length}" ${i ? 'aria-hidden="true"' : ""}>
      <div class="car-panel"><span class="car-eyebrow">${esc(x.eyebrow)}</span><h2 class="car-title">${esc(x.title)}</h2><p class="car-text">${esc(x.text)}</p><a class="car-cta" href="${url(x.route)}" ${i ? 'tabindex="-1"' : ""}>${esc(x.cta)}</a></div>
      <div class="car-art" aria-hidden="true">${x.photo && /^https:\/\//.test(x.photo) ? `<img src="${esc(x.photo)}" alt="">` : `<span class="car-blob b1"></span><span class="car-blob b2"></span><span class="car-blob b3"></span><span class="car-icon">${ic(x.icon)}</span>`}</div></div>`).join("")}</div>
    <button class="car-nav prev" type="button" aria-label="Previous slide">‹</button><button class="car-nav next" type="button" aria-label="Next slide">›</button>
    <div class="car-dots">${s.map((x, i) => `<button type="button" class="car-dot" aria-label="Slide ${i + 1}: ${esc(x.title)}" aria-current="${i === 0}"></button>`).join("")}<button type="button" class="car-pause" aria-label="Pause">❚❚</button></div></section>`;
}
function bindCarousel() {
  const c = app.querySelector("[data-carousel]"); if (!c) return;
  const track = c.querySelector(".car-track"), slides = [...c.querySelectorAll(".car-slide")], dots = [...c.querySelectorAll(".car-dot")], pauseBtn = c.querySelector(".car-pause");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let i = 0, paused = reduce, hover = false; clearInterval(window.__carT);
  const show = n => { i = (n + slides.length) % slides.length; track.style.transform = `translateX(-${i * 100}%)`;
    slides.forEach((s, k) => { s.setAttribute("aria-hidden", k !== i); s.querySelector(".car-cta").tabIndex = k === i ? 0 : -1; });
    dots.forEach((d, k) => d.setAttribute("aria-current", k === i)); };
  const tick = () => { clearInterval(window.__carT); window.__carT = (!paused && !hover) ? setInterval(() => { if (!document.body.contains(c)) return clearInterval(window.__carT); show(i + 1); }, 7000) : null; };
  c.querySelector(".prev").onclick = () => { show(i - 1); tick(); };
  c.querySelector(".next").onclick = () => { show(i + 1); tick(); };
  dots.forEach((d, k) => d.onclick = () => { show(k); tick(); });
  pauseBtn.textContent = paused ? "▶" : "❚❚"; pauseBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? "▶" : "❚❚"; pauseBtn.setAttribute("aria-label", paused ? "Play" : "Pause"); tick(); };
  c.addEventListener("mouseenter", () => { hover = true; tick(); }); c.addEventListener("mouseleave", () => { hover = false; tick(); });
  c.addEventListener("focusin", () => { hover = true; tick(); }); c.addEventListener("focusout", () => { hover = false; tick(); });
  c.addEventListener("keydown", e => { if (e.key === "ArrowRight") { show(i + 1); tick(); } if (e.key === "ArrowLeft") { show(i - 1); tick(); } });
  let x0 = null; c.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  c.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { show(i + (dx < 0 ? 1 : -1)); tick(); } x0 = null; });
  show(0); tick();
}
V.home = () => `${carousel("pro")}
  <section class="hero hero-pro">
    <span class="eyebrow">Gynaecological oncology reference · Malaysia</span>
    <h1 class="brand-title"><span class="bt-name">DR ARVEEN</span><span class="bt-full"><span class="bt-line">Advanced Reference and Verified Evidence Network</span> <span class="bt-line">for Gynaecological Oncology</span></span></h1>
    <p>Find clinical guidelines, staging criteria, treatment protocols, clinical trial evidence, and patient education resources in one integrated platform.</p>
    <form class="bigsearch" id="hs"><input id="hq" type="search" aria-label="Search" placeholder="Search a cancer, guideline, treatment, biomarker, drug, or clinical question."><button>Search</button></form>
    <div class="chips">${["Ovarian cancer", "FIGO 2023 endometrial staging", "Recurrent cervical cancer", "Carboplatin and paclitaxel", "Sentinel lymph node", "BRCA1 and BRCA2", "Endometrial molecular classification"].map(s => `<button class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>
  </section>
  ${continueBlock(["Guideline", "Drug", "Protocol", "Trial", "Staging", "Disease"])}
  ${(() => { const v = verificationSummary(); const pct = x => (100 * x / v.tot).toFixed(1); return `<section class="section progress-panel" aria-label="Review progress">
    <div class="section-h"><h2>Review progress</h2><span class="muted">${v.tot} professional records</span></div>
    <div class="vbar" role="img" aria-label="${v.ver} verified, ${v.part} partially verified, ${v.not} not yet verified"><span class="v-ok" style="width:${pct(v.ver)}%"></span><span class="v-part" style="width:${pct(v.part)}%"></span><span class="v-not" style="width:${pct(v.not)}%"></span></div>
    <div class="vlegend"><span><i class="v-ok"></i>Verified ${v.ver}</span><span><i class="v-part"></i>Extracted or partially verified ${v.part}</span><span><i class="v-not"></i>Not yet verified ${v.not}</span>${isReviewer() ? `<a href="${url(`review`)}">Open the review queue</a>` : ""}</div>
    <p class="muted" style="font-size:.84rem">Doses are pending pharmacist review and recommendation grades are transcribed from the source but await clinical review. Check every record's status label before relying on it.</p></section>`; })()}
  <section class="section"><div class="section-h"><h2>Disease hubs</h2><a href="${url(`diseases`)}">All diseases</a></div>
    <div class="grid">${D.diseases.map(d => { const nt = D.trials.filter(t => t.disease === d.id).length, ng = D.guidelines.filter(g => g.disease === d.id).length, ns = D.staging.filter(s => s.cancer === d.id && !s.superseded).length;
      return `<a class="tile hub" href="${url(`d.${d.id}`)}">${badge(d.id)}<b>${esc(d.name)}</b><span>${esc(d.short)}</span><span class="hubmeta">${[ng && `${ng} guideline${ng > 1 ? "s" : ""}`, ns && `${ns} staging`, nt && `${nt} trial${nt > 1 ? "s" : ""}`, d.reference && "24-section reference"].filter(Boolean).join(" · ") || "Reference in progress"}</span></a>`; }).join("")}</div></section>
  <section class="section band"><div class="section-h"><h2>Key evidence</h2><a href="${url(`trials`)}">All trials</a></div>
    <div class="tablewrap"><table><thead><tr><th>Trial</th><th>Question</th><th>Headline result</th><th>Status</th></tr></thead><tbody>
    ${D.trials.filter(t => t.outcome).sort((a, b) => DIS_ORDER(a.disease) - DIS_ORDER(b.disease)).map(t => `<tr><td><a href="${url(`t.${t.id}`)}"><b>${esc(t.name)}</b></a><div class="muted" style="font-size:.78rem">${dname(t.disease)}</div></td><td style="font-size:.86rem">${esc(t.intervention)} vs ${esc(t.comparator)}</td><td style="font-size:.86rem">${esc(headline(t))}</td><td>${statusPill(t.outcome.status)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">Trial results load from the database. If this is empty, the latest seed.sql has not been run.</td></tr>`}
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
  return `<div class="section-h"><div><span class="eyebrow">Repository</span><h1>Clinical guidelines</h1></div><div class="toc"><a class="btn" aria-pressed="true" href="${url(`guidelines`)}">Guidelines</a><a class="btn" href="${url(`recs`)}">Recommendations (${D.recommendations.length})</a><a class="btn" href="${url(`updates`)}">Updates (${(D.updates || []).length})</a></div></div>
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
  ${byDisease(list, g => g.disease, its => `<div class="list">${its.map(g => `<a class="row" href="${url(`g.${g.id}`)}"><span class="row-t">${esc(g.title)}</span>
    <span class="row-m"><span>${esc(orgs(g))}</span><span>${g.pubDate ? esc(g.pubDate) : "Date not recorded"}</span><span>${D.recommendations.filter(r => r.guideline === g.id).length} recommendations</span><span class="mono">${esc(g.id)}</span></span>
    <span class="row-m">${supPill(g)} ${listPill(g.status)} ${myLabel(g.malaysia)}</span></a>`).join("")}</div>`) || `<div class="row muted">No guidelines match these filters.</div>`}</div></div>`;
};
function bindFilters() {
  app.querySelectorAll("[data-f]").forEach(s => s.onchange = () => { state.filters[s.dataset.f] = s.value; render(); });
  const c = $("#clearf"); if (c) c.onclick = () => { state.filters = {}; render(); };
}

/* Recommendations in clinical order, like the textbook notes:
   introduction → etiology/risk → clinical features & diagnosis → treatment → recurrence → follow-up & survivorship. */
const REC_PHASES = [
  ["intro", "1. Introduction: general care and organisation", "Multidisciplinary planning, centralisation, counselling, clinical trials."],
  ["etiology", "2. Etiology: risk, genetics, screening and prevention", "Hereditary risk (Lynch, BRCA), HPV, screening programmes, risk-reducing surgery."],
  ["clinical", "3. Clinical features and diagnosis", "Presentation and referral, examination, biopsy, imaging, pathology, molecular testing, staging."],
  ["treatment", "4. Treatment", "Primary treatment by stage, with adjuvant therapy."],
  ["recurrence", "5. Recurrent and advanced disease", "Work-up and treatment of recurrence, metastatic and oligometastatic disease."],
  ["followup", "6. Follow-up, survivorship and palliative care", "Surveillance schedules, late effects, HRT, psychosexual support, palliation."]];
const TX_SUB = [["fertility", "Fertility-sparing treatment"], ["surgery", "Surgery"], ["radio", "Radiotherapy and chemoradiotherapy"], ["systemic", "Systemic therapy (chemotherapy, endocrine, immunotherapy, targeted)"], ["other", "Other treatment decisions"]];
function recPhase(r) {
  const loc = `${r.location || ""} ${r.stage || ""}`, set = `${r.setting || ""}`, all = `${loc} ${set}`, intent = r.intent || "";
  if (/follow-?up|survivorship|palliati|\bHRT\b|lymphoedema|psychosexual|supportive/i.test(all) || intent === "Palliative") return "followup";
  if (/recurr|relapse|metasta|oligometa|re-irradiation|previously irradiated|progression after|second line|second-line/i.test(all)) return "recurrence";
  if (intent === "Preventive" || /lynch|brca|hereditary|screening|risk-reducing|carriers/i.test(loc) || /^(genetics|surveillance|risk-reducing surgery)$/i.test(set)) return "etiology";
  if (/^General Recommendations$/i.test((r.location || "").trim())) return "intro";
  if (intent === "Diagnostic" || intent === "Prognostic" || /work-?up|imaging|biopsy|patholog|staging|diagnos|tumour markers|molecular testing|referral|examination|investigation|risk assessment/i.test(set)) return "clinical";
  return "treatment";
}
function txSub(r) {
  const all = `${r.location || ""} ${r.setting || ""} ${r.stage || ""}`;
  if (r.intent === "Fertility-sparing" || /fertility/i.test(all)) return "fertility";
  if (/radiotherapy|brachy|chemoradio|radiation/i.test(r.setting || "")) return "radio";
  if (/systemic|chemotherapy|endocrine|immuno|targeted|hormon|maintenance|neoadjuvant/i.test(r.setting || "")) return "systemic";
  if (/surg|lymphadenectomy|sentinel|nodal|excision|hysterectomy|ovarian preservation|reconstruction|groin|morcellation|cytoreduct|re-staging|uterine preservation/i.test(all)) return "surgery";
  if (/radiotherapy|brachy|chemoradio/i.test(all)) return "radio";
  if (/chemotherapy|systemic|endocrine/i.test(all)) return "systemic";
  return "other";
}
V.recs = () => {
  const mode = state.filters.recMode || store.get("recMode", "topic");
  const byGuideline = its => [...new Set(its.map(r => r.guideline))].map(gid => { const g = byId(D.guidelines, gid); return `<details class="recgrp"><summary><b>${esc(g ? `${orgs(g)} ${g.version || ""}` : gid)}</b> <span class="muted">${esc(g?.title || "")} · ${its.filter(r => r.guideline === gid).length} recommendations</span></summary>${recTable(its.filter(r => r.guideline === gid))}</details>`; }).join("");
  const byTopic = its => REC_PHASES.map(([k, title, hint]) => {
    const ph = its.filter(r => recPhase(r) === k); if (!ph.length) return "";
    const body = k === "treatment"
      ? TX_SUB.map(([s, st]) => { const sub = ph.filter(r => txSub(r) === s); return sub.length ? `<h4 class="recsub">${esc(st)} <span class="muted">${sub.length}</span></h4>${recTable(sub)}` : ""; }).join("")
      : recTable(ph);
    return `<details class="recgrp phase"><summary><b>${esc(title)}</b> <span class="muted">${ph.length} recommendation${ph.length > 1 ? "s" : ""} · ${esc(hint)}</span></summary>${body}</details>`;
  }).join("");
  return `<div class="section-h"><div><span class="eyebrow">Recommendation-level database</span><h1>Recommendations</h1></div><div class="toc"><a class="btn" href="${url(`guidelines`)}">Guidelines</a><a class="btn" aria-pressed="true" href="${url(`recs`)}">Recommendations</a><a class="btn" href="${url(`updates`)}">Updates</a></div></div>
  ${seedBanner()}<p class="banner info">Recommendation text below is an <b>ARVEEN paraphrase</b>, not a quotation. Grades and strengths are kept in each guideline's original framework.</p>
  <div class="chips" role="group" aria-label="Arrange recommendations"><span class="muted">Arrange:</span><button class="chip" data-recmode="topic" aria-pressed="${mode === "topic"}">By clinical topic (introduction → treatment → follow-up)</button><button class="chip" data-recmode="guideline" aria-pressed="${mode === "guideline"}">By guideline</button></div>
  ${byDisease(D.recommendations, r => r.disease, mode === "topic" ? byTopic : byGuideline)}`;
};
/* Malaysian position on a recommendation (reviewers build the Malaysian CPG; everyone signed in can read it) */
const MY_DECISIONS = { ADOPT: ["Adopt as is", "ok"], ADAPT: ["Adapt for Malaysia", "teal"], "NOT ADOPTED": ["Not adopted", "bad"], PENDING: ["Under discussion", "warn"] };
function myCell(r) {
  const m = state.mycpg?.[r.id], edit = isReviewer() && state.mycpgTable !== false ? `<button class="mybtn" type="button" data-mycpg="${esc(r.id)}" title="Record the Malaysian position">${m ? "✎ Edit" : "+ Malaysian position"}</button>` : "";
  if (!m) return `<span class="mynone">Not yet assessed</span>${edit}`;
  const [label, tone] = MY_DECISIONS[m.decision] || [m.decision, ""];
  return `<span class="pill ${tone} mypill">${esc(label)}</span>${m.statement ? `<div class="mystmt">${esc(m.statement)}</div>` : ""}${m.notes ? `<details class="mynotes"><summary>Local notes</summary>${esc(m.notes)}</details>` : ""}<div class="myby">${esc(m.author)}, ${esc(String(m.updated_at || "").slice(0, 10))}</div>${edit}`;
}
function recTable(recs) {
  const grade = r => `${/^Not /.test(r.grade) ? `<span class="na">${esc(r.grade)}</span>` : `<b>${esc(r.grade)}</b>`}<div>${/^Not /.test(r.strength) ? `<span class="na">${esc(r.strength)}</span>` : esc(r.strength)}</div>`;
  return `<div class="tablewrap"><table class="rectbl"><thead><tr><th>ID</th><th>Recommendation</th><th>Grade</th><th>Malaysia</th><th>Source</th></tr></thead><tbody>
  ${recs.map(r => { const g = byId(D.guidelines, r.guideline); return `<tr id="rec-${esc(r.id)}"><td class="mono recid">${r.id}</td>
    <td class="rectext" title="${esc(`${r.stage} · ${r.setting}`)}">${fmt(r.text)} ${listPill(r.status)}</td>
    <td class="recgrade">${grade(r)}</td>
    <td class="recmy">${myCell(r)}</td>
    <td class="recsrc"><a href="${url(`g.${g.id}`)}">${esc(orgs(g))} ${esc(g.version || "")}</a>${r.trials.map(t => ` · <a href="${url(`t.${t}`)}">${esc(byId(D.trials, t)?.name)}</a>`).join("")}${r.protocols.map(p => ` · <a href="${url(`p.${p}`)}">${p}</a>`).join("")}</td></tr>` }).join("")}
  </tbody></table></div>`;
}
/* Editing dialog for the Malaysian position (one shared dialog, opened from any recommendation table) */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-mycpg]"); if (!b || !isReviewer()) return;
  const r = byId(D.recommendations, b.dataset.mycpg); if (!r) return;
  const m = state.mycpg?.[r.id] || {};
  let dlg = document.getElementById("mydlg"); if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "mydlg"; dlg.className = "mydlg"; document.body.appendChild(dlg); }
  dlg.innerHTML = `<form method="dialog" id="myform"><span class="eyebrow">Malaysian CPG · ${esc(r.id)}</span><h2>Malaysian position</h2>
    <p class="prose"><b>${esc(orgs(byId(D.guidelines, r.guideline)))}:</b> ${esc(r.text)} <span class="muted">(${esc(r.grade)}, ${esc(r.strength)})</span></p>
    <label>Decision<select name="decision">${Object.entries(MY_DECISIONS).map(([k, [l]]) => `<option value="${k}" ${(m.decision || "PENDING") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label>Malaysian statement (how this applies in Malaysia; required for Adapt)<textarea name="statement" rows="3" maxlength="2000">${esc(m.statement || "")}</textarea></label>
    <label>Local notes (availability, cost, MOH policy, rationale, sources)<textarea name="notes" rows="3" maxlength="2000">${esc(m.notes || "")}</textarea></label>
    <label>Recorded by<input name="author" required minlength="2" value="${esc(m.author || state.profile?.full_name || "")}"></label>
    <p class="result err" id="myerr" hidden></p>
    <div class="dlg-actions"><button class="btn primary" type="submit" value="save">Save</button><button class="btn" type="submit" value="cancel" formnovalidate>Cancel</button>${m.rec_id ? `<button class="btn" type="button" id="mydel">Remove position</button>` : ""}</div></form>`;
  dlg.showModal();
  const f = dlg.querySelector("#myform"), err = t => { const x = dlg.querySelector("#myerr"); x.hidden = !t; x.textContent = t || ""; };
  f.onsubmit = async ev => {
    if (ev.submitter?.value !== "save") return;
    ev.preventDefault();
    const v = n => f.elements[n].value.trim() || null, row = { rec_id: r.id, decision: v("decision"), statement: v("statement"), notes: v("notes"), author: v("author") };
    if (row.decision === "ADAPT" && !row.statement) return err("Write the Malaysian statement for an adapted recommendation.");
    const { data, error } = await sb.from("my_cpg").upsert(row).select().single();
    if (error) return err(/does not exist|schema cache/.test(error.message) ? "The Malaysian CPG table isn't set up yet: run supabase/upgrade-8-malaysia-cpg.sql." : error.message);
    state.mycpg = { ...(state.mycpg || {}), [r.id]: data }; dlg.close(); render();
  };
  const del = dlg.querySelector("#mydel");
  if (del) del.onclick = async () => { if (!confirm("Remove the Malaysian position for this recommendation?")) return; const { error } = await sb.from("my_cpg").delete().eq("rec_id", r.id); if (error) return err(error.message); delete state.mycpg[r.id]; dlg.close(); render(); };
});

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
  ${(D.visuals || []).filter(v => v.guideline === g.id).length ? `<section class="section"><h2>Tables from this guideline</h2>${(D.visuals || []).filter(v => v.guideline === g.id).map(v => vTable(v)).join("")}</section>` : ""}
  ${noteBox(g.id)}</article>`;
};

V.diseases = () => `<span class="eyebrow">Disease reference library</span><h1>Diseases</h1>
  <div class="grid">${D.diseases.map(d => `<a class="tile" href="${url(`d.${d.id}`)}">${badge(d.id)}<b>${esc(d.name)}</b><span>${esc(d.short)}</span></a>`).join("")}</div>`;
const DTEMPLATE = ["Definition and epidemiology", "Risk factors and hereditary predisposition", "Histological classification", "Molecular classification and biomarkers", "Clinical presentation", "Diagnostic pathway", "Imaging and pathology", "Staging", "Risk stratification", "Treatment intent", "Management by stage and subtype", "Surgery", "Radiotherapy", "Systemic therapy", "Recurrent and metastatic disease", "Follow-up", "Survivorship", "Pivotal trials", "Current guideline references", "Malaysian applicability", "Clinical pearls", "Case-based learning", "Examination questions", "Patient education links"];
/* "Everything on DR ARVEEN for this cancer": one panel linking every section of the site, in the notes' order */
function diseaseHub(d) {
  const id = d.id, key = ["tubal", "peritoneal"].includes(id) ? "ovarian" : id, mine = x => x === id || x === key;
  const recs = D.recommendations.filter(r => mine(r.disease)), gls = D.guidelines.filter(g => mine(g.disease));
  const ch = (D.notes?.chapters || []).find(c => mine(c.disease) || (c.also || []).includes(id));
  const paths = (D.algorithms || []).filter(a => mine(a.disease) || a.disease === "all");
  const lit = (D.literature || []).filter(x => mine(x.disease)), st = D.staging.filter(s => mine(s.cancer) && !s.superseded);
  const tr = D.trials.filter(t => mine(t.disease)), pr = D.protocols.filter(p => mine(p.disease)), dr = D.drugs.filter(x => x.cancers.some(mine));
  const lf = D.leaflets.filter(l => mine(l.disease) && (l.sections || []).length);
  const more = (items, max, href) => items.length > max ? `${items.slice(0, max).join(" · ")} · <a href="${href}">+${items.length - max} more</a>` : items.join(" · ");
  const row = (label, count, href, body) => `<div class="hubrow"><a class="hublabel" href="${href}">${esc(label)}${count !== null ? ` <span class="hubc">${count}</span>` : ""}</a><div class="hubitems">${body || '<span class="na">None yet</span>'}</div></div>`;
  const phases = REC_PHASES.map(([k, t]) => { const c = recs.filter(r => recPhase(r) === k).length; return c ? `${esc(t.replace(/^\d\.\s*/, "").split(":")[0])} <span class="hubc">${c}</span>` : ""; }).filter(Boolean);
  return `<section class="dhub" aria-label="Everything on DR ARVEEN for this cancer"><h2>Everything on DR ARVEEN for ${esc(d.name.toLowerCase())}</h2><div class="hubrows">
    ${ch ? row("Textbook notes", null, `${url("notes")}#nb-${ch.id}`, `<a href="${url("notes")}#nb-${ch.id}">Ch ${ch.n} · ${esc(ch.title)}</a>`) : ""}
    ${row("Guidelines", gls.length, `${url("guidelines")}#dg-${key}`, more(gls.map(g => `<a href="${url(`g.${g.id}`)}">${esc(orgs(g))} ${esc(String(g.version || "").replace(/\s*\(.*\)$/, ""))}</a>`), 4, `${url("guidelines")}#dg-${key}`))}
    ${row("Recommendations", recs.length, `${url("recs")}#dg-${key}`, phases.length ? `<a href="${url("recs")}#dg-${key}" class="hubplain">${phases.join(" · ")}</a>` : "")}
    ${row("Staging", st.length, `${url("staging")}#dg-${key}`, st.map(s => `<a href="${url(`s.${s.id}`)}">${esc(s.authority)} ${esc(s.version)}</a>`).join(" · "))}
    ${row("Clinical pathways", paths.length, url("algorithms"), paths.map(a => `<a href="${url("algorithms")}?id=${encodeURIComponent(a.id)}">${esc(a.title.split(":")[0])}</a>`).join(" · "))}
    ${(() => { const vs = (D.visuals || []).filter(v => mine(v.disease)); return vs.length ? row("Tables", vs.length, `${url("visuals")}#vg-${key}`, vs.map(v => `<a href="${url("visuals")}#vt-${esc(v.id)}">${esc(v.title.split(":")[1]?.trim() || v.title)}</a>`).join(" · ")) : ""; })()}
    ${row("Key trials", tr.length, `${url("trials")}#dg-${key}`, more(tr.map(t => `<a href="${url(`t.${t.id}`)}" title="${esc(t.outcome ? headline(t) : t.intervention + " vs " + t.comparator)}">${esc(t.name)}</a>`), 6, `${url("trials")}#dg-${key}`))}
    ${row("Treatment protocols", pr.length, `${url("protocols")}#dg-${key}`, pr.map(p => `<a href="${url(`p.${p.id}`)}">${esc(p.name)}</a>`).join(" · "))}
    ${row("Drugs", dr.length, `${url("drugs")}#dg-${key}`, more(dr.map(x => `<a href="${url(`dr.${x.id}`)}">${esc(x.name)}</a>`), 6, `${url("drugs")}#dg-${key}`))}
    ${lit.length ? row("Research library", lit.length, `${url("compare")}#dg-${key}`, `<a href="${url("compare")}#dg-${key}">${lit.length} summarised studies</a>`) : ""}
    ${row("For patients", null, url(`ptd.${id}`), [`<a href="${url(`ptd.${id}`)}">Patient page</a>`, ...lf.map(l => `<a href="${url(`l.${l.id}`)}">${esc(l.title)}</a>`), `<a href="${url("tool")}">Planning guides</a>`].join(" · "))}
  </div></section>`;
}
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
    return `${txt.length ? `<ul class="plist">${txt.map(x => `<li>${fmt(x)}</li>`).join("")}</ul>` : ""}${lk.length ? `<div style="display:grid;gap:4px;font-size:.9rem">${lk.map(x => `<span>${x}</span>`).join("")}</div>` : ""}`; };
  return `<article class="detail"><div class="dhead"><div class="dtitle">${badge(d.id, true)}<div><span class="eyebrow">Disease reference</span><h1>${esc(d.name)}</h1></div></div><p class="prose muted">${esc(d.short)}</p>
    <div class="actions"><button class="btn" data-mode="quick" aria-pressed="${mode === "quick"}">Quick reference</button><button class="btn" data-mode="comp" aria-pressed="${mode !== "quick"}">Comprehensive reference</button>${bmBtn("Disease", d.id, d.name)}</div></div>
  ${diseaseHub(d)}
  ${d.reference ? `<p class="banner"><span class="pill teal">ARVEEN educational summary</span> ${statusPill(d.refReview?.status || "NOT VERIFIED")} ${d.refReview ? `Reviewed by ${esc(d.refReview.reviewer)} on ${esc(d.refReview.verifiedOn)}.` : "Written for education and awaiting clinical review against the cited guidelines."} For doses see the drug and protocol pages. Do not use for prescribing.</p>` : ""}
  ${mode !== "quick" ? `<p class="banner info">Comprehensive reference uses the standard 24-section template.</p>` : ""}
  <div class="list">${secs.map((s, i) => `<div class="row"><span class="row-t">${mode !== "quick" ? `<span class="mono muted">${String(DTEMPLATE.indexOf(s) + 1).padStart(2, "0")}</span>` : ""} ${s}</span>
    ${body(s)}</div>`).join("")}</div>
  ${noteBox("d-" + d.id)}</article>`;
};

V.staging = () => `<span class="eyebrow">Staging module</span><h1>Staging systems</h1>
  <p class="banner info">Definitions are <b>ARVEEN educational paraphrases</b> of the FIGO criteria, not the published text, and are NOT VERIFIED. Formal staging is kept separate from treatment recommendations. Do not mix criteria between versions.</p>
  ${byDisease(D.staging, s => s.cancer, its => `<div class="list">${its.map(s => `<a class="row" href="${url(`s.${s.id}`)}"><span class="row-t">${esc(s.name)} <span class="mono">${esc(s.authority)} ${esc(s.version)}</span> ${s.superseded ? '<span class="pill bad">Superseded</span>' : ""} ${listPill(s.status || "NOT VERIFIED")}</span><span class="row-m">${s.stages.length ? s.stages.length + " main stages" : "criteria not entered"}</span></a>`).join("")}</div>`)}
  <p><a class="btn" href="${url(`education`)}">Practise with staging exercises →</a></p>`;
function stageTree(list) {
  return list.map(x => x.sub ? `<details class="stage" open><summary><span class="code">${esc(x.s)}</span><span>${esc(x.d)}</span></summary><div class="kids">${stageTree(x.sub)}</div></details>`
    : `<div class="stage leaf"><div class="sum"><span class="code">${esc(x.s)}</span><span>${esc(x.d)}</span></div></div>`).join("");
}
V.s = id => {
  const s = byId(D.staging, id); if (!s) return notFound();
  recent("Staging", s.id, `${s.authority} ${s.version} ${dname(s.cancer)}`);
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Staging · ${dname(s.cancer)}</span><h1>${esc(s.name)}</h1>
    <div class="row-m"><span class="mono">${esc(s.authority)} · version ${esc(s.version)}</span> ${statusPill(s.status || "NOT VERIFIED")} <span class="pill teal">ARVEEN educational paraphrase</span></div>
    <div class="actions">${bmBtn("Staging", s.id, s.name + " " + s.version)}<input type="text" id="sfilter" placeholder="Filter stages, e.g. IIIC or node" aria-label="Filter stages" style="max-width:280px"></div></div>
  ${s.superseded ? `<p class="banner bad">Superseded by <a href="${url(`s.${s.supersededBy}`)}">${esc(byId(D.staging, s.supersededBy).name)} ${esc(byId(D.staging, s.supersededBy).version)}</a>. Use only to interpret older reports.</p>` : ""}
  <p class="prose">${esc(s.notes)}</p>
  ${s.stages.length ? `<div class="list" id="stree">${stageTree(s.stages)}</div>` : `<p class="muted">Criteria not entered.</p>`}
  ${s.sourceCheck ? `<p class="banner slim">${esc(s.sourceCheck)}</p>` : ""}
  <p class="muted" style="font-size:.84rem">Source: ${s.citation ? esc(s.citation) : `${esc(s.authority)} ${esc(s.version)} staging publication (citation to be recorded by reviewer)`}. Any staging assignment requires clinician verification.</p></article>`;
};

V.protocols = () => `<span class="eyebrow">Treatment protocol library</span><h1>Treatment protocols</h1>
  <p class="banner bad"><b>Doses are pending pharmacist review.</b> Each dose shows its source (guideline, product information or trial). Check it against the Malaysian product information and your institutional protocol before prescribing.</p>
  ${byDisease(D.protocols, p => p.disease, its => `<div class="list">${its.map(p => `<a class="row" href="${url(`p.${p.id}`)}"><span class="row-t">${esc(p.name)} ${listPill(p.status)} ${p.labels.map(l => `<span class="pill bad">${esc(l)}</span>`).join("")}</span>
    <span class="row-m"><span>${esc(p.line)}</span><span>${esc(p.modality)}</span><span>Biomarker: ${esc(p.biomarker)}</span></span></a>`).join("")}</div>`)}`;
V.p = id => {
  const p = byId(D.protocols, id); if (!p) return notFound();
  recent("Protocol", p.id, p.name);
  const W = `<span class="withheld">withheld · not verified</span>`;
  const fields = [["Regimen", esc(p.name)], ["Clinical indication", esc(p.indication)], ["Disease and histology", `${dname(p.disease)} · ${esc(p.histology)}`], ["Stage", na(p.stage)], ["Treatment intent", na(p.intent)], ["Treatment line", na(p.line)], ["Eligibility", W], ["Biomarker requirements", na(p.biomarker)], ["Cycle length", na(p.cycle)], ["Treatment duration", na(p.duration)], ["Premedication", W], ["Supportive medications", W], ["Baseline investigations", W], ["Monitoring", W], ["Renal adjustments", W], ["Hepatic adjustments", W], ["Haematological criteria", W], ["Dose modifications", W], ["Contraindications", W], ["Important interactions", W], ["Toxicity management", W], ["Interruption / restart criteria", W], ["Source protocol", esc(p.sourceType)], ["Version", '<span class="na">Not recorded</span>'], ["Verification status", statusPill(p.status)], ["Malaysian applicability", myLabel(p.malaysia)]];
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Treatment protocol · ${esc(p.modality)}</span><h1>${esc(p.name)}</h1><div class="row-m">${statusPill(p.status)} ${myLabel(p.malaysia)} ${p.labels.map(l => `<span class="pill bad">${esc(l)}</span>`).join("")}</div><div class="actions">${bmBtn("Protocol", p.id, p.name)}</div></div>
  ${p.doseStatus === "PHARMACIST VERIFIED" ? `<p class="banner">${statusPill(p.doseStatus)} Doses checked by ${esc(p.doseReviewer)} on ${esc(p.doseReviewedOn)}. Dose source: ${esc(p.doseSource)}. Confirm against your institutional protocol before prescribing.</p>`
    : p.doseStatus ? `<p class="banner bad">${statusPill(p.doseStatus)} Not for prescribing until a pharmacist has checked these doses. Dose source: ${esc(p.doseSource)}.${p.doseNote ? ` Reviewer note: ${esc(p.doseNote)}` : ""}</p>` : `<p class="banner bad">Not for prescribing. This record has no verified source protocol. Dose fields stay empty until a reviewer enters them from an authoritative source and clinical approval is recorded.</p>`}
  <section class="section"><h2>Regimen components</h2><div class="tablewrap"><table><thead><tr><th>Drug</th><th>Calculation basis</th><th>Dose</th><th>Route</th><th>Schedule</th></tr></thead><tbody>
    ${p.components.map(c => `<tr><td><a href="${url(`dr.${c.drug}`)}">${esc(byId(D.drugs, c.drug)?.name || c.drug)}</a></td><td>${esc(c.basis)}</td><td>${c.dose ? `<b>${esc(c.dose)}</b>` : W}</td><td>${esc(c.route)}</td><td>${c.schedule ? esc(c.schedule) : W}</td></tr>`).join("")}</tbody></table></div></section>
  <section class="section"><h2>Protocol fields</h2><div class="kv">${fields.map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}</div></section>
  ${noteBox(p.id)}</article>`;
};

V.drugs = () => `<span class="eyebrow">Oncology drug reference</span><h1>Drug monographs</h1>
  <p class="banner info">Monographs are <b>ARVEEN educational summaries</b>, not official product information. Malaysian (NPRA) registration is not verified for any drug.</p>${reviewStrip(false)}
  <p class="muted">A drug used for several cancers appears under each of them.</p>
  ${byDisease(D.drugs, d => d.cancers, its => `<div class="list cols-list">${[...its].sort((a, b) => a.name.localeCompare(b.name)).map(d => `<a class="row" href="${url(`dr.${d.id}`)}"><span class="row-t">${esc(d.name)} ${listPill(d.status || "NOT VERIFIED")}${d.doseStatus ? " " + listPill(d.doseStatus) : ""}</span><span class="row-m"><span>${esc(d.cls)}</span></span></a>`).join("")}</div>`)}`;
/* Drug page: dose and key safety facts first, the rest of the monograph folded underneath */
const GLANCE = ["Dose by indication", "Major adverse effects", "Contraindications", "Monitoring", "Renal considerations", "Hepatic considerations"];
const drugLayout = rows => {
  const kv = rs => `<div class="kv">${rs.map(([k, v]) => `<div>${k}</div><div>${v}</div>`).join("")}</div>`;
  const top = GLANCE.map(k => rows.find(r => r[0] === k)).filter(Boolean), rest = rows.filter(r => !GLANCE.includes(r[0]));
  return `<section class="section glance"><h2>At a glance</h2>${kv(top)}</section>
    <details class="section more-mono"><summary><b>Full monograph</b> <span class="muted">(class, mechanism, administration, interactions, pregnancy, counselling, regulatory status)</span></summary>${kv(rest)}</details>`;
};
V.dr = id => {
  const d = byId(D.drugs, id); if (!d) return notFound();
  recent("Drug", d.id, d.name);
  const W = `<span class="withheld">not entered · verify against product information</span>`;
  const pr = D.protocols.filter(p => p.components.some(c => c.drug === id));
  return `<article class="detail"><div class="dhead"><span class="eyebrow">Drug monograph</span><h1>${esc(d.name)}</h1><div class="row-m"><span class="pill teal">ARVEEN educational summary</span> ${statusPill(d.status || "NOT VERIFIED")} ${myLabel("regulatory")}</div><div class="actions">${bmBtn("Drug", d.id, d.name)}</div></div>
  ${drugLayout([["Generic name", esc(d.name)], ["Drug class", esc(d.cls)], ["Mechanism of action", esc(d.moa)], ["Cancer types", d.cancers.map(c => `<a href="${url(`d.${c}`)}">${dname(c)}</a>`).join(", ")], ["Major adverse effects", esc(d.ae)], ["Renal considerations", esc(d.renal)], ["Dose by indication", d.doses ? `${statusPill(d.doseStatus)}${d.doseReviewer ? ` <span class="muted">by ${esc(d.doseReviewer)}, ${esc(d.doseReviewedOn)}${d.doseNote ? ` — ${esc(d.doseNote)}` : ""}</span>` : ""}<ul class="doses">${d.doses.map(x => `<li><b>${esc(x.indication)}:</b> ${esc(x.dose)} <span class="muted">Source: ${esc(x.source)}</span></li>`).join("")}</ul>` : `<span class="withheld">not entered</span>`], ["Administration", d.admin ? esc(d.admin) : W], ["Contraindications", d.contra ? esc(d.contra) : W], ["Drug interactions", d.interactions ? esc(d.interactions) : W], ["Hepatic considerations", d.hepatic ? esc(d.hepatic) : W], ["Pregnancy and breastfeeding", d.pregnancy ? esc(d.pregnancy) : W], ["Fertility considerations", d.fertility ? esc(d.fertility) : W], ["Monitoring", d.monitoring ? esc(d.monitoring) : W], ["Dose modifications", `<span class="withheld">withheld · per verified protocol only</span>`], ["Patient counselling", d.counselling ? esc(d.counselling) : W], ["Product information", '<span class="na">Not linked</span>'], ["Malaysian regulatory status (NPRA)", `<span class="pill warn">${esc(d.npra)}</span>`], ["Used in ARVEEN protocols", pr.map(p => `<a href="${url(`p.${p.id}`)}">${esc(p.name)}</a>`).join("<br>") || na(null)]])}
  ${noteBox(d.id)}</article>`;
};

V.trials = () => {
  return `<span class="eyebrow">Clinical trials and evidence</span><h1>Clinical trials</h1>
  <p class="banner">Outcomes are entered from the published abstracts on PubMed, with the PubMed ID on each trial page. They are <b>PARTIALLY VERIFIED</b> until a clinical reviewer checks them against the full paper. Subgroup and interim results are labelled as such.</p>
  ${byDisease(D.trials, t => t.disease, its => `<div class="tablewrap"><table><thead><tr><th>Trial</th><th>Intervention vs comparator</th><th>Primary endpoint</th><th>Headline result</th><th>Source</th></tr></thead><tbody>
  ${its.map(t => `<tr><td><a href="${url(`t.${t.id}`)}"><b>${esc(t.name)}</b></a><div class="muted" style="font-size:.78rem">Phase ${esc(t.phase)}${t.outcome ? "" : " · ongoing / results not entered"}</div><div class="mono muted" style="font-size:.74rem">${esc(t.reg)}</div></td><td>${esc(t.intervention)}<div class="muted">vs ${esc(t.comparator)}</div></td><td>${esc(t.primary)}</td><td style="font-size:.86rem">${t.outcome ? esc(headline(t)) : '<span class="na">Not entered</span>'}</td><td style="font-size:.82rem">${esc(t.pub)}<div>${listPill(t.outcome?.status || "NOT VERIFIED")}</div></td></tr>`).join("")}
  </tbody></table></div>`)}`;
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
if (new URLSearchParams(location.search).get("view") === "flow") store.set("algoView", "flow"); // links from Tables & flowcharts open the flowchart
const refLink = id => {
  const r = byId(D.recommendations, id); if (r) return `<a href="${url(`g.${r.guideline}`)}#${esc(id)}">${esc(id)}</a> <span class="muted">(${esc(r.grade)}, ${esc(r.strength)})</span>`;
  if (byId(D.trials, id)) return `<a href="${url(`t.${id}`)}">${esc(byId(D.trials, id).name)}</a>`;
  if (byId(D.guidelines, id)) return `<a href="${url(`g.${id}`)}">${esc(id)}</a>`;
  if (byId(D.protocols, id)) return `<a href="${url(`p.${id}`)}">${esc(byId(D.protocols, id).name)}</a>`;
  const l = (D.literature || []).find(x => x.id === id); if (l) return `<a href="https://doi.org/${esc(l.doi)}" target="_blank" rel="noopener">${esc(l.authors.split(",")[0])} ${esc(l.citation.match(/20\d\d/)?.[0] || "")} ↗</a>`;
  return esc(id);
};
/* Flowchart view: the pathway's own decision tree drawn as boxes and arrows (generated from our data, not a copied
   figure). Questions are white, actions orange, referrals purple, outcomes blue, missing information amber.
   A step reached by more than one route is drawn once; later arrows point to it by name. */
let algoView = store.get("algoView", "steps");
function algoFlow(a) {
  const seen = new Set(), label = { action: "Investigation", escalate: "Referral / escalation", missing: "Missing information", info: "Outcome" };
  const short = s => { const t = String(s); return t.length > 190 ? t.slice(0, 187).replace(/\s+\S*$/, "") + "…" : t; };
  const box = (k, n) => n.end
    ? `<div class="fbox f-${esc(n.kind || "info")}" id="fl-${esc(k)}"><span class="fk">${label[n.kind] || "Outcome"}</span>${esc(short(n.end))}${n.refs?.length ? `<span class="fref">${n.refs.slice(0, 4).map(refLink).join(" · ")}${n.refs.length > 4 ? ` +${n.refs.length - 4}` : ""}</span>` : ""}${n.calc && CALCS[n.calc] ? `<a class="fcalc" href="${url("calculators")}#calc-${esc(n.calc)}">${esc(CALCS[n.calc].title)} ↗</a>` : ""}</div>`
    : `<div class="fbox f-q" id="fl-${esc(k)}">${esc(short(n.q))}${n.calc && CALCS[n.calc] ? `<a class="fcalc" href="${url("calculators")}#calc-${esc(n.calc)}">${esc(CALCS[n.calc].title)} ↗</a>` : ""}</div>`;
  const node = (k, depth) => {
    const n = a.nodes[k]; if (!n) return "";
    if (seen.has(k)) return `<div class="fbox f-link"><a href="#fl-${esc(k)}">→ continues at: ${esc(short(n.q || n.end).slice(0, 70))}…</a></div>`;
    seen.add(k);
    if (n.end || depth > 12) return box(k, n);
    return `${box(k, n)}<ul>${n.options.map(([t, to]) => `<li><span class="fedge">${esc(t)}</span>${node(to, depth + 1)}</li>`).join("")}</ul>`;
  };
  return `<p class="muted no-print" style="font-size:.86rem">The whole pathway at a glance. On a small screen, scroll sideways. Each outcome lists the recommendations it is based on.</p>
  <div class="flow-wrap" tabindex="0" aria-label="Flowchart of ${esc(a.title)}"><div class="flow"><ul><li>${node("start", 0)}</li></ul></div></div>
  <div class="flow-key" aria-hidden="true"><span class="fbox f-q">Question</span><span class="fbox f-action">Investigation</span><span class="fbox f-escalate">Referral</span><span class="fbox f-info">Outcome</span><span class="fbox f-missing">Missing information</span></div>
  <div class="algo-actions no-print"><button class="btn" data-print>Print this flowchart</button></div>`;
}
/* Tables & flowcharts: DR ARVEEN's own abridged guideline tables (visuals collection) and every pathway as a flowchart. */
function vTable(v, opts = {}) {
  const g = byId(D.guidelines, v.guideline), paths = (v.pathways || []).map(p => byId(D.algorithms || [], p)).filter(Boolean);
  return `<section class="vt" id="vt-${esc(v.id)}"><${opts.h || "h3"}>${esc(v.title)}</${opts.h || "h3"}>
    <p class="vt-src">${listPill(v.status)} Source: <a href="${url(`g.${v.guideline}`)}">${esc(g ? orgs(g) + " " + (g.version || "") : v.guideline)}</a> · ${esc(v.source)} · abridged by DR ARVEEN</p>
    <div class="tablewrap"><table class="vtable"><thead><tr>${v.columns.map(c => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${v.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${String(c).split(" · ").map(esc).join("<br>")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${v.note ? `<p class="vt-note">${fmt(v.note)}</p>` : ""}
    ${paths.length ? `<p class="vt-links">${paths.map(a => `<a class="btn" href="${url("algorithms")}?id=${encodeURIComponent(a.id)}&view=flow">Flowchart: ${esc(a.title.split(":")[0])} →</a>`).join(" ")}</p>` : ""}</section>`;
}
V.visuals = () => {
  const vis = D.visuals || [], algos = D.algorithms || [];
  const keys = [...new Set([...vis.map(v => v.disease), ...algos.map(a => a.disease)])].sort((a, b) => DIS_ORDER(a) - DIS_ORDER(b));
  const lab = k => k === "all" ? "All cancers" : dname(k);
  return `<div class="section-h"><div><span class="eyebrow">Reference</span><h1>Tables &amp; flowcharts</h1></div><div class="toc"><a class="btn" href="${url("algorithms")}">Clinical pathways</a><a class="btn" href="${url("staging")}">Staging</a></div></div>
  <p class="prose muted">Key tables from the guidelines, re-drawn and abridged by DR ARVEEN with the source table cited, and every clinical pathway as a flowchart. Check the original before clinical use; all items are NOT VERIFIED until reviewed.</p>
  <nav class="chips" aria-label="Jump to cancer">${keys.map(k => `<a class="chip" href="#vg-${esc(k)}">${esc(lab(k))}</a>`).join("")}</nav>
  ${keys.map(k => { const vs = vis.filter(v => v.disease === k), as = algos.filter(a => a.disease === k);
    return `<section class="section vgroup" id="vg-${esc(k)}"><h2>${esc(lab(k))}</h2>
      ${as.length ? `<div class="vflows">${as.map(a => `<a class="tile vflow" href="${url("algorithms")}?id=${encodeURIComponent(a.id)}&view=flow"><span class="eyebrow">Flowchart</span><b>${esc(a.title)}</b><span class="muted">${Object.keys(a.nodes).length} steps · ${esc(a.source)}</span></a>`).join("")}</div>` : ""}
      ${vs.map(v => vTable(v)).join("")}</section>`; }).join("")}`;
};
/* Pathway library (no ?id=) and pathway runner (?id=A-…). */
const algoDis = a => a.disease === "all" ? "All cancers" : dname(a.disease);
function algoLibrary() {
  const list = [...D.algorithms].sort((p, q) => DIS_ORDER(p.disease) - DIS_ORDER(q.disease));
  const groups = [...new Set(list.map(algoDis))];
  const card = a => { const qs = Object.values(a.nodes).filter(n => !n.end).length, ends = Object.values(a.nodes).filter(n => n.end).length;
    return `<a class="tile algo-card" href="${url("algorithms")}?id=${encodeURIComponent(a.id)}">${badge(a.disease === "all" ? "all" : a.disease)}<b>${esc(a.title)}</b><span>${esc(a.entry)}</span>
      <span class="row-m">${listPill(a.status)}<span class="muted">${qs} questions · ${ends} outcomes · ${esc(a.source)}</span></span></a>`; };
  return `<div class="section-h"><div><span class="eyebrow">Clinical pathways</span><h1>Clinical pathways</h1></div><div class="toc"><a class="btn" href="${url("calculators")}">Calculators</a></div></div>
  <p class="prose muted">Step-by-step work-up pathways. Each outcome links to the guideline recommendations it is built from. Where information is missing the pathway says so rather than guessing. Pathways do not choose treatment: the MDT decides.</p>
  ${groups.map(g => `<section class="section"><h2>${esc(g)}</h2><div class="grid algo-grid">${list.filter(a => algoDis(a) === g).map(card).join("")}</div></section>`).join("")}`;
}
V.algorithms = () => {
  if (!algoId || !byId(D.algorithms, algoId)) return algoLibrary();
  const a = byId(D.algorithms, algoId);
  if (!algoPath.length || !a.nodes[algoPath[0]]) algoPath = ["start"];
  const qn = algoPath.filter(k => !a.nodes[k].end).length;
  const steps = algoPath.map((k, i) => {
    const n = a.nodes[k]; const last = i === algoPath.length - 1;
    if (n.end) return `<div class="step end ${esc(n.kind)}" ${last ? 'id="algo-last"' : ""}><span class="eyebrow">${n.kind === "missing" ? "Missing information" : n.kind === "escalate" ? "Referral / escalation" : n.kind === "action" ? "Required investigation" : "Outcome"}</span><p>${esc(n.end)}</p>${n.refs?.length ? `<p class="muted" style="font-size:.84rem">Based on: ${n.refs.map(refLink).join(" · ")}</p>` : ""}</div>`;
    const chosen = algoPath[i + 1];
    const calc = n.calc && CALCS[n.calc] ? `<p class="step-calc"><a class="btn" href="${url("calculators")}#calc-${esc(n.calc)}" target="_blank" rel="noopener">Open the ${esc(CALCS[n.calc].title)} calculator ↗</a></p>` : "";
    return `<div class="step ${last ? "" : "past"}" ${last ? 'id="algo-last"' : ""}><span class="step-n">Question ${algoPath.slice(0, i + 1).filter(x => !a.nodes[x].end).length}</span><p><b>${esc(n.q)}</b></p>${calc}<div class="opts">${n.options.map(([t, to]) => `<button class="btn" data-step="${i}" data-to="${esc(to)}" aria-pressed="${chosen === to}">${esc(t)}</button>`).join("")}</div></div>`;
  }).join("");
  const g = byId(D.guidelines, a.source);
  const others = D.algorithms.filter(x => x.id !== a.id && (x.disease === a.disease || x.disease === "all" || a.disease === "all"));
  const done = !!a.nodes[algoPath[algoPath.length - 1]].end;
  return `<nav class="crumbs" aria-label="Breadcrumb"><a href="${url("algorithms")}">Clinical pathways</a> › <span>${esc(algoDis(a))}</span></nav>
  <span class="eyebrow">Clinical pathway · ${esc(algoDis(a))}</span><h1>${esc(a.title)}</h1>
  <div class="row-m">${statusPill(a.status)} <span>Main source: <a href="${url(`g.${a.source}`)}">${esc(a.source)}</a>${g ? ` (${esc(g.version || "")}, ${esc(g.status || "not verified")})` : ""}</span><span>Verification date: ${a.verifiedOn ? `${esc(a.verifiedOn)} (${esc(a.reviewer)})` : '<span class="na">Not yet verified</span>'}</span></div>
  ${a.sourceNote ? `<p class="muted" style="font-size:.86rem">${esc(a.sourceNote)}</p>` : ""}
  <p class="banner info">Educational pathway. Where information is missing it says so instead of forcing a conclusion. It does not select treatment: the MDT decides.</p>
  <p class="prose"><b>Entry criteria:</b> ${esc(a.entry)}</p>
  <div class="chips algo-views no-print" role="group" aria-label="View"><button class="chip" data-algoview="steps" aria-pressed="${algoView !== "flow"}">Step by step</button><button class="chip" data-algoview="flow" aria-pressed="${algoView === "flow"}">Flowchart</button></div>
  ${algoView === "flow" ? algoFlow(a) : `<p class="algo-progress" aria-live="polite">${done ? `<b>Finished</b> after ${qn} question${qn === 1 ? "" : "s"}.` : `Question ${qn}. Choose an answer to continue.`}</p>
  <div class="algo" aria-live="polite">${steps}<div class="algo-actions">${algoPath.length > 1 ? `<button class="btn" id="algoback">← Back one step</button>` : ""}<button class="btn" id="algoreset">Start again</button>${algoPath.length > 1 ? `<button class="btn" data-print>Print this pathway</button>` : ""}</div></div>`}
  ${others.length ? `<section class="section no-print"><h2>Related pathways</h2><div class="chips">${others.map(x => `<a class="chip" href="${url("algorithms")}?id=${encodeURIComponent(x.id)}">${esc(x.title.split(":")[0])}</a>`).join("")}</div></section>` : ""}
  <p class="print-only muted">Printed ${new Date().toISOString().slice(0, 10)} from DR ARVEEN. Educational pathway, NOT VERIFIED unless stated above. The MDT decides treatment.</p>`;
};

/* ---------- calculators ----------
   Each calculator: id, title, fields [name, label, min, max, options?], formula text, limitations, source, and the pathways that use it.
   Options can be plain strings or [value, label] pairs. Results may be a string or { text, tone } (tone: ok | warn | bad). */
const CALC_GROUPS = [
  ["body", "Body size and kidney function", ["bsa", "bmi", "ibw", "crcl", "egfr"]],
  ["dose", "Dose support", ["calvert", "bsadose", "doxo"]],
  ["blood", "Blood results", ["anc", "ccalc"]],
  ["markers", "Tumour markers and risk of malignancy", ["rmi", "roma", "ca125"]],
  ["scores", "Pathology and prognostic scores", ["sedlis", "gtn"]]
];
const GTN_OPTS = {
  age: [["0", "Under 40"], ["1", "40 or over"]],
  preg: [["0", "Hydatidiform mole"], ["1", "Abortion"], ["2", "Term pregnancy"]],
  interval: [["0", "Under 4"], ["1", "4 to under 7"], ["2", "7 to under 13"], ["4", "13 or more"]],
  hcg: [["0", "Under 1,000"], ["1", "1,000 to under 10,000"], ["2", "10,000 to under 100,000"], ["4", "100,000 or more"]],
  size: [["0", "Under 3 cm (or none)"], ["1", "3 to under 5 cm"], ["2", "5 cm or more"]],
  site: [["0", "None or lung"], ["1", "Spleen or kidney"], ["2", "Gastrointestinal tract"], ["4", "Liver or brain"]],
  nmet: [["0", "None"], ["1", "1 to 4"], ["2", "5 to 8"], ["4", "More than 8"]],
  chemo: [["0", "None"], ["2", "Single drug"], ["4", "Two or more drugs"]]
};
const CALCS = {
  bsa: { title: "Body surface area", fields: [["h", "Height (cm)", 100, 230], ["w", "Weight (kg)", 25, 250]], formula: "Mosteller: √(height cm × weight kg / 3600). Du Bois: 0.007184 × W^0.425 × H^0.725.", limits: "Adults. Some protocols cap BSA or use adjusted weight; not applied here." },
  bmi: { title: "Body mass index", fields: [["h", "Height (cm)", 100, 230], ["w", "Weight (kg)", 25, 250]], formula: "Weight (kg) / height (m)². WHO adult categories; Asian populations may use lower action thresholds.", limits: "Adults only. Does not reflect body composition." },
  ibw: { title: "Ideal and adjusted body weight", fields: [["sex", "Sex", null, null, ["female", "male"]], ["h", "Height (cm)", 120, 230], ["w", "Actual weight (kg)", 25, 250]], formula: "Ideal body weight (Devine): 45.5 kg (female) or 50 kg (male) + 2.3 kg per inch over 5 feet (152.4 cm). Adjusted body weight = IBW + 0.4 × (actual − IBW), used when actual weight is above IBW.", limits: "Devine is not validated below 152 cm. Which weight to use for creatinine clearance or dosing is set by the local protocol.", source: "Devine BJ. Drug Intell Clin Pharm 1974;8:650–5." },
  crcl: { title: "Creatinine clearance (Cockcroft–Gault)", fields: [["age", "Age (years)", 18, 110], ["w", "Weight (kg)", 25, 250], ["cr", "Serum creatinine (µmol/L)", 20, 1500], ["sex", "Sex", null, null, ["female", "male"]]], formula: "((140 − age) × weight × K) / creatinine (µmol/L); K = 1.04 female, 1.23 male.", limits: "Unreliable with unstable renal function, extremes of body weight or low muscle mass. The weight used (actual, ideal, adjusted) varies by protocol: see Ideal and adjusted body weight." },
  egfr: { title: "eGFR (CKD-EPI 2021, race-free)", fields: [["age", "Age (years)", 18, 110], ["cr", "Serum creatinine (µmol/L)", 20, 1500], ["sex", "Sex", null, null, ["female", "male"]]], formula: "142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^age × 1.012 if female. κ 0.7 F / 0.9 M; α −0.241 F / −0.302 M. Scr in mg/dL (µmol/L ÷ 88.4).", limits: "Indexed to 1.73 m². Do not substitute into the Calvert formula without de-indexing per protocol." },
  calvert: { title: "Carboplatin dose support (Calvert)", fields: [["auc", "Target AUC (mg/mL·min)", 1, 8], ["gfr", "GFR (mL/min)", 5, 200]], formula: "Dose (mg) = target AUC × (GFR + 25).", limits: "Target AUC comes from the verified protocol only. Many protocols cap GFR (for example at 125 mL/min); no cap is applied here." },
  bsadose: { title: "Dose from mg/m² (BSA-based)", fields: [["dose", "Protocol dose (mg/m²)", 0.1, 5000], ["bsa", "Body surface area (m²)", 0.5, 3.5]], formula: "Dose (mg) = protocol dose (mg/m²) × BSA (m²).", limits: "The mg/m² dose must come from the verified protocol, which also sets rounding, BSA capping and dose adjustments for organ function or toxicity. Not applied here." },
  doxo: { title: "Cumulative anthracycline (doxorubicin) dose", fields: [["prev", "Doxorubicin already given (mg/m²)", 0, 1500], ["per", "Planned dose per cycle (mg/m²)", 0, 150], ["n", "Planned cycles", 0, 20]], formula: "Cumulative dose = previous + (dose per cycle × cycles). Risk of cardiomyopathy rises steeply above about 450–550 mg/m² of conventional doxorubicin.", limits: "Conventional doxorubicin only: pegylated liposomal doxorubicin, epirubicin and prior chest radiotherapy change the risk and are not converted here. Cardiac monitoring follows the protocol.", source: "Swain SM et al. Cancer 2003;97:2869–79 (dose-related heart failure)." },
  anc: { title: "Absolute neutrophil count", fields: [["wbc", "White cell count (×10⁹/L)", 0, 300], ["n", "Neutrophils (%)", 0, 100], ["b", "Band forms (%, 0 if not reported)", 0, 100]], formula: "ANC (×10⁹/L) = white cells × (neutrophils % + bands %) / 100. Grading per CTCAE v5: grade 1 below normal to 1.5; grade 2 1.0 to under 1.5; grade 3 0.5 to under 1.0; grade 4 under 0.5.", limits: "Most analysers report the ANC directly; use the laboratory value when available. Whether to treat or delay follows the protocol." },
  ccalc: { title: "Albumin-corrected calcium", fields: [["ca", "Total calcium (mmol/L)", 0.5, 5], ["alb", "Albumin (g/L)", 5, 60]], formula: "Corrected calcium (mmol/L) = calcium + 0.02 × (40 − albumin g/L). Reference range typically about 2.2–2.6 mmol/L.", limits: "Correction formulas vary by laboratory; ionised calcium is preferred when available or when albumin is very low. Relevant, for example, to hypercalcaemia in ovarian small cell carcinoma." },
  rmi: { title: "Risk of Malignancy Index (RMI I)", fields: [["f", "Ultrasound features present (0–5)", 0, 5], ["meno", "Menopausal status", null, null, ["postmenopausal", "premenopausal"]], ["ca", "Serum CA125 (IU/mL)", 0, 100000]], formula: "RMI = U × M × CA125. U = 0 (no features), 1 (one feature) or 3 (two to five) of: multilocular cyst, solid areas, metastases, ascites, bilateral lesions. M = 3 postmenopausal, 1 premenopausal. NICE CG122: refer to the specialist MDT if RMI is 250 or more.", limits: "Adnexal masses only. Not valid in pregnancy. CA125 can rise in benign conditions (endometriosis, infection, menstruation). Formula and threshold checked against NICE CG122 Box 3.1 (PDF). 'Postmenopausal' means no period for more than a year, or over 50 after hysterectomy.", pathways: ["A-OV-SUSPECT"] },
  roma: { title: "ROMA (Risk of Ovarian Malignancy Algorithm)", fields: [["he4", "HE4 (pmol/L)", 1, 10000], ["ca", "CA125 (U/mL)", 1, 100000], ["meno", "Menopausal status", null, null, ["premenopausal", "postmenopausal"]], ["assay", "Assay (sets the cut-off)", null, null, [["roche", "Roche Elecsys (11.4% / 29.9%)"], ["abbott", "Abbott ARCHITECT (7.4% / 25.3%)"]]]], formula: "Premenopausal PI = −12.0 + 2.38 × ln(HE4) + 0.0626 × ln(CA125). Postmenopausal PI = −8.09 + 1.04 × ln(HE4) + 0.732 × ln(CA125). ROMA (%) = exp(PI) / (1 + exp(PI)) × 100. High risk at or above the assay's cut-off (premenopausal / postmenopausal).", limits: "For women with a pelvic mass already planned for surgery; not a screening test. Cut-offs are assay-specific: use the one your laboratory reports. HE4 rises with renal impairment and age. Not part of NICE CG122.", source: "Moore RG et al. Gynecol Oncol 2009;112:40–6; manufacturer cut-offs." },
  ca125: { title: "CA125 change (GCIG response)", fields: [["base", "Pre-treatment CA125 (U/mL)", 0, 100000], ["now", "Current CA125 (U/mL)", 0, 100000], ["uln", "Upper limit of normal (U/mL)", 1, 200]], formula: "Change (%) = (current − pre-treatment) / pre-treatment × 100. GCIG CA125 response: at least a 50% fall from a pre-treatment value of at least twice the upper limit of normal, confirmed and maintained for at least 28 days.", limits: "Response needs a confirmatory sample at least 28 days later and is not assessable within 28 days of intraperitoneal therapy or after mouse antibodies. Progression by CA125 has separate GCIG criteria. Interpret with imaging and clinical findings.", source: "Rustin GJS et al. Int J Gynecol Cancer 2011;21:419–23 (GCIG definitions)." },
  sedlis: { title: "Cervical cancer: Sedlis intermediate-risk criteria", fields: [["lvsi", "Lymphovascular space invasion", null, null, [["pos", "Present"], ["neg", "Absent"]]], ["depth", "Depth of stromal invasion", null, null, [["deep", "Deep third"], ["middle", "Middle third"], ["sup", "Superficial third"]]], ["size", "Clinical tumour size (cm)", 0, 15]], formula: "Meets the criteria if: LVSI present + deep third (any size); LVSI present + middle third + 2 cm or more; LVSI present + superficial third + 5 cm or more; LVSI absent + middle or deep third + 4 cm or more.", limits: "Applies to node-negative disease with clear margins and parametria after radical hysterectomy (otherwise high risk). GOG-92 trial criteria; ESGO 2023 frames intermediate risk by the same factors and lets the MDT choose radiotherapy or observation.", source: "Sedlis A et al. Gynecol Oncol 1999;73:177–83; ESGO/ESTRO/ESP 2023 (R-CX-E09).", pathways: ["A-CX-ADJ"] },
  gtn: { title: "GTN prognostic score (FIGO 2000 / WHO)", fields: [["age", "Age", null, null, GTN_OPTS.age], ["preg", "Antecedent pregnancy", null, null, GTN_OPTS.preg], ["interval", "Months from index pregnancy", null, null, GTN_OPTS.interval], ["hcg", "Pre-treatment serum hCG (IU/L)", null, null, GTN_OPTS.hcg], ["size", "Largest tumour, including uterus", null, null, GTN_OPTS.size], ["site", "Site of metastases", null, null, GTN_OPTS.site], ["nmet", "Number of metastases", null, null, GTN_OPTS.nmet], ["chemo", "Previous failed chemotherapy", null, null, GTN_OPTS.chemo]], formula: "Sum of the eight item scores. 0–6: low risk (usually single-agent chemotherapy). 7 or more: high risk (multi-agent chemotherapy). 13 or more: ultra-high risk.", limits: "Score with the anatomical FIGO stage, written as stage:score (for example III:4). Not used for placental-site or epithelioid trophoblastic tumours. Treatment is decided by a specialist GTD centre.", source: "FIGO Oncology Committee 2002 (FIGO 2000 staging and risk-factor scoring); FIGO Cancer Report 2021." }
};
const CALC_PATHS = Object.fromEntries(Object.entries(CALCS).flatMap(([id, c]) => (c.pathways || []).map(p => [p + ":" + id, 1])));
V.calculators = () => `<div class="section-h"><div><span class="eyebrow">Calculator library</span><h1>Calculators</h1></div>
    <div class="toc"><a class="btn" href="${url("algorithms")}">Clinical pathways</a></div></div>
  <p class="banner bad">Calculation support only. Results are not a prescription. Rounding, capping and the choice of renal-function estimate follow your institution's protocol, which this tool does not apply.</p>
  <div class="calc-tools"><label class="calc-find">Find a calculator<input type="search" id="calcq" placeholder="e.g. ROMA, carboplatin, calcium" autocomplete="off"></label>
    <nav class="chips calc-jump" aria-label="Calculator groups">${CALC_GROUPS.map(([g, t, ids]) => `<a class="chip" href="#cg-${g}">${esc(t)} <span class="muted">${ids.length}</span></a>`).join("")}</nav></div>
  ${CALC_GROUPS.map(([g, t, ids]) => `<section class="calc-group" id="cg-${g}"><h2>${esc(t)}</h2><div class="calcs">${ids.map(calcCard).join("")}</div></section>`).join("")}
  <p class="muted calc-none" id="calc-none" hidden>No calculator matches that search.</p>`;
function calcCard(id) {
  const c = CALCS[id];
  const opt = o => Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<option>${esc(o)}</option>`;
  const paths = (c.pathways || []).map(p => byId(D.algorithms || [], p)).filter(Boolean);
  return `<form class="calc" id="calc-${id}" data-calc="${id}"><h3>${esc(c.title)}</h3><div class="fields">${c.fields.map(([k, l, mn, mx, opts]) => opts
    ? `<label for="${id}-${k}">${esc(l)}<select id="${id}-${k}" name="${k}">${opts.map(opt).join("")}</select></label>`
    : `<label for="${id}-${k}">${esc(l)}<input id="${id}-${k}" name="${k}" type="number" step="any" min="${mn}" max="${mx}" inputmode="decimal"></label>`).join("")}</div>
    <div class="calc-out"><div class="result" id="${id}-out" aria-live="polite">${c.fields.every(f => f[4]) ? "Choose the options above" : "Enter values"}</div><button class="btn calc-copy" type="button" data-copy="${id}" hidden>Copy</button></div>
    ${paths.length ? `<p class="calc-used">Used in: ${paths.map(a => `<a href="${url("algorithms")}?id=${encodeURIComponent(a.id)}">${esc(a.title.split(":")[0])}</a>`).join(" · ")}</p>` : ""}
    <details><summary>Formula, population and limitations</summary><p><b>Formula:</b> ${esc(c.formula)}</p><p><b>Limitations:</b> ${esc(c.limits)}</p>${c.source ? `<p><b>Source:</b> ${esc(c.source)}</p>` : ""}<p><b>Testing status:</b> unit-tested formula; not clinically validated in this build.</p></details></form>`;
}
// @test:CALC — the formulas (pure functions, unit-tested in tests/calculators.test.mjs)
const CALC = {
  bsa: v => { const m = Math.sqrt(v.h * v.w / 3600), d = 0.007184 * Math.pow(v.w, .425) * Math.pow(v.h, .725); return `Mosteller ${m.toFixed(2)} m² · Du Bois ${d.toFixed(2)} m²`; },
  bmi: v => { const b = v.w / Math.pow(v.h / 100, 2); return `${b.toFixed(1)} kg/m²`; },
  ibw: v => { const inch = v.h / 2.54 - 60, ibw = (v.sex === "male" ? 50 : 45.5) + 2.3 * inch, adj = v.w > ibw ? ibw + 0.4 * (v.w - ibw) : null;
    const pct = v.w / ibw * 100; return { text: `Ideal ${ibw.toFixed(1)} kg · ${adj ? `adjusted ${adj.toFixed(1)} kg` : "adjusted not needed (actual ≤ ideal)"} · actual is ${pct.toFixed(0)}% of ideal${v.h < 152.4 ? " · height under 152 cm: Devine not validated" : ""}`, tone: v.h < 152.4 ? "warn" : "" }; },
  crcl: v => { const k = v.sex === "female" ? 1.04 : 1.23; return `${((140 - v.age) * v.w * k / v.cr).toFixed(0)} mL/min`; },
  egfr: v => { const f = v.sex === "female", s = v.cr / 88.4, k = f ? .7 : .9, a = f ? -.241 : -.302; const e = 142 * Math.pow(Math.min(s / k, 1), a) * Math.pow(Math.max(s / k, 1), -1.2) * Math.pow(.9938, v.age) * (f ? 1.012 : 1); return `${e.toFixed(0)} mL/min/1.73 m²`; },
  calvert: v => `${(v.auc * (v.gfr + 25)).toFixed(0)} mg (unrounded, uncapped)`,
  bsadose: v => `${(v.dose * v.bsa).toFixed(1)} mg (unrounded; BSA cap and adjustments per protocol)`,
  doxo: v => { const tot = v.prev + v.per * v.n; return { text: `Cumulative ${tot.toFixed(0)} mg/m²${tot >= 550 ? " — above 550 mg/m²: high cardiomyopathy risk" : tot >= 450 ? " — 450 mg/m² or more: cardiomyopathy risk rises steeply" : ""}`, tone: tot >= 550 ? "bad" : tot >= 450 ? "warn" : "ok" }; },
  anc: v => { if (v.n + v.b > 100) return { text: "Neutrophils plus bands cannot exceed 100%.", tone: "bad" }; const a = v.wbc * (v.n + v.b) / 100;
    const g = a < .5 ? "grade 4 neutropenia" : a < 1 ? "grade 3 neutropenia" : a < 1.5 ? "grade 2 neutropenia" : a < 2 ? "possible grade 1 (check the laboratory's lower limit)" : "not neutropenic";
    return { text: `ANC ${a.toFixed(2)} ×10⁹/L — ${g}`, tone: a < 1 ? "bad" : a < 1.5 ? "warn" : "ok" }; },
  ccalc: v => { const c = v.ca + 0.02 * (40 - v.alb); return { text: `Corrected calcium ${c.toFixed(2)} mmol/L${c > 2.6 ? " — above the usual range" : c < 2.2 ? " — below the usual range" : ""}`, tone: c >= 3 ? "bad" : c > 2.6 || c < 2.2 ? "warn" : "ok" }; },
  rmi: v => { if (!Number.isInteger(v.f)) return "Features must be a whole number from 0 to 5."; const u = v.f === 0 ? 0 : v.f === 1 ? 1 : 3, m = v.meno === "postmenopausal" ? 3 : 1, r = u * m * v.ca; return { text: `RMI ${r.toFixed(0)} (U ${u} × M ${m} × CA125 ${v.ca}) — ${r >= 250 ? "250 or more: refer to the specialist MDT (NICE CG122)" : "below 250"}`, tone: r >= 250 ? "bad" : "ok" }; },
  roma: v => { const pre = v.meno === "premenopausal"; const pi = pre ? -12 + 2.38 * Math.log(v.he4) + 0.0626 * Math.log(v.ca) : -8.09 + 1.04 * Math.log(v.he4) + 0.732 * Math.log(v.ca);
    const r = Math.exp(pi) / (1 + Math.exp(pi)) * 100, cut = v.assay === "abbott" ? (pre ? 7.4 : 25.3) : (pre ? 11.4 : 29.9);
    return { text: `ROMA ${r.toFixed(1)}% — ${r >= cut ? "high" : "low"} risk (cut-off ${cut}% for ${pre ? "premenopausal" : "postmenopausal"} women, ${v.assay === "abbott" ? "Abbott" : "Roche"} assay)`, tone: r >= cut ? "bad" : "ok" }; },
  ca125: v => { if (v.base <= 0) return { text: "Pre-treatment CA125 must be above 0.", tone: "bad" }; const ch = (v.now - v.base) / v.base * 100, eligible = v.base >= 2 * v.uln;
    const resp = ch <= -50 && eligible; return { text: `${ch <= 0 ? "Fall" : "Rise"} of ${Math.abs(ch).toFixed(0)}% — ${!eligible ? "pre-treatment value is under 2 × the upper limit of normal, so GCIG CA125 response cannot be assessed" : resp ? "meets the 50% fall for GCIG CA125 response if confirmed and maintained for 28 days or more" : "does not meet the 50% fall for GCIG CA125 response"}`, tone: !eligible ? "warn" : resp ? "ok" : "" }; },
  sedlis: v => { const s = v.size, pos = v.lvsi === "pos";
    const meets = pos ? (v.depth === "deep" || (v.depth === "middle" && s >= 2) || (v.depth === "sup" && s >= 5)) : ((v.depth === "middle" || v.depth === "deep") && s >= 4);
    return { text: meets ? "Meets the Sedlis intermediate-risk criteria: adjuvant radiotherapy to be considered (observation is an alternative) — MDT decision" : "Does not meet the Sedlis criteria", tone: meets ? "warn" : "ok" }; },
  gtn: v => { const tot = ["age", "preg", "interval", "hcg", "size", "site", "nmet", "chemo"].reduce((a, k) => a + Number(v[k] || 0), 0);
    return { text: `Score ${tot} — ${tot >= 13 ? "ultra-high risk (13 or more)" : tot >= 7 ? "high risk (7 or more)" : "low risk (0–6)"}. Report as FIGO stage:score.`, tone: tot >= 7 ? "bad" : "ok" }; }
};
// @end
function bindCalcs() {
  const q = $("#calcq");
  if (q) q.oninput = () => { const s = q.value.trim().toLowerCase(); let shown = 0;
    app.querySelectorAll(".calc-group").forEach(g => { let n = 0; g.querySelectorAll(".calc").forEach(c => { const hit = !s || c.textContent.toLowerCase().includes(s); c.hidden = !hit; n += hit; }); g.hidden = !n; shown += n; });
    $("#calc-none").hidden = shown > 0; };
  app.querySelectorAll("[data-calc]").forEach(f => {
    f.onsubmit = e => e.preventDefault();
    const run = () => {
      const id = f.dataset.calc, out = $("#" + id + "-out"), copy = f.querySelector(".calc-copy"), v = {}; let err = "";
      f.querySelectorAll("input,select").forEach(i => {
        if (i.tagName === "SELECT") { v[i.name] = i.value; return; }
        if (i.value === "") { err = err || "Enter all values."; return; }
        const n = Number(i.value);
        if (!isFinite(n) || n < +i.min || n > +i.max) err = `${i.labels[0].firstChild.textContent.trim()} must be between ${i.min} and ${i.max}.`;
        v[i.name] = n;
      });
      const r = err ? { text: err, tone: err === "Enter all values." ? "" : "bad" } : (r0 => typeof r0 === "string" ? { text: r0, tone: "" } : r0)(CALC[id](v));
      out.className = "result" + (r.tone ? " " + (r.tone === "bad" && err ? "err" : r.tone) : "");
      out.textContent = r.text;
      if (copy) copy.hidden = !!err;
    };
    f.oninput = run; f.onchange = run;
    if ([...f.querySelectorAll("input")].length === 0) run(); // all-choice calculators (e.g. GTN score) show a result straight away
    const cp = f.querySelector(".calc-copy");
    if (cp) cp.onclick = async () => { const txt = CALCS[f.dataset.calc].title + ": " + $("#" + f.dataset.calc + "-out").textContent + " (DR ARVEEN calculator, calculation support only)";
      try { await navigator.clipboard.writeText(txt); cp.textContent = "Copied"; setTimeout(() => cp.textContent = "Copy", 1500); } catch { cp.textContent = "Copy failed"; } };
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
  const groups = [...new Set(items.map(x => x.disease))].sort((a, b) => DIS_ORDER(a) - DIS_ORDER(b));
  return `<section class="section"><h2>${esc(title)}</h2><p class="muted">${esc(intro)}</p>
    ${groups.map(g => `<h3 class="dgroup-h small">${badge(g)}<span>${esc(dn(g))}</span></h3><div class="list">${items.filter(x => x.disease === g).map(x => `<details class="row lit">
      <summary><span class="row-t">${esc(x.title)} ${listPill(x.status)}</span><span class="row-m"><span>${esc(x.type)}</span><span>${esc(x.topic)}</span><span>${esc(x.authors)} ${esc(x.citation)}</span></span></summary>
      <p class="prose">${fmt(x.summary)}</p><ul class="plist">${x.findings.map(f => `<li>${fmt(f)}</li>`).join("")}</ul>
      <p class="muted"><b>Caveat:</b> ${esc(x.caveat)}</p>
      ${x.related.length || x.drugs.length ? `<p class="muted">Related: ${[...x.related.map(link), ...x.drugs.map(d => `<a href="${url(`dr.${d}`)}">${esc(byId(D.drugs, d)?.name || d)}</a>`)].join(", ")}</p>` : ""}
      <p><a href="https://doi.org/${encodeURIComponent(x.doi).replace(/%2F/g, "/")}" target="_blank" rel="noopener">Read the article (doi ${esc(x.doi)}) ↗</a></p></details>`).join("")}</div>`).join("")}</section>`;
};

V.updates = () => `<div class="section-h"><div><span class="eyebrow">Guidelines · update intelligence</span><h1>Guideline updates</h1></div><div class="toc"><a class="btn" href="${url(`guidelines`)}">Guidelines</a><a class="btn" href="${url(`recs`)}">Recommendations</a><a class="btn" aria-pressed="true" href="${url(`updates`)}">Updates</a></div></div>
  <p class="prose muted">The issuing organisation's publication date is shown separately from the date ARVEEN detected and verified the change. Detected changes do not alter approved content until a reviewer decides.</p>
  ${updatesTable(D.updates)}
  <section class="section"><h2>Linked content flagged for review</h2><div class="list">${D.updates.map(u => `<div class="row"><span class="row-t">${esc(u.title)} ${statusPill(u.state)}</span><span class="row-m">${u.affected.map(a => `<span>${esc(a)}</span>`).join("")}</span><span class="row-m">Reviewer: <span class="na">Unassigned</span> · Decision: <span class="na">Pending</span> · Clinical significance: ${esc(u.significance)}</span></div>`).join("")}</div></section>
  <section class="section"><h2>Subscribe to updates</h2><p class="muted">Subscriptions need an account and are not active in this prototype. Chosen topics are remembered in this browser only.</p>
  <div class="chips">${D.diseases.slice(0, 6).map(d => { const s = store.get("subs", []).includes(d.id); return `<button class="chip" data-sub="${d.id}" aria-pressed="${s}">${esc(d.name)}</button>` }).join("")}</div></section>`;

V.education = () => `<span class="eyebrow">Postgraduate education</span><h1>Staging exercises</h1>
  ${D.notes?.chapters?.length ? `<a class="tile entry" href="${url("notes")}" style="margin:12px 0 18px"><span class="eyebrow">Revision</span><b>Textbook notes: Chapters 37–42</b><span>Searchable chapter notes on uterine, cervical and vaginal, ovarian, vulvar, trophoblastic and breast cancer, with flags where they differ from current guidelines.</span></a>` : ""}
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
  const b = bm(), r = pstore.get("recent", []), n = pstore.get("notes", {});
  const link = x => { const p = { Guideline: "g.", Disease: "d.", Staging: "s.", Protocol: "p.", Drug: "dr.", Trial: "t.", Leaflet: "l.", "Patient page": "ptd.", Article: "a." }[x.type] || ""; const sup = x.type === "Guideline" && byId(D.guidelines, x.id)?.superseded === "superseded"; return `<a class="row" href="${url(`${p}${x.id}`)}"><span class="row-t">${esc(x.title)} ${sup ? '<span class="pill bad">Now superseded</span>' : ""}</span><span class="row-m"><span class="eyebrow">${esc(x.type)}</span>${x.at ? `<span>${x.at}</span>` : ""}</span></a>` };
  return `<span class="eyebrow">${state.aud === "pro" ? "My Workspace" : "Saved"}</span><h1>${state.aud === "pro" ? "My Workspace" : "Things you have saved"}</h1>
  <p class="banner info">${state.user
    ? (state.wsCloud === false ? `Your personal space: bookmarks, recently viewed pages and private notes, kept for your account on this device only (online saving isn't set up yet). No other account can see them.`
      : `Your personal space: bookmarks, recently viewed pages and private notes are saved to <b>your account only</b>. You see them on any device you sign in to; no other user, and no administrator, can read them. Signing out removes them from this computer.`)
    : `Saved pages and notes are kept in this browser on this device only.`}</p>
  ${state.user && legacyCount() ? `<div class="banner slim" id="legacyws"><b>${legacyCount()} item(s) were saved on this computer before workspaces were linked to accounts.</b> They may belong to someone else who used this computer. <button class="btn" type="button" id="ws-import">They're mine: add to my account</button> <button class="btn" type="button" id="ws-discard">Delete them from this computer</button></div>` : ""}
  ${isEditor() ? `<p class="banner slim">Looking for review work, approvals or account requests? They are in your <a href="${url("adminws")}"><b>Admin workspace</b></a>.</p>` : ""}
  <div class="cols"><section class="section"><h2>Bookmarks</h2><div class="list">${b.map(link).join("") || `<div class="row muted">Nothing saved yet. Use ☆ Save on any record.</div>`}</div></section>
  <section class="section"><h2>Recently viewed</h2><div class="list">${r.map(link).join("") || `<div class="row muted">No history yet.</div>`}</div></section></div>
  ${state.aud === "pro" ? `<section class="section"><h2>Private notes</h2><div class="list">${Object.entries(n).filter(([, v]) => v).map(([k, v]) => `<div class="row"><span class="row-t mono">${esc(k)}</span><span>${esc(v)}</span></div>`).join("") || `<div class="row muted">No notes yet.</div>`}</div></section>` : ""}`;
};

/* ---------- two-step sign-in (authenticator app) ---------- */
V.security = () => {
  const staff = staffRole(), on = state.aal === "aal2", hasFactor = state.aalNext === "aal2";
  return `<span class="eyebrow">Account security</span><h1>Two-step sign-in</h1>
  <p class="prose">Two-step sign-in asks for a 6-digit code from an authenticator app on your phone (for example Google Authenticator, Microsoft Authenticator or Authy) as well as your password. ${staff ? "<b>It is required for your role</b>: editor, reviewer and admin tools only work after the second step." : "It is optional for your account and recommended."}</p>
  ${PARAMS.get("need") ? `<p class="banner bad">The page you opened is a staff tool. Complete two-step sign-in below to continue.</p>` : ""}
  <div class="calc authbox" id="mfabox">
    ${on ? `<p class="banner">${statusPill("APPROVED")} Two-step sign-in is <b>on</b> and this session is verified.</p>
      ${safeNext(PARAMS.get("next"), "") ? `<p><a class="btn primary" href="${esc(safeNext(PARAMS.get("next"), ""))}">Continue</a></p>` : ""}
      <details><summary>Remove two-step sign-in</summary><p class="muted">${staff ? "Staff tools will stop working until you set it up again." : ""} You will need to set it up again with a new code.</p><button class="btn" type="button" id="mfa-remove">Remove it</button></details>`
    : hasFactor ? `<h2>Enter your code</h2><p class="muted">Open your authenticator app and enter the 6-digit code for DR ARVEEN.</p>
      <label for="mfa-code">6-digit code<input id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"></label><button class="btn primary" type="button" id="mfa-verify">Verify</button>`
    : `<h2>Set it up</h2><ol class="prose"><li>Install an authenticator app on your phone.</li><li>Click <b>Start</b>, then scan the QR code with the app.</li><li>Type the 6-digit code the app shows, and click <b>Verify</b>.</li></ol>
      <button class="btn primary" type="button" id="mfa-start">Start</button><div id="mfa-enrol" hidden></div>`}
    <p class="result err" role="alert" id="mfa-err" hidden></p></div>
  <p class="muted" style="font-size:.86rem">Lost your phone? An administrator can't see your codes. Contact the site owner, who can remove the second step for your account in Supabase (Authentication → Users → your account → remove the factor).</p>`;
};
function bindSecurity() {
  if (PAGE !== "security" || !sb) return;
  const err = m => { const e = $("#mfa-err"); e.hidden = !m; e.textContent = m || ""; };
  const done = () => { location.href = safeNext(PARAMS.get("next"), "two-step.html"); };
  const start = $("#mfa-start");
  if (start) start.onclick = async () => {
    err(""); start.disabled = true;
    const lf = await sb.auth.mfa.listFactors(); // remove half-finished set-ups first
    for (const f of (lf.data?.all || []).filter(f => f.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "DR ARVEEN " + new Date().toISOString().slice(0, 16) });
    if (error) { start.disabled = false; return err(error.message); }
    const box = $("#mfa-enrol"); box.hidden = false;
    box.innerHTML = `<p><img class="mfa-qr" alt="QR code for your authenticator app" src="${esc(data.totp.qr_code)}" width="200" height="200"></p>
      <p class="muted">Can't scan? Enter this key in the app: <code>${esc(data.totp.secret)}</code></p>
      <label for="mfa-code">6-digit code<input id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label><button class="btn primary" type="button" id="mfa-verify">Verify</button>`;
    bindVerify(data.id);
  };
  const bindVerify = factorId => { const b = $("#mfa-verify"); if (!b) return; b.onclick = async () => {
    err(""); const code = ($("#mfa-code").value || "").replace(/\D/g, "");
    if (code.length !== 6) return err("Enter the 6-digit code from your app.");
    let id = factorId;
    if (!id) { const lf = await sb.auth.mfa.listFactors(); id = (lf.data?.totp || [])[0]?.id; }
    if (!id) return err("No authenticator is set up for this account.");
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: id, code });
    if (error) return err("That code didn't work. Check the time on your phone is correct and try the newest code.");
    done();
  }; };
  bindVerify(null);
  const rm = $("#mfa-remove");
  if (rm) rm.onclick = async () => {
    if (!confirm("Remove two-step sign-in from your account?")) return;
    const lf = await sb.auth.mfa.listFactors();
    for (const f of lf.data?.all || []) { const { error } = await sb.auth.mfa.unenroll({ factorId: f.id }); if (error) return err(error.message); }
    await sb.auth.refreshSession(); location.reload();
  };
}

/* ---------- admin workspace (editors, reviewers, admins): everything needed to run the site ---------- */
V.adminws = () => {
  const role = state.profile?.role || "reader", today = new Date().toISOString().slice(0, 10);
  const all = queueItems(), pend = all.filter(x => !DONE.includes(x.status));
  const doses = pend.filter(x => x.kind === "dose").length, changes = all.filter(x => x.status === "CHANGES NEEDED").length;
  const overdue = Object.values(state.reviews || {}).filter(r => r.next_review && r.next_review < today).length;
  const ptItems = [...(D.leaflets || []).filter(l => (l.sections || []).length).map(l => l.approval), ...(D.articles || []).map(a => a.status)];
  const ptPending = ptItems.filter(s => s !== "APPROVED").length;
  const tile = (n, label, href, tone, sub) => `<a class="tile aw-tile ${tone || ""}" href="${href}"><span class="aw-n" ${n === null ? 'data-live="1"' : ""}>${n === null ? "…" : n}</span><b>${label}</b><span>${sub}</span></a>`;
  const tabs = RQ_TABS.map(([k, l]) => { const its = all.filter(x => x.kind === k), d = its.filter(x => DONE.includes(x.status)).length; return its.length ? `<div class="aw-prog"><span>${l}</span><div class="rq-prog"><span style="width:${(100 * d / its.length).toFixed(1)}%"></span></div><span class="muted">${d} / ${its.length}</span></div>` : ""; }).join("");
  const recentRev = Object.values(state.reviews || {}).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 8);
  const tool = (r, t, d) => `<a class="tile" href="${url(r)}"><b>${t}</b><span>${d}</span></a>`;
  const check = (ok, label, fix) => `<li class="${ok ? "ok" : "todo"}">${ok ? "✓" : "!"} ${label}${ok ? "" : ` <span class="muted">— ${fix}</span>`}</li>`;
  return `<span class="eyebrow">Administration</span><h1>Admin workspace</h1>
  <p class="prose muted">Signed in as <b>${esc(state.profile?.full_name || state.user?.email || "")}</b> · role <span class="pill teal">${esc(role)}</span>${isPharmacist() ? ` <span class="pill ok">Pharmacist: can verify doses</span>` : ""}. This page is only for editors, reviewers and administrators. Your personal bookmarks and notes stay in <a href="${url("workspace")}">My Workspace</a>.</p>
  <section class="section"><h2>Needs your attention</h2><div class="grid aw-grid">
    ${isAdmin() ? tile(null, "Account requests", url("accounts"), "warn", "Professionals waiting for approval").replace('data-live="1"', 'data-live="accounts"') : ""}
    ${isAdmin() ? tile(null, "Reported problems", url("accounts") + "#fblist", "", "Open reports from users").replace('data-live="1"', 'data-live="feedback"') : ""}
    ${isReviewer() ? tile(pend.length, "Items awaiting review", url("review"), "", "Across all sections of the Review queue") : ""}
    ${isReviewer() ? tile(doses, "Doses awaiting a pharmacist", url("review"), doses ? "warn" : "", isPharmacist() ? "You can verify these" : "Only a Pharmacist account can verify") : ""}
    ${tile(changes, "Marked 'Changes needed'", url("review"), changes ? "bad" : "", "Reviewers found a problem to fix")}
    ${tile(overdue, "Reviews overdue", url("review"), overdue ? "bad" : "", "Past their next review date")}
    ${tile(ptPending, "Patient pages not approved", url("cms"), "", "Leaflets and articles still in draft or review")}
  </div></section>
  ${isReviewer() ? `<section class="section"><h2>Review progress by section</h2><div class="aw-progs">${tabs}</div><p><a class="btn primary" href="${url("review")}">Open the Review queue</a></p></section>` : ""}
  <section class="section"><h2>Admin tools</h2><div class="grid">
    ${isReviewer() ? tool("review", "Review queue", "Sign off recommendations, doses, guidelines, pathways, research and textbook notes.") : ""}
    ${tool("cms", "Edit content", "Edit patient articles, leaflets and cancer pages; upload pictures.")}
    ${tool("admin", "Editorial dashboard", "Pipeline view, review tracker and the patient leaflet generator.")}
    ${isAdmin() ? tool("accounts", "Accounts", "Approve professionals, set roles, read reported problems.") : ""}
    ${tool("governance", "Governance", "The written review and approval process to share with reviewers.")}
    ${tool("guide", "Site owner guide", "How content gets onto the site: PDFs, seed.sql, git push.").replace(`href="${url("guide")}"`, `href="${url("guide")}#g-owner"`)}
  </div></section>
  <section class="section"><h2>Recent sign-offs</h2><div class="list">${recentRev.map(r => `<div class="row"><span class="row-t">${esc(r.item_id)} ${statusPill(r.status)}</span><span class="row-m"><span>${esc(r.reviewer)}</span><span>${esc(r.reviewed_on)}</span>${r.note ? `<span>${esc(r.note)}</span>` : ""}</span></div>`).join("") || `<div class="row muted">No sign-offs yet.</div>`}</div></section>
  ${isAdmin() ? `<section class="section"><h2>Backup</h2><p class="prose muted">Sign-offs, online edits to patient pages, reported problems, account records and audit logs exist only in Supabase. Download a dated copy regularly (for example monthly) and keep it somewhere safe and private: it contains staff names and account details. Personal workspaces are not included; only their owners can read them.</p>
    <p><button class="btn primary" type="button" id="aw-backup">Download backup (JSON)</button> <span class="muted" id="aw-backup-msg" role="status"></span></p></section>` : ""}
  ${isAdmin() ? `<section class="section"><h2>Setup check</h2><ul class="aw-check">
    ${check(state.proLoaded, "Professional content loaded from Supabase", "run seed.sql")}
    ${check(!!D.notes?.chapters?.length && !!(D.literature || []).length, "Latest content (research library and textbook notes) loaded", "run the latest seed.sql")}
    ${check(!!state.reviewsTable, "Review table set up (upgrade 4)", "run supabase/upgrade-4-reviews.sql")}
    ${check(!!(D.algorithms || []).find(a => a.id === "A-OV-SUSPECT"), "Clinical pathways loaded", "run the latest seed.sql")}
  </ul><p class="muted" style="font-size:.84rem">Upgrade 5 (signing off textbook notes) can't be detected from here: if saving a notes sign-off fails, run supabase/upgrade-5-notes-review.sql.</p></section>` : ""}`;
};
function bindWorkspace() {
  if (PAGE !== "workspace" || !state.user) return;
  const dropLegacy = () => { try { WS_KEYS.forEach(k => localStorage.removeItem("arveen." + k)); } catch {} };
  const imp = $("#ws-import"), dis = $("#ws-discard");
  if (imp) imp.onclick = () => {
    const l = legacyWs(), bmNow = pstore.get("bm", []), notesNow = pstore.get("notes", {}), recNow = pstore.get("recent", []);
    pstore.set("bm", [...bmNow, ...l.bm.filter(x => !bmNow.some(y => y.id === x.id))]);
    pstore.set("notes", { ...l.notes, ...notesNow });
    pstore.set("recent", [...recNow, ...l.recent.filter(x => !recNow.some(y => y.id === x.id))].slice(0, 12));
    dropLegacy(); render();
  };
  if (dis) dis.onclick = () => { if (confirm("Delete the items saved on this computer before accounts were linked? This can't be undone.")) { dropLegacy(); render(); } };
}
async function bindAdminWs() {
  if (PAGE !== "adminws" || !sb) return;
  const set = (k, v) => { const el = app.querySelector(`[data-live="${k}"]`); if (el) el.textContent = v; };
  const bk = $("#aw-backup");
  if (bk) bk.onclick = async () => {
    const msg = $("#aw-backup-msg"); msg.textContent = "Collecting…"; bk.disabled = true;
    const tables = ["pro_reviews", "pro_review_audit", "patient_items", "content_audit", "feedback", "profiles", "account_audit"], out = { exportedAt: new Date().toISOString(), exportedBy: state.user?.email, site: location.origin + location.pathname.replace(/[^/]*$/, ""), tables: {} }, problems = [];
    for (const t of tables) { const { data, error } = await sb.from(t).select("*"); if (error) problems.push(`${t}: ${error.message}`); else out.tables[t] = data; }
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `dr-arveen-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    msg.textContent = problems.length ? `Downloaded, but some tables were skipped (${problems.join("; ")}). Two-step sign-in may be needed.` : `Downloaded ${Object.values(out.tables).reduce((s, x) => s + (Array.isArray(x) ? x.length : x ? 1 : 0), 0)} records.`; bk.disabled = false;
  };
  if (isAdmin()) {
    const a = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending");
    set("accounts", a.error ? "–" : a.count ?? 0);
    const f = await sb.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open");
    set("feedback", f.error ? "–" : f.count ?? 0);
  }
}

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
  <h2>Your personal workspace</h2><p>When you are signed in, your bookmarks, recently viewed pages and private notes are stored with your account so you can use them on any device. Database rules allow only your own account to read or change them; administrators cannot see them. A copy is kept in your browser while you are signed in and removed when you sign out. Do not put patient-identifiable information in private notes. If you sign off or edit content as a reviewer or editor, your name and the date are recorded with that sign-off.</p>
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
    <div><span class="eyebrow">Status</span><span>${statusPill(rec.status || rec.approval || "NOT VERIFIED")}</span></div>${rec.reviewNote ? `<div><span class="eyebrow">Reviewer note</span><span>${esc(rec.reviewNote)}</span></div>` : ""}
    ${rec.editedAt ? `<div><span class="eyebrow">Edited online</span><span>${esc(String(rec.editedAt).slice(0, 10))}${rec.editedBy ? " by " + esc(rec.editedBy) : ""}${rec.editedAfterReview ? ' <span class="pill warn">Edited after sign-off: needs re-review</span>' : ""}${rec.doseEditedAfterReview ? ' <span class="pill warn">Dose edited: pending pharmacist review again</span>' : ""}</span></div>` : ""}</aside>`;
}
/* Pictures and intros added online: a banner on any page ("page:<route>") and a picture on any record */
const IMG_FIELD = coll => coll === "diseases" ? "refImage" : "image";
function pageExtras(base, arg) {
  const out = [];
  const pe = state.pageEdits?.[base];
  if (pe && (pe.image?.url || pe.intro)) out.push(`<div class="page-extra">${photo(pe.image)}${pe.intro ? `<p class="prose page-intro">${fmt(pe.intro)}</p>` : ""}</div>`);
  const coll = { g: "guidelines", d: "diseases", s: "staging", p: "protocols", dr: "drugs", t: "trials", algorithms: "algorithms" }[base];
  const rec = coll && (base === "algorithms" ? byId(D.algorithms || [], algoId) : byId(D[coll] || [], arg));
  const img = rec && rec[IMG_FIELD(coll)];
  if (img?.url && !app.innerHTML.includes(img.url)) out.push(photo(img));
  if (isEditor() && !["cms", "review", "adminws", "accounts", "security", "login", "register", "reset"].includes(base)) {
    const key = rec ? `edit:${coll}:${rec.id}` : `edit:page:${base}`;
    const car = base === "home" || base === "pt" ? ` <a class="btn" href="${FILES.cms}?id=${encodeURIComponent(`edit:slides:${base === "pt" ? "pt" : "pro"}`)}">✎ Edit the carousel</a>` : base === "portfolio" ? ` <a class="btn" href="${FILES.cms}?id=edit%3Aportfolio%3Amain">✎ Edit the portfolio</a>` : "";
    out.push(`<p class="edit-here"><a class="btn" href="${FILES.cms}?id=${encodeURIComponent(key)}">✎ Edit ${rec ? "this record" : "this page's picture and intro"}</a>${car}</p>`);
  }
  return out.join("");
}

/* ---------- views: patient ---------- */
V.pt = () => `<div class="patient detail">${transBanner()}${carousel("pt")}
  <section class="hero hero-pt"><span class="eyebrow">DR ARVEEN Patient Education Centre</span><h1>Understanding Your Cancer. Understanding Your Care.</h1>
  <p>Clear, reliable information to help you understand your diagnosis, prepare for treatment, manage side effects, and navigate life during and after gynaecological cancer.</p></section>
  <section class="section band start-here"><h2>Start here: where are you now?</h2><p class="muted">Choose one. We'll show you only the guides that matter at this stage.</p>
    <div class="journey">${(D.journey || []).map((j, i) => `<a class="tile jstep" href="${url(`articles`)}?stage=${j.id}"><span class="jnum" aria-hidden="true">${i + 1}</span><b>${esc(j.title)}</b><span>${esc(j.text)}</span><span class="muted jcount">${journeyItems(j.id).length} guides →</span></a>`).join("")}</div>
    <p class="muted" style="margin-top:12px">Know your cancer type? <a href="${url(`ptcancers`)}">Go straight to your cancer</a>. Text too small? Use the <b>A+</b> button at the top.</p></section>
  <form class="bigsearch" id="hs"><input id="hq" type="search" aria-label="Search" placeholder="Or search for your cancer, treatment, test, symptom, or question."><button>Search</button></form>
  <p class="banner slim">This information is still being reviewed by our clinical team and does not replace advice from your own doctors. In an emergency in Malaysia, call <b>999</b>.</p>
  ${continueBlock(["Article", "Leaflet", "Patient page"])}
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
const sectionsHtml = secs => secs.map(([h, ps]) => `<section><h2>${esc(h)}</h2>${ps.length > 1 ? `<ul class="plist">${ps.map(p => `<li>${fmt(p)}</li>`).join("")}</ul>` : `<p>${fmt(ps[0])}</p>`}</section>`).join("");
V.articles = () => {
  const stage = new URLSearchParams(location.search).get("stage") || "";
  const cats = [...new Set((D.articles || []).map(a => a.category))];
  const st = (D.journey || []).find(j => j.id === stage);
  const list = stage ? journeyItems(stage) : null;
  return `<div class="patient detail"><span class="eyebrow">Patient Education Centre</span><h1>${st ? esc(st.title) : "Articles"}</h1>${transBanner()}
  <div class="chips" role="navigation" aria-label="Journey stage"><a class="chip" href="${url(`articles`)}" ${!stage ? 'aria-current="page"' : ""}>All articles</a>${(D.journey || []).map(j => `<a class="chip" href="${url(`articles`)}?stage=${j.id}" ${stage === j.id ? 'aria-current="page"' : ""}>${esc(j.title)}</a>`).join("")}</div>${reviewStrip(true)}
  ${list ? `<p class="prose muted">${esc(st.text)}</p><div class="list">${list.map(x => `<a class="row" href="${url(x.route)}"><span class="row-t">${esc(x.title)} ${listPill(x.status)}</span><span class="row-m"><span class="eyebrow">${esc(x.kind)}</span><span>${esc(x.summary)}</span></span></a>`).join("")}</div>`
  : cats.map(c => `<section class="section"><h2>${esc(c)}</h2><div class="list">${D.articles.filter(a => a.category === c).map(a => `<a class="row" href="${url(`a.${a.id}`)}"><span class="row-t">${esc(a.title)} ${listPill(a.status)}</span><span class="row-m"><span>${esc(a.summary)}</span></span></a>`).join("")}</div></section>`).join("")}</div>`;
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
  <div class="cols">${secs ? secs.map(([h, ps]) => `<section class="section"><h2>${esc(h)}</h2><ul class="plist">${ps.map(p => `<li>${fmt(p)}</li>`).join("")}</ul></section>`).join("")
    : ["What stage means", "Tests you may have", "Treatment options", "Living with and after cancer"].map(h => `<section class="section"><h2>${h}</h2><p class="na">This section is being written and reviewed. Your treating team is the best source of information about this cancer.</p></section>`).join("")}</div>
  <section class="section"><h2>Leaflets</h2><div class="list">${ls.map(l => `<a class="row" href="${url(`l.${l.id}`)}"><span class="row-t">${esc(l.title)} ${listPill(l.approval)}</span></a>`).join("") || `<div class="row muted">No leaflet for this cancer yet.</div>`}</div></section>
  ${arts.length ? `<section class="section"><h2>Articles</h2><div class="list">${arts.map(a => `<a class="row" href="${url(`a.${a.id}`)}"><span class="row-t">${esc(a.title)}</span><span class="row-m"><span>${esc(a.summary)}</span></span></a>`).join("")}</div></section>` : ""}
  <p><a class="btn" href="${url(`sdm`)}">Prepare questions for your doctor →</a></p></article>`;
};
V.leaflets = () => `<div class="patient detail"><span class="eyebrow">Patient information leaflets</span><h1>Information leaflets</h1>${transBanner()}
  <p class="prose muted">Every leaflet follows the same structure, so you always know where to find what to expect, risks, and when to get help.</p>${reviewStrip(true)}
  ${byDisease(D.leaflets, l => l.disease, its => `<div class="list">${its.map(l => `<a class="row" href="${url(`l.${l.id}`)}"><span class="row-t">${esc(l.title)} ${listPill(l.approval)}</span><span class="row-m"><span>${esc(l.audience)}</span><span class="mono">${esc(l.id)} · ${esc(l.version)}</span></span></a>`).join("")}</div>`, true)}</div>`;
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
  <section class="section no-print"><h2>More planning guides</h2><div class="grid">${TOOLS.map(t => `<a class="tile" href="${url(`tool.${t.id}`)}"><b>${esc(t.title)}</b><span>${esc(t.intro.split(". ")[0])}.</span></a>`).join("")}<a class="tile" href="${url(`tracker`)}">${ic("tracker")}<b>Side-effect tracker</b><span>Record how you feel between appointments.</span></a></div></section></div>`;
};
function bindSdm() {
  app.querySelectorAll("[data-sq]").forEach(c => c.onchange = () => { let d = store.get("sdmq", []); const i = +c.dataset.sq; d = c.checked ? [...d, i] : d.filter(x => x !== i); store.set("sdmq", d); });
  app.querySelectorAll("[data-ws]").forEach(t => t.oninput = () => { const w = store.get("ws", {}); w[t.dataset.ws] = t.value; store.set("ws", w); });
}
/* ---------- Dr Arveen portfolio (public; same page on both sides, emphasis by audience) ---------- */
V.portfolio = () => {
  const P = window.ARVEEN_PUBLIC?.portfolio || D.portfolio || {}, ed = isEditor(), pro = state.aud === "pro";
  const has = v => Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim());
  const todo = (label, hint) => ed ? `<section class="section pf-todo"><h2>${esc(label)}</h2><p class="todo">[To be completed by the site owner: ${esc(hint)}]</p></section>` : "";
  const sec = (label, v, hint, render) => has(v) ? `<section class="section"><h2>${esc(label)}</h2>${render(v)}</section>` : todo(label, hint);
  const list = v => `<ul>${v.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const filled = ["summary", "qualifications", "interests", "locations"].filter(k => has(P[k])).length;
  const name = P.name || "Dr Arveen";
  return `<div class="${pro ? "" : "patient "}detail portfolio">
  <section class="hero pf-hero">${P.image?.url && /^https:\/\//.test(P.image.url) ? `<img class="pf-photo" src="${esc(P.image.url)}" alt="${esc(P.image.alt || name)}">` : P.photo && /^https:\/\//.test(P.photo) ? `<img class="pf-photo" src="${esc(P.photo)}" alt="${esc(P.photoAlt || name)}">` : `<div class="pf-photo pf-ph" aria-hidden="true">${esc(name.replace(/^Dr\.?\s*/i, "").charAt(0) || "A")}</div>`}
    <div><span class="eyebrow">${pro ? "For healthcare professionals" : "For patients and families"} · About the doctor</span><h1>${esc(name)}</h1><p class="pf-title">${esc(P.title || "")}</p>${has(P.summary) ? `<p>${esc(P.summary)}</p>` : ""}</div></section>
  ${!filled && !ed ? `<p class="banner info">This profile is being prepared. Please check back soon.</p>` : ""}
  ${ed && filled < 4 ? `<p class="banner">Editor view: empty sections below are hidden from the public. Fill them in with <a href="${FILES.cms}?id=edit%3Aportfolio%3Amain">Edit content → Dr Arveen portfolio</a>. Information must be factual and follow Malaysian Medical Council guidance on information about doctors (no testimonials or claims of superiority).</p>` : ""}
  ${pro ? sec("Referrals", P.referrals, "how clinicians refer: letter or email, MDT, urgent route", v => `<p class="prose">${esc(v)}</p>`) : ""}
  ${sec(pro ? "Clinical interests" : "Areas of care", P.interests, "clinical interests", list)}
  ${sec(pro ? "Services" : "What you can be seen for", P.services, "services offered", list)}
  ${sec(pro ? "Clinics" : "Where to see Dr Arveen and how to make an appointment", P.locations, "clinic name, address, clinic days and appointment phone number", v => `<div class="grid">${v.map(l => `<div class="tile"><b>${esc(l.name || "")}</b>${l.address ? `<span>${esc(l.address)}</span>` : ""}${l.days ? `<span>${esc(l.days)}</span>` : ""}${l.phone ? `<span><a href="tel:${esc(l.phone.replace(/[^\d+]/g, ""))}">${esc(l.phone)}</a></span>` : ""}</div>`).join("")}</div>`)}
  ${sec("Qualifications", P.qualifications, "degrees and specialist training, with institution and year", list)}
  ${sec("Registration", P.registration, "Malaysian Medical Council and National Specialist Register numbers", list)}
  ${pro ? sec("Research and publications", P.research, "publications and trials, with DOI or PubMed ID", list) : ""}
  ${pro ? sec("Teaching", P.teaching, "teaching and training roles", list) : ""}
  ${sec("Professional memberships", P.memberships, "current professional bodies", list)}
  ${sec("Languages", P.languages, "languages spoken with patients", v => `<p>${v.map(esc).join(" · ")}</p>`)}
  ${sec("Enquiries", P.enquiries, "non-clinical contact; state that medical advice is not given by email", v => `<p class="prose">${esc(v)}</p>`)}
  ${!pro ? `<p class="banner slim">If you are unwell or worried about a symptom, contact your treating team. In an emergency in Malaysia, call 999.</p>` : ""}
  <p class="muted" style="font-size:.84rem">${pro ? `Looking for patient information? <a href="patients.html">Patient Education Centre</a>.` : `Healthcare professional? <a href="professional.html">Clinical reference</a>.`} · <a href="${url("about")}">About DR ARVEEN</a></p></div>`;
};

/* ---------- patient planning guides (worksheets saved on this device only) ---------- */
const URGENT_GENERAL = { emergency: ["Chest pain, sudden breathlessness, coughing blood, collapse or fits", "Heavy bleeding that soaks a pad an hour", "Signs of a stroke: face drooping, arm weakness, slurred speech"], urgent: ["Temperature of 38°C or above, or shivering and feeling unwell, during or soon after treatment", "Pain, redness, swelling or discharge from a wound", "Calf pain or swelling in one leg", "Vomiting that stops you keeping fluids down, or not passing urine for 12 hours", "New severe or worsening pain"], routine: ["New symptoms that last more than two weeks", "Tiredness, low mood or worry that is not getting better", "Questions about your medicines"] };
const TOOLS = [
  { id: "diagnosis", title: "Understanding my diagnosis", intro: "A place to write down the details of your diagnosis in your own words, so you can explain it to family and refer back to it. Ask your team to help you fill it in.",
    blocks: [
      { type: "fields", title: "My diagnosis", fields: [["type", "Type of cancer (where it started)"], ["histology", "Cell type, if I was told (e.g. squamous, serous, endometrioid)"], ["stage", "Stage, and what it means for me"], ["grade", "Grade, if I was told"], ["spread", "Has it spread? Where?"]] },
      { type: "checklist", title: "Tests I have had or will have", items: ["Biopsy or tissue sample", "Ultrasound scan", "CT scan", "MRI scan", "PET-CT scan", "Blood tests (for example CA-125 or hCG)", "Genetic tests on my blood (for example BRCA1/BRCA2)", "Tests on the tumour (for example MMR, which can point to Lynch syndrome)", "HPV test or cervical screening result"] },
      { type: "fields", title: "My treatment plan", fields: [["aim", "The aim of treatment (cure, control, comfort), as my team explained it"], ["plan", "Treatments planned, in order"], ["start", "When treatment starts"]] },
      { type: "fields", title: "My team", fields: [["doctor", "My consultant / specialist"], ["nurse", "My specialist nurse or key contact"], ["phone", "Phone number to call with worries (and hours)"], ["hospital", "Hospital and clinic"]] },
      { type: "checklist", title: "Questions I want to ask", items: ["What type of cancer do I have, and where did it start?", "What stage is it, and what does that mean?", "Has it spread to the lymph nodes or elsewhere?", "Do I need genetic testing? Does this affect my family?", "What are my treatment options, and what do you recommend?", "What is the aim of treatment?", "How will treatment affect my daily life, work and family?", "Who do I contact if I have questions between appointments?"] }],
    links: [["ptcancers", "Read about your type of cancer"], ["glossary", "Medical words explained"]] },
  { id: "surgery", title: "Surgery preparation checklist", intro: "Use this before and after your operation. Your hospital's own instructions always come first, especially about fasting and medicines.",
    blocks: [
      { type: "checklist", title: "Questions about my operation", items: ["What operation am I having, and why?", "Will it be open (a cut) or keyhole surgery?", "Will my ovaries be removed? Will I go into menopause?", "How will this affect my fertility?", "Will lymph nodes be removed? What is my risk of lymphoedema (swelling)?", "Is there any chance of a stoma (bag)?", "How long will I be in hospital, and how long is recovery?", "When will I get the results of the tissue tests?"] },
      { type: "checklist", title: "Getting ready (weeks before)", items: ["Stop smoking (ask for help to quit)", "Make a list of all my medicines, including herbal and traditional remedies, and show my team", "Ask whether I should stop any blood thinners or other medicines (don't stop them without advice)", "Keep active and eat well if I can", "Arrange transport home and help at home for the first weeks", "Arrange time off work and any childcare"] },
      { type: "checklist", title: "My hospital bag", items: ["Identity card and hospital documents", "List of medicines (and the medicines themselves)", "Loose, comfortable clothing and high-waisted underwear", "Toiletries, phone and charger", "Something to read or listen to", "Sanitary pads (some bleeding is common after surgery)"] },
      { type: "fields", title: "Instructions from my team", fields: [["date", "Date and time of admission"], ["fasting", "When to stop eating and drinking"], ["meds", "Medicines to take or stop before surgery"]] },
      { type: "checklist", title: "After the operation", items: ["Get up and walk as soon as the team says it is safe", "Do deep-breathing and leg exercises", "Take pain relief regularly as prescribed", "Keep the wound clean and dry; watch for redness or discharge", "Avoid heavy lifting for as long as advised", "Ask when I can drive, return to work and have sex", "Know the date of my results appointment"] }],
    safety: true },
  { id: "chemo", title: "Chemotherapy diary", intro: "Record each treatment and how you feel day by day. Bring this to every appointment: it helps your team adjust treatment and manage side effects.",
    blocks: [
      { type: "fields", title: "My treatment", fields: [["regimen", "Name of my treatment (as written by my team)"], ["cycle", "How often (e.g. every 3 weeks) and how many cycles"], ["hotline", "24-hour chemotherapy helpline number"]] },
      { type: "banner", text: "If your temperature is 38°C or above, or you feel shivery or suddenly unwell, call your chemotherapy helpline straight away, even at night. Infection during chemotherapy can be serious." },
      { type: "log", id: "days", title: "Daily diary", cols: [["date", "Date"], ["cycle", "Cycle / day"], ["temp", "Temperature (°C)"], ["feel", "How I feel (0 = very bad, 10 = very good)"], ["symptoms", "Symptoms"], ["meds", "Medicines taken (e.g. anti-sickness)"]] },
      { type: "checklist", title: "Every day during treatment", items: ["Drink plenty of fluids", "Clean my mouth gently after meals; tell my team about mouth sores", "Wash my hands often; avoid people with infections", "Check my temperature if I feel unwell", "Rest, but try some gentle activity", "Write down questions for my next appointment"] }],
    safety: true, links: [["tracker", "Side-effect tracker"], ["l.PIL-TX-CHEMO", "Leaflet: Understanding chemotherapy"]] },
  { id: "fertility", title: "Fertility discussion guide", intro: "Some treatments affect the ability to have children. Options to protect fertility usually need to be discussed before treatment starts, so ask early.",
    blocks: [
      { type: "checklist", title: "Questions to ask my cancer team", items: ["Will my treatment affect my fertility or bring on menopause?", "Is a fertility-sparing treatment possible for my type and stage of cancer?", "What are the risks of fertility-sparing treatment compared with standard treatment?", "Can I be referred to a fertility specialist before treatment starts?", "Is there time to freeze eggs or embryos before treatment?", "If I need pelvic radiotherapy, can my ovaries be moved out of the way (ovarian transposition)?", "Which contraception should I use during treatment?", "How long should I wait after treatment before trying to get pregnant?"] },
      { type: "checklist", title: "Questions for a fertility specialist", items: ["Which options suit my age and situation?", "How long does each option take, and would it delay my cancer treatment?", "What are the chances of success?", "What does it cost, and is any of it covered?"] },
      { type: "fields", title: "My thoughts", fields: [["wishes", "How important having children (or more children) is to me"], ["partner", "What my partner or family think"], ["decided", "What we decided, and next steps"]] }],
    links: [["ptcancers", "Read about your type of cancer"]] },
  { id: "menopause", title: "Menopause and sexual health guide", intro: "Treatment can bring on menopause and change your sex life and body image. These changes are common, and help is available: you can raise them with your team.",
    blocks: [
      { type: "info", title: "Why this can happen", items: ["Removing both ovaries causes immediate menopause.", "Pelvic radiotherapy and some chemotherapy can stop the ovaries working.", "Surgery and radiotherapy can make the vagina shorter, narrower or drier."] },
      { type: "checklist", title: "Changes I have noticed", items: ["Hot flushes or night sweats", "Poor sleep", "Mood changes or low mood", "Vaginal dryness or itching", "Pain during sex", "Less interest in sex", "Changes in how I feel about my body", "Bladder changes (urgency, leaks)"] },
      { type: "checklist", title: "Questions to ask", items: ["Is hormone replacement therapy (HRT) safe for my type of cancer? (For some cancers it is, for others it is not.)", "What non-hormonal treatments can help hot flushes?", "Which vaginal moisturisers or lubricants can I use?", "Should I use vaginal dilators after radiotherapy? How and for how long?", "Do I need a bone density check?", "When is it safe to have sex again?", "Can I be referred to a psychosexual counsellor or women's health physiotherapist?"] },
      { type: "fields", title: "Notes for my next appointment", fields: [["notes", "What I want to discuss"]] }],
    links: [["articles", "Articles on menopause and relationships"]] },
  { id: "followup", title: "Follow-up planner", intro: "After treatment you will have regular check-ups. The schedule depends on your cancer and treatment: often every 3–6 months for the first years, then less often. Keep track here.",
    blocks: [
      { type: "log", id: "visits", title: "My appointments", cols: [["date", "Date"], ["where", "Clinic / doctor"], ["tests", "Tests planned"], ["result", "What I was told"], ["next", "Next appointment"]] },
      { type: "checklist", title: "Symptoms to report between appointments (don't wait for the next visit)", items: ["Bleeding from the vagina or after sex, or blood in urine or stool", "A new lump or swelling (including in the groin or neck)", "Pain that does not go away", "Bloating, feeling full quickly or a change in bowel habit lasting more than two weeks", "A persistent cough or breathlessness", "Swelling of a leg", "Losing weight without trying"] },
      { type: "fields", title: "Questions for my next check-up", fields: [["q", "Questions"]] }],
    safety: true },
  { id: "caregiver", title: "Caregiver guide", intro: "For family members and friends supporting someone with gynaecological cancer. Caring is valuable, and it can be tiring: look after yourself too.",
    blocks: [
      { type: "checklist", title: "Practical ways to help", items: ["Go to appointments and take notes", "Keep a list of medicines and treatment dates", "Help with transport, meals, housework or childcare", "Keep the treating team's contact numbers handy", "Help track side effects (the side-effect tracker or chemotherapy diary)", "Share updates with family so the patient doesn't have to repeat everything"] },
      { type: "checklist", title: "Looking after myself", items: ["Accept offers of help and share tasks", "Take regular breaks", "Talk to someone I trust about how I feel", "Ask the hospital's medical social worker about financial, work or practical support", "Ask about local cancer support groups for carers"] },
      { type: "checklist", title: "Talking together", items: ["Ask what kind of support they want, rather than assuming", "It is fine to say you don't know what to say", "Ask the team for help talking with children about cancer", "If your relative agrees, ask the team whether you can be told about their care"] },
      { type: "fields", title: "Useful contacts", fields: [["team", "Treating team and specialist nurse"], ["hotline", "Chemotherapy or ward helpline"], ["social", "Medical social worker"], ["support", "Support groups and others who can help"]] }],
    safety: true }];
V.tool = id => {
  const t = TOOLS.find(x => x.id === id);
  if (!t) return `<div class="patient detail"><span class="eyebrow">Planning guides</span><h1>Planning guides</h1><div class="grid">${TOOLS.map(x => `<a class="tile" href="${url(`tool.${x.id}`)}"><b>${esc(x.title)}</b><span>${esc(x.intro.split(". ")[0])}.</span></a>`).join("")}</div></div>`;
  recent("Guide", t.id, t.title);
  const s = store.get("tool." + t.id, { c: {}, f: {}, l: {} });
  const block = (b, bi) => {
    if (b.type === "banner") return `<p class="banner bad">${esc(b.text)}</p>`;
    if (b.type === "info") return `<section class="section"><h2>${esc(b.title)}</h2><ul class="plist">${b.items.map(x => `<li>${fmt(x)}</li>`).join("")}</ul></section>`;
    if (b.type === "checklist") return `<section class="section"><h2>${esc(b.title)}</h2><div class="checklist">${b.items.map((x, i) => { const k = `${bi}.${i}`; return `<label><input type="checkbox" data-tc="${k}" ${s.c[k] ? "checked" : ""}> ${esc(x)}</label>`; }).join("")}</div></section>`;
    if (b.type === "fields") return `<section class="section"><h2>${esc(b.title)}</h2><div class="calc tool-fields">${b.fields.map(([k, l]) => `<label>${esc(l)}<textarea rows="2" data-tf="${bi}.${k}">${esc(s.f[`${bi}.${k}`] || "")}</textarea></label>`).join("")}</div></section>`;
    if (b.type === "log") { const rows = s.l[b.id] || [];
      return `<section class="section"><h2>${esc(b.title)}</h2>
        <form class="calc tool-log no-print" data-tl="${b.id}"><div class="fields">${b.cols.map(([k, l]) => `<label>${esc(l)}<input name="${k}" ${k === "date" ? `value="${new Date().toISOString().slice(0, 10)}"` : ""}></label>`).join("")}</div><div><button class="btn primary">Add entry</button></div></form>
        <div class="tablewrap"><table><thead><tr>${b.cols.map(([, l]) => `<th>${esc(l)}</th>`).join("")}<th class="no-print"></th></tr></thead><tbody>${rows.map((r, i) => `<tr>${b.cols.map(([k]) => `<td>${esc(r[k] || "")}</td>`).join("")}<td class="no-print"><button class="btn" type="button" data-tldel="${b.id}.${i}">Delete</button></td></tr>`).join("") || `<tr><td colspan="${b.cols.length + 1}" class="muted">No entries yet.</td></tr>`}</tbody></table></div></section>`; }
    return "";
  };
  const S = URGENT_GENERAL;
  return `<div class="patient detail"><span class="eyebrow">Planning guide</span><h1>${esc(t.title)}</h1>${transBanner()}
    <div class="actions no-print">${bmBtn("Guide", t.id, t.title)}<button class="btn" type="button" data-print>Print or save as PDF</button><button class="btn" type="button" id="tool-clear">Clear my entries</button></div>
    <p class="prose">${esc(t.intro)}</p>
    <p class="banner slim">What you tick and type stays only on this device and is not sent to DR ARVEEN. This guide is still being reviewed by our clinical team and does not replace advice from your own doctors. ${statusPill("DRAFT")}</p>
    ${t.blocks.map(block).join("")}
    ${t.safety ? `<section class="section"><h2>When should I get help?</h2><div class="safety">
      <div class="em"><b>Emergency: call 999 now</b><ul>${S.emergency.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="ur"><b>Urgent: contact your treating team or helpline promptly</b><ul>${S.urgent.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="ro"><b>Routine: mention at your next appointment</b><ul>${S.routine.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div></section>` : ""}
    ${t.links?.length ? `<section class="section no-print"><h2>Related</h2><div class="chips">${t.links.map(([r, l]) => `<a class="chip" href="${url(r)}">${esc(l)}</a>`).join("")}</div></section>` : ""}
    <p class="print-only print-foot">DR ARVEEN Patient Education Centre · ${esc(t.title)} · printed ${new Date().toISOString().slice(0, 10)}. General information that does not replace advice from your own treating team. In an emergency in Malaysia, call 999.</p></div>`;
};
function bindTool() {
  if (PAGE !== "tool") return; const id = PARAMS.get("id"); if (!TOOLS.find(x => x.id === id)) return;
  const key = "tool." + id, get = () => store.get(key, { c: {}, f: {}, l: {} }), put = s => store.set(key, s);
  app.querySelectorAll("[data-tc]").forEach(c => c.onchange = () => { const s = get(); s.c[c.dataset.tc] = c.checked; put(s); });
  app.querySelectorAll("[data-tf]").forEach(t => t.oninput = () => { const s = get(); s.f[t.dataset.tf] = t.value; put(s); });
  app.querySelectorAll("[data-tl]").forEach(f => f.onsubmit = e => { e.preventDefault(); const row = Object.fromEntries([...f.querySelectorAll("input")].map(i => [i.name, i.value.trim()]));
    if (!Object.entries(row).some(([k, v]) => k !== "date" && v)) return; const s = get(); (s.l[f.dataset.tl] = s.l[f.dataset.tl] || []).push(row); put(s); render(); });
  app.querySelectorAll("[data-tldel]").forEach(b => b.onclick = () => { const [lid, i] = b.dataset.tldel.split("."); const s = get(); s.l[lid].splice(+i, 1); put(s); render(); });
  const clr = $("#tool-clear"); if (clr) clr.onclick = () => { if (confirm("Clear everything you have ticked and typed in this guide on this device?")) { try { localStorage.removeItem("arveen." + key); } catch {} render(); } };
}
V.tracker = () => {
  const rows = store.get("fx", []);
  return `<div class="patient detail"><span class="eyebrow">Shared decision-making</span><h1>Side-effect tracker</h1>
  <div class="no-print toc"><button class="btn" type="button" data-print>Print my entries</button>${rows.length ? `<button class="btn" type="button" id="fx-clear">Delete all entries from this device</button>` : ""}</div>
  <p class="muted no-print" style="font-size:.86rem">Your entries are kept only in this browser on this device. On a shared or family computer, delete them when you have finished.</p>
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
  const fc = $("#fx-clear"); if (fc) fc.onclick = () => { if (confirm("Delete all your side-effect entries from this device? This cannot be undone.")) { store.set("fx", []); render(); } };
  app.querySelectorAll("[data-fxdel]").forEach(b => b.onclick = () => { const r = store.get("fx", []); r.splice(+b.dataset.fxdel, 1); store.set("fx", r); render(); });
}
V.glossary = () => `<div class="patient detail"><span class="eyebrow">Medical glossary</span><h1>Medical words explained</h1>${transBanner()}
  <input type="text" id="gq" placeholder="Find a word" aria-label="Find a word" style="max-width:360px">
  <div class="list" id="gl">${D.glossary.map(([t, d]) => `<div class="row" data-term="${esc((t + " " + d).toLowerCase())}"><span class="row-t">${esc(t)}</span><span>${esc(d)}</span></div>`).join("")}</div></div>`;

V.search = () => {
  const all = search(state.q);
  const aud = state.filters.saud || "all", stype = state.filters.stype || "", sdis = state.filters.sdis || "";
  const types = [...new Set(all.map(r => r.type))], dises = [...new Set(all.map(r => r.dis).filter(d => d && d !== "all"))].sort((a, b) => DIS_ORDER(a) - DIS_ORDER(b));
  const res = all.filter(r => (!stype || r.type === stype) && (!sdis || r.dis === sdis || r.dis === "all"));
  const pro = res.filter(r => r.aud === "pro"), pt = res.filter(r => r.aud === "pt");
  const MAX = 60;
  const block = (t, l) => l.length ? `<section class="section"><h2>${t} <span class="muted" style="font-size:.9rem">${l.length}</span></h2><div class="list">${l.slice(0, MAX).map(r => resultRow(r, hq)).join("")}</div>${l.length > MAX ? `<p class="muted">Showing the best ${MAX} of ${l.length}. Narrow by type or cancer above, or add a word.</p>` : ""}</section>` : "";
  const fix = all.corrections || []; const hq = [state.q, ...fix.map(f => f[1])].join(" ");
  return `<span class="eyebrow">Search</span><h1>Results for “${esc(state.q)}”</h1>
  ${fix.length ? `<p class="banner info">Showing results for ${fix.map(([a, b]) => `<b>${esc(b)}</b> (you typed “${esc(a)}”)`).join(", ")}.</p>` : ""}
  <div class="search-filters">
    <div class="chips" role="group" aria-label="Audience">${[["all", "All audiences"], ["pro", "Professional clinical"], ["pt", "Patient education"]].map(([k, t]) => `<button class="chip" data-saud="${k}" aria-pressed="${aud === k}">${t}</button>`).join("")}</div>
    ${types.length > 1 ? `<div class="chips" role="group" aria-label="Type"><button class="chip" data-stype="" aria-pressed="${!stype}">All types</button>${types.map(ty => `<button class="chip" data-stype="${esc(ty)}" aria-pressed="${stype === ty}">${esc(ty)} <span class="muted">${all.filter(r => r.type === ty).length}</span></button>`).join("")}</div>` : ""}
    ${dises.length > 1 ? `<label class="search-dis">Cancer <select id="sdis"><option value="">All cancers</option>${dises.map(d => `<option value="${esc(d)}" ${sdis === d ? "selected" : ""}>${esc(dname(d))}</option>`).join("")}</select></label>` : ""}
  </div>
  ${!state.proLoaded ? `<p class="banner info">Showing patient education results. <a href="login.html?next=${encodeURIComponent("search.html?q=" + state.q)}">Sign in</a> as an approved healthcare professional to search guidelines, staging, protocols, drugs and trials.</p>` : ""}
  ${!res.length ? `<p class="muted">No results. Try a disease name, a drug, an organisation (ESGO, FIGO) or a stage such as IIIC.</p>` : ""}
  ${aud !== "pt" ? block("Professional clinical results", pro) : ""}${aud !== "pro" ? block("Patient education results", pt) : ""}`;
};
const notFound = () => `<h1>Record not found</h1><p><a href="index.html">Return home</a></p>`;

/* ---------- views: welcome, accounts, governance ---------- */
V.welcome = () => `<section class="hero hero-welcome"><span class="eyebrow">Gynaecological oncology · Malaysia</span>
  <h1 class="brand-title"><span class="bt-name">DR ARVEEN</span><span class="bt-full"><span class="bt-line">Advanced Reference and Verified Evidence Network</span> <span class="bt-line">for Gynaecological Oncology</span></span></h1>
  <p>Clinical guidelines, staging, treatment protocols and trial evidence for healthcare professionals, and clear, reliable information for patients and the people who care for them.</p></section>
  <div class="cols">
    <a class="tile entry" href="professional.html"><span class="eyebrow">For healthcare professionals</span><b>Clinical reference</b><span>Guidelines, recommendations, FIGO staging, protocols, drug monographs, trials, calculators and education. Sign-in required: accounts are approved after we verify your professional registration.</span><span class="btn primary">${state.user ? "Open the clinical reference" : "Sign in"}</span></a>
    <a class="tile entry" href="patients.html"><span class="eyebrow">For patients and caregivers</span><b>Patient Education Centre</b><span>Understand your diagnosis, prepare for treatment and appointments, and track side effects. No account needed.</span><span class="btn">Go to patient information</span></a>
  </div>
  <p class="banner info"><b>New here or not sure where to go?</b> The <a href="guide.html">Site guide</a> lists every page, what it is for and how to use it.</p>
  <p class="muted"><a href="governance.html">How DR ARVEEN checks and approves its information</a></p>`;
V.login = () => !sb ? `<h1>Sign in</h1>${notConfigured()}` : state.user ? `<h1>You're signed in</h1><p><a class="btn primary" href="professional.html">Open the clinical reference</a></p>` : `<span class="eyebrow">Healthcare professionals</span><h1>Sign in</h1>${loginForm()}`;
V.register = () => !sb ? `<h1>Request an account</h1>${notConfigured()}` : `<span class="eyebrow">Healthcare professionals</span><h1>Request an account</h1>
  <p class="prose muted">Accounts are for registered healthcare professionals. After you confirm your email, an administrator checks your registration with the relevant Malaysian board or council before approving access. Patients don't need an account.</p>
  <form class="calc authbox" id="regf">
    <label for="rg-name">Full name<input id="rg-name" type="text" autocomplete="name" required></label>
    <label for="rg-email">Work email<input id="rg-email" type="email" autocomplete="email" required></label>
    <label for="rg-pass">Password (at least 10 characters, with upper- and lower-case letters and a number)<input id="rg-pass" type="password" autocomplete="new-password" required></label>
    <label for="rg-prof">Profession<select id="rg-prof"><option>Doctor</option><option>Pharmacist</option><option>Nurse</option><option>Medical trainee</option><option>Other healthcare professional</option></select></label>
    <label for="rg-body">Registering body<select id="rg-body"><option>Malaysian Medical Council (MMC)</option><option>Pharmacy Board Malaysia</option><option>Malaysia Nursing Board</option><option>Other</option></select></label>
    <label for="rg-num">Registration number<input id="rg-num" type="text" required></label>
    <label for="rg-inst">Hospital or institution<input id="rg-inst" type="text" required></label>
    <label class="check" for="rg-agree"><input id="rg-agree" type="checkbox"> I confirm I am a registered healthcare professional, and I agree that DR ARVEEN stores these details to verify my registration, as described on the <a href="governance.html#privacy">governance page</a>.</label>
    <p class="result err" role="alert" id="autherr" hidden></p>
    <div class="captcha-box" data-captcha></div><div class="toc"><button class="btn primary" type="submit">Request account</button><a class="btn" href="login.html">I already have an account</a></div>
  </form><p class="banner info" id="authok" role="status" hidden></p>`;
V.reset = () => !sb ? `<h1>Reset password</h1>${notConfigured()}` : `<span class="eyebrow">Account</span><h1>Reset your password</h1>
  ${state.user ? `<form class="calc authbox" id="newpassf"><label for="np-pass">New password (at least 10 characters, with upper- and lower-case letters and a number)<input id="np-pass" type="password" autocomplete="new-password" required></label><p class="result err" role="alert" id="autherr" hidden></p><div><button class="btn primary" type="submit">Save new password</button></div></form>`
  : `<form class="calc authbox" id="resetf"><label for="rs-email">Email<input id="rs-email" type="email" autocomplete="email" required></label><p class="result err" role="alert" id="autherr" hidden></p><div class="captcha-box" data-captcha></div><div><button class="btn primary" type="submit">Send reset link</button></div></form>`}
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
  <section class="section" id="privacy"><h2>6. Privacy for account holders</h2><p class="prose">DR ARVEEN stores your name, email, profession, registering body, registration number and institution only to verify your registration and manage access. It does not store patient information. You can ask to see, correct or delete your details. Your bookmarks and private notes are stored with your account and can be read only by you (administrators cannot see them); they are removed from the computer when you sign out. Side-effect tracker entries for patients stay in the browser only.</p></section>
  <section class="section"><h2>7. Approvals needed before public launch</h2>
    <p class="banner">This checklist is a starting point, not legal advice. Confirm each item with a Malaysian lawyer and the relevant authority.</p>
    ${govTable(["Approval", "What to do"], GOV_LAUNCH)}</section></article>`;

/* On phones, wide tables become stacked cards: each cell gets its column name as a label. */
function stackTables() {
  app.querySelectorAll(".tablewrap table").forEach(t => {
    const heads = [...t.querySelectorAll("thead th")].map(th => th.textContent.trim());
    if (heads.length < 3) return;
    t.classList.add("stack");
    t.querySelectorAll("tbody tr").forEach(tr => [...tr.children].forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; }));
  });
}

/* Search as you type (header box): top matches grouped by type */
let sugTimer;
function bindSuggest() {
  const q = $("#mq"), form = $("#msearch"); if (!q || q.dataset.bound) return; q.dataset.bound = "1";
  const box = document.createElement("div"); box.className = "suggest"; box.id = "msuggest"; box.hidden = true; box.setAttribute("role", "listbox"); form.appendChild(box);
  q.setAttribute("autocomplete", "off"); q.setAttribute("aria-controls", "msuggest");
  const close = () => { box.hidden = true; q.setAttribute("aria-expanded", "false"); };
  q.addEventListener("input", () => { clearTimeout(sugTimer); sugTimer = setTimeout(() => {
    const term = q.value.trim(); if (term.length < 2 || !IDX.length) return close();
    const found = search(term), hits = found.slice(0, 40), groups = {};
    for (const h of hits) { (groups[h.type] = groups[h.type] || []).length < 3 && groups[h.type].push(h); }
    const keys = Object.keys(groups).slice(0, 5);
    const fix = found.corrections?.length ? `<div class="sg-fix">Showing results for ${found.corrections.map(([, b]) => `<b>${esc(b)}</b>`).join(", ")}</div>` : "";
    box.innerHTML = keys.length ? fix + keys.map(k => `<div class="sg-h">${esc(k)}</div>${groups[k].map(h => `<a role="option" href="${esc(h.href || url(h.route))}">${hlTitle(h.title.length > 90 ? h.title.slice(0, 88) + "…" : h.title, [term, ...(found.corrections || []).map(f => f[1])].join(" "))}<span class="muted">${esc(h.meta || "")}</span></a>`).join("")}`).join("") + `<a class="sg-all" href="search.html?q=${encodeURIComponent(term)}">See all ${found.length > 40 ? found.length : hits.length} results →</a>`
      : `<div class="sg-h">No matches</div><a class="sg-all" href="search.html?q=${encodeURIComponent(term)}">Search anyway →</a>`;
    box.hidden = false; q.setAttribute("aria-expanded", "true");
  }, 120); });
  q.addEventListener("keydown", e => { if (e.key === "ArrowDown" && !box.hidden) { e.preventDefault(); box.querySelector("a")?.focus(); } if (e.key === "Escape") close(); });
  box.addEventListener("keydown", e => {
    const links = [...box.querySelectorAll("a")], i = links.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); links[Math.min(i + 1, links.length - 1)]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); i <= 0 ? q.focus() : links[i - 1].focus(); }
    if (e.key === "Escape") { close(); q.focus(); }
  });
  document.addEventListener("click", e => { if (!form.contains(e.target)) close(); });
}

/* ---------- router ---------- */
function render() {
  const base = PAGE, arg = PARAMS.get("id") || "";
  renderNav();
  const view = V[base]; app.innerHTML = view ? view(arg) : notFound();
  const extra = view ? pageExtras(base, arg) : "";
  if (extra) { const h = app.querySelector(".hero h1, h1"); const anchor = h && (h.closest(".hero, .section-h, .dhead") || h); anchor ? anchor.insertAdjacentHTML("afterend", extra) : app.insertAdjacentHTML("afterbegin", extra); }
  stackTables();
  const h1 = app.querySelector("h1"); if (h1 && !["home", "pt", "welcome"].includes(base)) document.title = h1.textContent.trim() + " · DR ARVEEN";
  const rec = REVIEW_SRC[base] && (D[REVIEW_SRC[base]] || []).find(x => x.id === arg);
  if (rec) app.insertAdjacentHTML("beforeend", reviewBlock(rec));
  $("#mq").value = base === "search" ? state.q : "";
  const hs = $("#hs"); if (hs) hs.onsubmit = e => { e.preventDefault(); state.q = $("#hq").value.trim(); go("search"); };
  app.querySelectorAll("[data-q]").forEach(c => c.onclick = () => { state.q = c.dataset.q; go("search"); });
  app.querySelectorAll("[data-print]").forEach(b => b.onclick = () => window.print());
  app.querySelectorAll("[data-showlang]").forEach(b => b.onclick = () => { state.lang = b.dataset.showlang; store.set("lang", state.lang); $("#lang").value = state.lang; render(); });
  app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { store.set("dmode", b.dataset.mode); render(); });
  app.querySelectorAll("[data-recmode]").forEach(b => b.onclick = () => { state.filters.recMode = b.dataset.recmode; store.set("recMode", b.dataset.recmode); render(); });
  app.querySelectorAll("[data-td]").forEach(b => b.onclick = () => { state.filters.trialDisease = b.dataset.td; render(); });
  app.querySelectorAll("[data-saud]").forEach(b => b.onclick = () => { state.filters.saud = b.dataset.saud; render(); });
  app.querySelectorAll("[data-stype]").forEach(b => b.onclick = () => { state.filters.stype = b.dataset.stype; render(); });
  const sd = $("#sdis"); if (sd) sd.onchange = () => { state.filters.sdis = sd.value; render(); };
  app.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => { let s = store.get("subs", []); s = s.includes(b.dataset.sub) ? s.filter(x => x !== b.dataset.sub) : [...s, b.dataset.sub]; store.set("subs", s); b.setAttribute("aria-pressed", s.includes(b.dataset.sub)); });
  const toLast = () => requestAnimationFrame(() => { const l = $("#algo-last"); if (l) { l.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); l.querySelector("button, a")?.focus({ preventScroll: true }); } });
  app.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { algoPath = algoPath.slice(0, +b.dataset.step + 1).concat(b.dataset.to); render(); toLast(); });
  const ar = $("#algoreset"); if (ar) ar.onclick = () => { algoPath = []; render(); };
  app.querySelectorAll("[data-algoview]").forEach(b => b.onclick = () => { algoView = b.dataset.algoview; store.set("algoView", algoView); render(); });
  const fw = $(".flow-wrap"); if (fw) requestAnimationFrame(() => { const root = fw.querySelector(".flow > ul > li > .fbox"); if (root) fw.scrollLeft = Math.max(0, root.offsetLeft + root.offsetWidth / 2 - fw.clientWidth / 2); });
  const ab = $("#algoback"); if (ab) ab.onclick = () => { algoPath = algoPath.slice(0, -1); render(); toLast(); };
  app.querySelectorAll("[data-algo]").forEach(b => b.onclick = () => { algoId = b.dataset.algo; algoPath = []; history.replaceState(null, "", "?id=" + encodeURIComponent(algoId)); render(); });
  const cq = $("#cmpq"); if (cq) cq.onchange = () => { state.filters.cmp = cq.value; render(); };
  const sf = $("#sfilter"); if (sf) sf.oninput = () => { const q = sf.value.toLowerCase(); $("#stree").querySelectorAll(".stage").forEach(s => { s.hidden = q && !s.textContent.toLowerCase().includes(q); }); };
  const gq = $("#gq"); if (gq) gq.oninput = () => app.querySelectorAll("[data-term]").forEach(r => r.hidden = !r.dataset.term.includes(gq.value.toLowerCase()));
  bindFilters(); bindCalcs(); bindQuiz(); bindGen(); bindSdm(); bindTracker(); bindAuth(); bindCms(); bindReview(); bindNotes(); bindAdminWs(); bindWorkspace(); bindSecurity(); bindTool(); bindCarousel();
}
/* ---------- textbook study notes (Berek & Novak's, Ch 37–42), professional only ---------- */
V.notes = () => {
  const N = D.notes;
  if (!N?.chapters?.length) return `<span class="eyebrow">Education</span><h1>Textbook notes</h1><p class="banner">The notes have not been loaded yet. The site owner needs to run the latest seed.sql in Supabase.</p>`;
  const rail = N.chapters.map(c => `<a href="#nb-${c.id}" class="nrail-a">${badge(c.disease === "all" ? "all" : c.disease)}<span><b>Ch ${c.n}</b> ${esc(c.short)}</span></a>`).join("");
  const flagBox = c => c.flags?.length ? `<details class="nflags" open><summary><b>Check against current guidance</b> <span class="muted">${c.flags.length} point${c.flags.length > 1 ? "s" : ""} where these notes differ from guidelines on DR ARVEEN</span></summary><ul>${c.flags.map(([t, d, link]) => `<li><b>${esc(t)}:</b> ${esc(d)}${link ? ` <a href="${url(link)}">Open on DR ARVEEN →</a>` : ""}</li>`).join("")}</ul></details>` : "";
  return `<span class="eyebrow">Education · Textbook study notes</span><h1>Gynaecologic oncology notes</h1>
  <p class="prose">Chapter notes on uterine, cervical and vaginal, ovarian, vulvar, gestational trophoblastic and breast cancer: staging tables, landmark trials and treatment by stage.</p>
  <p class="banner slim">${esc(N.source)} For learning, not for clinical decisions: textbook content can be older than current guidelines, so each chapter lists where it differs from guidance on this site. Doses in these notes are not pharmacist-verified. ${statusPill(N.reviewStatus || N.status)}</p>
  <div class="nsearch"><label for="nq">Search the notes</label><input id="nq" type="search" placeholder="Try LACC, BRCA, Sedlis, p57, EMA-CO" autocomplete="off"><output id="ncount" for="nq"></output></div>
  <div class="nlayout"><nav class="nrail" aria-label="Chapters">${rail}</nav>
  <div class="nmain"><p class="banner" id="nempty" hidden>No section matches that search. Try a shorter term, such as a trial name or a gene.</p>
  ${N.chapters.map(c => `<article class="nchap" id="nb-${c.id}"><div class="nchap-h">${badge(c.disease === "all" ? "all" : c.disease, true)}<div><span class="eyebrow">Chapter ${c.n}</span><h2>${esc(c.title)}</h2><p class="muted">${esc(c.byline)}</p><div class="row-m">${statusPill(c.status || "NOT VERIFIED")}${c.reviewer ? ` <span class="muted">Reviewed by ${esc(c.reviewer)}, ${esc(c.verifiedOn)}${c.reviewNote ? ` — ${esc(c.reviewNote)}` : ""}</span>` : ""}</div></div></div>
    ${photo(c.image)}${isEditor() ? `<p class="edit-here"><a class="btn" href="${FILES.cms}?id=${encodeURIComponent("edit:notes:" + c.id)}">✎ Edit this chapter's details or picture</a></p>` : ""}${flagBox(c)}${c.html}</article>`).join("")}</div></div>`;
};
function bindNotes() {
  if (PAGE !== "notes" || !D.notes) return;
  const input = $("#nq"), out = $("#ncount"), empty = $("#nempty"), blocks = [...app.querySelectorAll("section.nblock")], originals = blocks.map(b => b.innerHTML);
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mark = (el, re) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(t => { re.lastIndex = 0; if (!re.test(t.nodeValue)) return; re.lastIndex = 0; const f = document.createDocumentFragment(); let last = 0, m;
      while ((m = re.exec(t.nodeValue))) { f.appendChild(document.createTextNode(t.nodeValue.slice(last, m.index))); const k = document.createElement("mark"); k.textContent = m[0]; f.appendChild(k); last = m.index + m[0].length; }
      f.appendChild(document.createTextNode(t.nodeValue.slice(last))); t.parentNode.replaceChild(f, t); });
  };
  const run = () => {
    const q = input.value.trim(), re = q.length > 1 ? new RegExp(escRe(q), "gi") : null; let shown = 0;
    blocks.forEach((b, i) => { b.innerHTML = originals[i]; let hit = true; if (re) { hit = re.test(b.textContent); re.lastIndex = 0; } b.hidden = !hit; if (hit) { shown++; if (re) mark(b, re); } });
    app.querySelectorAll("article.nchap").forEach(a => a.hidden = !!re && !a.querySelector("section.nblock:not([hidden])"));
    app.querySelectorAll("h2.npart, .nflags").forEach(h => h.hidden = !!re);
    out.value = re ? `${shown} of ${blocks.length} sections` : `${blocks.length} sections`; empty.hidden = shown > 0;
  };
  input.oninput = run; run();
}

/* ---------- site guide: every page, what it is for, how to use it ---------- */
V.guide = () => {
  const signedIn = approved(), lock = signedIn ? "" : ` <span class="pill">Sign-in required</span>`;
  const table = rows => `<div class="tablewrap"><table class="guide-t"><thead><tr><th>Page</th><th>What it is for</th><th>How to use it</th></tr></thead><tbody>${rows.map(([r, name, what, how, pro]) => `<tr><td><a href="${url(r)}"><b>${name}</b></a>${pro ? lock : ""}</td><td>${what}</td><td>${how}</td></tr>`).join("")}</tbody></table></div>`;
  const steps = (title, list) => `<div class="calc"><h3>${title}</h3><ol>${list.map(s => `<li>${s}</li>`).join("")}</ol></div>`;
  const S = [["NOT VERIFIED", "Entered by the DR ARVEEN team but not yet checked against its source. Treat with caution."], ["EXTRACTED", "Copied (in our own words) from a guideline we have read, with the original grade; waiting for a clinician to check it."], ["PARTIALLY VERIFIED", "Trial results taken from the published abstract; the full paper still needs checking."], ["PENDING PHARMACIST REVIEW", "A dose with its source shown, not yet checked by a pharmacist. Not for prescribing."], ["PHARMACIST VERIFIED", "A pharmacist has checked the dose. Still confirm against your local protocol."], ["VERIFIED AGAINST SOURCE", "A reviewer has checked it word-for-word against the source document."], ["CLINICALLY REVIEWED", "A clinician has reviewed it for accuracy and relevance."], ["APPROVED", "Signed off by a named reviewer. For patient pages: approved for patient use."], ["CHANGES NEEDED", "A reviewer found a problem; see the reviewer note."], ["DRAFT", "Patient material still being written or reviewed. Printed copies are marked DRAFT."]];
  return `<span class="eyebrow">Help</span><h1>Site guide</h1>
  <p class="prose">DR ARVEEN has two parts: a <b>Patient Education Centre</b>, open to everyone, and a <b>clinical reference</b> for approved healthcare professionals. This page lists every page, what it is for and how to use it.</p>
  <nav class="chips" aria-label="Jump to"><a class="chip" href="#g-patients">Patients and families</a><a class="chip" href="#g-pro">Healthcare professionals</a><a class="chip" href="#g-tasks">How do I…?</a><a class="chip" href="#g-labels">What the labels mean</a>${isEditor() ? `<a class="chip" href="#g-team">Reviewers and admins</a>` : ""}${isAdmin() ? `<a class="chip" href="#g-owner">Site owner</a>` : ""}<a class="chip" href="#g-faq">Questions</a></nav>
  <div class="grid two" style="margin:1rem 0">
    <a class="tile entry" href="patients.html"><span class="eyebrow">I am a patient or carer</span><b>Patient Education Centre</b><span>Plain-language information. No account needed.</span><span class="btn primary">Start here</span></a>
    <a class="tile entry" href="professional.html"><span class="eyebrow">I am a healthcare professional</span><b>Clinical reference</b><span>${signedIn ? "You're signed in and approved." : "Request an account, confirm your email, wait for approval, then sign in."}</span><span class="btn primary">${signedIn ? "Open" : "Sign in or request an account"}</span></a></div>

  <section class="section" id="g-patients"><h2>1. For patients and families</h2>
  <p class="muted">Open to everyone. Choose <b>For patients and caregivers</b> at the top of any page.</p>
  ${table([
    ["pt", "Patient home", "Where to start: your cancer, your treatment journey, common worries.", "Pick your cancer or a stage of your journey (just diagnosed, in treatment, after treatment)."],
    ["ptcancers", "Your cancer", "A plain guide to each gynaecological cancer.", "Choose your cancer. Each page explains the tests, treatments and support, with a body diagram."],
    ["articles", "Articles", "Short articles on side effects, fertility, menopause, feelings and life after cancer.", "Browse by topic, or use the search box at the top."],
    ["leaflets", "Information leaflets", "Printable leaflets about cancers, tests and treatments.", "Open a leaflet and press <b>Print or save as PDF</b>. Some are in Bahasa Malaysia: use the language buttons."],
    ["sdm", "Prepare for appointments", "Questions to ask your doctor and a worksheet for treatment decisions.", "Tick the questions you want to ask, then print the list and take it with you."],
    ["tracker", "Side-effect tracker", "A private diary of side effects to show your team.", "Add an entry each day you have symptoms. It stays only on this device; print it for appointments."],
    ["glossary", "Medical glossary", "Medical words explained simply.", "Type a word in the filter box."],
    ["workspace", "Saved", "Pages you bookmarked with ☆ Save.", "Click ☆ Save on any page; find it here later. Saved on this device only."]])}
  </section>

  <section class="section" id="g-pro"><h2>2. For healthcare professionals</h2>
  <p class="muted">Needs an approved account. The menu has two dropdowns, <b>Reference</b> and <b>Tools</b>. Your personal and admin pages are in the <b>account menu</b> (the circle with your initial, top right).</p>
  <h3>Reference menu</h3>
  ${table([
    ["notes", "Textbook notes", "Revision notes on Chapters 37–42 of Berek & Novak's Gynecology (uterine, cervix and vagina, ovary, vulva, trophoblastic disease, breast).", "Pick a chapter on the left or type in the search box (e.g. LACC, p57). Read the orange 'Check against current guidance' box at the top of each chapter first.", 1],
    ["guidelines", "Guidelines", "Every guideline we hold, with version, status and its extracted recommendations.", "Filter by cancer. Open a guideline to read its summary and the table of recommendations with original levels and grades.", 1],
    ["updates", "Guideline updates", "Guideline changes detected and what they affect.", "Check after logging in to see what is new or under review.", 1],
    ["recs", "Recommendations", "All recommendations in one searchable list.", "Filter by cancer, setting or status; click an ID to see its guideline.", 1],
    ["diseases", "Diseases", "A 24-section reference for each cancer: pathology, staging, treatment, follow-up, pearls, exam questions.", "Open a cancer; use the section list to jump around.", 1],
    ["staging", "Staging", "FIGO staging systems (cervix, ovary, endometrium, vulva, vagina, sarcoma, GTN).", "Open a system and use the filter box to find a stage.", 1],
    ["protocols", "Treatment protocols", "Regimens with doses, schedule and source.", "Check the dose status label first. Doses PENDING PHARMACIST REVIEW are not for prescribing.", 1],
    ["drugs", "Drug reference", "Monographs: class, side effects, interactions, monitoring, doses by indication.", "Open a drug; doses show their source and review status.", 1],
    ["trials", "Clinical trials", "Pivotal and ongoing trials with headline results.", "Filter by cancer; open a trial for numbers, PubMed link and limitations.", 1]])}
  <h3>Tools menu</h3>
  ${table([
    ["algorithms", "Clinical pathways", "Six step-by-step pathways: cervical staging work-up, suspected ovarian cancer, suspected endometrial cancer, endometrial risk group, suspected recurrence, biomarker testing.", "Choose a pathway at the top, then answer one question at a time. Each end point shows the recommendations it is based on. It does not choose treatment.", 1],
    ["calculators", "Calculators", "BSA, BMI, creatinine clearance, eGFR, RMI, carboplatin (Calvert).", "Type the values; the answer appears as you type. Open 'Formula and limitations' before using it.", 1],
    ["compare", "Evidence and comparisons", "Compare guideline recommendations on one question, plus the Research library of summarised studies.", "Choose a clinical question from the list. Scroll down for the Research library; click a study to open its summary.", 1],
    ["education", "Education", "FIGO staging quiz, reviews, surgical videos and teaching cases.", "Answer quiz questions to see the explanation. Videos open on the journal website.", 1]])}
  <h3>Other pages</h3>
  ${table([
    ["home", "Clinical reference home", "Search, disease hubs, review progress and key evidence.", "Start with the big search box, or click a disease hub.", 1],
    ["sdm", "Shared decisions", "Question prompts to use with patients.", "Print and use in clinic."],
    ["workspace", "My Workspace", "Your bookmarks and private notes.", "Add notes at the bottom of any record; they stay in this browser."],
    ["search", "Search", "Search across everything you can see.", "Type in the box at the top of any page."]])}
  </section>

  <section class="section" id="g-tasks"><h2>3. How do I…?</h2><div class="cols">
    ${steps("Find what a guideline recommends", ["Reference → <b>Guidelines</b>.", "Filter by cancer and open the guideline.", "Scroll to the recommendations table: each row shows the text, original level and grade, and status."])}
    ${steps("Check a drug dose", ["Reference → <b>Drug reference</b> → choose the drug.", "Read <b>Dose by indication</b> and its source.", "Check the label: only PHARMACIST VERIFIED doses have been checked, and you must still follow your local protocol."])}
    ${steps("Stage a cancer", ["Reference → <b>Staging</b> → choose the system.", "Type in the filter box (for example 'IB2').", "Practise with the quiz in Tools → Education."])}
    ${steps("Work through a patient's work-up", ["Tools → <b>Clinical pathways</b>.", "Choose the pathway at the top.", "Answer each question; at the end, read the linked recommendations."])}
    ${steps("Give a patient written information", ["Switch to <b>For patients and caregivers</b>.", "Open <b>Information leaflets</b>, choose the leaflet and language.", "Click <b>Print or save as PDF</b>. Leaflets marked DRAFT are not for patients yet."])}
    ${steps("Report a mistake", ["Scroll to the bottom of the page with the problem.", "Click <b>Report a problem</b>, describe it and send.", "Don't include any patient's details."])}
  </div></section>

  <section class="section" id="g-labels"><h2>4. What the labels mean</h2>
  <div class="tablewrap"><table><thead><tr><th>Label</th><th>Meaning</th></tr></thead><tbody>${S.map(([s, m]) => `<tr><td>${statusPill(s)}</td><td>${m}</td></tr>`).join("")}</tbody></table></div></section>

  ${isEditor() ? `<section class="section" id="g-team"><h2>5. For reviewers, editors and admins</h2><p class="muted">These pages are in your <b>account menu</b> (top right) and appear only for the right roles.</p>
  ${table([
    ["review", "Review queue", "Sign off professional content: recommendations, doses, guidelines, drugs, protocols, trials, staging, pathways, research summaries.", "Choose a section; open an item; check it against the source; pick a decision, add a note and click <b>Save sign-off</b>. Doses can be verified only by a Pharmacist account. (Reviewer or admin role.)"],
    ["cms", "Edit content", "Edit patient articles, leaflets and cancer pages, and add pictures.", "Choose an item on the left, edit, set the status and save. Approving needs the reviewer or admin role, a reviewer name and a date."],
    ["admin", "Editorial", "Overview of every record and when it is due for review.", "Use it to plan review sessions."],
    ["accounts", "Accounts", "Approve or reject account requests, set roles, read reported problems.", "Check the registration number on the MMC, Pharmacy Board or Nursing Board register before approving. (Admin only.)"],
    ["governance", "Governance", "The written review and approval process.", "Share with reviewers so everyone follows the same steps."]])}
  <div class="tablewrap"><table><thead><tr><th>Role</th><th>Can do</th></tr></thead><tbody>
    <tr><td>reader</td><td>Read the clinical reference.</td></tr>
    <tr><td>editor</td><td>Also edit patient content (not approve).</td></tr>
    <tr><td>reviewer</td><td>Also approve patient content and use the Review queue. With profession Pharmacist: verify doses.</td></tr>
    <tr><td>admin</td><td>Everything, including approving accounts and changing roles.</td></tr></tbody></table></div></section>` : ""}

  ${isAdmin() ? `<section class="section" id="g-owner"><h2>6. Site owner: how content gets onto the site</h2>
  <div class="cols">
    ${steps("Adding a new guideline or article", ["Save the PDF in <code>Documents\\dr-arveen-content\\sources</code> (private, never online).", "Ask Claude to process it. Claude extracts recommendations with original grades and rebuilds <code>seed.sql</code>.", "In Supabase → SQL Editor → New query, paste all of <code>seed.sql</code> and click <b>Run</b>.", "Review the new items in the <b>Review queue</b>."])}
    ${steps("When Claude changes how the site looks or works", ["Open PowerShell: <code>cd C:\\Users\\0308\\Documents\\dr-arveen-site</code>", "Run <code>git push</code>.", "Wait about a minute, then press Ctrl+F5 on the site."])}
    ${steps("Approving content", ["Professional content: account menu → <b>Review queue</b>. Use the filter box, tick several items and sign them off together, or press <kbd>j</kbd>/<kbd>k</kbd> to move between items.", "Patient content: account menu → <b>Edit content</b> → set status APPROVED with reviewer name and date.", "Doses: your pharmacist signs in (profession Pharmacist, role reviewer) and uses the Review queue → Doses."])}
  </div>
  <p class="banner info">Rule of thumb: <b>content</b> changes (guidelines, doses, trials, pathways, research) need <b>seed.sql</b> run in Supabase. <b>Look and features</b> changes need <b>git push</b>. Patient leaflets and articles written by Claude need git push; edits you make online in Edit content appear immediately.</p></section>` : ""}

  <section class="section" id="g-faq"><h2>Questions</h2>
  <details class="row"><summary><b>Why can't I see the professional pages?</b></summary><p class="prose">You need an account that an administrator has approved. Request one on <a href="register.html">Request an account</a>, confirm your email, then wait for approval. If you're approved, <a href="login.html">sign in</a>.</p></details>
  <details class="row"><summary><b>Why does so much say NOT VERIFIED?</b></summary><p class="prose">DR ARVEEN never presents unchecked information as approved. Each item keeps its label until a named reviewer signs it off. See <a href="#g-labels">What the labels mean</a> and <a href="governance.html">Governance</a>.</p></details>
  <details class="row"><summary><b>Something changed but I can't see it.</b></summary><p class="prose">Press <b>Ctrl+F5</b> to reload without the old copy. If it still looks old, the site owner may not have run the latest update yet.</p></details>
  <details class="row"><summary><b>Where are my bookmarks, notes and tracker entries kept?</b></summary><p class="prose">If you are signed in, bookmarks, recently viewed pages and private notes are saved to your own account: only you can read them, on any device, and they are removed from the computer when you sign out (important on shared ward computers). If you are not signed in, they stay in this browser only. Patients' side-effect tracker entries always stay in the browser only.</p></details>
  <details class="row"><summary><b>Is this medical advice?</b></summary><p class="prose">No. DR ARVEEN is an educational reference. Patients should talk to their own treatment team; professionals must follow their institution's protocols.</p></details>
  </section>`;
};

/* ---------- review queue (reviewers and admins; doses by pharmacists) ---------- */
const DONE = ["VERIFIED AGAINST SOURCE", "CLINICALLY REVIEWED", "APPROVED", "PHARMACIST VERIFIED"];
const RQ_TABS = [["recommendation", "Recommendations"], ["dose", "Doses"], ["guideline", "Guidelines"], ["drug", "Drug monographs"], ["protocol", "Protocols"], ["trial", "Trials"], ["staging", "Staging"], ["algorithm", "Pathways"], ["literature", "Research library"], ["disease", "Disease references"], ["notes", "Textbook notes"]];
function queueItems() {
  const doseText = d => (d.doses || []).map(x => `${x.indication}: ${x.dose} [${x.source}]`).join("\n");
  const protoDose = p => p.components.map(c => `${byId(D.drugs, c.drug)?.name || c.drug}: ${c.dose || "—"} (${c.schedule || "—"})`).join("\n") + (p.doseSource ? `\nSource: ${p.doseSource}` : "");
  return [
    ...D.recommendations.map(r => ({ kind: "recommendation", id: r.id, group: r.guideline, title: r.id, text: r.text, meta: `${r.location} · ${r.grade}, ${r.strength}`, route: `g.${r.guideline}`, status: r.status })),
    ...D.drugs.filter(d => d.doses).map(d => ({ kind: "dose", id: d.id, group: "Drug doses", title: d.name, text: doseText(d), meta: "Check against NPRA product information and the institutional protocol", route: `dr.${d.id}`, status: d.doseStatus })),
    ...D.protocols.filter(p => p.doseStatus).map(p => ({ kind: "dose", id: p.id, group: "Protocol doses", title: p.name, text: protoDose(p), meta: p.indication, route: `p.${p.id}`, status: p.doseStatus })),
    ...D.guidelines.map(g => ({ kind: "guideline", id: g.id, group: dname(g.disease), title: g.title, text: g.summary, meta: `${g.id} · ${g.version || ""}`, route: `g.${g.id}`, status: g.status })),
    ...D.drugs.map(d => ({ kind: "drug", id: d.id, group: d.cls, title: d.name, text: `${d.moa} Adverse effects: ${d.ae}`, meta: "Monograph text (doses are reviewed separately)", route: `dr.${d.id}`, status: d.status || "NOT VERIFIED" })),
    ...D.protocols.map(p => ({ kind: "protocol", id: p.id, group: dname(p.disease), title: p.name, text: p.indication, meta: p.sourceType, route: `p.${p.id}`, status: p.status })),
    ...D.trials.map(t => ({ kind: "trial", id: t.id, group: dname(t.disease), title: t.name, text: t.outcome ? headline(t) : `${t.intervention} vs ${t.comparator}`, meta: t.pub, route: `t.${t.id}`, status: t.outcome?.status || t.status || "NOT VERIFIED" })),
    ...D.staging.map(s => ({ kind: "staging", id: s.id, group: dname(s.cancer), title: s.name, text: s.notes || "", meta: `${s.authority} ${s.version}`, route: `s.${s.id}`, status: s.status || "NOT VERIFIED" })),
    ...D.algorithms.map(a => ({ kind: "algorithm", id: a.id, group: a.disease === "all" ? "All cancers" : dname(a.disease), title: a.title, text: a.sourceNote || a.entry, meta: `Main source ${a.source}`, route: `algorithms.${a.id}`, status: a.status })),
    ...(D.literature || []).map(x => ({ kind: "literature", id: x.id, group: x.place === "evidence" ? "Evidence page" : "Education page", title: x.title, text: x.summary + "\n" + x.findings.join("\n"), meta: `${x.citation} · doi ${x.doi}`, route: x.place === "evidence" ? "compare" : "education", status: x.status })),
    ...(D.notes?.chapters || []).map(c => ({ kind: "notes", id: c.id, group: "Textbook notes (Berek & Novak's, Ch 37–42)", title: `Ch ${c.n} — ${c.title}`, text: `Check the chapter against the textbook and current guidance. Flags already noted:\n${(c.flags || []).map(([t, d]) => `• ${t}: ${d}`).join("\n")}`, meta: c.byline, route: "notes", status: c.status || "NOT VERIFIED", dis: c.disease })),
    ...D.diseases.filter(d => d.reference).map(d => ({ kind: "disease", id: d.id, group: "Disease references", title: `${d.name}: 24-section reference`, text: d.short, meta: "Educational summary", route: `d.${d.id}`, status: d.refReview?.status || "NOT VERIFIED" }))
  ].map(x => ({ ...x, key: `${x.kind}:${x.id}`, review: state.reviews?.[`${x.kind}:${x.id}`] }));
}
V.review = () => {
  const all = queueItems(), tab = state.filters.rq || "recommendation", showAll = !!state.filters.rqAll;
  const pending = x => !DONE.includes(x.status);
  const items = all.filter(x => x.kind === tab && (showAll || pending(x)));
  const today = new Date().toISOString().slice(0, 10), nextYear = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  const opts = k => (k === "dose" ? ["PHARMACIST VERIFIED", "CHANGES NEEDED"] : ["VERIFIED AGAINST SOURCE", "CLINICALLY REVIEWED", "APPROVED", "CHANGES NEEDED"]);
  const optList = (k, sel) => opts(k).map(o => `<option ${sel === o ? "selected" : ""} ${o === "PHARMACIST VERIFIED" && !isPharmacist() ? "disabled" : ""}>${o}</option>`).join("");
  const me = esc(state.profile?.full_name || "");
  const form = x => `<form class="rq-form" data-rkey="${esc(x.key)}" data-rkind="${esc(x.kind)}">
      <label>Decision<select name="status">${optList(x.kind, x.review?.status)}</select></label>
      <label>Reviewer name<input name="reviewer" required minlength="2" value="${x.review?.reviewer ? esc(x.review.reviewer) : me}"></label>
      <label>Review date<input name="reviewed_on" type="date" required value="${esc(x.review?.reviewed_on || today)}"></label>
      <label>Next review<input name="next_review" type="date" value="${esc(x.review?.next_review || nextYear)}"></label>
      <label class="wide">Note (what you checked, or what must change)<textarea name="note" rows="2" maxlength="2000">${esc(x.review?.note || "")}</textarea></label>
      <div class="wide"><button class="btn primary" type="submit" value="next">Save and open next</button> <button class="btn" type="submit" value="stay">Save</button>${x.review ? ` <button class="btn" type="button" data-rwithdraw="${esc(x.key)}">Withdraw sign-off</button>` : ""} <span class="rq-msg" role="status"></span></div>
      ${x.kind === "dose" && !isPharmacist() ? `<p class="muted wide">Only an account registered as a Pharmacist can mark doses verified. You can record CHANGES NEEDED.</p>` : ""}</form>`;
  const itemDis = x => { const f = id => [D.recommendations, D.guidelines, D.protocols, D.trials, D.algorithms, D.literature || []].map(c => byId(c, id)).find(Boolean); const r = f(x.id), dr = byId(D.drugs, x.id), st = byId(D.staging, x.id);
    return x.kind === "disease" ? x.id : x.kind === "notes" ? x.dis : dr ? dr.cancers[0] : st ? st.cancer : r?.disease || "all"; };
  const gOrder = g => Math.min(...items.filter(x => x.group === g).map(x => DIS_ORDER(itemDis(x))));
  const groups = [...new Set(items.map(x => x.group))].sort((a, b) => gOrder(a) - gOrder(b));
  const gBadge = g => badge(itemDis(items.find(x => x.group === g)));
  const prog = g => { const inG = all.filter(x => x.kind === tab && x.group === g), d = inG.filter(x => !pending(x)).length; return `<div class="rq-prog" title="${d} of ${inG.length} signed off"><span style="width:${inG.length ? (100 * d / inG.length).toFixed(1) : 0}%"></span></div><span class="muted rq-count">${d} / ${inG.length} signed off</span>`; };
  return `<span class="eyebrow">Governance</span><h1>Review queue</h1>
  <p class="prose muted">Check each item against its source, then record your decision. Sign-offs are saved with your name and date, logged, and shown on the site at once. Doses are verified by pharmacists; other items by reviewers.</p>
  <div class="chips" role="group" aria-label="Item type">${RQ_TABS.map(([k, l]) => { const n = all.filter(x => x.kind === k && pending(x)).length; return `<button class="chip" data-rq="${k}" aria-pressed="${k === tab}">${l} <span class="muted">${n}</span></button>`; }).join("")}</div>
  <div class="rq-tools"><input type="search" id="rq-search" placeholder="Filter this section (ID, words, drug, guideline…)" aria-label="Filter items" value="${esc(state.filters.rqq || "")}">
    <label class="check"><input type="checkbox" id="rq-all" ${showAll ? "checked" : ""}> Show items already signed off</label>
    <span class="muted rq-keys">Keys: <kbd>j</kbd> next · <kbd>k</kbd> previous · <kbd>x</kbd> select</span></div>
  ${items.length ? groups.map(g => `<section class="section rq-group"><div class="section-h"><h2 class="dgroup-h small">${gBadge(g)}${esc(tab === "recommendation" ? `${g} — ${byId(D.guidelines, g)?.title || ""}` : g)}</h2><label class="check"><input type="checkbox" data-rselgroup> Select all</label></div>${prog(g)}
    <div class="list">${items.filter(x => x.group === g).map(x => `<details class="row rq" data-key="${esc(x.key)}" data-search="${esc((x.title + " " + x.text + " " + x.meta + " " + x.group).toLowerCase())}">
    <summary><input type="checkbox" class="rq-sel" data-rsel="${esc(x.key)}" aria-label="Select ${esc(x.title)}"><span class="row-t">${esc(x.title)} ${statusPill(x.status || "NOT VERIFIED")}${x.review ? ` <span class="muted">${esc(x.review.reviewer)}, ${esc(x.review.reviewed_on)}</span>` : ""}</span><span class="row-m"><span>${esc(x.meta || "")}</span></span></summary>
    <p class="prose rq-text">${esc(x.text || "").replace(/\n/g, "<br>")}</p><p><a href="${url(x.route)}" target="_blank" rel="noopener">Open on the site ↗</a></p>${form(x)}</details>`).join("")}</div></section>`).join("")
    : `<p class="banner">Nothing waiting in this section${showAll ? "" : ". Tick 'Show items already signed off' to see completed items"}.</p>`}
  <div class="rq-bulk" id="rq-bulk" hidden><b id="rq-n">0 selected</b>
    <select id="rqb-status" aria-label="Decision">${optList(tab)}</select>
    <input id="rqb-reviewer" aria-label="Reviewer name" value="${me}" placeholder="Reviewer name">
    <input id="rqb-date" type="date" aria-label="Review date" value="${today}">
    <input id="rqb-note" aria-label="Note" placeholder="Note, e.g. 'checked against ESGO 2021 PDF'">
    <button class="btn primary" id="rqb-go" type="button">Sign off selected</button><button class="btn" id="rqb-clear" type="button">Clear</button><span class="rq-msg" id="rqb-msg" role="status"></span></div>`;
};
function bindReview() {
  if (PAGE !== "review") return;
  const visible = () => [...app.querySelectorAll("details.rq")].filter(d => !d.hidden);
  const filter = () => {
    const q = (state.filters.rqq || "").toLowerCase().trim();
    app.querySelectorAll("details.rq").forEach(d => d.hidden = !!q && !d.dataset.search.includes(q));
    app.querySelectorAll(".rq-group").forEach(s => s.hidden = !s.querySelector("details.rq:not([hidden])"));
  };
  const bulk = () => { const n = app.querySelectorAll(".rq-sel:checked").length; $("#rq-bulk").hidden = !n; $("#rq-n").textContent = `${n} selected`; };
  const openItem = d => { if (!d) return; app.querySelectorAll("details.rq[open]").forEach(o => { if (o !== d) o.open = false; }); d.open = true; d.scrollIntoView({ block: "start", behavior: "smooth" }); d.querySelector("summary").focus({ preventScroll: true }); };
  app.querySelectorAll("[data-rq]").forEach(b => b.onclick = () => { state.filters.rq = b.dataset.rq; state.filters.rqq = ""; render(); });
  const all = $("#rq-all"); if (all) all.onchange = () => { state.filters.rqAll = all.checked; render(); };
  const s = $("#rq-search"); if (s) s.oninput = () => { state.filters.rqq = s.value; filter(); };
  filter();
  app.querySelectorAll(".rq-sel").forEach(c => { c.onclick = e => e.stopPropagation(); c.onchange = bulk; });
  app.querySelectorAll("[data-rselgroup]").forEach(c => c.onchange = () => { c.closest(".rq-group").querySelectorAll("details.rq:not([hidden]) .rq-sel").forEach(x => x.checked = c.checked); bulk(); });
  $("#rqb-clear").onclick = () => { app.querySelectorAll(".rq-sel, [data-rselgroup]").forEach(x => x.checked = false); bulk(); };
  $("#rqb-go").onclick = async () => {
    const keys = [...app.querySelectorAll(".rq-sel:checked")].map(c => c.dataset.rsel), msg = $("#rqb-msg");
    const reviewer = $("#rqb-reviewer").value.trim(), date = $("#rqb-date").value, status = $("#rqb-status").value;
    if (reviewer.length < 2 || !date) { msg.textContent = "Enter the reviewer name and date."; msg.className = "rq-msg err"; return; }
    if (!confirm(`Record "${status}" for ${keys.length} item(s), signed by ${reviewer}? Only do this for items you have actually checked.`)) return;
    msg.textContent = "Saving…"; msg.className = "rq-msg";
    const kind = state.filters.rq || "recommendation", next = new Date(Date.parse(date) + 365 * 864e5).toISOString().slice(0, 10);
    const rows = keys.map(k => ({ item_id: k, kind, status, reviewer, reviewed_on: date, next_review: next, note: $("#rqb-note").value.trim() || null }));
    const { data, error } = await sb.from("pro_reviews").upsert(rows).select();
    if (error) { msg.textContent = /does not exist|schema cache/.test(error.message) ? "The review table isn't set up yet: run supabase/upgrade-4-reviews.sql." : error.message; msg.className = "rq-msg err"; return; }
    applyReviews([].concat(data || [])); render();
  };
  app.querySelectorAll(".rq-form").forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const goNext = e.submitter?.value !== "stay";
    const msg = f.querySelector(".rq-msg"), v = n => f.elements[n].value.trim() || null;
    msg.textContent = "Saving…"; msg.className = "rq-msg";
    const vis = visible(), me = f.closest("details.rq"), nextKey = vis[vis.indexOf(me) + 1]?.dataset.key;
    const row = { item_id: f.dataset.rkey, kind: f.dataset.rkind, status: v("status"), reviewer: v("reviewer"), reviewed_on: v("reviewed_on"), next_review: v("next_review"), note: v("note") };
    const { data, error } = await sb.from("pro_reviews").upsert(row).select().single();
    if (error) { msg.textContent = /does not exist|schema cache/.test(error.message) ? "The review table isn't set up yet: run supabase/upgrade-4-reviews.sql." : error.message; msg.className = "rq-msg err"; return; }
    applyReviews([data]); render();
    const target = goNext ? nextKey : row.item_id;
    if (target) openItem(app.querySelector(`details.rq[data-key="${CSS.escape(target)}"]`));
  });
  app.querySelectorAll("[data-rwithdraw]").forEach(b => b.onclick = async () => {
    if (!confirm("Withdraw this sign-off? The item goes back to its built-in status.")) return;
    const { error } = await sb.from("pro_reviews").delete().eq("item_id", b.dataset.rwithdraw);
    if (error) return alert(error.message);
    location.reload();
  });
  if (!document.body.dataset.rqKeys) {
    document.body.dataset.rqKeys = "1";
    document.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      const vis = visible(), cur = app.querySelector("details.rq[open]"), i = vis.indexOf(cur);
      if (e.key === "j") { e.preventDefault(); openItem(vis[i + 1] || vis[0]); }
      if (e.key === "k") { e.preventDefault(); openItem(vis[Math.max(i - 1, 0)]); }
      if (e.key === "x" && cur) { const c = cur.querySelector(".rq-sel"); c.checked = !c.checked; bulk(); }
    });
  }
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
/* ---------- general editor: any record, page, carousel or the portfolio (site_edits) ---------- */
const EDIT_SKIP = new Set(["id", "status", "reviewer", "verifiedOn", "nextReview", "reviewNote", "doseStatus", "doseReviewer", "doseReviewedOn", "doseNote", "refReview", "online", "updatedAt", "editedAt", "editedBy", "editKeys", "editedAfterReview", "doseEditedAfterReview", "html", "file", "image", "refImage", "pageStatus", "lastReview", "approval", "patient", "patientSections", "photo", "photoAlt", "__src"]);
const PAGE_LABELS = (() => { const out = [["home", "Professional home"], ["pt", "Patient home"]]; const walk = a => a.forEach(x => Array.isArray(x) ? out.push(x) : walk(x.items)); walk(NAV_PRO_GROUPS); walk(NAV_PT);
  const seen = new Set(); return out.filter(([r]) => !seen.has(r) && seen.add(r)).map(([r, l]) => [r, l.replace(/^↳\s*/, "")]); })();
const recTitle = r => r.title || r.name || r.short || (r.text ? `${r.id} · ${String(r.text).slice(0, 70)}…` : r.id);
function editTarget(key) { // key = "edit:<coll>:<id>"
  const rest = key.slice(5), i = rest.indexOf(":"), coll = rest.slice(0, i), id = rest.slice(i + 1), row = state.edits[`${coll}:${id}`];
  if (coll === "page") { const pl = PAGE_LABELS.find(([r]) => r === id); return { coll, id, row, label: `Page: ${pl ? pl[1] : id}`, rec: state.pageEdits?.[id] || {}, scope: PUBLIC_PAGES.includes(id) ? "public" : "pro", view: id }; }
  if (coll === "slides") return { coll, id, row, label: id === "pt" ? "Patient home carousel" : "Professional home carousel", rec: { slides: state.slides?.[id] || SLIDES[id] || [] }, scope: id === "pt" ? "public" : "pro", view: id === "pt" ? "pt" : "home" };
  if (coll === "portfolio") return { coll, id, row, label: "Dr Arveen portfolio", rec: window.ARVEEN_PUBLIC.portfolio || {}, orig: origOf("portfolio:main") || window.ARVEEN_PUBLIC.portfolio || {}, scope: "public", view: "portfolio" };
  const rec = byId(editList(D, coll) || [], id); if (!rec) return null;
  const view = { guidelines: `g.${id}`, diseases: `d.${id}`, staging: `s.${id}`, protocols: `p.${id}`, drugs: `dr.${id}`, trials: `t.${id}`, algorithms: `algorithms.${id}`, notes: "notes", recommendations: "recs", literature: "compare" }[coll];
  return { coll, id, row, label: `${(EDIT_COLLS.find(([c]) => c === coll) || [, coll])[1]} · ${recTitle(rec)}`, rec, orig: origOf(`${coll}:${id}`) || rec, scope: "pro", view };
}
const humanKey = k => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, c => c.toUpperCase());
function fieldHtml(k, v) {
  const lab = esc(humanKey(k));
  if (typeof v === "boolean") return `<label class="ef ef-check"><input type="checkbox" data-k="${esc(k)}" data-kind="bool" ${v ? "checked" : ""}> ${lab}</label>`;
  if (k === "locations" && Array.isArray(v)) return `<label class="ef">Clinics <span class="muted">(one clinic per line: Name | Address | Clinic days and hours | Appointment phone)</span><textarea data-k="locations" data-kind="clinics" rows="${Math.max(2, v.length + 1)}" placeholder="Hospital name | Street, city | Mon and Thu 9am–1pm | +60 3-1234 5678">${esc(v.map(l => [l.name, l.address, l.days, l.phone].map(x => x || "").join(" | ")).join("\n"))}</textarea></label>`;
  if (typeof v === "number") return `<label class="ef">${lab}<input type="number" step="any" data-k="${esc(k)}" data-kind="num" value="${esc(v)}"></label>`;
  if (Array.isArray(v) && v.every(x => typeof x === "string")) return `<label class="ef">${lab} <span class="muted">(one per line)</span><textarea data-k="${esc(k)}" data-kind="lines" rows="${Math.min(12, Math.max(2, v.length + 1))}">${esc(v.join("\n"))}</textarea></label>`;
  if (v && typeof v === "object") return `<label class="ef">${lab} <span class="muted">(structured — keep the JSON format)</span><textarea class="mono" data-k="${esc(k)}" data-kind="json" rows="${Math.min(16, Math.max(3, JSON.stringify(v, null, 1).split("\n").length))}">${esc(JSON.stringify(v, null, 2))}</textarea></label>`;
  const s = v == null ? "" : String(v);
  return s.length > 90 || s.includes("\n") ? `<label class="ef">${lab}<textarea data-k="${esc(k)}" data-kind="${v == null ? "nstr" : "str"}" rows="${Math.min(10, Math.max(2, Math.ceil(s.length / 90)))}">${esc(s)}</textarea></label>`
    : `<label class="ef">${lab}<input type="text" data-k="${esc(k)}" data-kind="${v == null ? "nstr" : "str"}" value="${esc(s)}"></label>`;
}
const imgSlot = (img, legend = "Picture") => `<fieldset><legend>${esc(legend)}</legend>
  <div class="img-slot"><div class="img-prev" id="img-prev">${img?.url ? `<img src="${esc(img.url)}" alt="">` : `<span class="muted">No picture</span>`}</div>
  <div class="img-fields"><input type="hidden" id="img-url" value="${esc(img?.url || "")}">
    <label>Upload a picture (JPEG, PNG or WebP, up to 3 MB)<input type="file" id="img-file" accept="image/jpeg,image/png,image/webp"></label>
    <label>Description for screen readers (required with a picture)<input type="text" id="img-alt" value="${esc(img?.alt || "")}"></label>
    <label>Credit or caption (optional)<input type="text" id="img-credit" value="${esc(img?.credit || "")}"></label>
    <div class="toc"><button class="btn" type="button" id="img-remove">Remove picture</button></div>
    <p class="muted" style="font-size:.84rem">Only upload pictures you own or have permission to use. Get written consent from anyone identifiable, and never show patient information. Clinical images must be fully de-identified.</p></div></div></fieldset>`;
/* L4: check the real file type from its first bytes (not the name), then redraw the picture on a canvas. Redrawing
   removes hidden metadata such as GPS location and camera details, and limits the size to 2400 px. */
// @test:cleanPic
async function sniffImage(file) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer()), s = (i, j) => String.fromCharCode(...b.slice(i, j));
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "image/jpeg";
  if (b[0] === 0x89 && s(1, 4) === "PNG") return "image/png";
  if (s(0, 4) === "RIFF" && s(8, 12) === "WEBP") return "image/webp";
  return null;
}
async function cleanPic(file) {
  const type = await sniffImage(file);
  if (!type) throw new Error("That file isn't a JPEG, PNG or WebP picture.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That picture is over 15 MB. Choose a smaller one.");
  const bmp = await createImageBitmap(file), k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const blob = await new Promise((res, rej) => c.toBlob(x => x ? res(x) : rej(new Error("The picture couldn't be processed.")), type, 0.88));
  return { blob, type: blob.type || type };
}
// @end
async function uploadPic(file, folder) {
  const { blob, type } = await cleanPic(file);
  if (blob.size > 3 * 1024 * 1024) throw new Error("That picture is still over 3 MB after resizing. Use a smaller or simpler picture.");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${type.split("/")[1].replace("jpeg", "jpg")}`;
  const { error } = await sb.storage.from("site-images").upload(path, blob, { cacheControl: "3600", upsert: false, contentType: type });
  if (error) throw new Error("The picture couldn't be uploaded: " + error.message);
  return sb.storage.from("site-images").getPublicUrl(path).data.publicUrl;
}
function bindImgSlot(folder, err, ok) {
  $("#img-file").onchange = async e => { const file = e.target.files[0]; if (!file) return; ok("Uploading picture…");
    try { const u = await uploadPic(file, folder); $("#img-url").value = u; $("#img-prev").innerHTML = `<img src="${esc(u)}" alt="">`; ok("Picture uploaded. Add a description, then Save."); } catch (x) { err(x.message); } };
  $("#img-remove").onclick = () => { $("#img-url").value = ""; $("#img-prev").innerHTML = `<span class="muted">No picture</span>`; };
}
function readImgSlot() { const u = $("#img-url").value, alt = $("#img-alt").value.trim(); if (u && !alt) throw new Error("Add a description of the picture for people using screen readers."); return u ? { url: u, alt, credit: $("#img-credit").value.trim() } : null; }
const SLIDE_TONES = ["teal", "lav", "navy"];
const slideBlock = (x = {}) => `<div class="secblock slblock"><div class="sec-top"><b>Slide</b><div class="sec-tools"><button class="btn" type="button" data-slmv="-1" aria-label="Move slide up">↑</button><button class="btn" type="button" data-slmv="1" aria-label="Move slide down">↓</button><button class="btn" type="button" data-sldel>Remove</button></div></div>
  <div class="fields"><label>Small heading<input type="text" class="sl-eyebrow" value="${esc(x.eyebrow || "")}"></label><label>Colour<select class="sl-tone">${SLIDE_TONES.map(t => `<option ${t === x.tone ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
  <label>Title<input type="text" class="sl-title" value="${esc(x.title || "")}"></label>
  <label>Text<textarea class="sl-text" rows="2">${esc(x.text || "")}</textarea></label>
  <div class="fields"><label>Button label<input type="text" class="sl-cta" value="${esc(x.cta || "")}"></label><label>Button goes to (page name, e.g. notes, g.G-NICE-NG12, tool.chemo)<input type="text" class="sl-route" value="${esc(x.route || "")}"></label><label>Icon (if no picture)<input type="text" class="sl-icon" value="${esc(x.icon || "")}"></label></div>
  <div class="fields"><label>Picture (optional)<input type="file" class="sl-file" accept="image/jpeg,image/png,image/webp"></label><input type="hidden" class="sl-photo" value="${esc(x.photo || "")}"><span class="sl-prev">${x.photo ? `<img src="${esc(x.photo)}" alt="">` : '<span class="muted">No picture: shapes and icon shown</span>'}</span><button class="btn" type="button" data-slnopic>Remove picture</button></div></div>`;
function editAnyForm(key) {
  const t = editTarget(key);
  if (!t) return `<div class="cms-empty"><h2>Not found</h2><p class="muted">That record isn't in the current content.</p></div>`;
  const head = `<div class="section-h"><div><span class="eyebrow">${t.scope === "public" ? "Public" : "Professional only"} · ${esc(t.coll)}</span><h2>${esc(t.label)}</h2></div>
    <div class="toc"><a class="btn" href="${url(t.view)}" target="_blank" rel="noopener">View page ↗</a></div></div>
    ${t.row ? `<p class="banner info">Edited online by ${esc(t.row.editor || "an editor")} on ${esc(String(t.row.updated_at || "").slice(0, 16).replace("T", " "))}. The site shows this version.</p>` : `<p class="muted">Not edited online yet: you are looking at the built-in version. Saving creates an online version; only the fields you change are stored.</p>`}`;
  let body;
  if (t.coll === "page") body = `<fieldset><legend>Introduction shown under the page title (optional)</legend><label>Text<textarea id="pg-intro" rows="3">${esc(t.rec.intro || "")}</textarea></label></fieldset>${imgSlot(t.rec.image, "Banner picture under the page title")}`;
  else if (t.coll === "slides") body = `<fieldset><legend>Slides (shown in this order, changing every 7 seconds)</legend><div id="slides" class="secs">${t.rec.slides.map(slideBlock).join("")}</div><button class="btn" type="button" id="sladd">+ Add slide</button></fieldset>`;
  else {
    const keys = Object.keys(t.rec).filter(k => !EDIT_SKIP.has(k) && t.rec[k] !== undefined && typeof t.rec[k] !== "function");
    const clinical = t.scope === "pro";
    body = `${clinical ? `<p class="banner">Clinical content: editing does not sign it off. After saving, the record shows "Edited after sign-off" until a reviewer re-checks it in the Review queue${t.coll === "drugs" || t.coll === "protocols" ? ", and any changed dose goes back to PENDING PHARMACIST REVIEW" : ""}. Keep sources and grades exactly as published.</p>` : ""}
      ${t.coll === "portfolio" ? `<p class="banner">Factual information only, following Malaysian Medical Council guidance: no testimonials, no claims of superiority, and no subspecialty title unless it is on the National Specialist Register.</p>` : ""}
      <fieldset><legend>Details</legend><div class="efields">${keys.map(k => fieldHtml(k, t.rec[k])).join("")}</div></fieldset>
      ${imgSlot(t.rec[t.coll === "portfolio" ? "image" : IMG_FIELD(t.coll)] || (t.coll === "portfolio" && t.rec.photo ? { url: t.rec.photo, alt: t.rec.photoAlt } : null), t.coll === "portfolio" ? "Profile photo" : "Picture shown on this record")}`;
  }
  return `<form id="editf" class="cms-form" data-key="${esc(key)}">${head}${body}
    <fieldset><legend>Reason for this change (kept in the audit log)</legend><label>Reason<input type="text" id="ef-reason" required minlength="3" maxlength="500" placeholder="Corrected typo / added clinic photo / updated to 2025 version"></label></fieldset>
    <p class="result err" id="cms-err" role="alert" hidden></p><p class="banner info" id="cms-ok" role="status" hidden></p>
    <div class="toc cms-actions"><button class="btn primary" type="submit">Save</button>
      ${t.row ? `<button class="btn" type="button" id="cms-revert">Discard online edits…</button><span id="cms-revert-confirm" hidden>Go back to the built-in version? <button class="btn" type="button" id="cms-revert-yes">Yes, discard</button> <button class="btn" type="button" id="cms-revert-no">Cancel</button></span>` : ""}</div></form>`;
}
function bindEditAny() {
  const f = $("#editf"); if (!f) return;
  const key = f.dataset.key, t = editTarget(key); if (!t) return;
  const rowId = `${t.coll}:${t.id}`;
  const err = m => { const e = $("#cms-err"); e.hidden = !m; e.textContent = m || ""; if (m) $("#cms-ok").hidden = true; };
  const ok = m => { const o = $("#cms-ok"); o.hidden = false; o.textContent = m; err(""); };
  if ($("#img-file")) bindImgSlot(`${t.coll}/${t.id}`.replace(/[^\w/.-]/g, "_"), err, ok);
  const sl = $("#slides");
  if (sl) {
    $("#sladd").onclick = () => sl.insertAdjacentHTML("beforeend", slideBlock({ tone: "teal" }));
    sl.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const blk = b.closest(".slblock");
      if (b.hasAttribute("data-sldel")) blk.remove();
      if (b.hasAttribute("data-slnopic")) { blk.querySelector(".sl-photo").value = ""; blk.querySelector(".sl-prev").innerHTML = '<span class="muted">No picture: shapes and icon shown</span>'; }
      if (b.dataset.slmv === "-1" && blk.previousElementSibling) sl.insertBefore(blk, blk.previousElementSibling);
      if (b.dataset.slmv === "1" && blk.nextElementSibling) sl.insertBefore(blk.nextElementSibling, blk); });
    sl.addEventListener("change", async e => { if (!e.target.classList.contains("sl-file")) return; const file = e.target.files[0]; if (!file) return; const blk = e.target.closest(".slblock"); ok("Uploading picture…");
      try { const u = await uploadPic(file, `slides/${t.id}`); blk.querySelector(".sl-photo").value = u; blk.querySelector(".sl-prev").innerHTML = `<img src="${esc(u)}" alt="">`; ok("Picture uploaded. Save to publish."); } catch (x) { err(x.message); } });
  }
  const revert = $("#cms-revert");
  if (revert) {
    revert.onclick = () => { $("#cms-revert-confirm").hidden = false; revert.hidden = true; };
    $("#cms-revert-no").onclick = () => { $("#cms-revert-confirm").hidden = true; revert.hidden = false; };
    $("#cms-revert-yes").onclick = async () => { const { error } = await sb.from("site_edits").delete().eq("id", rowId); if (error) return err(error.message); location.reload(); };
  }
  f.onsubmit = async e => {
    e.preventDefault();
    const reason = $("#ef-reason").value.trim(); if (reason.length < 3) return err("Give a short reason for the change.");
    let data;
    try {
      if (t.coll === "page") { const image = readImgSlot(), intro = $("#pg-intro").value.trim(); data = {}; if (image) data.image = image; if (intro) data.intro = intro; }
      else if (t.coll === "slides") {
        const slides = [...sl.querySelectorAll(".slblock")].map(b => { const v = c => b.querySelector(c).value.trim(); const s = { eyebrow: v(".sl-eyebrow"), title: v(".sl-title"), text: v(".sl-text"), cta: v(".sl-cta"), route: v(".sl-route"), icon: v(".sl-icon") || "articles", tone: v(".sl-tone") }; if (v(".sl-photo")) s.photo = v(".sl-photo"); return s; });
        if (!slides.length) throw new Error("Keep at least one slide.");
        const bad = slides.find(s => !s.title || !s.cta || !s.route); if (bad) throw new Error("Every slide needs a title, a button label and where the button goes.");
        const badRoute = slides.find(s => !FILES[s.route.split(".")[0]]); if (badRoute) throw new Error(`"${badRoute.route}" isn't a page on this site. Use a page name such as notes, recs, tool.chemo or g.G-NICE-NG12.`);
        data = { slides };
      } else {
        const base = t.orig || t.rec; data = {};
        for (const el of f.querySelectorAll("[data-k]")) {
          const k = el.dataset.k, kind = el.dataset.kind; let v;
          if (kind === "bool") v = el.checked; else if (kind === "num") v = el.value === "" ? null : Number(el.value);
          else if (kind === "lines") v = lines(el.value);
          else if (kind === "clinics") v = lines(el.value).map(l => { const [name, address, days, phone] = l.split("|").map(s => s.trim()); return { name: name || "", address: address || "", days: days || "", phone: phone || "" }; });
          else if (kind === "json") { try { v = JSON.parse(el.value); } catch { throw new Error(`"${humanKey(k)}" isn't valid JSON. Check brackets, quotes and commas.`); } }
          else if (kind === "nstr") v = el.value.trim() || null; else v = el.value.trim();
          if (JSON.stringify(v) !== JSON.stringify(base[k])) data[k] = v;
        }
        const image = readImgSlot(), ik = t.coll === "portfolio" ? "image" : IMG_FIELD(t.coll);
        if (JSON.stringify(image) !== JSON.stringify(base[ik] || null)) data[ik] = image;
        if (!Object.keys(data).length) throw new Error("Nothing has changed yet.");
      }
    } catch (x) { return err(x.message); }
    const { error } = await sb.from("site_edits").upsert({ id: rowId, scope: t.scope, data, reason });
    if (error) return err(/relation|does not exist|schema cache/i.test(error.message) ? "The site_edits table isn't set up yet: run supabase/upgrade-9-site-edits.sql in Supabase first." : "Couldn't save: " + error.message);
    ok("Saved. The site now shows this version.");
    setTimeout(() => location.reload(), 900);
  };
}
V.cms = () => {
  const items = cmsItems();
  const sel = PARAMS.get("id");
  const generic = sel && sel.startsWith("edit:");
  const cur = sel && !generic ? cmsCurrent(sel) : null;
  const patientHtml = CMS_KINDS.map(([k, t]) => `<details class="cms-group" ${sel && sel.startsWith(k + ":") ? "open" : ""}><summary>${t} <span class="muted">${items.filter(x => x.kind === k).length}</span></summary>
    ${items.filter(x => x.kind === k).map(x => `<a class="cms-item" href="${FILES.cms}?id=${encodeURIComponent(x.key)}" ${x.key === sel ? 'aria-current="page"' : ""}><span>${esc(x.title)}</span><span class="row-m">${statusPill(x.status)}${x.online ? '<span class="pill teal">Edited online</span>' : ""}</span></a>`).join("")}</details>`).join("");
  const gItem = (key, title) => { const k = key.slice(5); return `<a class="cms-item" href="${FILES.cms}?id=${encodeURIComponent(key)}" ${key === sel ? 'aria-current="page"' : ""}><span>${esc(title)}</span>${state.edits[k] ? '<span class="row-m"><span class="pill teal">Edited online</span></span>' : ""}</a>`; };
  const gGroup = (prefix, title, entries) => `<details class="cms-group" ${sel && sel.startsWith(prefix) ? "open" : ""}><summary>${esc(title)} <span class="muted">${entries.length}</span></summary>${entries.map(([k, t]) => gItem(k, t)).join("")}</details>`;
  const listHtml = `<label class="cms-filter">Find something to edit<input type="search" id="cms-filter" placeholder="e.g. carboplatin, ESGO, carousel"></label>
    <p class="cms-gh">Whole site</p>
    ${gGroup("edit:slides:", "Home page carousels", [["edit:slides:pro", "Professional home carousel"], ["edit:slides:pt", "Patient home carousel"]])}
    ${gGroup("edit:portfolio:", "Dr Arveen portfolio", [["edit:portfolio:main", "Portfolio details and photo"]])}
    ${gGroup("edit:page:", "Page pictures and intros", PAGE_LABELS.map(([r, l]) => [`edit:page:${r}`, l]))}
    <p class="cms-gh">Patient Education Centre</p>${patientHtml}
    <p class="cms-gh">Clinical reference</p>
    ${EDIT_COLLS.map(([c, t]) => { const list = editList(D, c) || []; return list.length ? gGroup(`edit:${c}:`, t, list.map(r => [`edit:${c}:${r.id}`, recTitle(r)])) : ""; }).join("")}
    ${state.editsTable === false ? `<p class="banner slim">Whole-site editing needs <code>supabase/upgrade-9-site-edits.sql</code> run once in Supabase.</p>` : ""}`;
  let form = generic ? editAnyForm(sel) : `<div class="cms-empty"><h2>Choose something to edit</h2><p class="muted">Pick anything on the left: the home carousels, the portfolio, a picture and intro for any page, patient articles, leaflets and cancer pages, or any clinical record (guidelines, recommendations, drugs, protocols, trials, staging, pathways, research, note chapters). You can also press "✎ Edit" at the top of any page while signed in as an editor.</p>
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
  <p class="prose muted">Edit any section of the site and add pictures. Saved changes appear on the site straight away. Every save is logged with your name and reason. Editing clinical content does not sign it off: reviewers still check it in the Review queue.</p>
  <div class="cms">${`<nav class="cms-list" aria-label="Content items">${listHtml}</nav>`}<div>${form}</div></div>`;
};
function bindCms() {
  if (PAGE !== "cms" || !isEditor()) return;
  const cf = $("#cms-filter");
  if (cf) cf.oninput = () => { const q = cf.value.trim().toLowerCase();
    app.querySelectorAll(".cms-group").forEach(g => { let n = 0; g.querySelectorAll(".cms-item").forEach(a => { const hit = !q || a.textContent.toLowerCase().includes(q); a.hidden = !hit; n += hit; }); g.hidden = q && !n; if (q) g.open = n > 0 && n < 40; }); };
  bindEditAny();
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
  bindImgSlot(`${cur.kind}/${cur.id}`, err, ok);
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
  app.innerHTML = `<div class="skeleton" role="status" aria-label="Loading"><span class="sk sk-eyebrow"></span><span class="sk sk-h1"></span><span class="sk sk-line"></span><span class="sk sk-line short"></span><div class="sk-grid"><span class="sk sk-card"></span><span class="sk sk-card"></span><span class="sk sk-card"></span></div></div>`;
  try { await loadSession(); await loadPatientItems(); if (approved() && (GATED || PAGE === "search" || PAGE === "workspace")) await loadPro(); } catch (e) { console.error(e); }
  IDX = index(); buildVocab(); bindSuggest();
  // Staff tools need a session verified with the authenticator app: send them to the two-step page first.
  if (STAFF_PAGES.includes(PAGE) && state.proLoaded && needsMfa()) {
    location.replace(`two-step.html?need=1&next=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`); return;
  }
  if ((GATED && !state.proLoaded) || (PAGE === "accounts" && !isAdmin()) || (PAGE === "cms" && !isEditor()) || (PAGE === "review" && !isReviewer()) || (PAGE === "adminws" && !isEditor())) {
    renderNav();
    app.innerHTML = PAGE === "accounts" && state.proLoaded ? `<h1>Administrators only</h1><p class="prose">Account approvals are limited to administrators.</p>`
      : PAGE === "adminws" && state.proLoaded ? `<h1>For editors, reviewers and administrators</h1><p class="prose">The Admin workspace is for accounts with the editor, reviewer or admin role. Your own bookmarks and notes are in <a href="workspace.html">My Workspace</a>.</p>`
      : PAGE === "review" && state.proLoaded ? `<h1>Reviewers only</h1><p class="prose">The review queue is for accounts with the reviewer or admin role. An administrator can change your role on the Accounts page. Pharmacists who verify doses need the reviewer role and the profession Pharmacist.</p>`
      : PAGE === "cms" && state.proLoaded ? `<h1>Editors only</h1><p class="prose">The content editor is for accounts with the editor, reviewer or admin role. An administrator can change your role on the Accounts page.</p>` : gateView();
    document.title = "Sign in · DR ARVEEN";
    bindAuth(); return;
  }
  render();
  // Links like recommendations.html#dg-cervical: scroll to the section once the page has been built.
  if (location.hash.length > 1) {
    try { history.scrollRestoration = "manual"; } catch {}
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) { const go = () => window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 16)); requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, 400); }
  }
}
boot();
})();
