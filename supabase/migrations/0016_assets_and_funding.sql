-- 0016 — Fixed assets, and the funding columns Funding needs (SaaS §6.20).
--
-- Fixed assets have no table at all before this. Equipment and vehicle finance buy something that
-- depreciates, and depreciation is a P&L line, so the plan cannot be honest without somewhere to hold it.
--
-- An asset is either bought with cash the business has (source 'entered') or bought with a finance row in
-- Funding (source 'finance'). A financed asset's figures belong to that loan and are never editable here —
-- the same rule as a synced Overheads line (§6.19).

create type asset_source as enum ('entered', 'finance');
create type depreciation_method as enum ('straight_line', 'diminishing');

create table if not exists plan_fixed_assets (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references plans(id) on delete cascade,
  source              asset_source not null default 'entered',
  -- a financed asset is owned by its loan; delete the loan and the asset goes with it
  funding_debt_id     uuid references plan_funding_debt(id) on delete cascade,
  name                text not null,
  category            text,
  purchase_price      numeric(14,2) not null default 0,
  residual_value      numeric(14,2) not null default 0,
  useful_life_months  int not null default 60,
  method              depreciation_method not null default 'straight_line',
  start_year          int not null default 1 check (start_year between 1 and 5),
  start_month         int not null default 1 check (start_month between 1 and 12),
  notes               text,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- one asset per finance row, so a loan can never quietly own two
create unique index if not exists plan_fixed_assets_one_per_debt
  on plan_fixed_assets (funding_debt_id) where funding_debt_id is not null;
create index if not exists plan_fixed_assets_plan on plan_fixed_assets (plan_id);

-- a financed asset must name its loan; a cash asset must not
alter table plan_fixed_assets add constraint plan_fixed_assets_source_matches
  check ((source = 'finance') = (funding_debt_id is not null));

-- ---------- Funding: the columns the module actually sets ----------
-- APeX stores an absolute start_date. Every other module in this app places money by plan year + month,
-- because a plan is five forecast years and not a calendar. Funding follows the rest of the app.
alter table plan_funding_owner
  add column if not exists name        text,
  add column if not exists start_year  int not null default 1,
  add column if not exists start_month int not null default 1;

alter table plan_funding_debt
  add column if not exists start_year  int not null default 1,
  add column if not exists start_month int not null default 1;

alter table plan_funding_equity
  add column if not exists start_year  int not null default 1,
  add column if not exists start_month int not null default 1;

alter table plan_funding_grants
  add column if not exists start_year  int not null default 1,
  add column if not exists start_month int not null default 1;

alter table plan_funding_revenue_linked
  add column if not exists start_year  int not null default 1,
  add column if not exists start_month int not null default 1;

-- Opening cash: what is in the bank the day the plan starts. Without it "is the funding enough?" has no
-- starting point, and Historic only exists for a business that has traded before.
alter table plan_settings
  add column if not exists opening_cash numeric(14,2) not null default 0;

do $$
declare t text;
begin
  foreach t in array array['plan_fixed_assets'] loop
    perform apply_plan_rls(t::regclass);
  end loop;
end $$;
