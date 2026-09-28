-- Billing tests (§6.185, migration 0062). Every block raises on failure; a clean run prints "ALL BILLING TESTS PASSED".
-- Actors:  F (admin of Coach Co)   A (advisor)   O (owner planning for themselves)   X (stranger, not signed in)
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
-- Supabase grants the API roles table access by default and lets row-level security decide; mirror that.
grant all on all tables in schema public to anon;

create or replace function _as(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, false)
$$;
create or replace function _assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'BILLING TEST FAILED: %', msg; end if; end $$;
create or replace function _raises(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end $$;
create or replace function _ok(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return true; exception when others then return false; end $$;
grant execute on function _as(text), _assert(boolean, text), _raises(text), _ok(text) to anon;

-- The secret, as Nic will set it in the SQL editor.
insert into billing_private.webhook_secret (id, secret_hash)
values (1, encode(extensions.digest('a-very-long-test-secret-of-forty-characters!', 'sha256'), 'hex'));

insert into auth.users (id, email) values
 ('f2000000-0000-0000-0000-00000000000f', 'f@coach.example'),
 ('a2000000-0000-0000-0000-00000000000a', 'a@coach.example'),
 ('02000000-0000-0000-0000-000000000000', 'o@example.com');

set role authenticated;
select _as('f2000000-0000-0000-0000-00000000000f');
insert into organisations (id, name, kind, created_by) values ('12000000-0000-0000-0000-000000000000', 'Coach Co', 'coach', 'f2000000-0000-0000-0000-00000000000f');
insert into organisation_members values ('12000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-00000000000a', 'advisor');

-- 1. One plan to start with, before anyone pays; the second is refused — by the database.
select _assert(_ok($$insert into plans (id, organisation_id, business_name, created_by) values ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000000', 'First', 'f2000000-0000-0000-0000-00000000000f')$$), 'the starter plan was refused');
select _assert(_raises($$insert into plans (organisation_id, business_name, created_by) values ('12000000-0000-0000-0000-000000000000', 'Second', 'f2000000-0000-0000-0000-00000000000f')$$), 'a second plan was allowed without paying');
select _assert((select allowed from plan_allowance('12000000-0000-0000-0000-000000000000')) = 1, 'starter allowance is not 1');
select _assert((select used from plan_allowance('12000000-0000-0000-0000-000000000000')) = 1, 'used is not 1');

-- 2. Nobody but the password holder can record a payment — not a signed-in admin, not an anonymous caller.
select _assert(_raises($$select billing_apply_subscription('wrong-secret-wrong-secret-wrong-secret!!', 'evt_1', 'x', '12000000-0000-0000-0000-000000000000', 'cus_1', 'sub_1', 'active', 'price_1', 'Bronze', 10, now() + interval '30 days', false)$$), 'an admin recorded a payment with a wrong password');
select _assert(_raises($$insert into billing_accounts (organisation_id, status, plans_included) values ('12000000-0000-0000-0000-000000000000', 'active', 100)$$), 'an admin wrote their own billing row');
reset role; set role anon; select _as('');  -- nobody signed in
select _assert(_raises($$select billing_apply_subscription('short', 'evt_1', 'x', '12000000-0000-0000-0000-000000000000', 'cus_1', 'sub_1', 'active', 'price_1', 'Bronze', 10, null, false)$$), 'a short password was accepted');
select _assert(_raises($$select * from billing_private.webhook_secret$$), 'the password hash is readable');

-- 3. With the password (the Stripe route runs as anon), a subscription is recorded — once.
select _assert(billing_apply_subscription('a-very-long-test-secret-of-forty-characters!', 'evt_1', 'customer.subscription.created', '12000000-0000-0000-0000-000000000000', 'cus_1', 'sub_1', 'active', 'price_1', 'Bronze', 3, now() + interval '30 days', false), 'subscription not recorded');
select _assert(not billing_apply_subscription('a-very-long-test-secret-of-forty-characters!', 'evt_1', 'customer.subscription.created', '12000000-0000-0000-0000-000000000000', 'cus_1', 'sub_1', 'active', 'price_1', 'Bronze', 3, now() + interval '30 days', false), 'a re-sent notice was applied twice');
select _assert(_raises($$select billing_apply_subscription('a-very-long-test-secret-of-forty-characters!', 'evt_x', 'x', '19999999-0000-0000-0000-000000000000', 'cus_9', 'sub_9', 'active', 'p', 'L', 3, null, false)$$), 'a notice for an unknown organisation was accepted');
select _assert((select count(*) from billing_accounts) = 0, 'anonymous caller can read billing');
reset role; set role authenticated;

-- 4. Paid: three plans, and the org can see it; a stranger org member cannot.
select _as('f2000000-0000-0000-0000-00000000000f');
select _assert((select allowed from plan_allowance('12000000-0000-0000-0000-000000000000')) = 3, 'paid allowance is not 3');
select _assert((select paid from plan_allowance('12000000-0000-0000-0000-000000000000')), 'not shown as paid');
select _assert(_ok($$insert into plans (id, organisation_id, business_name, created_by) values ('22000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000000', 'Second', 'f2000000-0000-0000-0000-00000000000f')$$), 'second plan refused after paying');
select _assert(_ok($$insert into plans (id, organisation_id, business_name, created_by) values ('22000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000000', 'Third', 'f2000000-0000-0000-0000-00000000000f')$$), 'third plan refused');
select _assert(_raises($$insert into plans (organisation_id, business_name, created_by) values ('12000000-0000-0000-0000-000000000000', 'Fourth', 'f2000000-0000-0000-0000-00000000000f')$$), 'a fourth plan was allowed on a plan of three');
select _as('a2000000-0000-0000-0000-00000000000a');
select _assert((select count(*) from billing_accounts) = 1, 'advisor cannot see the firm''s billing');
select _assert((select billing_customer('12000000-0000-0000-0000-000000000000')) is null, 'advisor reads the Stripe customer');
select _as('f2000000-0000-0000-0000-00000000000f');
select _assert((select billing_customer('12000000-0000-0000-0000-000000000000')) = 'cus_1', 'admin cannot read the Stripe customer');

-- 5. Archiving frees a place; taking one back out of the archive is refused at the limit.
select _assert(_ok($$update plans set archived_at = now() where id = '22000000-0000-0000-0000-000000000001'$$), 'archive refused');
select _assert(_ok($$insert into plans (id, organisation_id, business_name, created_by) values ('22000000-0000-0000-0000-000000000004', '12000000-0000-0000-0000-000000000000', 'Fourth', 'f2000000-0000-0000-0000-00000000000f')$$), 'archiving did not free a place');
select _assert(_raises($$update plans set archived_at = null where id = '22000000-0000-0000-0000-000000000001'$$), 'a plan came back from the archive past the limit');
select _assert(_ok($$update plans set business_name = 'Renamed' where id = '22000000-0000-0000-0000-000000000002'$$), 'an ordinary edit was blocked by the limit');

-- 6. Extra plans add on top, once per notice.
reset role; set role anon; select _as('');  -- nobody signed in
select _assert(billing_add_extra_plans('a-very-long-test-secret-of-forty-characters!', 'cs_1', '12000000-0000-0000-0000-000000000000', 'cus_1', 2), 'extra plans not recorded');
select _assert(not billing_add_extra_plans('a-very-long-test-secret-of-forty-characters!', 'cs_1', '12000000-0000-0000-0000-000000000000', 'cus_1', 2), 'extra plans counted twice');
select _assert(_raises($$select billing_add_extra_plans('a-very-long-test-secret-of-forty-characters!', 'cs_2', '12000000-0000-0000-0000-000000000000', 'cus_1', 0)$$), 'zero extra plans accepted');
reset role; set role authenticated;
select _as('f2000000-0000-0000-0000-00000000000f');
select _assert((select allowed from plan_allowance('12000000-0000-0000-0000-000000000000')) = 5, 'extras not added (3 + 2)');
select _assert(_ok($$update plans set archived_at = null where id = '22000000-0000-0000-0000-000000000001'$$), 'restore refused with room to spare');

-- 7. Cancelled: back to the starter allowance for NEW plans; nothing already there is touched.
reset role; set role anon; select _as('');  -- nobody signed in
select billing_apply_subscription('a-very-long-test-secret-of-forty-characters!', 'evt_2', 'customer.subscription.deleted', '12000000-0000-0000-0000-000000000000', 'cus_1', 'sub_1', 'canceled', 'price_1', 'Bronze', 3, null, false);
reset role; set role authenticated;
select _as('f2000000-0000-0000-0000-00000000000f');
select _assert((select allowed from plan_allowance('12000000-0000-0000-0000-000000000000')) = 1, 'a cancelled subscription still counts');
select _assert((select count(*) from plans where organisation_id = '12000000-0000-0000-0000-000000000000' and archived_at is null) = 4, 'existing plans were touched');
select _assert(_raises($$insert into plans (organisation_id, business_name, created_by) values ('12000000-0000-0000-0000-000000000000', 'Fifth', 'f2000000-0000-0000-0000-00000000000f')$$), 'a new plan was allowed after cancelling');

-- 8. An owner's first plan needs no subscription; their own subscription counts for them alone.
select _as('02000000-0000-0000-0000-000000000000');
insert into organisations (id, name, kind, created_by) values ('12000000-0000-0000-0000-000000000005', 'Solo', 'owner', '02000000-0000-0000-0000-000000000000');
select _assert(_ok($$insert into plans (organisation_id, business_name, created_by) values ('12000000-0000-0000-0000-000000000005', 'Solo Biz', '02000000-0000-0000-0000-000000000000')$$), 'an owner could not start');
select _assert((select count(*) from plan_allowance('12000000-0000-0000-0000-000000000000')) = 0, 'an owner reads another firm''s allowance');
select _assert((select count(*) from billing_accounts) = 0, 'an owner reads another firm''s billing');

select 'ALL BILLING TESTS PASSED';
