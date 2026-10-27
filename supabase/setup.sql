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
