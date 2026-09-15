-- 0026 — a fixed cost and a salary ARE their first-year figures (§6.48)
--
-- 0025 did this for overheads. Two tables were left behind, and they were the last places in the app where
-- "the figure you typed" and "the figure in Year 1" were different numbers:
--
--   plan_fixed_cogs   annual_cost   x (1 + yearly_growth_rates->>'1')    became Year 1
--   plan_people       annual_salary x (1 + salary_adjustments->>start)   became that person's first year
--
-- A yard entered at 60,000 with 5 % in the Year 1 box appeared in the plan as 63,000; a salary of 120,000
-- with 3 % appeared as 123,600. Neither screen said so. Sales, the per-unit cost of sales and Overheads all
-- read "this is the first year's figure and the percentages start the year after", and these two did not,
-- which left a business owner holding two models on one screen.
--
-- The fix is the fold 0025 used — multiply the first-year rate into the base and remove the key:
--
--     old Year 1 = base x (1 + r1)            new base   = base x (1 + r1)
--     old Year 2 = old Year 1 x (1 + r2)      new Year 2 = new base x (1 + r2)
--
-- Every year of every plan keeps the figure it had and no forecast moves. Salaries compound from the base
-- unrounded across all five years, so folding a rounded base can move a later year by a cent; the rounded
-- figure is the one the client is shown and the one they will now be typing, so it is the true one.
--
-- A person's first plan year is DERIVED from their Started date against the plan's first financial year
-- (§6.11), not stored, so it is derived here exactly as `startYearFromDate` derives it: someone joining in
-- Year 3 carries their Year 3 salary, and it is the Year 3 key that folds. Keys for years BEFORE a line
-- starts are left alone — the engine never reads them, and 0025 left the same dead keys on overheads.

-- ---------- fixed cost of sales ----------

update public.plan_fixed_cogs
   set annual_cost = round(annual_cost * (1 + (yearly_growth_rates->>'1')::numeric / 100), 2),
       yearly_growth_rates = yearly_growth_rates - '1'
 where yearly_growth_rates ? '1'
   and (yearly_growth_rates->>'1') ~ '^-?[0-9]+(\.[0-9]+)?$'
   and (yearly_growth_rates->>'1')::numeric <> 0;

-- A zero or malformed Year 1 key changes nothing, but leaving it would let the box reappear.
update public.plan_fixed_cogs
   set yearly_growth_rates = yearly_growth_rates - '1'
 where yearly_growth_rates ? '1';

-- ---------- key-person salaries ----------

with fy as (
  select p.id as plan_id,
         case when coalesce(nullif(s.financial_year_end_month, 0), 6) = 12
              then make_date(p.plan_year, 1, 1)
              else make_date(p.plan_year - 1,
                             case when s.financial_year_end_month between 1 and 11
                                  then s.financial_year_end_month else 6 end + 1, 1)
         end as fy_start
    from public.plans p
    left join public.plan_settings s on s.plan_id = p.id
),
first_year as (
  select pp.id,
         case when pp.started_on is null then 1
              else greatest(1, least(6, floor((
                       (extract(year  from pp.started_on) - extract(year  from fy.fy_start)) * 12
                     + (extract(month from pp.started_on) - extract(month from fy.fy_start))
                   ) / 12)::int + 1))
         end as y
    from public.plan_people pp
    join fy on fy.plan_id = pp.plan_id
)
update public.plan_people pp
   set annual_salary = round(coalesce(pp.annual_salary, 0) * (1 + (pp.salary_adjustments->>f.y::text)::numeric / 100), 2),
       salary_adjustments = pp.salary_adjustments - f.y::text
  from first_year f
 where f.id = pp.id
   and f.y between 1 and 5
   and pp.salary_adjustments ? f.y::text
   and (pp.salary_adjustments->>f.y::text) ~ '^-?[0-9]+(\.[0-9]+)?$'
   and (pp.salary_adjustments->>f.y::text)::numeric <> 0;

with fy as (
  select p.id as plan_id,
         case when coalesce(nullif(s.financial_year_end_month, 0), 6) = 12
              then make_date(p.plan_year, 1, 1)
              else make_date(p.plan_year - 1,
                             case when s.financial_year_end_month between 1 and 11
                                  then s.financial_year_end_month else 6 end + 1, 1)
         end as fy_start
    from public.plans p
    left join public.plan_settings s on s.plan_id = p.id
),
first_year as (
  select pp.id,
         case when pp.started_on is null then 1
              else greatest(1, least(6, floor((
                       (extract(year  from pp.started_on) - extract(year  from fy.fy_start)) * 12
                     + (extract(month from pp.started_on) - extract(month from fy.fy_start))
                   ) / 12)::int + 1))
         end as y
    from public.plan_people pp
    join fy on fy.plan_id = pp.plan_id
)
update public.plan_people pp
   set salary_adjustments = pp.salary_adjustments - f.y::text
  from first_year f
 where f.id = pp.id
   and f.y between 1 and 5
   and pp.salary_adjustments ? f.y::text;

comment on column public.plan_fixed_cogs.annual_cost is
  'The cost in Year 1. Later years grow from it via yearly_growth_rates, exactly as a product''s price does (§6.48).';
comment on column public.plan_fixed_cogs.yearly_growth_rates is
  'Percentage rise per plan year, from Year 2 on. Year 1 has no entry: there is nothing before it to grow from.';
comment on column public.plan_people.annual_salary is
  'The salary in the person''s FIRST plan year — Year 1 for someone already employed, otherwise the year they join (§6.48).';
comment on column public.plan_people.salary_adjustments is
  'Percentage change per plan year, from the year AFTER the person starts. Their own first year has no entry.';
