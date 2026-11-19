# DR ARVEEN — Security audit (Phases 1–2: findings only)

Audit date: 2026-11-19 · Branch: `security-hardening` · Scope: this repository (`dr-arveen-site`) and the Supabase SQL it contains.
Method: code reading plus local checks only. No scans, attacks or load tests were run against the live site or the live Supabase project.
No code has been changed yet. Phase 3 starts only after your approval.

> **Note on the template.** The audit request was written for a school site (students, teachers, grades).
> DR ARVEEN has no students or grades. Each check was applied to this site's own equivalents:
>
> | School term | DR ARVEEN equivalent |
> |---|---|
> | Student data | Staff account records (name, email, profession, registration number, institution), private workspaces, sign-offs and audit logs |
> | Grades and submissions | Clinical sign-offs and pharmacist dose verification |
> | Teachers and admins | Editors, reviewers and administrators |
> | Students | Approved professional "readers" and anonymous patients |

---

## Executive summary (for a non-technical reader)

**What's in good shape**
- The database protects each kind of information with rules that the server enforces.
  - People cannot make themselves administrators.
  - Nobody can read another person's private workspace, and administrators can't either.
  - Professional content is only given to approved accounts.
- There are no passwords or secret keys in the code or in its history.
- Passwords are handled by Supabase, which stores them securely.
- Most important actions are already logged.

**What needs attention, in order**
1. **Turn on two-step sign-in for staff (High).** The rule is already written (upgrade 7) but hasn't been switched on. Until it is, a stolen staff password is enough to change content or approve accounts.
2. **A crafted "sign in" link can run an attacker's code (High).** If a staff member is tricked into using the link to sign in, the attacker's code runs inside DR ARVEEN as that person. This needs a small code fix.
3. **Approval labels can be faked by an editor (High).** An editor account, or a stolen one, could make a dose look "PHARMACIST VERIFIED" or content look approved by writing to the database directly instead of through the website. For a medical site this is a patient-safety issue. It needs database rules, not just website rules.
4. **Medium issues:**
   - Content written by editors can carry hidden code.
   - Login tokens are kept in the browser, and the site has no Content Security Policy.
   - Professional content changes aren't logged.
   - Draft patient leaflets are publicly visible.
   - The open forms (problem reports, sign-up) have no spam protection.
   - Staff pages can be embedded in other websites, which allows click-tricking.
   - Old professional content is still in the public GitHub history.
5. **Low issues:** mostly tidying and privacy hygiene.

**Overall:** no critical flaw found. The three High items should be fixed before more staff accounts are created.

---

## Phase 1 — How the project works

### Tech stack
| Part | What it is |
|---|---|
| Front end | Static HTML pages plus one vanilla-JavaScript app (`assets/app.js`, ~2,300 lines) and CSS. No framework, no build step for the site. |
| Hosting | GitHub Pages: `.github/workflows/pages.yml` publishes the repo root on every push to `main`. The deploy runs `tools/check.mjs` (blocks secret keys and professional content) and `tools/contrast.mjs`. |
| Back end | Supabase (managed PostgreSQL, Auth, Storage). There is no custom server: **every server-side rule is a PostgreSQL Row-Level Security (RLS) policy or trigger** in `supabase/*.sql`. |
| Auth | Supabase Auth: email and password, email confirmation, password reset, TOTP authenticator for two-step sign-in. |
| Third-party code | `@supabase/supabase-js@2.45.4` from cdn.jsdelivr.net (every page); Google Fonts CSS. |
| Content pipeline | A private folder (`dr-arveen-content`, not in this repo) builds `seed.sql` (professional content, loaded into Supabase) and the public `assets/patient-data.js`. |
| Tests | **None.** There are no unit or integration tests, only the two deploy checks above. |
| Dependencies | No `package.json` or other manifest, so no `npm audit` is possible. The only runtime dependency is the pinned supabase-js CDN script. |

