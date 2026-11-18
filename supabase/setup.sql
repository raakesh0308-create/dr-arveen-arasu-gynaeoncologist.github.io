-- DR ARVEEN — Supabase setup. Run once in Supabase: SQL Editor → New query → paste → Run.
-- Creates: professional profiles with approval status, the protected professional content table,
-- an account audit log, and row-level security so only approved accounts can read professional content.

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  profession text,
  registration_body text,
  registration_number text,
  institution text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  role text not null default 'reader' check (role in ('reader', 'editor', 'reviewer', 'admin')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);
alter table public.profiles enable row level security;

-- New sign-ups get a pending profile. Status and role can never be set by the person signing up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, profession, registration_body, registration_number, institution)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          new.raw_user_meta_data->>'profession',
          new.raw_user_meta_data->>'registration_body',
          new.raw_user_meta_data->>'registration_number',
          new.raw_user_meta_data->>'institution');
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- access helpers ----------
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved')
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved' and role = 'admin')
$$;
create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved' and role in ('editor', 'reviewer', 'admin'))
$$;

drop policy if exists "Read own profile or admin reads all" on public.profiles;
create policy "Read own profile or admin reads all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- No insert or delete policies: profiles are created by the trigger and removed with the auth user.

-- ---------- account audit log ----------
create table if not exists public.account_audit (
  id bigserial primary key,
  profile_id uuid not null,
  changed_by uuid,
  old_status text, new_status text,
  old_role text, new_role text,
  at timestamptz not null default now()
);
alter table public.account_audit enable row level security;
drop policy if exists "Admins read audit" on public.account_audit;
create policy "Admins read audit" on public.account_audit for select to authenticated using (public.is_admin());

create or replace function public.log_profile_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status or new.role is distinct from old.role then
    insert into public.account_audit (profile_id, changed_by, old_status, new_status, old_role, new_role)
    values (new.id, auth.uid(), old.status, new.status, old.role, new.role);
  end if;
  return new;
end $$;
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after update on public.profiles
  for each row execute function public.log_profile_change();

-- ---------- professional content ----------
create table if not exists public.pro_content (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.pro_content enable row level security;
drop policy if exists "Approved professionals read content" on public.pro_content;
create policy "Approved professionals read content" on public.pro_content
  for select to authenticated using (public.is_approved());
drop policy if exists "Editors write content" on public.pro_content;
create policy "Editors write content" on public.pro_content
  for all to authenticated using (public.is_editor()) with check (public.is_editor());
-- Anonymous visitors have no policy on any table, so they can read nothing.

-- ---------- problem reports ----------
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

-- ---------- online content editor and pictures ----------

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

-- ---------- upgrade 4: review and sign-off ----------
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

-- ---------- upgrade 6: personal workspaces ----------
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

-- ---------- upgrade 7: staff two-step sign-in ----------
-- NOTE for new projects: set up two-step sign-in for the first admin BEFORE this section takes effect, or comment it out until then.
-- DR ARVEEN — upgrade 7: staff actions require two-step sign-in (authenticator app, "AAL2").
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
--
-- BEFORE RUNNING: sign in on the site and set up two-step sign-in first (account menu → Two-step sign-in).
-- After this runs, editor / reviewer / admin powers (approving accounts, editing content, uploading pictures,
-- signing off reviews, reading reports) only work in a session verified with an authenticator code.
-- Reading professional content is unchanged (password sign-in is enough for approved readers).
-- Supabase → Authentication → Multi-Factor: TOTP (app authenticator) must be enabled (it is on by default).

create or replace function public.is_aal2() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_aal2() and exists (select 1 from public.profiles where id = auth.uid() and status = 'approved' and role = 'admin')
$$;

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_aal2() and exists (select 1 from public.profiles where id = auth.uid() and status = 'approved' and role in ('editor', 'reviewer', 'admin'))
$$;

create or replace function public.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_aal2() and exists (select 1 from public.profiles where id = auth.uid() and status = 'approved' and role in ('reviewer', 'admin'))
$$;

-- The patient-content approval guard checks the role directly; require two-step sign-in there too.
create or replace function public.guard_patient_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if not public.is_aal2() then
    raise exception 'Two-step sign-in is required to change content';
  end if;
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

-- EMERGENCY ROLLBACK (if you are locked out): run this one line to remove the two-step requirement again.
-- create or replace function public.is_aal2() returns boolean language sql stable as $$ select true $$;
