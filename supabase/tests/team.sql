-- Team tests (§6.184, migration 0061). Every block raises on failure; a clean run prints "ALL TEAM TESTS PASSED".
-- Actors:  F (admin of Coach Co)   A (advisor)   B (a second advisor)   N (new consultant, n@coach.example)
--          X (stranger)   C (a client of plan P1)
-- Not a billing test: lift the plan allowance (0062) so these fixtures can hold several plans per organisation.
create or replace function public.billing_starter_plans() returns int language sql immutable as $$ select 1000 $$;
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;

create or replace function _as(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, false)
$$;
create or replace function _assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'TEAM TEST FAILED: %', msg; end if; end $$;
create or replace function _raises(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end $$;
create or replace function _ok(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return true; exception when others then return false; end $$;

insert into auth.users (id, email) values
 ('f1000000-0000-0000-0000-00000000000f', 'f@coach.example'),
 ('a1000000-0000-0000-0000-00000000000a', 'a@coach.example'),
 ('b1000000-0000-0000-0000-00000000000b', 'b@coach.example'),
 ('d1000000-0000-0000-0000-00000000000d', 'N@Coach.example'),
 ('e1000000-0000-0000-0000-00000000000e', 'x@example.com'),
 ('c1000000-0000-0000-0000-00000000000c', 'c@example.com');
insert into profiles (id, full_name) values
 ('f1000000-0000-0000-0000-00000000000f', 'Fran'), ('a1000000-0000-0000-0000-00000000000a', 'Andy'),
 ('b1000000-0000-0000-0000-00000000000b', 'Bea'), ('d1000000-0000-0000-0000-00000000000d', 'Nat'),
 ('e1000000-0000-0000-0000-00000000000e', 'X'), ('c1000000-0000-0000-0000-00000000000c', 'Cara')
on conflict (id) do update set full_name = excluded.full_name;

set role authenticated;
select _as('f1000000-0000-0000-0000-00000000000f');
insert into organisations (id, name, kind, created_by) values ('11000000-0000-0000-0000-000000000000', 'Coach Co', 'coach', 'f1000000-0000-0000-0000-00000000000f');
insert into organisation_members values ('11000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-00000000000a', 'advisor');
insert into organisation_members values ('11000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-00000000000b', 'advisor');
-- P1: made by the admin.  P2: made by advisor A.
insert into plans (id, organisation_id, business_name, created_by) values ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000000', 'Admin Made', 'f1000000-0000-0000-0000-00000000000f');
select _as('a1000000-0000-0000-0000-00000000000a');
-- 1. An advisor adds a client, and can read it back at once (the app's INSERT ... RETURNING pattern).
select _assert(_ok($$insert into plans (id, organisation_id, business_name, created_by) values ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000000', 'Andy Made', 'a1000000-0000-0000-0000-00000000000a') returning id$$), 'advisor cannot add a client with RETURNING');

-- 2. An advisor sees their own clients; an admin sees all.
select _assert((select count(*) from plans) = 1 and (select business_name from plans) = 'Andy Made', 'advisor sees a client they do not look after');
select _assert(not can_write_plan('21000000-0000-0000-0000-000000000001'), 'advisor writes an unassigned plan');
select _as('b1000000-0000-0000-0000-00000000000b');
select _assert((select count(*) from plans) = 0, 'second advisor sees clients that are not theirs');
select _as('f1000000-0000-0000-0000-00000000000f');
select _assert((select count(*) from plans where organisation_id = '11000000-0000-0000-0000-000000000000') = 2, 'admin does not see every client');
select _assert(can_write_plan('21000000-0000-0000-0000-000000000002'), 'admin cannot write an advisor''s client');

-- 3. Only the admin assigns; assigning opens the plan to that advisor, unassigning closes it.
select _as('a1000000-0000-0000-0000-00000000000a');
select _assert(_raises($$select assign_planner('21000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-00000000000a', true)$$), 'an advisor assigned themselves');
select _as('f1000000-0000-0000-0000-00000000000f');
select _assert(_raises($$select assign_planner('21000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-00000000000e', true)$$), 'a stranger was assigned');
select assign_planner('21000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000b', true);
select _assert((select count(*) from firm_assignments('11000000-0000-0000-0000-000000000000') where user_id = 'b1000000-0000-0000-0000-00000000000b') = 1, 'assignment not listed');
select _as('b1000000-0000-0000-0000-00000000000b');
select _assert(can_write_plan('21000000-0000-0000-0000-000000000001'), 'assigned advisor cannot work on the plan');
select _assert(is_plan_planner('21000000-0000-0000-0000-000000000001'), 'assigned advisor is not the Planner');
select _assert((select count(*) from firm_client_access('11000000-0000-0000-0000-000000000000')) = 1, 'advisor''s access list shows clients not theirs');
select _as('f1000000-0000-0000-0000-00000000000f');
select assign_planner('21000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000b', false);
select _as('b1000000-0000-0000-0000-00000000000b');
select _assert(not can_read_plan('21000000-0000-0000-0000-000000000001'), 'unassigned advisor still reads the plan');

-- 4. The team list: any member reads it, with emails; a stranger reads nothing.
select _assert((select count(*) from firm_team('11000000-0000-0000-0000-000000000000')) = 3, 'team list wrong size');
select _assert((select clients from firm_team('11000000-0000-0000-0000-000000000000') where user_id = 'a1000000-0000-0000-0000-00000000000a') = 1, 'client count wrong');
select _as('e1000000-0000-0000-0000-00000000000e');
select _assert((select count(*) from firm_team('11000000-0000-0000-0000-000000000000')) = 0, 'a stranger reads the team');

-- 5. Team invitations: admin only; the right email only; once only.
select _as('a1000000-0000-0000-0000-00000000000a');
select _assert(_raises($$select * from create_team_invitation('11000000-0000-0000-0000-000000000000', 'n@coach.example', 'advisor')$$), 'an advisor invited to the team');
select _as('f1000000-0000-0000-0000-00000000000f');
select _assert(_raises($$select * from create_team_invitation('11000000-0000-0000-0000-000000000000', 'A@coach.example', 'advisor')$$), 'invited someone already in the team');
select _assert(_raises($$select * from create_team_invitation('11000000-0000-0000-0000-000000000000', 'n@coach.example', 'member')$$), 'invited with a role that is not admin or advisor');
create temp table ti1 as select * from create_team_invitation('11000000-0000-0000-0000-000000000000', 'n@coach.example', 'advisor');
create temp table ti2 as select * from create_team_invitation('11000000-0000-0000-0000-000000000000', 'n@coach.example', 'advisor');
select _assert((select revoked_at is not null from organisation_invitations where token = (select token from ti1)), 'a new team link did not close the old');
select set_config('t.ti2', (select token from ti2), false);
reset role; set role anon;
select _assert((select state from team_invitation_preview(current_setting('t.ti2'))) = 'open', 'team preview not open');
reset role; set role authenticated;
select _as('e1000000-0000-0000-0000-00000000000e');
select _assert(_raises(format($$select accept_team_invitation(%L)$$, (select token from ti2))), 'a stranger joined the team');
select _as('d1000000-0000-0000-0000-00000000000d');
select _assert(accept_team_invitation((select token from ti2)) = '11000000-0000-0000-0000-000000000000', 'accept returned the wrong firm');
select _assert(is_org_advisor('11000000-0000-0000-0000-000000000000'), 'new consultant not an advisor');
select _assert((select count(*) from plans) = 0, 'new consultant sees clients before being assigned');
select _assert(_raises(format($$select accept_team_invitation(%L)$$, (select token from ti2))), 'a team link was used twice');

-- 6. Roles: the admin changes them; the firm always keeps an admin.
select _as('f1000000-0000-0000-0000-00000000000f');
select _assert(_raises($$select set_team_role('11000000-0000-0000-0000-000000000000', 'f1000000-0000-0000-0000-00000000000f', 'advisor')$$), 'the last admin stepped down');
select _assert(_raises($$select remove_from_team('11000000-0000-0000-0000-000000000000', 'f1000000-0000-0000-0000-00000000000f')$$), 'the last admin was removed');
select set_team_role('11000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-00000000000d', 'admin');
select _as('d1000000-0000-0000-0000-00000000000d');
select _assert((select count(*) from plans where organisation_id = '11000000-0000-0000-0000-000000000000') = 2, 'a new admin does not see every client');
select _as('a1000000-0000-0000-0000-00000000000a');
select _assert(_raises($$select set_team_role('11000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-00000000000a', 'admin')$$), 'an advisor promoted themselves');

-- 7. Removing someone takes them off every client — a plan membership does not outlive the job.
select _as('f1000000-0000-0000-0000-00000000000f');
select remove_from_team('11000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-00000000000a');
select _as('a1000000-0000-0000-0000-00000000000a');
select _assert((select count(*) from plans) = 0, 'a removed consultant still reads a client');
select _assert((select count(*) from organisations) = 0, 'a removed consultant still reads the firm');

-- 8. A client is untouched by all of this: in their plan, not in the firm.
select _as('f1000000-0000-0000-0000-00000000000f');
reset role;
insert into plan_members (plan_id, user_id, role) values ('21000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-00000000000c', 'owner');
set role authenticated;
select _as('c1000000-0000-0000-0000-00000000000c');
select _assert(can_write_plan('21000000-0000-0000-0000-000000000002'), 'client lost their plan');
select _assert((select count(*) from firm_team('11000000-0000-0000-0000-000000000000')) = 0, 'a client reads the team');
select _assert((select count(*) from organisation_invitations) = 0, 'a client reads team invitations');

select 'ALL TEAM TESTS PASSED';
