# Setting up sign-in with Supabase

Patient pages work for everyone without an account. Professional pages need an account that an administrator has approved. Supabase provides the accounts and stores the professional content, so that content is no longer in the public files of this site.

You only do this once. It takes about 20 minutes.

## 1. Create the Supabase project

1. Go to supabase.com and create a free account.
2. Click **New project**. Name it `dr-arveen`. Set a strong database password and keep it in a password manager.
3. For **Region**, choose **Southeast Asia (Singapore)**, the closest region to Malaysia.
4. Wait for the project to finish setting up.

## 2. Create the tables and security rules

1. In the project, open **SQL Editor → New query**.
2. Open `supabase/setup.sql` from this repository, copy all of it, paste it in, and click **Run**. It should end with "Success".

This creates professional profiles (every new account starts as **pending**), the protected content table, an audit log of approvals, and the security rules. Visitors who aren't signed in, or whose account isn't approved, can't read professional content.

## 3. Set the sign-in addresses

In **Authentication → URL Configuration**:

- **Site URL:** `https://raakesh0308-create.github.io/dr-arveen-arasu-gynaeoncologist.github.io/`
- **Redirect URLs:** add `https://raakesh0308-create.github.io/dr-arveen-arasu-gynaeoncologist.github.io/**`

If you later rename the repository or add your own domain, update both.

In **Authentication → Providers → Email**, keep **Confirm email** turned on.

## 4. Connect the site

1. Open **Project Settings → API** (in newer projects: **Project Settings → API Keys**).
2. Copy the **Project URL** and the **anon** key (newer projects call it the **publishable** key, starting `sb_publishable_`).
3. Paste both into `assets/config.js`, replacing `https://YOUR-PROJECT.supabase.co` and `YOUR-ANON-KEY`.

This key is meant to be public, and the security rules protect the data. **Never** paste the `service_role` or **secret** key into any file in this repository.

## 5. Load the professional content

The professional content lives in `Documents\dr-arveen-content`, outside this public repository.

1. In PowerShell, inside `Documents\dr-arveen-content`, run `node tools/build.mjs ../dr-arveen-site`. This creates `seed.sql` there and refreshes the public `assets/patient-data.js` here.
2. In Supabase **SQL Editor → New query**, paste the whole of `seed.sql` and click **Run**.

Repeat both steps whenever you change `data.js`. If you changed patient content, also commit and push this site.

## 6. Make yourself the first administrator

1. Publish the site (commit and push), open `register.html` on the live site, and request an account with your own details.
2. Open the confirmation email and click the link.
3. In Supabase **SQL Editor**, run this, using your email:

```sql
update public.profiles set status = 'approved', role = 'admin' where email = 'you@example.com';
```

4. Sign in on the site. **Accounts** now appears in the professional menu. That is where you approve everyone else.

Also turn on multi-factor sign-in for your Supabase dashboard account (**Account → Security**).

## 7. Approving professionals

1. Open **Accounts** on the site. New requests show as **pending**.
2. Check the registration number on the public register of the relevant body (Malaysian Medical Council, Pharmacy Board Malaysia or Malaysia Nursing Board), and that the name matches.
3. Click **Approve** or **Reject**. You can also change roles (reader, editor, reviewer, admin) or suspend an account. Every change is saved in the `account_audit` table.

## 8. Problem reports (upgrade 2)

Every page has a "Report a problem with this page" form. Reports go into a `feedback` table that only administrators can read; they appear under **Reported problems** on the Accounts page.

If you ran `setup.sql` before this feature was added, run `supabase/upgrade-2-feedback.sql` once in **SQL Editor → New query**. New projects get it automatically from `setup.sql`.

## 9. Online editor and pictures (upgrade 3)

Run `supabase/upgrade-3-editor.sql` once in **SQL Editor → New query**. It creates:

- a `patient_items` table for online edits to articles, leaflets and cancer pages. Anyone can read it, because patient content is public; only editors can change it.
- a safeguard in the database: only **reviewer** or **admin** accounts can set APPROVED, and approval needs a reviewer name and review date.
- a `content_audit` log of every save.
- a public `site-images` storage bucket for pictures (JPEG, PNG or WebP up to 3 MB). Only editors can upload.

To use the editor, sign in and open the **account menu (top right) → Edit content**. Admins can use it straight away. To let someone else edit, set their role on the **Accounts** page:
- **editor:** can write and change status up to clinical review.
- **reviewer:** can also approve.

Online edits take priority over the built-in content. **Discard online edits** returns an item to the built-in version.

## 10. Review queue and sign-off (upgrade 4)

Run `supabase/upgrade-4-reviews.sql` once in **SQL Editor → New query**. New projects get it automatically from `setup.sql`. It creates:

- `pro_reviews`: one sign-off per item, with decision, reviewer name, review date, next review date and note. Approved professionals can read sign-offs; only **reviewer** and **admin** accounts can write them.
- A database safeguard: only an account whose profession is **Pharmacist** can mark a dose **PHARMACIST VERIFIED**.
- `pro_review_audit`: the history of every sign-off and withdrawal.

**To use it:** sign in and open the **account menu (top right) → Review queue**. Choose a section, open an item, check it against the source, then choose a decision and click **Save sign-off**. The new status shows on the site straight away.

**To let a pharmacist verify doses:**
1. They register with profession **Pharmacist**.
2. You approve them on the Accounts page and set their role to **reviewer**.

Sign-offs are stored online and don't change the content files. If you change an item's text in the files later, review it again.

## Test the protection

After setup, check all of these:

- Signed out: `guidelines.html` shows the sign-in form, and `patients.html` works normally.
- Signed in with a pending account: professional pages say the account is waiting for approval.
- Signed in with an approved account: professional pages show content.
- In Supabase **Table Editor → pro_content**, the rows exist, and the lock icon shows that row-level security is on.

## Important: older content in the repository history

Earlier versions of this repository included `assets/data.js` with the seed professional content. It was removed from the current version, but GitHub still keeps it in the history of past commits. It's unverified seed data, so the risk is low. Verified professional content should only ever go into `dr-arveen-content/data.js` and Supabase, never into this repository. If you want the history fully clean, create a new repository from the current files and delete the old one.
