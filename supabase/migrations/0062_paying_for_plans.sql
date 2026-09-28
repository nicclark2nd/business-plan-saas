-- 0062: paying for plans (§6.185)
--
-- Part 4 of the consultant's area. Nic's decisions:
--   * a subscription, plus extra plans bought on top, through Stripe;
--   * the subscription counts ACTIVE CLIENT PLANS AT A TIME — archiving a finished client frees a place;
--   * business owners planning for themselves pay too, on their own price;
--   * prices and levels are set in Stripe, and the app reads them.
--
-- HOW STRIPE'S NOTICES REACH THE DATABASE WITHOUT A MASTER KEY (Nic chose this: "one-job password").
--
-- A payment notice arrives with nobody signed in, so the ordinary rules would refuse it — rightly. Rather than
-- give the app the database's master key, the ONLY thing a notice can do is call the functions below, and
-- each of them first checks a password. The database keeps only a hash of that password, in a schema the app's
-- API cannot see. If the password ever leaked, all it could touch is billing records: no plan, no client, no
-- figure. The web route checks separately that each notice really came from Stripe (its signature) before it
-- gets this far.

create schema if not exists billing_private;
revoke all on schema billing_private from public;

create table if not exists billing_private.webhook_secret (
  id          int primary key default 1 check (id = 1),
  secret_hash text not null
);
-- Nic sets it once, in the SQL editor, with the same value as BILLING_DB_SECRET on the server:
--   insert into billing_private.webhook_secret (id, secret_hash)
--   values (1, encode(extensions.digest('PASTE-THE-SECRET', 'sha256'), 'hex'))
--   on conflict (id) do update set secret_hash = excluded.secret_hash;

create or replace function billing_private.check_secret(p_secret text) returns void
language plpgsql security definer set search_path = public, billing_private as $$
begin
  if p_secret is null or length(p_secret) < 32 or not exists (
    select 1 from billing_private.webhook_secret
     where secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  ) then
    raise exception 'billing secret refused' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------- what each organisation has paid for

create table if not exists public.billing_accounts (
  organisation_id      uuid primary key references public.organisations(id) on delete cascade,
  stripe_customer_id   text unique,
  subscription_id      text,
  status               text not null default 'none',   -- Stripe's own: active, trialing, past_due, canceled, unpaid, incomplete…
  price_id             text,
  level_name           text,                            -- the product's name in Stripe: "Bronze", "Owner"
  plans_included       int not null default 0,          -- from the product's metadata in Stripe
  extra_plans          int not null default 0,          -- bought on top, one-off
  granted_plans        int not null default 0,          -- given by BizPlanHQ (Site Admin, part 5; SQL until then)
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at           timestamptz not null default now()
);
alter table public.billing_accounts enable row level security;
-- Read by the organisation's own people; written only by the functions below.
drop policy if exists "billing read" on public.billing_accounts;
create policy "billing read" on public.billing_accounts for select using (is_org_member(organisation_id));

-- Every notice once: Stripe re-sends, and a re-sent "3 extra plans" must not become 6.
create table if not exists billing_private.events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- how many plans an organisation may have

-- ONE PLAN TO START WITH. Before anyone subscribes they can set up one plan and see what the app does —
-- otherwise a new consultant could not even create their first client, and an owner could not start. After
-- that, a paid subscription decides. Change this number here and nowhere else.
create or replace function public.billing_starter_plans() returns int language sql immutable as $$ select 1 $$;

-- Paid statuses. `past_due` keeps working while Stripe retries the card; the rest do not.
create or replace function public.plan_allowance(p_org uuid)
returns table (allowed int, used int, paid boolean, status text, level_name text)
language sql stable security definer set search_path = public as $$
  with b as (select * from billing_accounts where organisation_id = p_org),
       paid as (select coalesce((select status in ('active', 'trialing', 'past_due') from b), false) as p)
  select greatest(billing_starter_plans(),
                  case when (select p from paid) then coalesce((select plans_included + extra_plans from b), 0) else 0 end)
           + coalesce((select granted_plans from b), 0),
         (select count(*)::int from plans where organisation_id = p_org and archived_at is null),
         (select p from paid),
         coalesce((select status from b), 'none'),
         (select level_name from b)
   where is_org_member(p_org);
$$;

