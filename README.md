# DR ARVEEN

Advanced Reference and Verified Evidence Network for Gynaecological Oncology.
A multi-page reference site for gynaecological oncology professionals in Malaysia, with a patient education centre built on the same records.

**Status: prototype.** Every clinical record is a seed record marked NOT VERIFIED. Doses, numerical trial results and recommendation grades are deliberately empty until a named clinical reviewer enters them from the original source.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` … `glossary.html` | One page per section. Detail pages take `?id=`, e.g. `guideline.html?id=G-ESGO-CX-2023` |
| `assets/data.js` | All clinical content (guidelines, staging, protocols, drugs, trials, leaflets). Edit content here only |
| `assets/app.js` | Page rendering, search, calculators, quizzes, saved items |
| `assets/style.css` | Teal and lavender theme, light and dark mode |
| `404.html` | Shown for unknown addresses |
| `.github/workflows/pages.yml` | Optional automatic deployment (see DEPLOYMENT.md) |

## Pages

Professional: Home, Guidelines, Recommendations, Diseases, Staging, Treatment protocols, Drug reference, Clinical trials, Clinical algorithms, Calculators, Evidence and research, Guideline updates, Education, My workspace, Editorial, About, Search.

Patients and caregivers: Patient Education Centre, Your cancer, Information leaflets, Prepare for appointments, Side-effect tracker, Medical glossary.

## Run locally

Any static file server works. With Node installed:

```bash
npx serve .
```

Then open the address it prints. Opening `index.html` directly from disk also works in most browsers.

See [DEPLOYMENT.md](DEPLOYMENT.md) to publish on GitHub Pages.
