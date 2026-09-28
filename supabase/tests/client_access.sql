-- Client-access tests (§6.183, migration 0060). Every block raises on failure; a clean run prints
-- "ALL CLIENT ACCESS TESTS PASSED". Run after the migrations, like tenant_isolation.sql.
-- Actors:  F (admin of Coach Co)   A (advisor of Coach Co)   C (the client, c@example.com)
--          X (stranger, x@example.com)   S (owner planning their own business)
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;

create or replace function _as(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, false)
$$;
create or replace function _assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'CLIENT ACCESS TEST FAILED: %', msg; end if; end $$;
create or replace function _raises(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end $$;

insert into auth.users (id, email) values
 ('f0000000-0000-0000-0000-00000000000f', 'f@coach.example'),
 ('a0000000-0000-0000-0000-00000000000a', 'a@coach.example'),
 ('c0000000-0000-0000-0000-00000000000c', 'C@Example.com'),
 ('e0000000-0000-0000-0000-00000000000e', 'x@example.com'),
 ('50000000-0000-0000-0000-000000000005', 's@example.com');
insert into profiles (id, full_name, title, phone) values
 ('f0000000-0000-0000-0000-00000000000f', 'Fran Coach', 'Business Coach', '0400 000 001'),
 ('a0000000-0000-0000-0000-00000000000a', 'Andy Adviser', null, null),
 ('c0000000-0000-0000-0000-00000000000c', 'Cara Client', null, null),
 ('e0000000-0000-0000-0000-00000000000e', 'Xavier', null, null),
 ('50000000-0000-0000-0000-000000000005', 'Sam Solo', null, null)
on conflict (id) do update set full_name = excluded.full_name, title = excluded.title, phone = excluded.phone;

set role authenticated;
select _as('f0000000-0000-0000-0000-00000000000f');
insert into organisations (id, name, kind, created_by) values ('10000000-0000-0000-0000-000000000000', 'Coach Co', 'coach', 'f0000000-0000-0000-0000-00000000000f');
insert into organisation_members values ('10000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'advisor');
insert into plans (id, organisation_id, business_name, created_by) values
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000000', 'DesignOne', 'f0000000-0000-0000-0000-00000000000f'),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000000', 'Second Co', 'f0000000-0000-0000-0000-00000000000f');
select _as('50000000-0000-0000-0000-000000000005');
insert into organisations (id, name, kind, created_by) values ('10000000-0000-0000-0000-000000000005', 'Solo', 'owner', '50000000-0000-0000-0000-000000000005');
insert into plans (id, organisation_id, business_name, created_by) values ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'Solo Biz', '50000000-0000-0000-0000-000000000005');

-- 1. Only the firm's Planners may invite.
select _as('e0000000-0000-0000-0000-00000000000e');
select _assert(_raises($$select * from create_plan_invitation('20000000-0000-0000-0000-000000000001', 'c@example.com')$$), 'a stranger created an invitation');
select _as('c0000000-0000-0000-0000-00000000000c');
select _assert(_raises($$select * from create_plan_invitation('20000000-0000-0000-0000-000000000001', 'c@example.com')$$), 'a non-member created an invitation');
select _as('50000000-0000-0000-0000-000000000005');
select _assert(_raises($$select * from create_plan_invitation('20000000-0000-0000-0000-000000000005', 'c@example.com')$$), 'an owner plan (not a firm) took an invitation');

-- 2. An advisor invites; a bad email is refused. Since 0061 an advisor reaches a client only once assigned.
select _as('f0000000-0000-0000-0000-00000000000f');
select assign_planner('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', true);
select _as('a0000000-0000-0000-0000-00000000000a');
select _assert(_raises($$select * from create_plan_invitation('20000000-0000-0000-0000-000000000001', 'not-an-email')$$), 'a bad email was accepted');
create temp table t1 as select * from create_plan_invitation('20000000-0000-0000-0000-000000000001', ' C@example.com ');
select _assert((select count(*) from t1) = 1, 'no invitation created');
select _assert((select email from plan_invitations where token = (select token from t1)) = 'c@example.com', 'email not normalised');

-- 3. Resend closes the old link.
create temp table t2 as select * from create_plan_invitation('20000000-0000-0000-0000-000000000001', 'c@example.com');
select _assert((select revoked_at is not null from plan_invitations where token = (select token from t1)), 'the old link was not closed by resend');

-- 4. The preview, before sign-in.
select set_config('t.t1', (select token from t1), false), set_config('t.t2', (select token from t2), false);
reset role; set role anon;
select _assert((select state from invitation_preview(current_setting('t.t2'))) = 'open', 'preview not open');
select _assert((select state from invitation_preview(current_setting('t.t1'))) = 'revoked', 'old link not shown revoked');
select _assert((select business_name from invitation_preview(current_setting('t.t2'))) = 'DesignOne', 'preview business wrong');
reset role; set role authenticated;

-- 5. Only the invited email may accept; the old link cannot be used.
select _as('e0000000-0000-0000-0000-00000000000e');
select _assert(_raises(format($$select accept_plan_invitation(%L)$$, (select token from t2))), 'a stranger accepted');
select _as('c0000000-0000-0000-0000-00000000000c');
select _assert(_raises(format($$select accept_plan_invitation(%L)$$, (select token from t1))), 'a revoked link was accepted');
select _assert(accept_plan_invitation((select token from t2)) = '20000000-0000-0000-0000-000000000001', 'accept did not return the plan');
select _assert(_raises(format($$select accept_plan_invitation(%L)$$, (select token from t2))), 'a link was used twice');

