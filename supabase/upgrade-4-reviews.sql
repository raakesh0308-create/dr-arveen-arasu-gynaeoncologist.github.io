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
