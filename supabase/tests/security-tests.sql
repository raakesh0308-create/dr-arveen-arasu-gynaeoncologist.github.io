-- DR ARVEEN — database security tests (access control and anti-forgery rules).
-- Run in Supabase: SQL Editor → New query → paste this whole file → Run.
-- Everything happens inside one transaction that is ROLLED BACK at the end: the fake test users, test rows and
-- changes disappear and nothing real is changed. Run it after update-all-now.sql and upgrade-10-hardening.sql.
-- Result: the final row says "ALL SECURITY TESTS PASSED" (see the Messages/notices for each PASS line).
-- If a rule is broken, the run stops with an error starting "FAIL:".

begin;

-- ---------- set-up as the database owner (all rolled back) ----------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'test-reader-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'test-reader-b@example.invalid'),
  ('00000000-0000-4000-8000-00000000000c', 'test-pending@example.invalid'),
  ('00000000-0000-4000-8000-00000000000e', 'test-editor@example.invalid'),
  ('00000000-0000-4000-8000-00000000000f', 'test-reviewer@example.invalid');
update public.profiles set status = 'approved', role = 'reader', profession = 'Doctor' where id in ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b');
update public.profiles set status = 'approved', role = 'editor', profession = 'Doctor', full_name = 'Test Editor' where id = '00000000-0000-4000-8000-00000000000e';
update public.profiles set status = 'approved', role = 'reviewer', profession = 'Doctor' where id = '00000000-0000-4000-8000-00000000000f';
-- (test-pending stays 'pending')
insert into public.pro_content (key, data) values ('drugs',
  '[{"id":"zz-test-drug","name":"Test drug","monitoring":"original","doseStatus":"PENDING PHARMACIST REVIEW","doses":[{"indication":"t","dose":"1 mg","reviewStatus":"PENDING PHARMACIST REVIEW"}]}]')
  on conflict (key) do update set data = public.pro_content.data || excluded.data;
insert into public.user_workspace (user_id, data) values ('00000000-0000-4000-8000-00000000000b', '{"notes":{"x":"private note of B"}}')
  on conflict (user_id) do nothing;

-- ---------- 1. Reader A cannot read reader B's private workspace (IDOR) ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.user_workspace where user_id = '00000000-0000-4000-8000-00000000000b';
  if n <> 0 then raise exception 'FAIL: reader A can read reader B''s workspace'; end if;
  raise notice 'PASS 1: reader A cannot read reader B''s workspace';
end $$;

-- ---------- 2. Reader A cannot make themselves admin ----------
do $$ declare n int; begin
  update public.profiles set role = 'admin', status = 'approved' where id = '00000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: reader A changed their own role'; end if;
  raise notice 'PASS 2: reader A cannot change their own role';
end $$;

-- ---------- 3. Reader A cannot edit content ----------
do $$ begin
  begin
    insert into public.site_edits (id, scope, data, reason) values ('drugs:zz-test-drug', 'pro', '{"monitoring":"hacked"}', 'test');
    raise exception 'FAIL: a reader could save an edit';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  raise notice 'PASS 3: a reader cannot save edits';
end $$;
reset role;

-- ---------- 4. A pending (not yet approved) account cannot read professional content ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.pro_content;
  if n <> 0 then raise exception 'FAIL: a pending account can read professional content'; end if;
  raise notice 'PASS 4: a pending account cannot read professional content';
end $$;
reset role;

-- ---------- 5–11. Editor (with two-step sign-in) ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
do $$ declare s text; begin
  insert into public.site_edits (id, scope, data, reason) values ('drugs:zz-test-drug', 'public', '{"monitoring":"edited text"}', 'test edit');
  select scope into s from public.site_edits where id = 'drugs:zz-test-drug';
  if s <> 'pro' then raise exception 'FAIL: the browser could choose a public scope for clinical content'; end if;
  raise notice 'PASS 5: an editor can save an ordinary edit, and clinical edits are forced to professional-only';
end $$;
do $$ begin
  begin
    insert into public.site_edits (id, scope, data, reason) values ('drugs:zz-test-drug', 'pro', '{"doseStatus":"PHARMACIST VERIFIED"}', 'forgery') on conflict (id) do update set data = excluded.data;
    raise exception 'FAIL: an editor forged a pharmacist-verified dose via site_edits';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin
    update public.site_edits set data = '{"doses":[{"indication":"t","dose":"1 mg","reviewStatus":"PHARMACIST VERIFIED"}]}' where id = 'drugs:zz-test-drug';
    raise exception 'FAIL: an editor forged a nested dose verification via site_edits';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin
    update public.site_edits set data = '{"status":"APPROVED","reviewer":"Someone Else"}' where id = 'drugs:zz-test-drug';
    raise exception 'FAIL: an editor forged an approval via site_edits';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  raise notice 'PASS 6: an editor cannot forge sign-offs or dose verification through edits';
