-- 0040: how the work actually gets done (§6.84).
--
-- THE ONE SECTION OF A STANDARD BUSINESS PLAN THE APP HAD NO DATA FOR. Every outline of a business plan
-- asks for an operations section — where the work happens, who supplies it, how it flows, and what limits
-- it — and a client using this app could not answer a single one of those questions. The report would have
-- had to print the heading and nothing under it, which is the fault this project refuses to ship (§6.57).
--
-- `plan_outlets` has existed since 0002 with a name, an address and a description, and no screen has ever
-- rendered it. It gets the columns a lender actually asks about rather than a new table beside it: the row
-- already means "a place this business operates from", and a second table meaning the same thing is how two
-- readings of one fact start (§6.41).
--
-- Additive only. Nothing is dropped and nothing is rewritten, so it is safe to apply before the code ships.

-- ---------- Premises ----------
alter table public.plan_outlets add column if not exists tenure text;        -- owned | leased | shared | none
-- Which one is the business's own address. Exactly one should be true; the screen enforces it, not the DB,
-- because a client mid-edit with none set is a normal state and not a constraint violation.
alter table public.plan_outlets add column if not exists is_primary boolean not null default false;
alter table public.plan_outlets add column if not exists floor_area text;    -- free text: "420 m²", "two bays"
alter table public.plan_outlets add column if not exists monthly_cost numeric(14,2) default 0;
alter table public.plan_outlets add column if not exists purpose text;       -- what happens at this one

comment on column public.plan_outlets.monthly_cost is
  'What this place costs a month. NOT fed to the forecast (§6.84) — rent is already an overhead, and counting it twice would overstate the costs.';

-- ---------- Suppliers ----------
create table if not exists public.plan_suppliers (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  name        text not null default '',
  supplies    text,
  terms       text,                           -- "30 days", "COD", "fixed to June 2027"
  -- How badly the business is hurt if this one stops. The column a lender reads first, and the reason the
  -- table earns its place: a critical supplier with no alternative is a risk visible on the face of the plan.
  dependency  text,                           -- low | medium | high | critical
  alternative text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists plan_suppliers_plan_idx on public.plan_suppliers (plan_id);

-- ---------- How the work gets done ----------
-- The operational process, which begins where the SALES process on Marketing ends. One is how a job is won;
-- this is how it is delivered, and a plan that confuses them describes neither.
create table if not exists public.plan_operations_steps (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  title       text not null default '',
  detail      text,
  owner       text,                           -- a name or a role; not a foreign key, because it is often neither
  duration    text,                           -- free text: "2 days", "same day", "3 weeks lead time"
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists plan_operations_steps_plan_idx on public.plan_operations_steps (plan_id);

-- ---------- Capacity ----------
-- One row per plan, like plan_marketing. These are sentences, not a list.
create table if not exists public.plan_operations (
  plan_id             uuid primary key references plans(id) on delete cascade,
  operating_hours     text,
  capacity_now        text,
  capacity_constraint text,
  capacity_plan       text,
  quality_approach    text,
  updated_at          timestamptz not null default now()
);

do $$ begin
  create trigger plan_suppliers_updated before update on public.plan_suppliers
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger plan_operations_steps_updated before update on public.plan_operations_steps
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger plan_operations_updated before update on public.plan_operations
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin perform apply_plan_rls('public.plan_suppliers'::regclass);
exception when duplicate_object then null; end $$;
do $$ begin perform apply_plan_rls('public.plan_operations_steps'::regclass);
exception when duplicate_object then null; end $$;
do $$ begin perform apply_plan_rls('public.plan_operations'::regclass);
exception when duplicate_object then null; end $$;

comment on table public.plan_suppliers is
  'Who the business depends on to deliver (§6.84). Dependency with no alternative is a risk the plan states rather than hides.';
comment on table public.plan_operations_steps is
  'How a job is DELIVERED. How one is WON is the sales process on Marketing (§6.84).';
