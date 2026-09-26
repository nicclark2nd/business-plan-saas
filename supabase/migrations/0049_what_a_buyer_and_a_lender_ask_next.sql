-- 0049: the figures behind the four capability panels that had no data (§6.129.3).
--
-- §6.129.2 built every panel the plan could feed from what it already held. Four could not be fed at all,
-- and Nic chose to show them rather than leave them out — greyed, with a pencil to where the figure is
-- collected. A pencil to nowhere is a lie, so this migration builds the somewhere:
--
--   Can the business execute the growth?   capacity measures (Operations), key hires (People, derived),
--                                          weighted pipeline and customer retention (Marketing)
--   How overdue are the invoices?          debtors split by age (Historic → Balance sheet)
--   What will the lender check?            repayment history, covenants, guarantee (Funding)
--   Who are the customers?                 the largest five, with share, contract end and assignability
--                                          (Marketing → Market)
--
-- And the add-backs become a list, because a profit bridge with one step in it is not a bridge.
--
-- EVERY NEW FIGURE IS NULLABLE and nothing here writes a default into it. The panels read null as "nobody has
-- said" and draw greyed; a default would draw them as though somebody had (§6.89).

-- ---------- Operations → Capacity: what the business depends on, and how much of it is used ----------
--
-- Named by the client, not a fixed list: a concreter depends on pumps and crews, a café on seats, a
-- distributor on a warehouse. A fixed list fits one industry and misleads the rest. Six at most — enforced
-- in the app, where the screen can say why, not here where it would surface as a constraint error.
create table public.plan_capacity_measures (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans(id) on delete cascade,
  name        text not null,
  -- Percent of what exists that is in use now. Null until said; above 100 is allowed, because "we are
  -- running the crew at 110% on overtime" is a real and important answer.
  pct_used    numeric(6,2) check (pct_used is null or pct_used >= 0),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists plan_capacity_measures_plan_idx on public.plan_capacity_measures (plan_id, sort_order);
create trigger plan_capacity_measures_updated before update on public.plan_capacity_measures
  for each row execute function set_updated_at();
select apply_plan_rls('public.plan_capacity_measures'::regclass);

-- ---------- Marketing → Market: the largest customers ----------
--
-- Segments (0035) say what KIND of buyer; this says WHICH ones. It is the first thing a buyer's adviser asks
-- and the one question the whole app could not answer. Five at most, for the same reason as above.
--
-- `assignable` is three-valued on purpose: yes, no, and null — "nobody has read the contract", which is the
-- commonest true answer and the one a buyer most needs to hear.
create table public.plan_customers (
  id               uuid primary key default gen_random_uuid(),
  plan_id          uuid not null references public.plans(id) on delete cascade,
  name             text not null,
  revenue_share    numeric(5,2) check (revenue_share is null or (revenue_share >= 0 and revenue_share <= 100)),
  contract_ends_on date,
  assignable       boolean,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists plan_customers_plan_idx on public.plan_customers (plan_id, sort_order);
create trigger plan_customers_updated before update on public.plan_customers
  for each row execute function set_updated_at();
select apply_plan_rls('public.plan_customers'::regclass);

-- Two figures on the marketing record. Retention on Market, beside the customers it is about; the
-- pipeline on Sales process, beside the description of how work is won.
alter table public.plan_marketing add column if not exists customer_retention_pct numeric(5,2)
  check (customer_retention_pct is null or (customer_retention_pct >= 0 and customer_retention_pct <= 100));
alter table public.plan_marketing add column if not exists weighted_pipeline numeric(16,2)
  check (weighted_pipeline is null or weighted_pipeline >= 0);

comment on column public.plan_marketing.weighted_pipeline is
  'Value of work quoted and not yet won, each quote multiplied by the chance of winning it (§6.129.3). Read against next year''s growth in revenue.';

-- ---------- Historic → Balance sheet: how old the debtors are ----------
--
-- On the period row, beside `accounts_receivable`, because the split is OF that figure and has to add up to
-- it. Only the most recent period is shown on screen; older periods keep nulls.
alter table public.plan_historic_periods add column if not exists ar_current numeric(14,2);
alter table public.plan_historic_periods add column if not exists ar_30 numeric(14,2);
alter table public.plan_historic_periods add column if not exists ar_60 numeric(14,2);
alter table public.plan_historic_periods add column if not exists ar_90 numeric(14,2);

comment on column public.plan_historic_periods.ar_current is
  'Debtors not yet due (§6.129.3). With ar_30, ar_60 and ar_90 must sum to accounts_receivable; checked in the app, where the message can name the gap.';

-- ---------- Funding → Lender history ----------
--
-- For the whole plan, not per loan: most small businesses have one lender, and a history is the business's,
-- not the facility's. On plan_settings because that is one row per plan already.
alter table public.plan_settings add column if not exists repayments_on_time boolean;
alter table public.plan_settings add column if not exists covenant_history text;
alter table public.plan_settings add column if not exists guarantee_offered boolean;
alter table public.plan_settings add column if not exists guarantee_by text;

-- ---------- Plan settings → Exit & sale: add-backs, itemised ----------
--
-- A single "owner add-backs" figure told a buyer the total and nothing they could test. A list says what
-- each dollar is, and the profit bridge on the selling tab can then show each step a buyer's accountant
-- will argue about.
create table public.plan_add_backs (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans(id) on delete cascade,
  label       text not null,
  amount      numeric(16,2) not null default 0 check (amount >= 0),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists plan_add_backs_plan_idx on public.plan_add_backs (plan_id, sort_order);
create trigger plan_add_backs_updated before update on public.plan_add_backs
  for each row execute function set_updated_at();
select apply_plan_rls('public.plan_add_backs'::regclass);

-- THE TOTAL ALREADY STORED MOVES IN AS THE FIRST LINE, and only then does the column go — in that order,
-- in one migration, so there is no moment where the figure exists in neither place. SEQ carries 85,000
-- that Nic typed; this is what keeps it.
insert into public.plan_add_backs (plan_id, label, amount, sort_order)
select plan_id, 'Owner add-backs (not yet itemised)', owner_add_backs, 0
  from public.plan_settings
 where owner_add_backs is not null and owner_add_backs > 0;

-- One fact, one place (§6.41). Nothing reads this after the code that ships with this migration.
alter table public.plan_settings drop column if exists owner_add_backs;
