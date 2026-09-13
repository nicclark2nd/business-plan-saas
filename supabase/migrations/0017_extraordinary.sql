-- 0017 — One-off income and costs (SaaS §6.23).
--
-- The table has existed since 0003 and nothing has ever written to it. Two things were missing before it
-- could be trusted:
--
-- 1. `year` had no bound. APeX's own screen lets a client date an item in a year that sits outside the
--    five-year projection, and the forecast then silently ignores it — 15,000 of income entered, shown in a
--    summary card, and present in neither the P&L nor the cash flow. A plan year is 1–5 and nothing else.
--
-- 2. An item that is the proceeds of selling an asset is not operating income. It belongs in investing, and
--    it should be able to say which asset it came from. Retiring that asset and stopping its depreciation is
--    balance-sheet work and lands with Review forecast; naming the asset now is what makes that possible.

alter table plan_extraordinary_items
  add column if not exists source_asset_id uuid references plan_fixed_assets(id) on delete set null,
  add column if not exists notes text,
  add column if not exists sort_order int not null default 0;

-- A plan year, not a calendar year. There is no year a client can pick that the forecast then drops.
alter table plan_extraordinary_items drop constraint if exists plan_extraordinary_items_year_check;
alter table plan_extraordinary_items add constraint plan_extraordinary_items_year_check
  check (year between 1 and 5);

-- Only income can come from selling something.
alter table plan_extraordinary_items drop constraint if exists plan_extraordinary_items_disposal_is_income;
alter table plan_extraordinary_items add constraint plan_extraordinary_items_disposal_is_income
  check (source_asset_id is null or category = 'income');

-- (no plan_id index here — 0003 already created plan_extraordinary_items_plan_idx.)

-- No apply_plan_rls here: 0003 already put read/write policies on this table, and calling it twice fails on
-- the existing policy. Verified by replaying all seventeen migrations against a scratch Postgres.