### Roles
| Role | Should be able to | Should NOT be able to |
|---|---|---|
| Anonymous visitor (patients) | Read patient pages, the public portfolio and the public carousel; send a problem report; request an account | Read professional content, other people's data, reports or drafts |
| Pending, rejected or suspended account | Sign in and see a "waiting" message | Read professional content |
| Approved reader | Read professional content and sign-offs; keep a private workspace | Edit content, sign off, see other accounts |
| Editor | All of the above, plus edit content and upload pictures | Approve content, sign off, verify doses, manage accounts |
| Reviewer | All of the above, plus sign off and record Malaysian CPG positions | Verify doses (unless registered as a Pharmacist), manage accounts |
| Reviewer with profession "Pharmacist" | Mark doses PHARMACIST VERIFIED | — |
| Admin | Everything above, plus approve accounts, change roles and read problem reports | Read other people's private workspaces (by design) |

### Entry points
- **Pages:** 60+ static HTML pages. Each sets `data-page`, and the app renders that view. Records are opened with `?id=`.
- **URL parameters read by the app:**
  - `id` (all record pages and `content-editor.html`)
  - `q` (search)
  - `next` (`login.html`, `two-step.html`)
  - `need` (`two-step.html`)
  - `title` (new article)
- **Authentication flows:**
  - sign-in: `login.html` → `signInWithPassword`
  - sign-up: `register.html` → `signUp`, with profession and registration details in user metadata
  - password reset: `reset-password.html` → `resetPasswordForEmail` / `updateUser`
  - two-step sign-in: `two-step.html` → TOTP enrol and verify
- **Staff pages:**
  - `accounts.html`: approvals and roles (admin)
  - `content-editor.html`: all content and pictures (editor)
  - `review-queue.html`: sign-offs (reviewer)
  - `admin-workspace.html`: dashboard and backup export (editor; the export is admin-only)
  - `editorial.html`
- **Database tables reached directly from the browser** with the public anon key:
  - `profiles`, `pro_content`, `feedback`
  - `patient_items`, `content_audit`
  - `pro_reviews`, `pro_review_audit`
  - `user_workspace`
  - `my_cpg`, `my_cpg_audit`
  - `site_edits`, `site_edits_audit`
  - `account_audit`
  - storage bucket `site-images`
- **File upload:** pictures go to the `site-images` bucket (editors only).
- **Not present:** webhooks, cron jobs and server code. GitHub Actions only deploys.

---

## Phase 2 — Findings

Severity scale: **Critical** means exploitable now by anyone with serious impact. **High** means serious impact that needs either a user step or a stolen staff account. **Medium** and **Low** follow from that.

### H1 — Staff powers work with a password alone (two-step not enforced yet) · **High**
- **Where:** `supabase/upgrade-7-staff-2fa.sql:10-48` has been written but not run. In the live database, `is_editor()`, `is_reviewer()` and `is_admin()` are still the versions in `supabase/setup.sql:44-51` and `:223-226`, which have no AAL2 (two-step) check.
- **Risk:** the website sends staff to the two-step page, but that check runs only in the browser (`assets/app.js` `STAFF_PAGES` / `needsMfa`). The database itself still accepts staff actions from a password-only session.
- **How it could be exploited:** someone with a phished or reused staff password calls Supabase directly with the public key. They can then approve accounts, change roles, rewrite content or sign off reviews.
- **Fix:**
  1. Every staff account sets up two-step sign-in.
  2. Run `upgrade-7-staff-2fa.sql`.
  3. In Phase 3, add the same AAL2 check to the new `site_edits` policy, which uses `is_editor()` and so is covered automatically, and to the storage policies, also covered.
  4. Add a test that a password-only session is refused.

### H2 — The `next` link after sign-in can run attacker code or redirect off-site · **High**
- **Where:**
  - `assets/app.js:401`: after login, `location.href = next`, guarded by `/^[a-z]+:|^\/\//i`
  - `assets/app.js:1128`: the same guard after two-step verification
  - `assets/app.js:1116`: the two-step "Continue" button uses `href="${esc(next)}"` with no check at all
