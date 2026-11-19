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
