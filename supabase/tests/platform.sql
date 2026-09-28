-- Site Admin tests (§6.186, migration 0063). Every block raises on failure; a clean run prints "ALL SITE ADMIN TESTS PASSED".
-- Actors:  N (Nic, site admin)   F (admin of Coach Co)   C (a client of Coach Co's plan)   X (stranger)
-- Not a billing test: lift the plan allowance (0062) so these fixtures can hold several plans per organisation.
create or replace function public.billing_starter_plans() returns int language sql immutable as $$ select 1000 $$;
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;

create or replace function _as(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, false)
$$;
create or replace function _assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'SITE ADMIN TEST FAILED: %', msg; end if; end $$;
create or replace function _raises(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end $$;
create or replace function _ok(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return true; exception when others then return false; end $$;

insert into auth.users (id, email) values
 ('93000000-0000-0000-0000-000000000009', 'nic@example.com'),
 ('f3000000-0000-0000-0000-00000000000f', 'f@coach.example'),
 ('c3000000-0000-0000-0000-00000000000c', 'c@example.com'),
 ('e3000000-0000-0000-0000-00000000000e', 'x@example.com');
-- As Nic will, in the SQL editor.
insert into platform_admins (user_id) values ('93000000-0000-0000-0000-000000000009');

set role authenticated;
select _as('f3000000-0000-0000-0000-00000000000f');
insert into organisations (id, name, kind, created_by) values ('13000000-0000-0000-0000-000000000000', 'Coach Co', 'coach', 'f3000000-0000-0000-0000-00000000000f');
insert into plans (id, organisation_id, business_name, created_by) values ('23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000000', 'Client One', 'f3000000-0000-0000-0000-00000000000f');
reset role;
insert into plan_members (plan_id, user_id, role) values ('23000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000c', 'owner');
set role authenticated;

-- 1. Nobody makes themselves a site admin, and only a site admin is one.
select _as('f3000000-0000-0000-0000-00000000000f');
select _assert(not is_platform_admin(), 'a firm admin is a site admin');
select _assert(_raises($$insert into platform_admins (user_id) values ('f3000000-0000-0000-0000-00000000000f')$$) or (select count(*) from platform_admins) = 0, 'a firm admin made themselves a site admin');
reset role;
select _assert((select count(*) from platform_admins) = 1, 'the site admin list was changed through the API');
set role authenticated;
select _assert(_raises($$select * from platform_accounts()$$), 'a firm admin listed every account');
select _assert(_raises($$select platform_grant_plans('13000000-0000-0000-0000-000000000000', 99)$$), 'a firm admin gave themselves plans');
select _assert(_raises($$select platform_set_hold('13000000-0000-0000-0000-000000000000', false, null)$$), 'a firm admin changed a hold');
select _assert(_raises($$select platform_log('forged', null)$$), 'the log can be written directly');
select _assert((select count(*) from platform_audit) = 0, 'the log is readable');
select _as('e3000000-0000-0000-0000-00000000000e');
select _assert(_raises($$select * from platform_account_plans('13000000-0000-0000-0000-000000000000')$$), 'a stranger read an account''s plans');

-- 2. The site admin sees every account, and each look is logged.
select _as('93000000-0000-0000-0000-000000000009');
select _assert(is_platform_admin(), 'Nic is not a site admin');
select _assert((select count(*) from platform_accounts() where name = 'Coach Co') = 1, 'the firm is not listed');
select _assert((select active_plans from platform_accounts() where name = 'Coach Co') = 1, 'active plans wrong');
select _assert((select clients_with_login from platform_accounts() where name = 'Coach Co') = 1, 'client logins wrong');
select _assert((select admin_email from platform_accounts() where name = 'Coach Co') = 'f@coach.example', 'admin email wrong');
select _assert((select count(*) from platform_account_people('13000000-0000-0000-0000-000000000000')) = 1, 'people not listed');
select _assert((select client_email from platform_account_plans('13000000-0000-0000-0000-000000000000')) = 'c@example.com', 'client email not shown');
-- …without the site admin being able to reach the plan itself.
select _assert(not can_read_plan('23000000-0000-0000-0000-000000000001'), 'looking at an account opened the plan');
select _assert((select count(*) from platform_audit_recent(10) where action in ('list accounts', 'view account')) >= 2, 'looks were not logged');

-- 3. Give plans: sets the number, logged, and the firm sees it.
select platform_grant_plans('13000000-0000-0000-0000-000000000000', 12);
select platform_grant_plans('13000000-0000-0000-0000-000000000000', 7);
select _assert(_raises($$select platform_grant_plans('13000000-0000-0000-0000-000000000000', -1)$$), 'a negative grant was accepted');
select _as('f3000000-0000-0000-0000-00000000000f');
select _assert((select granted_plans from billing_accounts where organisation_id = '13000000-0000-0000-0000-000000000000') = 7, 'grant did not set the number');

-- 4. On hold: read-only for the firm and its client, new plans refused; lifted, everything works again.
select _as('93000000-0000-0000-0000-000000000009');
select platform_set_hold('13000000-0000-0000-0000-000000000000', true, 'Card declined three times');
select _as('f3000000-0000-0000-0000-00000000000f');
select _assert(can_read_plan('23000000-0000-0000-0000-000000000001'), 'on hold hid the plan from its firm');
select _assert(not can_write_plan('23000000-0000-0000-0000-000000000001'), 'on hold still lets the firm write');
select _assert(_raises($$insert into plans (organisation_id, business_name, created_by) values ('13000000-0000-0000-0000-000000000000', 'New', 'f3000000-0000-0000-0000-00000000000f')$$), 'on hold still lets the firm add a plan');
select _assert((select reason from org_on_hold('13000000-0000-0000-0000-000000000000')) = 'Card declined three times', 'the firm cannot see why');
select _as('c3000000-0000-0000-0000-00000000000c');
select _assert(can_read_plan('23000000-0000-0000-0000-000000000001') and not can_write_plan('23000000-0000-0000-0000-000000000001'), 'the client is not read-only on hold');
select _assert((select count(*) from org_on_hold('13000000-0000-0000-0000-000000000000')) = 1, 'the client cannot see the hold');
select _as('e3000000-0000-0000-0000-00000000000e');
select _assert((select count(*) from org_on_hold('13000000-0000-0000-0000-000000000000')) = 0, 'a stranger sees the hold');
select _as('93000000-0000-0000-0000-000000000009');
select platform_set_hold('13000000-0000-0000-0000-000000000000', false, null);
select _as('f3000000-0000-0000-0000-00000000000f');
select _assert(can_write_plan('23000000-0000-0000-0000-000000000001'), 'lifting the hold did not restore writing');
select _assert(_ok($$insert into plans (organisation_id, business_name, created_by) values ('13000000-0000-0000-0000-000000000000', 'New', 'f3000000-0000-0000-0000-00000000000f')$$), 'lifting the hold did not restore adding');

-- 5. The log says who did what.
select _as('93000000-0000-0000-0000-000000000009');
select _assert((select count(*) from platform_audit_recent(50) where action = 'put on hold' and admin_email = 'nic@example.com' and detail->>'reason' = 'Card declined three times') = 1, 'the hold is not in the log');
select _assert((select count(*) from platform_audit_recent(50) where action = 'grant plans') = 2, 'grants not logged');

select 'ALL SITE ADMIN TESTS PASSED';
