-- 0039: the four columns the segments grid replaced (§6.75).
--
-- 0035 turned one target-market box into `plan_market_segments` and LEFT the source columns in place,
-- unread, on purpose: "dropping them in the same migration that creates their replacement leaves no way
-- back if the copy is wrong on a plan nobody has opened yet." The grid has been used since. They go now.
--
-- FIRST, NOTHING IS LOST. The copy runs again for any plan that still has words in those boxes and no
-- segment to hold them — a plan created between 0035 and today, or one where the first copy found nothing
-- because the boxes were filled afterwards. Re-running it is safe: a plan that already has a segment is
-- skipped entirely, so a client who has since edited their segments keeps exactly what they wrote.
insert into public.plan_market_segments (plan_id, name, profile, cares_about, sort_order)
  select m.plan_id,
         coalesce(nullif(btrim(m.target_market), ''), 'Our customers'),
         nullif(btrim(m.demographics), ''),
         nullif(concat_ws(E'\n\n', nullif(btrim(m.psychographics), ''), nullif(btrim(m.customer_needs), '')), ''),
         0
    from public.plan_marketing m
   where (coalesce(btrim(m.target_market), '') <> ''
       or coalesce(btrim(m.demographics), '') <> ''
       or coalesce(btrim(m.psychographics), '') <> ''
       or coalesce(btrim(m.customer_needs), '') <> '')
     and not exists (select 1 from public.plan_market_segments s where s.plan_id = m.plan_id);

-- THEN they go. `if exists` so the whole migration can be run twice without failing halfway, which is what
-- strands a half-finished push.
alter table public.plan_marketing
  drop column if exists target_market,
  drop column if exists demographics,
  drop column if exists psychographics,
  drop column if exists customer_needs;

-- WHAT THIS ALSO FIXES. `getCompleteness` scored the Marketing step out of four by counting
-- target_market, market_size, market_trends and customer_needs — and two of those four stopped being
-- fillable the day the grid replaced them. A plan created after §6.62 could reach 2/4 on Marketing and
-- never move again, however much its owner wrote: the §6.57 fault, in a second place. The count now asks
-- for a named segment, market size, market trends and positioning — four things the client can actually
-- type, all on the same tab.
