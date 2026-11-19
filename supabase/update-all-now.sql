-- DR ARVEEN — all pending updates in one go (upgrades 2, 3, 4, 5, 6, 8, 9 and 10).
-- Paste this whole file into Supabase SQL Editor → New query → Run. Safe to run more than once.
-- NOT included on purpose: upgrade-7-staff-2fa.sql (set up two-step sign-in on the site first, then run it).


-- ======================== upgrade-2-feedback.sql ========================

-- DR ARVEEN upgrade 2: problem reports.
-- Run once in Supabase (SQL Editor → New query → paste → Run).
-- Anyone can send a report; only administrators can read or resolve them.
create table if not exists public.feedback (
  id bigserial primary key,
  page text not null check (char_length(page) <= 300),
  category text not null check (char_length(category) <= 100),
  message text not null check (char_length(message) between 5 and 2000),
  contact text check (contact is null or char_length(contact) <= 200),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz
);
alter table public.feedback enable row level security;
drop policy if exists "Anyone can send a report" on public.feedback;
create policy "Anyone can send a report" on public.feedback
  for insert to anon, authenticated with check (status = 'open' and resolved_by is null and resolved_at is null);
drop policy if exists "Admins read reports" on public.feedback;
create policy "Admins read reports" on public.feedback
  for select to authenticated using (public.is_admin());
drop policy if exists "Admins resolve reports" on public.feedback;
create policy "Admins resolve reports" on public.feedback
  for update to authenticated using (public.is_admin()) with check (public.is_admin());


-- ======================== upgrade-3-editor.sql ========================

-- DR ARVEEN upgrade 3: online content editor and picture uploads.
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to run again.

-- ---------- edited patient content ----------
-- One row per edited item. The website shows these on top of the built-in content.
create table if not exists public.patient_items (
  id text primary key,                       -- e.g. "article:fatigue", "leaflet:PIL-TX-CHEMO", "cancer:cervical"
  kind text not null check (kind in ('article', 'leaflet', 'cancer')),
  data jsonb not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'EDITORIAL REVIEW', 'CLINICAL REVIEW', 'APPROVED', 'WITHDRAWN')),
  reviewer text,
  last_review date,
  next_review date,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.patient_items enable row level security;

drop policy if exists "Anyone reads patient content" on public.patient_items;
create policy "Anyone reads patient content" on public.patient_items for select to anon, authenticated using (true);
drop policy if exists "Editors write patient content" on public.patient_items;
create policy "Editors write patient content" on public.patient_items for all to authenticated using (public.is_editor()) with check (public.is_editor());

-- Only reviewers and admins may approve; record who saved and when.
create or replace function public.guard_patient_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role into r from public.profiles where id = auth.uid() and status = 'approved';
  if new.status = 'APPROVED' and (tg_op = 'INSERT' or old.status is distinct from 'APPROVED') and coalesce(r, '') not in ('reviewer', 'admin') then
    raise exception 'Only a reviewer or administrator can approve content';
  end if;
  if new.status = 'APPROVED' and (new.reviewer is null or new.last_review is null) then
    raise exception 'Approved content needs a reviewer name and review date';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists patient_items_guard on public.patient_items;
create trigger patient_items_guard before insert or update on public.patient_items
  for each row execute function public.guard_patient_item();

-- History of every save (who, when, status change).
create table if not exists public.content_audit (
  id bigserial primary key,
  item_id text not null,
  changed_by uuid,
  old_status text,
  new_status text,
  action text not null,
  at timestamptz not null default now()
);
alter table public.content_audit enable row level security;
drop policy if exists "Editors read content audit" on public.content_audit;
create policy "Editors read content audit" on public.content_audit for select to authenticated using (public.is_editor());

