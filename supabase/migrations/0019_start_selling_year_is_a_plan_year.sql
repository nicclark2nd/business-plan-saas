-- 0019: start_selling_year becomes the plan year itself.
--
-- It used to mean "1 = now, 2-6 = plan Year 1-5", which put a line marked *Now* in a phantom **year 0**: the
-- base sat in a year that does not exist, and plan Year 1 was treated as its first GROWTH year. A line could
-- therefore grow before the first year it existed in, and Year 1 could read higher than the year the
-- business is actually trading.
--
-- The plan's own model has no such year. Historic runs to the financial year end; Year 1 is the first
-- projected year and the year the business is in now. So a line either sells from Year 1 or defers to
-- Year 2, 3, 4 or 5 -- and the figures entered against it ARE that year's figures, with growth starting the
-- year after. "Now" and "Year 1" were two names for one thing.
--
-- 1 (now) and 2 (Year 1) both become 1; the rest shift down by one. No plan's figures move: for every line
-- whose base already sat in Year 1, Year 1 was already showing the base.
--
-- The whole thing is guarded on the CHECK constraint being absent, which is the marker that the remap has
-- not run. Without that guard a second run shifts every line down AGAIN -- silently, and with no way to tell
-- afterwards which years were meant. A migration that rewrites data has to be unable to rewrite it twice.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.plan_products'::regclass
      and conname = 'plan_products_start_selling_year_check'
  ) then
    return;                                   -- already remapped
  end if;

  update public.plan_products
     set start_selling_year = case
           when coalesce(start_selling_year, 1) <= 2 then 1
           else least(5, coalesce(start_selling_year, 1) - 1)
         end;

  alter table public.plan_products
    alter column start_selling_year set default 1,
    add constraint plan_products_start_selling_year_check
      check (start_selling_year between 1 and 5);
end $$;

comment on column public.plan_products.start_selling_year is
  'The plan year this line first sells in, 1-5. Its price and units ARE that year''s figures; growth starts the year after.';