- **Risk:** the guard can be bypassed. I checked this locally against the browser's own URL parser:
  - `"␠␠javascript:…"` and `"java<TAB>script:…"` pass the check, and the browser treats both as `javascript:`.
  - `"/\evil.example/"` passes the check and resolves to another website.
  - On `two-step.html`, any `javascript:` value becomes a clickable button.
- **How it could be exploited:** an attacker emails a staff member a genuine DR ARVEEN sign-in link with a crafted `next`. After the person signs in, the attacker's script runs on the real DR ARVEEN site, with that person's session. Because tokens are stored in the browser (see M2), the account can be taken over.
- **Fix:**
  - Accept `next` only if it matches `^[a-z0-9-]+\.html(\?[\w=&%.-]*)?(#[\w-]*)?$` (a page name on this site). Otherwise use the default page.
  - Apply the same check to the Continue button.
  - Add a unit test with the bypass strings above.

### H3 — Approval and pharmacist-verified labels can be forged by any editor · **High**
- **Where:**
  - `assets/app.js:306`: `Object.assign(x, data, …)` lays a `site_edits` row over a record with no limit on which fields it may set.
  - `supabase/upgrade-9-site-edits.sql:28`: any editor may write any JSON.
  - `supabase/setup.sql:96-100`: editors may also overwrite whole `pro_content` collections.
  - The rules that protect sign-offs (`guard_pro_review`, `setup.sql:246-263`) cover only the `pro_reviews` table.
- **Risk:** the website's editor hides fields such as `status`, `doseStatus`, `reviewer` and `verifiedOn`, but that is only the browser. An editor, or anyone holding an editor's password (see H1), can write those fields directly. A dose would then show "PHARMACIST VERIFIED" and content "APPROVED" without any reviewer or pharmacist doing so. The `pro_reviews` sign-off is only applied when a matching review row exists, so a forged label stays.
- **How it could be exploited:**
  - A careless or compromised editor account makes an unchecked or wrong dose look pharmacist-verified.
  - Clinicians trust the label.
- **Fix:**
  1. Add a database trigger on `site_edits` that rejects reserved keys in `data`: `id`, `status`, `approval`, `reviewer`, `verifiedOn`, `nextReview`, `reviewNote`, `dose*` status keys, `refReview` and `html`. It should also force `scope` from the id prefix.
  2. Restrict `pro_content` writes to admins (the content is loaded from `seed.sql` by the owner anyway), or add a similar trigger.
  3. In the browser, ignore those keys when applying edits.
  4. Add tests showing an editor's write of `{"doseStatus":"PHARMACIST VERIFIED"}` is refused.

### M1 — Content written by editors can carry hidden script (stored XSS) · **Medium**
- **Where:**
  - `assets/app.js:1789`: textbook note chapters are inserted as raw HTML (`${c.html}`).
  - Several attribute values are inserted without escaping, for example `${n.kind}` (`:984`), `${x.kind}` (`:1386`, `:1935`), and record ids in `href` and `id` attributes in many views.
  - Ids and `html` can be overwritten through `site_edits` or `pro_content` (see H3).
- **Risk:** an editor-level write can plant a script that runs for every approved professional, including administrators.
- **How it could be exploited:** a compromised editor account turns itself into admin by having the script run in an admin's browser.
- **Fix:**
  - Block `id` and `html` keys in edits (H3).
  - Escape every attribute interpolation with `esc()`.
  - Sanitise note HTML with an allow-list when it is built, or render notes from Markdown in the browser.
  - Add a Content Security Policy (M2) as a second layer.
  - Add tests that inject `"><img onerror>` into each editable field and confirm it renders as text.

### M2 — Login tokens in browser storage, no Content Security Policy, unpinned CDN script integrity · **Medium**
- **Where:**
  - Every HTML page loads `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/...` without an `integrity=` attribute (for example `professional.html`, near the end). The pages are generated by `dr-arveen-content/tools/pages.mjs`.
  - No page sets a Content Security Policy.
  - supabase-js keeps the access and refresh tokens in `localStorage` (`assets/app.js:314` reads the session).
