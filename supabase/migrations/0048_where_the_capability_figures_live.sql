-- 0048: the figures the capability dials need, each on the step that owns it (§6.129).
--
-- WHY THIS MIGRATION EXISTS. The three Financial Capabilities tabs were built with their inputs ON them:
-- an asking price typed beside the dial it drives, six transferability scores in a grid under the gauge, a
-- loan proposal in a row of boxes. Nic, seeing it built: "THESE THREE TABS ARE FOR DISPLAY - NOT FOR
-- COLLECTING DATA." He is right, and the reason is not aesthetic. Nothing typed on those tabs was saved, so
-- every figure a client entered was gone on refresh, no report could print any of it, and a score that
-- changes every visit is not a measurement. A dashboard that collects data is a form wearing a disguise.
--
-- So each figure moves to the step whose subject it is, and the dials read them the way every other screen
-- reads the plan. What is NOT here is as important: no proposed-loan columns. The borrowing tab asked a
-- client to type an amount, a rate and a term for a loan they were contemplating, and the plan already
-- answers both questions worth asking — what cover the existing debt has, and what the earnings would
-- support on top. A contemplated loan belongs on Funding or in What-If, where the whole forecast moves with
-- it, not in a box on a dashboard (§6.41).

-- ---------- Assumptions: cash floor and what the money costs ----------
--
-- On plan_settings because that is already where the Assumptions screen saves (working_capital_schedule
-- lives there), so these sit beside the figures they are read with rather than in a table of their own.
--
-- BOTH NULLABLE, AND THAT IS THE POINT. A cash floor of zero is a real answer — "just don't go negative" —
-- and it must be distinguishable from nobody having been asked (§6.89). The growth tab greys its lowest-
-- month dial until one of them is set rather than assuming the client is happy at nought.
alter table public.plan_settings add column if not exists cash_floor numeric(16,2);
alter table public.plan_settings add column if not exists cost_of_capital numeric(6,3);

comment on column public.plan_settings.cash_floor is
  'The lowest cash balance the client will tolerate (§6.129). Null = never asked; 0 = asked, and the answer is "do not go negative".';
comment on column public.plan_settings.cost_of_capital is
  'Annual cost of the money funding the plan, as a percent. Sets the bar the return on growth has to clear.';

-- ---------- Assumptions: the downside ----------
--
-- A stress case is a STANDING SECOND VIEW of the plan, not an experiment, which is why it is stored and why
-- it is here and not in What-If. What-If applies its changes TO the plan and the plan becomes them; these
-- three never touch a forecast figure. They describe a bad year the business is asked to survive on paper,
-- and a lender reading a stressed debt-service cover has to be told which three numbers made it stressed.
alter table public.plan_settings add column if not exists stress_sales_pct numeric(6,3);
alter table public.plan_settings add column if not exists stress_margin_pts numeric(6,3);
alter table public.plan_settings add column if not exists stress_debtor_days integer;

comment on column public.plan_settings.stress_sales_pct is
  'Downside case (§6.129): sales fall by this percent. Null until set; the stressed dials say so rather than inventing a default.';

-- ---------- Plan settings: Exit & sale ----------
--
-- Four numbers and a year. None of them is a fact about the forecast — an asking price is a POSITION IN A
-- NEGOTIATION and a comparable multiple is somebody else's deal — so they are stored as what the client
-- believes rather than as anything the engine can check. They are still stored, because a price nobody
-- wrote down cannot be argued with, and the sale report has to print the number the client actually wants.
alter table public.plan_settings add column if not exists asking_price numeric(16,2);
alter table public.plan_settings add column if not exists owner_add_backs numeric(16,2);
alter table public.plan_settings add column if not exists multiple_low numeric(6,2);
alter table public.plan_settings add column if not exists multiple_high numeric(6,2);
alter table public.plan_settings add column if not exists intended_exit_year integer;

comment on column public.plan_settings.owner_add_backs is
  'Costs in the accounts that exist only because THIS owner runs it — above-market salary, the family car, one-off legal fees. Added back to EBITDA before a multiple is applied, and every dollar of it is a dollar a buyer''s accountant will argue about.';
comment on column public.plan_settings.multiple_low is
  'The bottom of the range businesses like this one have actually changed hands for, as a multiple of normalised EBITDA. A broker''s figure or the accountant''s, never the app''s.';

-- Sanity, not judgement: a low above a high is a typo, and letting it through makes the price dial read
-- backwards. Nothing here has an opinion about whether 4x is right for a concreter (open item 32).
alter table public.plan_settings drop constraint if exists plan_settings_multiple_range;
alter table public.plan_settings add constraint plan_settings_multiple_range
  check (multiple_low is null or multiple_high is null or multiple_low <= multiple_high);

-- ---------- Vision & Purpose: the seventh field ----------
--
-- The numbers above say what the business is worth wanting. This says whether a sale is the plan at all,
-- roughly when, and to whom — a competitor, a manager, the family. Prose, beside the other six, because it
-- is a statement of direction and the other six are too.
alter table public.plan_framework add column if not exists exit_intention text;

-- ---------- Fixed Assets: what a lender could lend against ----------
--
-- NOT the written-down value, which the balance sheet already holds and which is the wrong number: a bank
-- lends a fraction of what plant is worth, and nothing like that on a fit-out. Nullable per asset, and
-- loan-to-value stays unanswerable until at least one asset carries a figure, because a total of zero
-- across a shed full of machinery is a worse answer than no answer.
alter table public.plan_fixed_assets add column if not exists security_value numeric(16,2);

comment on column public.plan_fixed_assets.security_value is
  'What a lender would actually advance against this asset (§6.129) — not its book value. Null = nobody has said.';

-- ---------- Leadership Team → Risk & Succession: the six judgements ----------
--
-- These were six buttons on the sale dashboard, unsaved. They are key-person risk, which is a PEOPLE fact,
-- and the Leadership Team help text has promised since §6.11 that Risk & Succession "feeds key-person risk
-- in funding, SBA and sale reports" while the tab sat empty behind a Phase 2 tag. So the tab gets built and
-- this is what it writes, and the sale tab reads it rather than asking a second time.
--
-- ROWS, NOT SIX COLUMNS, because each score carries a note. "Runs without the owner: 2" is a number nobody
-- can reconstruct; "2 — every quote still goes through Dave" is a finding. The note is the half of this
-- that survives into a report.
create type transfer_factor as enum (
  'owner', 'customers', 'processes', 'staff', 'contracts', 'systems'
);

create table public.plan_transfer_ratings (
  plan_id    uuid not null references public.plans(id) on delete cascade,
  factor     transfer_factor not null,
  -- 1 weak to 5 strong. No zero: a factor nobody has judged has no row at all, so the average is taken over
  -- what was actually scored and the screen can say "4 of 6 scored" honestly.
  score      smallint not null check (score between 1 and 5),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, factor)
);

create trigger plan_transfer_ratings_updated before update on public.plan_transfer_ratings
  for each row execute function set_updated_at();

select apply_plan_rls('public.plan_transfer_ratings'::regclass);

comment on table public.plan_transfer_ratings is
  'Would the business survive a change of owner? Six fixed judgements (§6.129), scored on Leadership Team → Risk & Succession and read by the Capability to Sell dashboard. Fixed list because a moving one cannot be compared between plans or between years.';
