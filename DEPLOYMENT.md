# Deploying DR ARVEEN on GitHub Pages

Your site will live at `https://<your-username>.github.io/<repository-name>/`, for example `https://drarveen.github.io/dr-arveen/`.

## What GitHub Pages can and cannot do

GitHub Pages hosts files. It does not run a server or a database. On this site that means:

| Works | Does not work on GitHub Pages |
| --- | --- |
| Every page and every record has its own address | Sign-in accounts |
| Search, filters, calculators, quizzes, algorithms | Content shared between users (one editor's change seen by everyone) |
| Bookmarks, notes, checklists, side-effect tracker (saved in each visitor's own browser) | The editorial workflow saving to a database |
| Light and dark mode | Sending email notifications for guideline updates |

To change content, you edit `assets/data.js` and publish again. When you need accounts and a shared database, see "Moving to a full server" at the end.

## Before you start

1. A GitHub account (free at github.com).
2. The contents of the `dr-arveen-site` folder.
3. Decide on visibility. On a free GitHub plan, Pages only works for **public** repositories, which means anyone can see the source files. Private repositories need a paid plan (GitHub Pro, Team or Enterprise).

## Option A: upload in the browser (no tools needed)

1. On github.com, click **New repository**. Name it, for example, `dr-arveen`. Choose **Public**. Click **Create repository**.
2. On the new repository page, click **uploading an existing file**.
3. Open the `dr-arveen-site` folder on your computer, select **everything inside it** (not the folder itself), and drag it into the browser. Check that `index.html` sits at the top level, with the `assets` folder next to it.
4. Click **Commit changes**.
5. Go to **Settings → Pages**. Under **Build and deployment → Source**, choose **Deploy from a branch**. Set the branch to **main** and the folder to **/ (root)**. Click **Save**.
6. Wait one or two minutes, then refresh the Settings → Pages screen. It shows your live address. Open it.

The browser upload does not always include the `.github` folder. That is fine for option A, which does not need it.

## Option B: Git on your computer (automatic deploys)

Install Git from git-scm.com. Then, in a terminal inside the `dr-arveen-site` folder:

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "DR ARVEEN first version"
```

Create an empty repository on github.com (no README), then connect and push, replacing the address with yours:

```bash
git remote add origin https://github.com/<your-username>/dr-arveen.git
```

```bash
git push -u origin main
```

In **Settings → Pages → Source**, choose **GitHub Actions**. The included workflow (`.github/workflows/pages.yml`) checks the scripts for syntax errors and publishes the site on every push to `main`. Progress shows in the **Actions** tab.

## Updating the site

1. Edit `assets/data.js` (content) or the other files.
2. Option A: open the file on github.com, click the pencil icon, paste the new version, and commit. Option B: `git add .`, `git commit -m "describe the change"`, `git push`.
3. The live site updates within a few minutes. If you don't see the change, force-refresh the page (Ctrl+F5).

Keep every clinical change traceable: write a clear commit message, for example "Verify G-ESGO-CX-2023 metadata against source (reviewer: Dr X)". Git history then acts as your audit trail.

## Using your own domain (optional)

1. Buy a domain, for example `drarveen.com` or `drarveen.my` (`.my` domains are sold through MYNIC-accredited resellers).
2. In **Settings → Pages → Custom domain**, enter it and save. GitHub creates a `CNAME` file in the repository.
3. At your domain provider, add the DNS records GitHub shows: a `CNAME` record pointing `www` to `<your-username>.github.io`, and for the bare domain the four `A` records listed in GitHub's documentation ("Managing a custom domain for your GitHub Pages site").
4. When the domain check passes, tick **Enforce HTTPS**.

## Checks after each deploy

- The home page loads, and the top menu reaches every section.
- A detail page opens from a list, for example a guideline, and its address ends in `?id=…`.
- Search returns results, for example "BRCA".
- Light and dark mode both look right.
- On a phone, the menu scrolls sideways and nothing overflows.
- An unknown address, for example `/nothing.html`, shows the "Record not found" page.

## Before you share the address publicly

GitHub Pages sites are public and are indexed by search engines.

- **Clinical review.** All seed content is marked NOT VERIFIED. Have a qualified clinician verify records against their sources before presenting the site as a clinical reference.
- **Disclaimer.** Keep the footer statement that the site is educational and does not replace clinical assessment or authorised prescribing.
- **Personal data.** The site does not collect personal data. Bookmarks, notes and tracker entries stay in each visitor's browser. Do not add forms that send patient information anywhere. If you later collect personal data, Malaysia's Personal Data Protection Act 2010 applies.
- **Medical device rules.** Calculators and decision pathways can count as medical-device software in some jurisdictions. Ask the Medical Device Authority (MDA) Malaysia for advice before presenting them as clinical decision support.
- **Copyright.** Link to guidelines and write your own summaries. Do not upload guideline PDFs or copy restricted text (for example NCCN content) into the site.
- **Hosting terms.** GitHub states that Pages is not meant for handling sensitive transactions such as passwords or payment details. That suits this version, which has none.

## Moving to a full server later

When you need sign-in accounts, shared editing, the review workflow with an audit log, or update emails, move to a host that runs a server and a database:

- **App hosting:** Vercel, Render, Railway, or a cloud virtual machine. For data held in or near Malaysia, choose a Malaysia or Singapore region where the provider offers one.
- **Database:** PostgreSQL. `schema.sql` (kept with the original prototype, not in this site folder) is the starting design, with the editorial rules built in.
- **Basics to set up:** HTTPS, secrets kept in the host's environment settings (never in the repository), daily database backups, error monitoring, and role-based access for editors and clinical reviewers.

This is a larger project: the pages would be rebuilt as a server application, for example with Next.js. The content in `assets/data.js` carries over as the first database import.
