-- 0010: SWOT items remember where they came from, so suggestions drawn from the plan are not offered twice. SaaS §6.14.
alter table plan_swot_items add column source text;   -- null = typed by the user; otherwise a stable key like "competitor:<id>:threat"
create index plan_swot_items_source_idx on plan_swot_items (plan_id, source);
