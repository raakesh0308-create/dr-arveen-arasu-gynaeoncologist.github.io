-- DR ARVEEN — upgrade 5: allow textbook study-note chapters to be signed off in the Review queue.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
-- Requires upgrade-4-reviews.sql (the pro_reviews table) to have been run first.
alter table public.pro_reviews drop constraint if exists pro_reviews_kind_check;
alter table public.pro_reviews add constraint pro_reviews_kind_check
  check (kind in ('guideline', 'recommendation', 'staging', 'protocol', 'drug', 'dose', 'trial', 'literature', 'algorithm', 'disease', 'notes'));
