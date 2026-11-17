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