-- 6. The client is in their plan, and nowhere else.
select _assert(can_read_plan('20000000-0000-0000-0000-000000000001'), 'client cannot read their plan');
select _assert(can_write_plan('20000000-0000-0000-0000-000000000001'), 'client cannot work on their plan');
select _assert(not can_read_plan('20000000-0000-0000-0000-000000000002'), 'client reads another client''s plan');
select _assert((select count(*) from organisations) = 0, 'client can read the firm');
select _assert(not is_plan_planner('20000000-0000-0000-0000-000000000001'), 'client counts as a Planner');
select _assert((select count(*) from firm_client_access('10000000-0000-0000-0000-000000000000')) = 0, 'client sees the firm''s client list');

-- 7. The "Your Planner" card: the Planner who invited, for the client only.
select _assert((select full_name from plan_planner('20000000-0000-0000-0000-000000000001')) = 'Andy Adviser', 'card names the wrong Planner');
select _assert((select email from plan_planner('20000000-0000-0000-0000-000000000001')) = 'a@coach.example', 'card email wrong');
select _as('e0000000-0000-0000-0000-00000000000e');
select _assert((select count(*) from plan_planner('20000000-0000-0000-0000-000000000001')) = 0, 'a stranger sees the Planner card');
select _as('50000000-0000-0000-0000-000000000005');
select _assert((select count(*) from plan_planner('20000000-0000-0000-0000-000000000005')) = 0, 'an owner plan shows a Planner card');

-- 8. My Clients sees where each client stands.
select _as('f0000000-0000-0000-0000-00000000000f');
select _assert((select state from firm_client_access('10000000-0000-0000-0000-000000000000') where plan_id = '20000000-0000-0000-0000-000000000001') = 'active', 'accepted client not active');
select _assert((select state from firm_client_access('10000000-0000-0000-0000-000000000000') where plan_id = '20000000-0000-0000-0000-000000000002') = 'none', 'uninvited client not none');
select _assert((select token from firm_client_access('10000000-0000-0000-0000-000000000000') where plan_id = '20000000-0000-0000-0000-000000000001') is null, 'a used link is still offered');

-- 9. May the client download: only the Planner decides, and it reaches the client's membership.
select _as('c0000000-0000-0000-0000-00000000000c');
select _assert(_raises($$select set_client_download('20000000-0000-0000-0000-000000000001', false)$$), 'the client changed their own download switch');
select _as('f0000000-0000-0000-0000-00000000000f');
select set_client_download('20000000-0000-0000-0000-000000000001', false);
reset role;
select _assert((select can_generate_reports from plan_members where plan_id = '20000000-0000-0000-0000-000000000001' and user_id = 'c0000000-0000-0000-0000-00000000000c') = false, 'download switch did not reach the client');
select _assert((select can_generate_reports from plan_members where plan_id = '20000000-0000-0000-0000-000000000001' and user_id = 'f0000000-0000-0000-0000-00000000000f') = true, 'download switch reached the Planner');
set role authenticated;

-- 10. The Planner's photo: readable by their client, not by a stranger.
reset role;
insert into storage.objects (bucket_id, name) values ('profile-photos', 'a0000000-0000-0000-0000-00000000000a/photo.png');
set role authenticated;
select _as('c0000000-0000-0000-0000-00000000000c');
select _assert((select count(*) from storage.objects where bucket_id = 'profile-photos') = 1, 'client cannot see their Planner''s photo');
select _as('e0000000-0000-0000-0000-00000000000e');
select _assert((select count(*) from storage.objects where bucket_id = 'profile-photos') = 0, 'a stranger sees the Planner''s photo');

-- 11. Turn access off: the client is out, the firm is not, and the status says so.
select _as('c0000000-0000-0000-0000-00000000000c');
select _assert(_raises($$select revoke_client_access('20000000-0000-0000-0000-000000000001')$$), 'the client turned off access');
select _as('a0000000-0000-0000-0000-00000000000a');
select revoke_client_access('20000000-0000-0000-0000-000000000001');
select _assert(can_read_plan('20000000-0000-0000-0000-000000000001'), 'the advisor lost the plan');
select _assert((select state from firm_client_access('10000000-0000-0000-0000-000000000000') where plan_id = '20000000-0000-0000-0000-000000000001') = 'off', 'status not off');
select _as('c0000000-0000-0000-0000-00000000000c');
select _assert(not can_read_plan('20000000-0000-0000-0000-000000000001'), 'the client still reads the plan after access off');
select _assert((select count(*) from plan_planner('20000000-0000-0000-0000-000000000001')) = 0, 'the card survives access off');

-- 12. An open link is closed by turning access off.
select _as('f0000000-0000-0000-0000-00000000000f');
create temp table t3 as select * from create_plan_invitation('20000000-0000-0000-0000-000000000002', 'x@example.com');
select _assert((select state from firm_client_access('10000000-0000-0000-0000-000000000000') where plan_id = '20000000-0000-0000-0000-000000000002') = 'invited', 'status not invited');
select revoke_client_access('20000000-0000-0000-0000-000000000002');
select _as('e0000000-0000-0000-0000-00000000000e');
select _assert(_raises(format($$select accept_plan_invitation(%L)$$, (select token from t3))), 'a cancelled link was accepted');

select 'ALL CLIENT ACCESS TESTS PASSED';
