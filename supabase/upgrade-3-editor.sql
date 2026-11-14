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
