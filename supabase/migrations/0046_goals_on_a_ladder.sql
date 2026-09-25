-- 0046: goals on a ladder, not in six boxes (§6.125).
--
-- WHAT WAS WRONG WITH THE OLD SHAPE, said plainly because the migration is the record.
--
-- Since 0002 a plan has had exactly one annual goal per area, enforced by a unique index, and every
-- quarterly goal hung off one of those six rows as its parent. The screen that followed from it asked a
-- client to write six paragraphs, each headed by a phrase describing what the AREA covers — "Profit, cash,
-- margins and the terms behind them" — and the only text that ever said what to WRITE was the placeholder,
-- which disappears the moment the box has a character in it. A client re-reading their own screen was told
-- the subject and never the task.
--
-- The replacement is a LADDER: the same few facts stated at 1, 3 and 5 years, and a 90-day list underneath
-- with owners and statuses on it. Every field on it is a thing with a value, which is the whole repair —
-- there is nothing abstract left to interpret.
--
-- THE AREAS DO NOT DIE, THEY DEMOTE. Financial, Management, Marketing, Sales, Operational and AI stop being
-- the spine of the screen and become a TAG on a goal. That keeps four things working that would otherwise
-- each need rebuilding: the report can still group its sections, What-If's "Turn into goals" still knows
-- where its output belongs, the SWOT commitment still lands somewhere, and Marketing's Actions tab still
-- finds the marketing goals it shows.
--
-- NO REVENUE OR PROFIT COLUMN IS ADDED, AT ANY HORIZON, and that is the decision worth recording.
--
-- The obvious build gives each horizon a revenue and a profit to type. It was very nearly built. But the
-- forecast already runs FIVE years (`FORECAST_YEARS = [1,2,3,4,5]`), so Year 1, Year 3 and Year 5 revenue
-- and profit are all facts this plan has already calculated. A typed copy beside them is a second answer to
-- a question that already has one, on the page a lender reads, with nothing in the app able to tell which
-- of the two is true (§6.41). So the screen READS all six figures from the forecast and stores none of
-- them. A client who wants different numbers changes the forecast, and What-If already exists to do that.

-- ---------- the horizon ----------
--
-- 'ninety' first, because it is the default: a goal with somebody's name on it and a date is the common
-- case, and the enum's first value is what an unspecified row falls to.
create type goal_horizon as enum ('ninety', 'year1', 'year3', 'year5');

alter table public.plan_goals add column if not exists horizon goal_horizon;

-- Old annual goals were a whole year's intent, so they become Year 1. Everything that hung beneath one was
-- a quarterly step, which is what the 90-day list now holds.
update public.plan_goals set horizon = case when parent_id is null then 'year1' else 'ninety' end::goal_horizon
 where horizon is null;

-- ---------- area becomes a tag ----------
--
-- Nullable because a 5-year picture of the business is not "a Marketing goal" and should not be forced to
-- claim it is. The six values stay exactly as they were — the enum is untouched — so every row that already
-- carries one keeps it and every consumer that filters on one keeps working.
alter table public.plan_goals alter column area drop not null;

-- One annual goal per area was the old spine. A plan may now hold three Sales goals at three horizons, or
-- none, so the index that forbade it has to go before the data is cleaned.
drop index if exists plan_goals_one_annual_per_area;

-- ---------- sever the parent chain, then clear the placeholders ----------
--
-- ORDER MATTERS HERE AND GETTING IT WRONG DESTROYS CLIENT DATA. The parent foreign key cascades on delete,
-- so deleting the empty area rows FIRST would take every quarterly goal beneath them with it — including
-- every goal What-If wrote, which is most of what is on SEQ's screen today. The links are cut first, and
-- only then are the empty rows removed.
--
-- The links are cut rather than kept because the old parents were not goals. `saveQuarterlyGoal` and
-- `createGoalsFromScenario` both INSERT an annual row with an empty title whenever an area has none, purely
-- so the child has something to point at. They are scaffolding, and most of them say nothing at all. What
-- actually carried the meaning down to the child was the area, and the child still has it.
update public.plan_goals set parent_id = null where parent_id is not null;