- **Risk:** any script injection (H2, M1, or a compromised CDN) can read the tokens. HttpOnly cookies aren't available to a static site.
- **Fix:**
  - Add `integrity` and `crossorigin` to the CDN script, or self-host the file in `assets/`.
  - Add `<meta http-equiv="Content-Security-Policy">` allowing only the site itself, cdn.jsdelivr (or self), the Supabase project URL, Google Fonts and `https:` images. The theme script would need a hash or would have to move to a file.
  - In Supabase, shorten the JWT expiry (for example to 15–30 minutes) and keep refresh-token rotation on.

### M3 — Changes to professional content are not logged · **Medium**
- **Where:** `supabase/setup.sql:88-100`. `pro_content` has no audit trigger, and `updated_by` is never stamped. Every other table has an audit log.
- **Risk:** a bulk overwrite or deletion of guidelines or doses can't be traced or undone.
- **Fix:** add a `pro_content_audit` trigger that stores old and new data, who made the change and when. Combine this with H3, limiting writes to admins.

### M4 — Draft and withdrawn patient content is public · **Medium**
- **Where:** `supabase/setup.sql:144-145`: `patient_items` can be read by anyone (`using (true)`) whatever its status. The app then shows DRAFT items on the public site.
- **Risk:** patients may see unreviewed medical text, and withdrawn items stay downloadable through the API.
- **Fix:**
  - Anonymous users read only `status = 'APPROVED'`; editors read everything.
  - Decide whether built-in, not-yet-approved leaflets should stay public.
  - This is partly a content-governance decision for you.

### M5 — No spam or abuse protection on the open forms · **Medium**
- **Where:**
  - `supabase/setup.sql:117-119`: anyone can insert into `feedback`, with no limit.
  - `register.html` → `signUp` has no CAPTCHA.
- **Risk:** a script using the public key could flood thousands of reports or fake account requests. That buries real reports, costs email quota, and could be used for email-bombing.
- **Fix:**
  - Turn on Supabase Auth CAPTCHA (Cloudflare Turnstile or hCaptcha) for sign-up and password reset.
  - Add a per-IP or per-time-window limit for feedback, for example through a small Supabase Edge Function or a database check on recent rows.
  - Review the Auth rate limits in the dashboard.

### M6 — Staff pages can be framed by other sites (clickjacking) · **Medium**
- **Where:** all pages. GitHub Pages can't send `X-Frame-Options` or CSP `frame-ancestors` headers, and `frame-ancestors` doesn't work in a `<meta>` tag.
- **Risk:** a malicious page could invisibly frame `accounts.html` and trick a signed-in admin into clicking "Approve" or changing a role.
- **Fix:**
  - Add a small frame-busting script on staff pages (refuse to render when `window.top !== window.self`).
  - Longer term, host behind Cloudflare Pages, Netlify or a Cloudflare proxy, which can send real security headers.

### M7 — Old professional content is still in the public Git history · **Medium (already known)**
- **Where:** `assets/data.js` in commits `58387a1` and `d90ba34` (2026-10-27). This is already documented in `SUPABASE-SETUP.md`.
- **Risk:** anyone can still download that early, unverified professional content from GitHub.
- **Fix:** if this matters, create a fresh repository from the current files (or rewrite history with `git filter-repo` and force-push). This is your decision because it rewrites the public repository.

### L1 — "Pharmacist" is self-declared at sign-up · **Low**
- **Where:** `supabase/setup.sql:26-32` copies `profession` from sign-up data. `guard_pro_review` (`:257`) trusts it.
- **Risk:** someone could register as "Pharmacist". It still needs an admin to approve the account and grant the reviewer role.
- **Fix:**
  - Show profession and registration prominently on the Accounts page and make admins confirm them (process).
  - Optionally add a separate admin-set `verified_pharmacist` flag.

