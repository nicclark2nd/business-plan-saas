-- 0002: plan settings, Strategy & Direction, Assets, People, Market, Goals

-- helper macro: standard plan-scoped RLS for a table (call after create)
create or replace function apply_plan_rls(tbl regclass) returns void language plpgsql as $$
begin
  execute format('alter table %s enable row level security', tbl);
  execute format('create policy "read"  on %s for select using (can_read_plan(plan_id))', tbl);
  execute format('create policy "write" on %s for all using (can_write_plan(plan_id)) with check (can_write_plan(plan_id))', tbl);
end $$;

-- ---------- plan settings (one row per plan) ----------
create table plan_settings (
  plan_id                     uuid primary key references plans(id) on delete cascade,
  date_established            date,
  industry                    text,
  country                     text,
  legal_structure             text,
  products_services_statement text,
  financial_year_end_month    int not null default 6 check (financial_year_end_month between 1 and 12),
  first_projected_year        int,
  months_projecting           int not null default 12,
  tax_rate                    numeric(6,3) not null default 25,
  dividend_rate               numeric(6,3) not null default 0,
  currency                    text not null default 'AUD',
  opening_tax_payable         numeric(14,2) not null default 0,
  customer_type               text,
  product_type                text,
  customer_acquisition_cost   numeric(14,2),
  monthly_churn_rate          numeric(6,3),
  -- engine-shaped assumption grids, keyed by forecast year "1".."5"
  working_capital_schedule    jsonb not null default '{}'::jsonb,  -- {year: {debtorDays, inventoryDays, creditorDays}}
  cash_flow_assumptions       jsonb not null default '{}'::jsonb,  -- {year: {taxPaidPct, prepaidClosing, accruedClosing, maintenanceCapex, capexLifeYears, disposalProceeds, disposedBookValue}}
  logo_path                   text,
  updated_at                  timestamptz not null default now()
);
create trigger plan_settings_updated before update on plan_settings for each row execute function set_updated_at();
do $$ begin perform apply_plan_rls('plan_settings'); end $$;

-- create settings row with the plan
create or replace function on_plan_created_settings() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into plan_settings (plan_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger plan_created_settings after insert on plans for each row execute function on_plan_created_settings();

-- ---------- Strategy & Direction: Vision & Purpose ----------
create table plan_framework (
  plan_id       uuid primary key references plans(id) on delete cascade,
  vision        text, mission text, purpose text, brand_promise text, ai_direction text, field_of_play text,
  updated_at    timestamptz not null default now()
);
create trigger plan_framework_updated before update on plan_framework for each row execute function set_updated_at();
do $$ begin perform apply_plan_rls('plan_framework'); end $$;

-- ---------- Assets (descriptive registers) ----------
create table plan_outlets (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  name text not null, address text, description text, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table plan_social_media (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  platform text not null, url text, description text, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table plan_memberships (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  organisation_name text not null, description text, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table plan_ip (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  name text not null, ip_type text, description text, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table plan_capital_equipment (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  name text not null, value numeric(14,2), description text, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

-- ---------- People ----------
create table plan_people (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references plans(id) on delete cascade,
  name                  text not null,
  position              text,
  pct_time_in_sales     numeric(5,2) default 0,
  pct_shareholding      numeric(5,2) default 0,
  annual_salary         numeric(14,2) default 0,
  salary_by_year        jsonb not null default '{}'::jsonb,   -- {"1": 90000, "2": 93000, ...}
  productivity_level    text,
  productivity_comments text,
  duties                text,
  qualities             text,
  education             text,
  focus_areas           text,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------- Market ----------
create table plan_marketing (
  plan_id              uuid primary key references plans(id) on delete cascade,
  target_market text, market_size text, market_trends text, customer_needs text, competitive_analysis text,
  research_topic text, research_methodology text, key_findings text, recommendations text,
  brand_purpose text, brand_values text, brand_personality text, visual_identity text,
  updated_at timestamptz not null default now()
);
create type promotion_kind as enum ('advertising','content','sales_promotions','public_relations','partnerships','retention');
create table plan_promotion_items (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  kind promotion_kind not null, approach text, estimated_budget numeric(14,2) default 0,
  updated_at timestamptz not null default now(), unique (plan_id, kind));
create table plan_distribution_channels (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  channel text not null, cost numeric(14,2) default 0, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table plan_marketing_actions (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  title text not null, detail text, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table plan_competitors (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  name text not null, profile text, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

-- ---------- Goals ----------
create type swot_quadrant as enum ('strength','weakness','opportunity','threat');
create table plan_swot_items (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plans(id) on delete cascade,
  quadrant swot_quadrant not null, text text not null, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create type goal_area   as enum ('financial','management','marketing','sales','operational','ai');
create type goal_status as enum ('not_started','in_progress','done','at_risk');
create type goal_source as enum ('manual','ai','whatif');
create table plan_goals (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references plans(id) on delete cascade,
  parent_id       uuid,                                                -- null = annual goal
  area            goal_area not null,
  title           text not null,
  detail          text,
  year            int,
  quarter         int check (quarter between 1 and 4),
  owner_user_id   uuid references auth.users(id) on delete set null,
  status          goal_status not null default 'not_started',
  milestone_date  date,
  source          goal_source not null default 'manual',
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, plan_id),
  -- a quarterly goal's parent must be a goal in the same plan
  foreign key (parent_id, plan_id) references plan_goals(id, plan_id) on delete cascade
);
-- one annual goal per area per plan
create unique index plan_goals_one_annual_per_area on plan_goals (plan_id, area) where parent_id is null;
create index on plan_goals (plan_id, parent_id);

-- ---------- indexes, triggers, RLS for all row tables ----------
do $$
declare t text;
begin
  foreach t in array array[
    'plan_outlets','plan_social_media','plan_memberships','plan_ip','plan_capital_equipment',
    'plan_people','plan_marketing','plan_promotion_items','plan_distribution_channels',
    'plan_marketing_actions','plan_competitors','plan_swot_items','plan_goals'
  ] loop
    if t not in ('plan_marketing') then
      execute format('create index if not exists %I on %I (plan_id)', t || '_plan_idx', t);
    end if;
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t || '_updated', t);
    perform apply_plan_rls(t::regclass);
  end loop;
end $$;
