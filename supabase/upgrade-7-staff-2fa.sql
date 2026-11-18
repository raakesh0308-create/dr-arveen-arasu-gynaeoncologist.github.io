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
