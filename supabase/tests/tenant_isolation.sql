-- Tenant-isolation tests. Every block raises on failure; a clean run prints "ALL TENANT TESTS PASSED".
-- Actors:  A_admin (admin of Coach Co)   A_adv (advisor of Coach Co)   A_member (member of Coach Co)
--          O1 (owner of plan P1 in Coach Co)   S (solo owner, own org, plan P2)   X (stranger: no memberships)
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

create or replace function _as(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, false)
$$;
create or replace function _assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'TENANT TEST FAILED: %', msg; end if; end $$;
-- run a statement as `authenticated` and report whether it was permitted
create or replace function _allowed(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt; return true;
exception when insufficient_privilege or check_violation or foreign_key_violation or unique_violation then
  return false;
end $$;

-- ---------- fixtures ----------
insert into auth.users (id) values
 ('a0000000-0000-0000-0000-00000000000a'),  -- A_admin
 ('a0000000-0000-0000-0000-00000000000b'),  -- A_adv
 ('a0000000-0000-0000-0000-00000000000c'),  -- A_member
 ('00000000-0000-0000-0000-000000000001'),  -- O1
 ('00000000-0000-0000-0000-000000000005'),  -- S
 ('00000000-0000-0000-0000-00000000000e');  -- X

set role authenticated;
select _as('a0000000-0000-0000-0000-00000000000a');
insert into organisations (id,name,kind,created_by) values ('10000000-0000-0000-0000-000000000000','Coach Co','coach','a0000000-0000-0000-0000-00000000000a');
insert into organisation_members values ('10000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-00000000000b','advisor');
insert into organisation_members values ('10000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-00000000000c','member');
insert into cohorts (id,organisation_id,name) values ('c0000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000000','Sept workshop');
select _as('a0000000-0000-0000-0000-00000000000b');
insert into plans (id,organisation_id,cohort_id,business_name,created_by) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000000','DesignOne','a0000000-0000-0000-0000-00000000000b');
insert into plan_members (plan_id,user_id,role) values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','owner');
insert into plan_framework (plan_id,vision) values ('20000000-0000-0000-0000-000000000001','v1');
select _as('00000000-0000-0000-0000-000000000005');
insert into organisations (id,name,kind,created_by) values ('10000000-0000-0000-0000-000000000005','Solo Pty','owner','00000000-0000-0000-0000-000000000005');
insert into cohorts (id,organisation_id,name) values ('c0000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','Solo cohort');
insert into plans (id,organisation_id,business_name,created_by) values ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','Solo','00000000-0000-0000-0000-000000000005');
insert into plan_framework (plan_id,vision) values ('20000000-0000-0000-0000-000000000005','solo');
reset role;

-- ---------- 0. the app's own insert pattern (INSERT ... RETURNING) must work ----------
set role authenticated;
select _as('a0000000-0000-0000-0000-00000000000a');
select _assert(_allowed($q$insert into organisations (name,kind,created_by) values ('Returning Co','coach','a0000000-0000-0000-0000-00000000000a') returning id$q$), 'insert organisation with RETURNING (creator can read it immediately)');
select _assert(_allowed($q$insert into plans (organisation_id,business_name,created_by) select id,'Returning Plan','a0000000-0000-0000-0000-00000000000a' from organisations where name='Returning Co' returning id$q$), 'insert plan with RETURNING');
reset role;

-- ---------- 1. creator roles ----------
select _assert((select role from plan_members where plan_id='20000000-0000-0000-0000-000000000001' and user_id='a0000000-0000-0000-0000-00000000000b')='advisor', 'coach creating a client plan joins as advisor');
select _assert((select role from plan_members where plan_id='20000000-0000-0000-0000-000000000005' and user_id='00000000-0000-0000-0000-000000000005')='owner', 'solo owner creating own plan joins as owner');
select _assert((select count(*) from plan_settings where plan_id in ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005'))=2, 'plan_settings row auto-created per plan');

-- ---------- 2. visibility ----------
set role authenticated;
select _as('00000000-0000-0000-0000-000000000001');
select _assert((select count(*) from plans)=1 and (select count(*) from plan_framework)=1, 'owner sees only their plan');
select _assert((select count(*) from organisations)=0, 'plan owner who is not an org member sees no organisation rows');
select _as('a0000000-0000-0000-0000-00000000000b');
select _assert((select count(*) from plans)=1, 'advisor sees org plans');
select _as('a0000000-0000-0000-0000-00000000000c');
select _assert((select count(*) from plans)=0, 'plain org member sees no plans unless added to them');
select _as('00000000-0000-0000-0000-00000000000e');
select _assert((select count(*) from plans)=0 and (select count(*) from plan_framework)=0 and (select count(*) from organisations)=0, 'stranger sees nothing');
select _as('00000000-0000-0000-0000-000000000005');
select _assert((select count(*) from plans)=1 and (select business_name from plans)='Solo', 'solo owner sees only own plan');

-- ---------- 3. writes on plan data ----------
select _as('00000000-0000-0000-0000-000000000001');
select _assert(_allowed($q$update plan_framework set vision='o1' where plan_id='20000000-0000-0000-0000-000000000001'$q$), 'owner can edit own plan');
select _assert((select vision from plan_framework where plan_id='20000000-0000-0000-0000-000000000001')='o1', 'owner edit persisted');
select _as('a0000000-0000-0000-0000-00000000000b');
select _assert(_allowed($q$update plan_framework set vision='adv' where plan_id='20000000-0000-0000-0000-000000000001'$q$), 'advisor can edit client plan');
select _as('00000000-0000-0000-0000-00000000000e');
update plan_framework set vision='X' where plan_id='20000000-0000-0000-0000-000000000001';
reset role;
select _assert((select vision from plan_framework where plan_id='20000000-0000-0000-0000-000000000001')='adv', 'stranger update silently affected 0 rows');
set role authenticated;
select _as('00000000-0000-0000-0000-00000000000e');
select _assert(not _allowed($q$insert into plan_products (plan_id,name) values ('20000000-0000-0000-0000-000000000001','hack')$q$), 'stranger cannot insert into a plan');
select _as('00000000-0000-0000-0000-000000000005');
select _assert(not _allowed($q$insert into plan_products (plan_id,name) values ('20000000-0000-0000-0000-000000000001','cross-tenant')$q$), 'owner of another tenant cannot insert into a foreign plan');

-- ---------- 4. organisation membership is admin-only ----------
select _as('a0000000-0000-0000-0000-00000000000b');
select _assert(not _allowed($q$insert into organisation_members values ('10000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000000e','advisor')$q$), 'advisor cannot add org members');
select _assert(not _allowed($q$update organisation_members set role='admin' where user_id='a0000000-0000-0000-0000-00000000000b'$q$) or (select role from organisation_members where user_id='a0000000-0000-0000-0000-00000000000b')='advisor', 'advisor cannot promote themselves');
select _assert(not _allowed($q$update organisations set name='pwned' where id='10000000-0000-0000-0000-000000000000'$q$) or (select name from organisations where id='10000000-0000-0000-0000-000000000000')='Coach Co', 'advisor cannot rename org');
select _as('a0000000-0000-0000-0000-00000000000a');
select _assert(_allowed($q$insert into organisation_members values ('10000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000000e','member')$q$), 'admin can add org members');
select _assert((select count(*) from organisation_members where user_id='00000000-0000-0000-0000-00000000000e')=1, 'admin add persisted');

-- ---------- 5. server-controlled tables ----------
select _as('a0000000-0000-0000-0000-00000000000b');
select _assert(not _allowed($q$insert into plan_invitations (plan_id,email) values ('20000000-0000-0000-0000-000000000001','x@y')$q$), 'clients cannot create invitations directly');
select _assert(not _allowed($q$insert into plan_reports (plan_id,template_kind,sections) values ('20000000-0000-0000-0000-000000000001','bank','[]')$q$), 'clients cannot write reports directly');
select _assert(not _allowed($q$insert into ai_calls (plan_id,purpose,model) values ('20000000-0000-0000-0000-000000000001','x','m')$q$), 'clients cannot write ai_calls');
select _assert(not _allowed($q$insert into audit_log (plan_id,table_name,action) values ('20000000-0000-0000-0000-000000000001','t','insert')$q$), 'clients cannot write audit_log');
reset role;
insert into plan_reports (plan_id,template_kind,sections) values ('20000000-0000-0000-0000-000000000001','bank','[]');   -- service role
set role authenticated;
select _as('00000000-0000-0000-0000-000000000001');
select _assert((select count(*) from plan_reports)=1, 'owner can read their reports');
select _as('00000000-0000-0000-0000-00000000000e');
select _assert((select count(*) from plan_reports)=0, 'stranger cannot read reports');

-- ---------- 6. tenant boundaries enforced by the schema ----------
select _as('a0000000-0000-0000-0000-00000000000b');
select _assert(not _allowed($q$update plans set cohort_id='c0000000-0000-0000-0000-000000000005' where id='20000000-0000-0000-0000-000000000001'$q$), 'plan cannot be moved into another organisation''s cohort');
select _assert(_allowed($q$insert into plan_goals (id,plan_id,area,title) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','sales','Annual sales goal')$q$), 'annual goal insert');
select _as('00000000-0000-0000-0000-000000000005');
select _assert(not _allowed($q$insert into plan_goals (plan_id,parent_id,area,title,quarter) values ('20000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000001','sales','q goal',1)$q$), 'quarterly goal cannot point at a parent in another plan');
select _as('a0000000-0000-0000-0000-00000000000b');
select _assert(not _allowed($q$insert into plan_goals (plan_id,area,title) values ('20000000-0000-0000-0000-000000000001','sales','Second annual sales goal')$q$), 'only one annual goal per area');
select _assert(_allowed($q$insert into plan_goals (plan_id,parent_id,area,title,quarter) values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','sales','Q1 goal',1)$q$), 'quarterly goal under same-plan parent');
reset role;

-- ---------- 7. people child tables respect the plan boundary ----------
set role authenticated;
select _as('a0000000-0000-0000-0000-00000000000b');
select _assert(_allowed($q$insert into plan_people (id,plan_id,first_name) values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Sam')$q$), 'advisor adds a person');
select _assert(_allowed($q$insert into plan_people_duties (plan_id,person_id,duty) values ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Invoicing')$q$), 'duty under same-plan person');
select _as('00000000-0000-0000-0000-000000000005');
select _assert(not _allowed($q$insert into plan_people_duties (plan_id,person_id,duty) values ('20000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000001','cross')$q$), 'duty cannot point at a person in another plan');
select _assert((select count(*) from plan_people_duties)=0, 'other tenant cannot read duties');
reset role;

select 'ALL TENANT TESTS PASSED' as result;
