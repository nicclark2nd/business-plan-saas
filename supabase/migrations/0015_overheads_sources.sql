-- Overheads §6.19. Two lines are not typed here: the Leadership Team's salaries and the Marketing budget both
-- come from the module that owns them, across all five years. A synced line is never grown by Overheads —
-- turning a deliberate 5,000 marketing budget into 7,500 would be lying to the person who typed it.
-- On-costs (super, payroll tax, workers' comp) are one percentage applied to the wage lines, held on the plan.

do $$ begin
  create type overhead_source as enum ('entered', 'people', 'marketing');
exception when duplicate_object then null; end $$;

alter table plan_overheads
  add column if not exists source     overhead_source not null default 'entered',
  add column if not exists start_year int             not null default 1,
  add column if not exists on_cost    boolean         not null default false;

-- One synced line of each kind per plan; the module creates them on demand.
create unique index if not exists plan_overheads_one_synced
  on plan_overheads (plan_id, source) where source <> 'entered';

alter table plan_settings
  add column if not exists on_cost_pct numeric(6,3) not null default 0;

comment on column plan_overheads.source     is 'entered = typed here; people = Leadership Team salaries; marketing = Channels & spend. Synced lines are taken as given, never grown.';
comment on column plan_overheads.start_year is 'First plan year (1-5) the expense exists. Entered lines only.';
comment on column plan_overheads.on_cost    is 'A wage line: plan_settings.on_cost_pct applies to it.';
comment on column plan_settings.on_cost_pct is 'Superannuation, payroll tax and workers comp as one percentage of wages.';