### L2 — Server password policy is weaker than the website's · **Low**
- **Where:** `assets/app.js:407,425` require 8 characters, but only in the browser. The Supabase default minimum is 6.
- **Fix:** in Supabase Auth settings, set minimum length to 10 or more, require mixed character types, and enable leaked-password protection if your plan allows it.

### L3 — Public edit rows expose staff names, and scope is chosen by the browser · **Low**
- **Where:**
  - `supabase/upgrade-9-site-edits.sql:24`: public rows include `editor`, `reason` and `updated_by` (a staff user id).
  - `patient_items` similarly exposes `reviewer` and `updated_by`.
  - The browser picks `scope`, so an editor could publish professional text as public.
- **Fix:**
  - Expose public data through a view that leaves out the staff columns.
  - Enforce `scope` in the H3 trigger.

### L4 — Uploaded pictures keep their hidden metadata · **Low**
- **Where:** `assets/app.js` `uploadPic`, and the `site-images` bucket (`setup.sql:200-212`).
- **What's fine:** type and size are limited by the bucket, names are randomised, and files are served from the Supabase domain and never executed.
- **Risk:** photos can contain GPS location and camera data (EXIF), which could reveal a clinic or home location.
- **Fix:** re-encode images through a browser canvas before upload, which strips the metadata. Optionally also check the file's magic bytes.

### L5 — Outdated client library; GitHub Actions pinned by tag · **Low**
- **Where:**
  - supabase-js `2.45.4` dates from 2024. No known vulnerability was identified offline, but it can't be checked automatically because there is no manifest.
  - `.github/workflows/pages.yml` uses `@v4`-style tags rather than commit SHAs.
- **Fix:**
  - Update to the current 2.x release, with SRI (M2).
  - Pin the Actions to commit SHAs.
  - Optionally add a `package.json` so `npm audit` and Dependabot can watch the library.

### L6 — Admin backup downloads personal data to the computer · **Low**
- **Where:** `assets/app.js:1196-1227` exports profiles (names, emails, registration numbers) and audit logs as plain JSON.
- **Fix:** keep the warning (already shown). Advise storing the file encrypted. Optionally leave registration numbers out of the export.

### L7 — Patient planning tools store health notes in the browser · **Low**
- **Where:** the patient tool, tracker and workspace on patient pages (`localStorage`, on the device only).
- **Risk:** on a shared or family computer, someone else could read symptom diaries.
- **Fix:** a clear "Delete everything saved on this device" button on each tool, plus a note about shared devices. Check what exists today.

### L8 — Other low-priority items
- **Google Fonts:** loading fonts from Google sends visitors' IP addresses to Google. Self-hosting the fonts removes this.
- **Free-text reviewer name:** the reviewer name in sign-offs is typed freely, so someone could type another person's name. The database also records the real user id (`reviewer_id`), so show that name instead.
- **No idle timeout:** there is no automatic sign-out after inactivity. You removed it on purpose; this is an accepted risk, best balanced by H1 (two-step) and a short token lifetime (M2).
- **Single admin can create admins:** consider a two-admin rule or alerts on role changes (see Logging).