create or replace function public.log_patient_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.content_audit (item_id, changed_by, old_status, new_status, action) values (old.id, auth.uid(), old.status, null, 'reverted to built-in version');
    return old;
  end if;
  insert into public.content_audit (item_id, changed_by, old_status, new_status, action)
  values (new.id, auth.uid(), case when tg_op = 'UPDATE' then old.status end, new.status, lower(tg_op));
  return new;
end $$;
drop trigger if exists patient_items_audit on public.patient_items;
create trigger patient_items_audit after insert or update or delete on public.patient_items
  for each row execute function public.log_patient_item();

-- ---------- picture storage ----------
-- Public bucket: anyone can view pictures; only editors can upload, replace or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Editors upload site images" on storage.objects;
create policy "Editors upload site images" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-images' and public.is_editor());
drop policy if exists "Editors change site images" on storage.objects;
create policy "Editors change site images" on storage.objects for update to authenticated
  using (bucket_id = 'site-images' and public.is_editor());
drop policy if exists "Editors delete site images" on storage.objects;
create policy "Editors delete site images" on storage.objects for delete to authenticated
  using (bucket_id = 'site-images' and public.is_editor());


-- ======================== upgrade-4-reviews.sql ========================

-- DR ARVEEN — upgrade 4: online review and sign-off of professional content.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
-- Creates: pro_reviews (one sign-off per item), pro_review_audit (history), and the rules:
--   * approved professionals can read sign-offs;
--   * only reviewer or admin accounts can sign off;
--   * only accounts whose profession is Pharmacist can mark a dose PHARMACIST VERIFIED;
--   * every sign-off needs a reviewer name and review date, and is logged.

create or replace function public.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved' and role in ('reviewer', 'admin'))
$$;

create table if not exists public.pro_reviews (
  item_id text primary key,                 -- e.g. "recommendation:R-EN-A01", "dose:carboplatin", "guideline:G-ESGO-EN-2021"
  kind text not null check (kind in ('guideline', 'recommendation', 'staging', 'protocol', 'drug', 'dose', 'trial', 'literature', 'algorithm', 'disease', 'notes')),
  status text not null check (status in ('VERIFIED AGAINST SOURCE', 'CLINICALLY REVIEWED', 'APPROVED', 'CHANGES NEEDED', 'PHARMACIST VERIFIED')),
  reviewer text not null check (char_length(reviewer) between 2 and 120),
  reviewed_on date not null,
  next_review date,
  note text check (note is null or char_length(note) <= 2000),
  reviewer_id uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.pro_reviews enable row level security;

drop policy if exists "Approved professionals read reviews" on public.pro_reviews;
create policy "Approved professionals read reviews" on public.pro_reviews for select to authenticated using (public.is_approved());
drop policy if exists "Reviewers write reviews" on public.pro_reviews;
create policy "Reviewers write reviews" on public.pro_reviews for all to authenticated using (public.is_reviewer()) with check (public.is_reviewer());

create or replace function public.guard_pro_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare prof text;
begin
  select profession into prof from public.profiles where id = auth.uid() and status = 'approved';
  if new.kind = 'dose' and new.status not in ('PHARMACIST VERIFIED', 'CHANGES NEEDED') then
    raise exception 'Doses can only be marked PHARMACIST VERIFIED or CHANGES NEEDED';
  end if;
  if new.kind <> 'dose' and new.status = 'PHARMACIST VERIFIED' then
    raise exception 'PHARMACIST VERIFIED applies to doses only';
  end if;
  if new.status = 'PHARMACIST VERIFIED' and coalesce(prof, '') <> 'Pharmacist' then
    raise exception 'Only an account registered as a Pharmacist can verify doses';
  end if;
  new.reviewer_id := auth.uid();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists pro_reviews_guard on public.pro_reviews;
create trigger pro_reviews_guard before insert or update on public.pro_reviews
  for each row execute function public.guard_pro_review();

create table if not exists public.pro_review_audit (
  id bigserial primary key,
  item_id text not null,
  changed_by uuid,
  old_status text,
  new_status text,
  reviewer text,
  note text,
  at timestamptz not null default now()
);
alter table public.pro_review_audit enable row level security;
drop policy if exists "Reviewers read review audit" on public.pro_review_audit;
create policy "Reviewers read review audit" on public.pro_review_audit for select to authenticated using (public.is_reviewer());

create or replace function public.log_pro_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.pro_review_audit (item_id, changed_by, old_status, new_status, reviewer, note) values (old.item_id, auth.uid(), old.status, null, old.reviewer, 'sign-off withdrawn');
    return old;
  end if;
  insert into public.pro_review_audit (item_id, changed_by, old_status, new_status, reviewer, note)
  values (new.item_id, auth.uid(), case when tg_op = 'UPDATE' then old.status end, new.status, new.reviewer, new.note);
  return new;
end $$;
drop trigger if exists pro_reviews_audit on public.pro_reviews;
create trigger pro_reviews_audit after insert or update or delete on public.pro_reviews
  for each row execute function public.log_pro_review();


-- ======================== upgrade-5-notes-review.sql ========================

-- DR ARVEEN — upgrade 5: allow textbook study-note chapters to be signed off in the Review queue.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
-- Requires upgrade-4-reviews.sql (the pro_reviews table) to have been run first.
alter table public.pro_reviews drop constraint if exists pro_reviews_kind_check;
alter table public.pro_reviews add constraint pro_reviews_kind_check
  check (kind in ('guideline', 'recommendation', 'staging', 'protocol', 'drug', 'dose', 'trial', 'literature', 'algorithm', 'disease', 'notes'));


-- ======================== upgrade-6-workspace.sql ========================

-- DR ARVEEN — upgrade 6: personal workspaces sandboxed to each account.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
-- Each signed-in person's bookmarks, recently viewed pages and private notes are stored in one row that only
-- they can read or change. There is deliberately NO administrator policy: admins cannot read anyone's workspace.

create table if not exists public.user_workspace (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 500000),
  updated_at timestamptz not null default now()
);
alter table public.user_workspace enable row level security;

