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
