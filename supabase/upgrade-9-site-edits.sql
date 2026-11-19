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
