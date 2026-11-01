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
