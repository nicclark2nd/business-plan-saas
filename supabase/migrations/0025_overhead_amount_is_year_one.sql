-- 0025 — an overhead's amount IS its Year 1 figure (§6.47)
--
-- Year 1 is the first PROJECTED year: the year the business is in, and a forecast rather than a record.
-- Sales says so — its Year 1 column is headed "Sales this year" and the growth dialog tells the client "the
-- price and units above are its Year 1 figures". Overheads did not. It carried a sixth column, "This year",
-- sitting before Year 1, with `current_value` in it and Year 1 derived by applying `yearly_change->>'1'`.
--
-- That extra year is almost certainly the phantom year 0 that §6.33 removed everywhere else. It made the same
-- field mean different things in two modules, so a What-If slider moving "Year 1 overheads" had to write
-- somewhere different from the one moving "Year 1 price", and nobody reading either screen could tell.
--
-- The fix is to fold, not to drop. For every line that runs from Year 1, the Year 1 change is multiplied into
-- the amount and the key removed:
--
--     old Year 1 = current_value x (1 + c1)        new current_value = current_value x (1 + c1)
--     old Year 2 = old Year 1 x (1 + c2)           new Year 2 = new current_value x (1 + c2)
--
-- Every year of every plan keeps the figure it had, to the cent, and no forecast moves. Lines starting in a
-- later year are untouched: their own first year was already `current_value`, and a "1" key on them was never
-- read by the engine.

update public.plan_overheads
   set current_value = round(current_value * (1 + (yearly_change->>'1')::numeric / 100), 2),
       yearly_change = yearly_change - '1'
 where coalesce(start_year, 1) = 1
   and yearly_change ? '1'
   and (yearly_change->>'1') ~ '^-?[0-9]+(\.[0-9]+)?$'
   and (yearly_change->>'1')::numeric <> 0;

-- A zero or malformed Year 1 key changes nothing, but leaving it would let the box reappear.
update public.plan_overheads
   set yearly_change = yearly_change - '1'
 where coalesce(start_year, 1) = 1
   and yearly_change ? '1';

comment on column public.plan_overheads.current_value is
  'The expense in its FIRST plan year — Year 1 for a line running from the start, otherwise the year it begins. Later years grow from it via yearly_change, exactly as a product''s price does (§6.47).';
comment on column public.plan_overheads.yearly_change is
  'Percentage change per plan year, from the year AFTER the line starts. The line''s own first year has no entry: there is nothing before it to grow from.';