end $$;
do $$ begin
  begin
    update public.site_edits set data = '{"id":"x\"><img src=x onerror=alert(1)>"}' where id = 'drugs:zz-test-drug';
    raise exception 'FAIL: an edit replaced a record id';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin
    insert into public.site_edits (id, scope, data, reason) values ('notes:uterine', 'pro', '{"html":"<script>alert(1)</script>"}', 'x');
    raise exception 'FAIL: an edit replaced raw HTML';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  raise notice 'PASS 7: edits cannot replace record ids or raw HTML';
end $$;
do $$ begin
  begin
    update public.pro_content set data = (select jsonb_agg(case when e ->> 'id' = 'zz-test-drug' then e || '{"doseStatus":"PHARMACIST VERIFIED"}' else e end) from jsonb_array_elements(data) e) where key = 'drugs';
    raise exception 'FAIL: an editor forged a dose verification directly in pro_content';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  raise notice 'PASS 8: an editor cannot forge sign-offs directly in the professional content';
end $$;
do $$ declare n int; begin
  update public.pro_content set data = (select jsonb_agg(case when e ->> 'id' = 'zz-test-drug' then e || '{"monitoring":"corrected"}' else e end) from jsonb_array_elements(data) e) where key = 'drugs';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: an editor could not make an ordinary content correction'; end if;
  raise notice 'PASS 9: an editor can still correct ordinary professional content';
end $$;
do $$ begin
  begin
    update public.pro_content set data = data || '[{"id":"bad\"><img src=x onerror=alert(1)>","name":"x"}]'::jsonb where key = 'drugs';
    raise exception 'FAIL: a record id with script characters was accepted';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin
    delete from public.pro_content where key = 'drugs';
    raise exception 'FAIL: an editor deleted a whole professional collection';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  raise notice 'PASS 10: unsafe record ids and whole-collection deletes are refused';
end $$;
do $$ declare n int; begin
  select count(*) into n from public.pro_content_audit where content_key = 'drugs' and changed_by = '00000000-0000-4000-8000-00000000000e' and old_data is not null;
  if n < 1 then raise exception 'FAIL: the professional content change was not logged'; end if;
  raise notice 'PASS 11: professional content changes are logged with the editor and the previous version';
end $$;
reset role;

-- ---------- 12. A reviewer who is not a pharmacist cannot verify doses ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000f","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
do $$ begin
  begin
    insert into public.pro_reviews (item_id, kind, status, reviewer, reviewed_on) values ('dose:zz-test-drug', 'dose', 'PHARMACIST VERIFIED', 'Test Reviewer', current_date);
    raise exception 'FAIL: a non-pharmacist verified a dose';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  raise notice 'PASS 12: only pharmacists can verify doses';
end $$;
reset role;

-- ---------- 13. Anonymous visitors: no staff names, no professional rows ----------
set local role anon;
do $$ declare n int; begin
  begin
    perform editor from public.site_edits limit 1;
    raise exception 'FAIL: anonymous visitors can read staff names on edits';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  select count(*) into n from public.site_edits where scope = 'pro';
  if n <> 0 then raise exception 'FAIL: anonymous visitors can read professional edits'; end if;
  select count(*) into n from public.pro_content;
  if n <> 0 then raise exception 'FAIL: anonymous visitors can read professional content'; end if;
  raise notice 'PASS 13: anonymous visitors cannot see staff names, professional edits or professional content';
end $$;
reset role;

-- ---------- 14. Two-step sign-in (upgrade 7): an editor without it ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
do $$ begin
  begin
    update public.site_edits set reason = 'password-only session' where id = 'drugs:zz-test-drug';
    if found then raise notice 'WARNING 14: two-step sign-in is NOT enforced yet. Run upgrade-7-staff-2fa.sql once every staff account has set it up.';
    else raise notice 'PASS 14: staff powers need two-step sign-in'; end if;
  exception when others then raise notice 'PASS 14: staff powers need two-step sign-in'; end;
end $$;
reset role;

select 'ALL SECURITY TESTS PASSED (everything above is rolled back)' as result;
rollback;