drop policy if exists "Owner reads own workspace" on public.user_workspace;
create policy "Owner reads own workspace" on public.user_workspace for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owner creates own workspace" on public.user_workspace;
create policy "Owner creates own workspace" on public.user_workspace for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Owner updates own workspace" on public.user_workspace;
create policy "Owner updates own workspace" on public.user_workspace for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Owner deletes own workspace" on public.user_workspace;
create policy "Owner deletes own workspace" on public.user_workspace for delete to authenticated using (user_id = auth.uid());

-- ======================== upgrade-8-malaysia-cpg.sql ========================
-- DR ARVEEN — upgrade 8: Malaysian position for each recommendation (building the Malaysian CPG).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
-- Approved professionals can read the Malaysian positions; only reviewers and admins can write them.
-- Every change is logged in my_cpg_audit.

create table if not exists public.my_cpg (
  rec_id text primary key,                         -- recommendation id, e.g. "R-EN-A01"
  decision text not null default 'PENDING' check (decision in ('ADOPT', 'ADAPT', 'NOT ADOPTED', 'PENDING')),
  statement text check (statement is null or char_length(statement) <= 2000),   -- the Malaysian wording
  notes text check (notes is null or char_length(notes) <= 2000),               -- resources, availability, MOH policy, rationale
  author text not null check (char_length(author) between 2 and 120),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.my_cpg enable row level security;

drop policy if exists "Approved professionals read Malaysian positions" on public.my_cpg;
create policy "Approved professionals read Malaysian positions" on public.my_cpg for select to authenticated using (public.is_approved());
drop policy if exists "Reviewers write Malaysian positions" on public.my_cpg;
create policy "Reviewers write Malaysian positions" on public.my_cpg for all to authenticated using (public.is_reviewer()) with check (public.is_reviewer());

create or replace function public.stamp_my_cpg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists my_cpg_stamp on public.my_cpg;
create trigger my_cpg_stamp before insert or update on public.my_cpg for each row execute function public.stamp_my_cpg();

create table if not exists public.my_cpg_audit (
  id bigserial primary key,
  rec_id text not null,
  changed_by uuid,
  old_decision text,
  new_decision text,
  statement text,
  author text,
  at timestamptz not null default now()
);
alter table public.my_cpg_audit enable row level security;
drop policy if exists "Reviewers read Malaysian position audit" on public.my_cpg_audit;
create policy "Reviewers read Malaysian position audit" on public.my_cpg_audit for select to authenticated using (public.is_reviewer());

create or replace function public.log_my_cpg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.my_cpg_audit (rec_id, changed_by, old_decision, new_decision, statement, author) values (old.rec_id, auth.uid(), old.decision, null, null, old.author);
    return old;
  end if;
  insert into public.my_cpg_audit (rec_id, changed_by, old_decision, new_decision, statement, author)
  values (new.rec_id, auth.uid(), case when tg_op = 'UPDATE' then old.decision end, new.decision, new.statement, new.author);
  return new;
end $$;
drop trigger if exists my_cpg_audit_trg on public.my_cpg;
create trigger my_cpg_audit_trg after insert or update or delete on public.my_cpg for each row execute function public.log_my_cpg();

-- ======================== upgrade-9-site-edits.sql ========================
-- DR ARVEEN — upgrade 9: edit every section of the site online, with pictures.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
-- Creates site_edits: one row per edited record or page, laid over the built-in content.
--   id looks like "guidelines:G-ESGO-EN-2021", "drugs:carboplatin", "page:guidelines", "slides:pro", "portfolio:main".
--   scope 'public' rows (patient pages, patient carousel, portfolio) can be read by everyone;
--   scope 'pro' rows (clinical reference) only by approved professionals.
--   Only editor, reviewer and admin accounts can write (with two-step sign-in once upgrade 7 is run).
-- Every change is logged in site_edits_audit, with the reason given by the editor.
-- An edit does not count as a sign-off: edited clinical records show "edited after sign-off" until re-reviewed,
-- and an edited dose returns to PENDING PHARMACIST REVIEW until a pharmacist verifies it again.

create table if not exists public.site_edits (
  id text primary key check (char_length(id) between 3 and 200),
  scope text not null default 'pro' check (scope in ('public', 'pro')),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 400000),
  reason text not null check (char_length(reason) between 3 and 500),
  editor text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.site_edits enable row level security;

drop policy if exists "Everyone reads public site edits" on public.site_edits;
create policy "Everyone reads public site edits" on public.site_edits for select to anon, authenticated using (scope = 'public');
drop policy if exists "Approved professionals read clinical site edits" on public.site_edits;
create policy "Approved professionals read clinical site edits" on public.site_edits for select to authenticated using (scope = 'pro' and public.is_approved());
drop policy if exists "Editors write site edits" on public.site_edits;
create policy "Editors write site edits" on public.site_edits for all to authenticated using (public.is_editor()) with check (public.is_editor());

create or replace function public.stamp_site_edits() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  new.editor := coalesce((select full_name from public.profiles where id = auth.uid()), new.editor);
  return new;
end $$;
drop trigger if exists site_edits_stamp on public.site_edits;
create trigger site_edits_stamp before insert or update on public.site_edits for each row execute function public.stamp_site_edits();

create table if not exists public.site_edits_audit (
  id bigserial primary key,
  edit_id text not null,
  action text not null,
  changed_by uuid,
  editor text,
  reason text,
  old_data jsonb,
  new_data jsonb,
  at timestamptz not null default now()
);
alter table public.site_edits_audit enable row level security;
drop policy if exists "Editors read site edit history" on public.site_edits_audit;
create policy "Editors read site edit history" on public.site_edits_audit for select to authenticated using (public.is_editor());

create or replace function public.log_site_edits() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.site_edits_audit (edit_id, action, changed_by, editor, reason, old_data, new_data)
    values (old.id, 'REVERTED', auth.uid(), (select full_name from public.profiles where id = auth.uid()), null, old.data, null);
    return old;
  end if;
  insert into public.site_edits_audit (edit_id, action, changed_by, editor, reason, old_data, new_data)
  values (new.id, tg_op, auth.uid(), new.editor, new.reason, case when tg_op = 'UPDATE' then old.data end, new.data);
  return new;
end $$;
drop trigger if exists site_edits_audit_trg on public.site_edits;
create trigger site_edits_audit_trg after insert or update or delete on public.site_edits for each row execute function public.log_site_edits();

-- ======================== upgrade-10-hardening.sql ========================
-- DR ARVEEN — upgrade 10: security hardening (from SECURITY_AUDIT.md: H3, M1, M3, L3).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again. Run it AFTER upgrade 9.
--
-- What it does:
--  * Sign-off labels (status, reviewer, review dates, dose status, reviewStatus …) can no longer be written through
--    the website's database connection, by anyone — editors, reviewers or admins. They can only come from the
--    Review queue (pro_reviews, which already enforces reviewer and pharmacist rules) or from the owner's seed.sql
--    import in this SQL editor.
--  * Online edits (site_edits) cannot replace a record's id or raw HTML, and their public/professional scope is set
--    by the database, not by the browser.
--  * Professional content record ids may only use letters, numbers and . _ : -  (stops script injection via ids).
--  * Whole professional collections can only be deleted here in the SQL editor.
--  * Every change to professional content is logged in pro_content_audit (M3).
--  * Anonymous visitors can no longer see staff names or user ids on public edit rows (L3).
-- Changes made here in the SQL editor (seed.sql imports) are not restricted: auth.uid() is empty in the SQL editor.

-- ---------- helper: the sign-off fields of any JSON value, keyed by record id ----------
create or replace function public.reserved_view(j jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  out jsonb := '{}'::jsonb; k text; v jsonb; i int := 0; sub jsonb;
  reserved text[] := array['status', 'approval', 'reviewer', 'verifiedOn', 'nextReview', 'reviewNote', 'reviewedOn',
                           'doseStatus', 'doseReviewer', 'doseReviewedOn', 'doseNote', 'refReview', 'reviewStatus', 'html'];
begin
  if j is null then return out; end if;
  if jsonb_typeof(j) = 'object' then
    for k, v in select * from jsonb_each(j) loop
      if k = any (reserved) then out := out || jsonb_build_object(k, v);
      elsif jsonb_typeof(v) in ('object', 'array') then
        sub := public.reserved_view(v);
        if sub <> '{}'::jsonb then out := out || jsonb_build_object(k, sub); end if;
      end if;
    end loop;
  elsif jsonb_typeof(j) = 'array' then
    for v in select * from jsonb_array_elements(j) loop
      sub := public.reserved_view(v);
      if sub <> '{}'::jsonb then out := out || jsonb_build_object(coalesce(v ->> 'id', '#' || i), sub); end if;
      i := i + 1;
    end loop;
  end if;
  return out;
end $$;

-- ---------- professional content (pro_content) ----------
create or replace function public.guard_pro_content() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then  -- SQL editor / owner import
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Professional content collections can only be removed by the site owner in the Supabase SQL editor';
  end if;
  if public.reserved_view(new.data) is distinct from public.reserved_view(case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end) then
    raise exception 'Sign-off fields (status, reviewer, review dates, dose status, HTML) can only be changed through the Review queue';
  end if;
  if exists (select 1 from jsonb_path_query(new.data, 'lax $.**.id') x where jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ '^[A-Za-z0-9._:-]{1,120}$') then
    raise exception 'Record ids may only contain letters, numbers and . _ : -';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists pro_content_guard on public.pro_content;
create trigger pro_content_guard before insert or update or delete on public.pro_content for each row execute function public.guard_pro_content();

create table if not exists public.pro_content_audit (
  id bigserial primary key,
  content_key text not null,
  action text not null,
  changed_by uuid,
  old_data jsonb,          -- kept for website edits so they can be undone; not kept for owner imports (size)
  at timestamptz not null default now()
);
alter table public.pro_content_audit enable row level security;
drop policy if exists "Editors read content history" on public.pro_content_audit;
create policy "Editors read content history" on public.pro_content_audit for select to authenticated using (public.is_editor());

create or replace function public.log_pro_content() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pro_content_audit (content_key, action, changed_by, old_data)
  values (coalesce(new.key, old.key), case when auth.uid() is null then 'owner ' else '' end || lower(tg_op), auth.uid(),
          case when auth.uid() is not null and tg_op <> 'INSERT' then old.data end);
  return null; -- AFTER trigger: return value is ignored
end $$;
drop trigger if exists pro_content_audit_trg on public.pro_content;
create trigger pro_content_audit_trg after insert or update or delete on public.pro_content for each row execute function public.log_pro_content();

-- ---------- online edits (site_edits) ----------
create or replace function public.guard_site_edit() returns trigger
language plpgsql security definer set search_path = public as $$
declare coll text; rec_id text; cdata jsonb; orig jsonb; k text;
begin
  if auth.uid() is null then return new; end if;
  if new.id !~ '^(slides:(pro|pt)|portfolio:main|page:[a-z]+|(guidelines|recommendations|diseases|staging|protocols|drugs|trials|algorithms|literature|notes):[A-Za-z0-9._:-]{1,120})$' then
    raise exception 'Unknown item: %', new.id;
  end if;
  if jsonb_typeof(new.data) <> 'object' then raise exception 'Edit data must be a JSON object'; end if;
  coll := split_part(new.id, ':', 1); rec_id := substr(new.id, length(coll) + 2);
  -- scope is decided here, not by the browser: public = patient carousel, portfolio and page banners
  new.scope := case when new.id ~ '^(slides:pt|portfolio:main|page:[a-z]+)$' then 'public' else 'pro' end;
  if coll in ('slides', 'portfolio', 'page') then
    if new.data ? 'id' or public.reserved_view(new.data) <> '{}'::jsonb then
      raise exception 'This edit contains fields that cannot be set here (id, status, reviewer, HTML …)';
    end if;
    return new;
  end if;
  -- a clinical record: it must exist, and its id, HTML and sign-off fields must stay as they are
  if new.data ? 'id' or new.data ? 'html' then raise exception 'An edit cannot change a record''s id or HTML'; end if;
  select case when coll = 'notes' then data -> 'chapters' else data end into cdata from public.pro_content where key = coll;
  if jsonb_typeof(cdata) = 'array' then
    select e into orig from jsonb_array_elements(cdata) e where e ->> 'id' = rec_id limit 1;
  end if;
  if orig is null then raise exception 'Record % not found in the professional content', new.id; end if;
  for k in select jsonb_object_keys(new.data) loop
    if public.reserved_view(jsonb_build_object(k, new.data -> k)) is distinct from public.reserved_view(jsonb_build_object(k, orig -> k)) then
      raise exception 'Sign-off fields (status, reviewer, review dates, dose status) can only be changed through the Review queue (field "%")', k;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists site_edits_guard on public.site_edits;
create trigger site_edits_guard before insert or update on public.site_edits for each row execute function public.guard_site_edit();

-- ---------- public rows: hide staff names and user ids from anonymous visitors (L3) ----------
revoke select on public.site_edits from anon;
grant select (id, scope, data, updated_at) on public.site_edits to anon;
revoke select on public.patient_items from anon;
grant select (id, kind, data, status, reviewer, last_review, next_review, updated_at) on public.patient_items to anon;
