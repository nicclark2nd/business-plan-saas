-- 0020: drop the funding columns that are a second home for a fact already stored elsewhere.
--
-- Two groups, both dormant, both the same hazard: a column nothing writes today is a column something can
-- write tomorrow, and then one fact has two answers that disagree. Four separate faults in the last
-- fortnight were exactly that, so these go before anything reaches for them.
--
-- 1. WHEN THE MONEY ARRIVES. Migration 0016 gave every funding source `start_year` + `start_month`, and said
--    why in its own comment: "APeX stores an absolute start_date. Every other module in this app places money
--    by plan year + month." The absolute dates were left behind. They are the duplicate.
--
-- 2. THE ASSET A LOAN BOUGHT. §6.20 moved financed assets to `plan_fixed_assets`, which owns the price, the
--    life, the method and the residual. The loan row's own copies of those figures are superseded.
--
-- Nothing is dropped blind: each column is checked for meaningful data first and the migration RAISES rather
-- than destroying it. "Meaningful" is not "not null" — three of these are `not null default 0`, where every
-- row holds a zero nobody typed, so the test for those is `<> 0`. Guarded on the column still existing, so
-- it can be run twice.

do $$
declare r record; n bigint;
begin
  for r in
    select * from (values
      ('plan_funding_owner',         'date_injected',         'date_injected is not null'),
      ('plan_funding_debt',          'start_date',            'start_date is not null'),
      ('plan_funding_grants',        'date_received',         'date_received is not null'),
      ('plan_funding_revenue_linked','start_date',            'start_date is not null'),
      ('plan_funding_debt',          'asset_category',        'asset_category is not null'),
      ('plan_funding_debt',          'asset_purchase_price',  'asset_purchase_price <> 0'),
      ('plan_funding_debt',          'down_payment',          'down_payment <> 0'),
      ('plan_funding_debt',          'depreciation_residual', 'depreciation_residual <> 0')
    ) as t(tbl, col, test)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl and column_name = r.col
    ) then
      execute format('select count(*) from public.%I where %s', r.tbl, r.test) into n;
      if n > 0 then
        raise exception
          'Refusing to drop %.%: % row(s) still hold data. Move it to start_year/start_month or plan_fixed_assets first.',
          r.tbl, r.col, n;
      end if;
      execute format('alter table public.%I drop column %I', r.tbl, r.col);
      raise notice 'dropped %.%', r.tbl, r.col;
    end if;
  end loop;
end $$;
