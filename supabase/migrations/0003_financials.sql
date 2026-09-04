-- 0003: financial inputs — engine-shaped (see docs/planning/Data_Model.md and APeX types)

-- ---------- Sales: products ----------
create table plan_products (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references plans(id) on delete cascade,
  name                  text not null,
  description           text,
  average_price         numeric(14,2) not null default 0,
  units_sold            numeric(14,2) not null default 0,
  cost_per_unit         numeric(14,4) not null default 0,
  start_selling_year    int not null default 1,
  yearly_growth         jsonb not null default '{}'::jsonb,   -- {"1": {"price": 3, "units": 5}, ...} percentages
  yearly_cost_increase  jsonb not null default '{}'::jsonb,   -- {"1": 2.5, ...} percentages
  monthly_distribution  jsonb,                                -- {"jan": 8.33, ...} percentages summing to 100; null = even
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------- COGS: fixed items ----------
create table plan_fixed_cogs (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references plans(id) on delete cascade,
  item_name             text not null,
  annual_cost           numeric(14,2) not null default 0,
  yearly_growth_rates   jsonb not null default '{}'::jsonb,   -- {"1": 2, ...}
  monthly_distribution  jsonb,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------- Overheads ----------
create table plan_overheads (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references plans(id) on delete cascade,
  name                  text not null,
  category              text,
  current_value         numeric(14,2) not null default 0,
  yearly_change         jsonb not null default '{}'::jsonb,   -- {"1": 2, ...} percentages
  monthly_distribution  jsonb,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------- Funding ----------
create type owner_funding_type as enum ('owner_capital','owner_loan');
create table plan_funding_owner (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references plans(id) on delete cascade,
  funding_type          owner_funding_type not null default 'owner_capital',
  amount                numeric(14,2) not null default 0,
  date_injected         date,
  interest_rate         numeric(6,3),
  repayment_term_months int,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create type debt_loan_type      as enum ('term_loan','line_of_credit','equipment_finance','vehicle_finance','director_loan');
create type debt_repayment_type as enum ('amortised','interest_only','pct_of_balance');
create type payment_frequency   as enum ('weekly','fortnightly','monthly','quarterly');
create table plan_funding_debt (
  id                     uuid primary key default gen_random_uuid(),
  plan_id                uuid not null references plans(id) on delete cascade,
  lender_name            text not null,
  loan_type              debt_loan_type not null default 'term_loan',
  total_facility_amount  numeric(14,2) not null default 0,
  amount_drawn           numeric(14,2) not null default 0,
  interest_rate          numeric(6,3) not null default 0,
  term_months            int not null default 60,
  repayment_type         debt_repayment_type not null default 'amortised',
  payment_frequency      payment_frequency not null default 'monthly',
  residual_value         numeric(14,2) not null default 0,
  start_date             date,
  fees                   numeric(14,2),
  annual_fee             numeric(14,2) not null default 0,
  min_repayment_pct      numeric(6,3) not null default 0,
  draw_schedule          jsonb not null default '[]'::jsonb,   -- [{month, amount}]
  opening_balance        numeric(14,2) not null default 0,
  auto_draw_enabled      boolean not null default false,
  min_cash_buffer        numeric(14,2) not null default 0,
  -- asset-backed finance (equipment / vehicle) → Fixed Assets + depreciation
  asset_purchase_price   numeric(14,2) not null default 0,
  down_payment           numeric(14,2) not null default 0,
  useful_life_months     int not null default 0,
  asset_category         text,
  depreciation_residual  numeric(14,2) not null default 0,
  subject_to_approval    boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table plan_funding_equity (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references plans(id) on delete cascade,
  investor_name       text not null,
  amount_invested     numeric(14,2) not null default 0,
  date                date,
  equity_percent      numeric(6,3) not null default 0,
  pre_money_valuation numeric(14,2),
  dividend_policy     boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create type grant_recognition as enum ('immediate','deferred');
create table plan_funding_grants (
  id                        uuid primary key default gen_random_uuid(),
  plan_id                   uuid not null references plans(id) on delete cascade,
  grant_name                text not null,
  amount_approved           numeric(14,2) not null default 0,
  date_received             date,
  has_conditions            boolean not null default false,
  conditions                text,
  recognition_type          grant_recognition not null default 'immediate',
  recognition_period_months int,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table plan_funding_revenue_linked (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references plans(id) on delete cascade,
  provider            text not null,
  amount_received     numeric(14,2) not null default 0,
  repayment_percent   numeric(6,3) not null default 0,
  cap_multiple        numeric(6,3) not null default 1.5,
  min_monthly_payment numeric(14,2) not null default 0,
  start_date          date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- Extraordinary items ----------
create type extraordinary_category as enum ('income','expense');
create table plan_extraordinary_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  description text not null,
  category    extraordinary_category not null,
  year        int not null default 1,
  month       int not null default 1 check (month between 1 and 12),
  amount      numeric(14,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Historic periods (mirrors FinancialPeriod) ----------
create table plan_historic_periods (
  plan_id                       uuid not null references plans(id) on delete cascade,
  period_number                 int not null check (period_number between 1 and 4),
  period_end                    date,
  period_length                 int not null default 12,
  revenue                       numeric(14,2) default 0,
  cogs                          numeric(14,2) default 0,
  gross_margin                  numeric(14,2) default 0,
  overheads                     numeric(14,2) default 0,
  depreciation_amortisation     numeric(14,2) default 0,
  operating_profit              numeric(14,2) default 0,
  extraordinary_income_expenses numeric(14,2) default 0,
  interest_paid                 numeric(14,2) default 0,
  net_profit_before_tax         numeric(14,2) default 0,
  tax_paid                      numeric(14,2) default 0,
  net_profit                    numeric(14,2) default 0,
  dividends_paid                numeric(14,2) default 0,
  retained_profit               numeric(14,2) default 0,
  cash                          numeric(14,2) default 0,
  accounts_receivable           numeric(14,2) default 0,
  inventory_wip                 numeric(14,2) default 0,
  other_current_assets          numeric(14,2) default 0,
  current_assets                numeric(14,2) default 0,
  fixed_assets                  numeric(14,2) default 0,
  other_non_current_assets      numeric(14,2) default 0,
  non_current_assets            numeric(14,2) default 0,
  total_assets                  numeric(14,2) default 0,
  accounts_payable              numeric(14,2) default 0,
  bank_loans_current            numeric(14,2) default 0,
  other_current_liabilities     numeric(14,2) default 0,
  current_liabilities           numeric(14,2) default 0,
  bank_loans_non_current        numeric(14,2) default 0,
  other_non_current_liabilities numeric(14,2) default 0,
  non_current_liabilities       numeric(14,2) default 0,
  total_liabilities             numeric(14,2) default 0,
  equity                        numeric(14,2) default 0,
  source                        text,          -- 'manual' | 'excel' | 'accounting_export'
  updated_at                    timestamptz not null default now(),
  primary key (plan_id, period_number)
);

-- ---------- indexes, triggers, RLS ----------
do $$
declare t text;
begin
  foreach t in array array[
    'plan_products','plan_fixed_cogs','plan_overheads','plan_funding_owner','plan_funding_debt',
    'plan_funding_equity','plan_funding_grants','plan_funding_revenue_linked','plan_extraordinary_items',
    'plan_historic_periods'
  ] loop
    if t <> 'plan_historic_periods' then
      execute format('create index if not exists %I on %I (plan_id)', t || '_plan_idx', t);
    end if;
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t || '_updated', t);
    perform apply_plan_rls(t::regclass);
  end loop;
end $$;