-- THE LIMIT IS KEPT BY THE DATABASE, not only by a greyed-out button: a new plan, or one taken back out of the
-- archive, is refused once the organisation is at its allowance. Plans that already exist are never touched.
create or replace function public.enforce_plan_allowance() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  if tg_op = 'UPDATE' and not (old.archived_at is not null and new.archived_at is null) then return new; end if;
  if tg_op = 'INSERT' and new.archived_at is not null then return new; end if;
  select greatest(billing_starter_plans(),
                  case when b.status in ('active', 'trialing', 'past_due') then b.plans_included + b.extra_plans else 0 end)
         + coalesce(b.granted_plans, 0)
    into lim
    from (select 1) one left join billing_accounts b on b.organisation_id = new.organisation_id;
  select count(*) into n from plans where organisation_id = new.organisation_id and archived_at is null and id <> new.id;
  if n >= lim then
    raise exception 'plan limit reached (% of %)', n, lim using errcode = 'P0001', hint = 'plan_limit';
  end if;
  return new;
end $$;

drop trigger if exists plans_allowance on plans;
create trigger plans_allowance before insert or update of archived_at on plans
  for each row execute function public.enforce_plan_allowance();

-- ---------------------------------------------------------------- what a Stripe notice may do

-- A subscription started, changed, renewed or ended. `p_org` comes from the metadata this app put on the
-- checkout; `p_customer` is Stripe's own id. Returns false for a notice already seen.
create or replace function public.billing_apply_subscription(
  p_secret text, p_event_id text, p_event_type text, p_org uuid, p_customer text,
  p_subscription text, p_status text, p_price text, p_level text, p_plans int,
  p_period_end timestamptz, p_cancel_at_end boolean
) returns boolean
language plpgsql security definer set search_path = public, billing_private as $$
begin
  perform billing_private.check_secret(p_secret);
  insert into billing_private.events (id, type) values (p_event_id, p_event_type) on conflict do nothing;
  if not found then return false; end if;
  if p_org is null or not exists (select 1 from organisations where id = p_org) then
    raise exception 'unknown organisation' using errcode = '22023';
  end if;
  insert into billing_accounts as b (organisation_id, stripe_customer_id, subscription_id, status, price_id, level_name,
                                     plans_included, current_period_end, cancel_at_period_end, updated_at)
  values (p_org, p_customer, p_subscription, coalesce(p_status, 'none'), p_price, p_level,
          greatest(coalesce(p_plans, 0), 0), p_period_end, coalesce(p_cancel_at_end, false), now())
  on conflict (organisation_id) do update set
    stripe_customer_id = coalesce(excluded.stripe_customer_id, b.stripe_customer_id),
    subscription_id = excluded.subscription_id, status = excluded.status, price_id = excluded.price_id,
    level_name = excluded.level_name, plans_included = excluded.plans_included,
    current_period_end = excluded.current_period_end, cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();
  return true;
end $$;

-- Extra plans bought once, on top of the subscription.
create or replace function public.billing_add_extra_plans(
  p_secret text, p_event_id text, p_org uuid, p_customer text, p_quantity int
) returns boolean
language plpgsql security definer set search_path = public, billing_private as $$
begin
  perform billing_private.check_secret(p_secret);
  insert into billing_private.events (id, type) values (p_event_id, 'extra_plans') on conflict do nothing;
  if not found then return false; end if;
  if p_org is null or not exists (select 1 from organisations where id = p_org) then
    raise exception 'unknown organisation' using errcode = '22023';
  end if;
  if coalesce(p_quantity, 0) < 1 or p_quantity > 1000 then raise exception 'bad quantity' using errcode = '22023'; end if;
  insert into billing_accounts as b (organisation_id, stripe_customer_id, extra_plans, updated_at)
  values (p_org, p_customer, p_quantity, now())
  on conflict (organisation_id) do update set
    stripe_customer_id = coalesce(b.stripe_customer_id, excluded.stripe_customer_id),
    extra_plans = b.extra_plans + excluded.extra_plans, updated_at = now();
  return true;
end $$;

-- The Stripe customer this organisation already has, so a second checkout reuses it. Admins only.
create or replace function public.billing_customer(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select stripe_customer_id from billing_accounts where organisation_id = p_org and is_org_admin(p_org);
$$;

grant execute on function public.billing_apply_subscription(text, text, text, uuid, text, text, text, text, text, int, timestamptz, boolean) to anon, authenticated;
grant execute on function public.billing_add_extra_plans(text, text, uuid, text, int) to anon, authenticated;
