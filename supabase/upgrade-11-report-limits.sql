-- DR ARVEEN — upgrade 11: limits on anonymous problem reports (SECURITY_AUDIT.md M5).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
-- Anyone can still send a report, but the database now refuses floods:
--   * at most 5 reports per hour from the same network address;
--   * at most 100 reports per hour in total.
-- The network address itself is never stored: only a one-way fingerprint (md5 with a private salt), kept with the
-- report for rate limiting, which administrators do not see on the site. Sign-up spam is handled separately by
-- turning on CAPTCHA in Supabase (see SECURITY_AUDIT.md, things you must do yourself).

alter table public.feedback add column if not exists sender_fp text;

-- private salt, created once, readable by nobody through the API
create table if not exists public.private_settings (name text primary key, value text not null);
alter table public.private_settings enable row level security;          -- no policies: API users can't read it
revoke all on public.private_settings from anon, authenticated;
insert into public.private_settings (name, value) values ('report_salt', md5(random()::text || clock_timestamp()::text))
  on conflict (name) do nothing;

create or replace function public.limit_feedback() returns trigger
language plpgsql security definer set search_path = public as $$
declare ip text; fp text; n_sender int; n_all int;
begin
  ip := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1);
  fp := case when ip <> '' then md5(trim(ip) || (select value from public.private_settings where name = 'report_salt')) end;
  new.sender_fp := fp;
  select count(*) into n_all from public.feedback where created_at > now() - interval '1 hour';
  if n_all >= 100 then raise exception 'Too many reports are being sent right now. Please try again later.'; end if;
  if fp is not null then
    select count(*) into n_sender from public.feedback where sender_fp = fp and created_at > now() - interval '1 hour';
    if n_sender >= 5 then raise exception 'You have sent several reports in the last hour. Please try again later.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists feedback_limit on public.feedback;
create trigger feedback_limit before insert on public.feedback for each row execute function public.limit_feedback();

create index if not exists feedback_recent_idx on public.feedback (created_at desc);
create index if not exists feedback_sender_idx on public.feedback (sender_fp, created_at desc);
