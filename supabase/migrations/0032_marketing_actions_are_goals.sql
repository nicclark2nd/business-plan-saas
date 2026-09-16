-- 0032: drop plan_marketing_actions — marketing actions are goals (§6.60).
--
-- §6.13 sent APeX's Action Plan tab to Goals and said the rows would stay "until Goals absorbs them".
-- Goals was built, the absorption never happened, and the table has been read by nothing in src/ ever
-- since — the §6.35 fault, left behind by a promise rather than an oversight.
--
-- Marketing now shows the plan's MARKETING goals on its own Actions tab: the same `plan_goals` rows the
-- Goals step shows, through the same dialog and the same server actions. Not a copy, and nothing to
-- migrate into — there is nowhere for these rows to go that is not already answered better.
--
-- Anything a client typed here is carried across first, as a quarterly goal in the Marketing area under
-- that area's annual goal, created empty if there is none. Dropping a table with a client's words in it
-- because the new screen is nicer is not a refactor.
do $$
declare p record; parent uuid;
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'plan_marketing_actions') then
    return;
  end if;

  for p in select distinct plan_id from public.plan_marketing_actions where coalesce(title,'') <> '' loop
    select id into parent from public.plan_goals
      where plan_id = p.plan_id and area = 'marketing' and parent_id is null limit 1;
    if parent is null then
      insert into public.plan_goals (plan_id, area, title, source)
        values (p.plan_id, 'marketing', '', 'manual') returning id into parent;
    end if;

    insert into public.plan_goals (plan_id, parent_id, area, title, detail, year, quarter, status, source, sort_order)
      select a.plan_id, parent, 'marketing', a.title, nullif(a.detail,''), 1, 1, 'not_started', 'manual', a.sort_order
        from public.plan_marketing_actions a
       where a.plan_id = p.plan_id and coalesce(a.title,'') <> '';
  end loop;
end $$;

drop table if exists public.plan_marketing_actions;