-- Now safe: these rows have no children left and never had any text.
delete from public.plan_goals where horizon = 'year1' and coalesce(btrim(title), '') = '';

alter table public.plan_goals alter column horizon set default 'ninety';
alter table public.plan_goals alter column horizon set not null;

create index if not exists plan_goals_horizon_idx on public.plan_goals (plan_id, horizon);

comment on column public.plan_goals.horizon is
  'Which rung of the ladder this goal sits on (§6.125). year1/year3/year5 are statements of intent; ninety is a commitment with an owner and a date.';
comment on column public.plan_goals.area is
  'Optional tag (§6.125). Was the spine of the Goals screen until 0046; now it only groups — the report, Marketing''s Actions tab, What-If and the SWOT commitment all read it.';

-- ---------- the top of the screen ----------
--
-- One big goal and one North Star for the PLAN, not one per horizon. A North Star that changes depending on
-- which card you are looking at is not a north star.
--
-- The value is text, not numeric. These are measured in whatever unit the business actually steers by —
-- "$10m", "500 active members", "4 days" — and forcing them into a numeric column would mean either losing
-- the unit or inventing a second column to hold it, for a figure nothing computes with.
alter table public.plan_settings add column if not exists big_goal text;
alter table public.plan_settings add column if not exists north_star_metric text;
alter table public.plan_settings add column if not exists north_star_value text;
alter table public.plan_settings add column if not exists north_star_why text;

-- The 90 days everyone is currently working in. A date the client picks, because unlike the financial-year
-- horizons there is nothing in the plan that could compute it — a review cycle starts when a business
-- decides it starts.
alter table public.plan_settings add column if not exists ninety_day_ends_on date;

comment on column public.plan_settings.north_star_value is
  'Free text on purpose (§6.125): a north star is measured in the business''s own unit, and nothing computes with this figure.';

-- ---------- KPIs: named once, targeted per horizon ----------
--
-- The competing product this shape was taken from repeats each KPI's NAME down every horizon column, and
-- in their own marketing screenshot two of the three columns have names with no numbers beside them. Both
-- faults are the same fault: a row that looks like data and holds none, and three copies of one name that
-- can drift apart the first time somebody edits one of them.
--
-- So the name is stated ONCE and only the target varies. A KPI is a measure; a target is what you want it
-- to read by a date.
create table public.plan_kpis (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.plans(id) on delete cascade,
  name       text not null,
  -- "days", "%", "$" — shown beside the target so a bare 5 is never left to be guessed at.
  unit       text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, plan_id)
);

create table public.plan_kpi_targets (
  plan_id    uuid not null references public.plans(id) on delete cascade,
  kpi_id     uuid not null,
  horizon    goal_horizon not null,
  -- Numeric, unlike the North Star: these sit in a column of figures that has to line up, and a target the
  -- client left blank is a null rather than a nought, because "no target yet" and "a target of zero" are
  -- different things and the screen has to be able to tell them apart.
  target     numeric(16,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (kpi_id, horizon),
  foreign key (kpi_id, plan_id) references public.plan_kpis(id, plan_id) on delete cascade
);

create index if not exists plan_kpis_plan_idx on public.plan_kpis (plan_id, sort_order);
create index if not exists plan_kpi_targets_plan_idx on public.plan_kpi_targets (plan_id, horizon);

create trigger plan_kpis_updated before update on public.plan_kpis
  for each row execute function set_updated_at();
create trigger plan_kpi_targets_updated before update on public.plan_kpi_targets
  for each row execute function set_updated_at();

select apply_plan_rls('public.plan_kpis'::regclass);
select apply_plan_rls('public.plan_kpi_targets'::regclass);

comment on table public.plan_kpis is
  'The handful of measures a plan steers by (§6.125). Named once; the number wanted at each horizon lives in plan_kpi_targets.';
