# DR ARVEEN

Advanced Reference and Verified Evidence Network for Gynaecological Oncology.
A multi-page reference site for gynaecological oncology professionals in Malaysia, with a patient education centre built on the same records.

**Status: prototype.** Every clinical record is a seed record marked NOT VERIFIED. Doses, numerical trial results and recommendation grades are deliberately empty until a named clinical reviewer enters them from the original source.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | Public welcome page: choose professional or patient |
| `professional.html` … `glossary.html` | One page per section. Detail pages take `?id=`, e.g. `guideline.html?id=G-ESGO-CX-2023` |
| `login.html`, `register.html`, `reset-password.html`, `accounts.html` | Professional sign-in, account requests, password reset, admin approvals |
| `governance.html` | Every approval step for content, accounts and launch |
| `assets/patient-data.js` | Public patient content (generated, do not edit) |
| `assets/config.js` | Supabase project URL and public key |
| `supabase/setup.sql` | Database tables and security rules |
| `assets/app.js` | Page rendering, sign-in, search, calculators, quizzes, saved items |
| `assets/style.css` | Teal and lavender theme, light and dark mode |
| `404.html` | Shown for unknown addresses |
| `.github/workflows/pages.yml` | Optional automatic deployment (see DEPLOYMENT.md) |

## Access

- **Patients and caregivers:** every patient page is open, with no account.
- **Healthcare professionals:** professional pages need an approved account. The content is stored in Supabase and sent only to approved accounts. Set it up with [SUPABASE-SETUP.md](SUPABASE-SETUP.md).
- Professional content is edited in the separate private folder `dr-arveen-content`, never in this repository.

## Pages

Professional (sign-in required): Home, Guidelines, Recommendations, Diseases, Staging, Treatment protocols, Drug reference, Clinical trials, Clinical algorithms, Calculators, Evidence and research, Guideline updates, Education, My workspace, Editorial, About, Search.

Patients and caregivers: Patient Education Centre, Your cancer, Information leaflets, Prepare for appointments, Side-effect tracker, Medical glossary.

## Run locally

Any static file server works. With Node installed:

```bash
npx serve .
```

Then open the address it prints. Opening `index.html` directly from disk also works in most browsers.

See [DEPLOYMENT.md](DEPLOYMENT.md) to publish on GitHub Pages.