### Checks that passed
- **Self role escalation is impossible.** There is no policy that lets users update their own profile, and the sign-up trigger never sets `status` or `role` (`setup.sql:22-59`).
- **IDOR (reading someone else's data by changing an id):**
  - `user_workspace` is owner-only for all operations.
  - `profiles` can be read only by the owner or an admin.
  - `feedback` can be read only by admins.
  - Audit logs can be read only by the relevant staff role.
  - Ids in URLs pick content, not access: access is enforced by RLS.
- **Server-side protection:** staff routes are protected in the database, not just hidden in the menu (subject to H1).
- **Secrets:**
  - No `service_role` or secret key was found in the code or any of the 48 commits.
  - `assets/config.js` holds only the public anon key; its role claim was checked and is `anon`.
  - The deploy check blocks secret keys.
- **Passwords:** Supabase stores them with bcrypt. Reset tokens are random, single-use and expiring, all managed by Supabase.
- **Injection:**
  - There is no SQL string building in the code; all queries go through the Supabase client.
  - There is no server code, so command injection, path traversal, SSRF and deserialisation risks don't apply.
- **CSRF:** the API uses bearer tokens, not cookies, so classic CSRF doesn't apply. Clickjacking (M6) is the relevant risk instead.
- **CORS:** managed by Supabase. Data is protected by RLS, not by origin.
- **Transport:** HTTPS is enforced on `*.github.io` (on the HSTS preload list) and on Supabase.
- **Exposed files:** there are no `.env` or backup files in the repo. `seed.sql` and `data.js` are git-ignored and checked at deploy.
- **Debug output:** there is no debug mode, and error messages shown to users are generic.
- **Doses verified only by pharmacists:** this is enforced in the database for `pro_reviews` (see H3 for the gap elsewhere).
- **Logging:** account status and role changes, patient-content saves, sign-offs, Malaysian CPG positions and site edits are all audited.

### Logging and monitoring
- **Logged:** role and status changes (`account_audit`), patient-content changes, sign-offs, CPG positions, site edits.
- **Not logged:** `pro_content` writes (M3).
- **Logins and failed logins:** recorded only in Supabase's Auth logs, which are kept for a limited time depending on the plan. There is no alerting.
- **Recommend:**
  - Supabase log drains or a weekly review.
  - An alert (for example, a database webhook to email) when a role becomes `admin` or `reviewer`, and on any `pro_content` change.

### Privacy and data protection (flags, not legal advice)
- **Applicable law:** the site operates in Malaysia, so the **Personal Data Protection Act 2010** most likely applies. Its 2024 amendments include breach notification, data portability and a data protection officer requirement for some organisations.
  - GDPR may apply if EU residents use it.
  - FERPA, COPPA and India's DPDP Act are unlikely to apply.
  - Please confirm with a qualified adviser.
- **Data collected from staff:**
  - name, email, profession, registration body and number, institution
  - TOTP factor, managed by Supabase
  - private workspace
- **Data collected from patients:** no accounts. Problem reports can include an optional contact detail.
- **Gaps:**
  - No written retention period for rejected or suspended accounts and old problem reports.
  - No self-service account deletion or data-export request route. Make sure `privacy.html` says how to request these.
  - No documented breach-response plan.
  - Registration numbers are kept after approval. Consider whether they're still needed.

---

## Proposed Phase 3 order (on approval)
Each fix gets its own commit on `security-hardening`, plus tests. There are none today, so I would add a small `node --test` suite for the browser-side helpers. I'd also add SQL policy tests that you can run in the Supabase SQL editor; I won't run anything against the live project myself.

| Order | Fix | Commit plan |
|---|---|---|
| 1 | **H2** | Strict `next` validation in one helper, plus unit tests |
| 2 | **H3 + L3 + M1 (database part)** | `upgrade-10-hardening.sql`: a `site_edits` guard trigger (reserved keys, enforced scope), `pro_content` writes limited to admins, a `pro_content` audit (M3), and a public view without staff columns. Browser-side key filtering. SQL test script. |
| 3 | **M1 (browser part)** | Escape every attribute interpolation; sanitise note HTML; XSS rendering tests |
| 4 | **M2** | SRI on supabase-js (or self-hosted), CSP meta tag (theme script moved to a file), in `pages.mjs` and the regenerated pages |
| 5 | **M6** | Frame-busting on staff pages |
| 6 | **M4** | `patient_items` anonymous read limited to APPROVED, *if you agree with the content decision* |
| 7 | **Low items** | L2 note, L4 EXIF stripping, L5 Action SHA pins, L7 delete button, L8 reviewer name from `reviewer_id` |
| — | **H1 and M7** | Need your actions (2FA set-up, then upgrade 7; repository history decision). I'll give step-by-step instructions. |

**Please confirm:**
- (a) approval to start Phase 3;
- (b) whether M4 should hide unapproved patient items from the public;
- (c) whether `pro_content` writes should become admin-only.
