-- 0047: a measure the plan already answers is not a measure you type (§6.125.1).
--
-- §6.125 took revenue and profit off this screen as inputs, because the forecast already computes them and
-- a typed copy is a second answer to a settled question (§6.41). It then left a free-text measures strip
-- beside them — and the first measure anybody added on a real plan was **debtor days**.
--
-- Nic, on his own screen: *"I thought the debtor days should be fixed based on the projections."*
--
-- He is right, and the strip was carrying the exact fault it was built next to. Debtor days are not a
-- guess: they are stated per year in `plan_settings.working_capital_schedule`, the forecast runs on them,
-- and the cash flow a lender reads is built from them. A client typing 35 into the Goals screen while
-- their assumptions say 46 has put two numbers for one fact in front of the same reader.
--
-- BUT NOT EVERY MEASURE IS LIKE THAT. Defects per batch, days to produce a unit, jobs won per month — the
-- plan holds nothing about any of them, and refusing to let a client set one would be worse than useless.
--
-- So a measure now declares WHERE ITS NUMBERS COME FROM.
--
--   `source_key` null  → the client's own measure. They name it and they type the target at each rung.
--   `source_key` set   → a measure the plan already answers. The name and the unit are the app's, the
--                        number at each rung is READ from the plan, and there is no box to type in.
--
-- Five keys are recognised, all of them things the plan decides elsewhere and none of them stored here:
-- grossMargin and closingCash come from the forecast; debtorDays, stockDays and creditorDays come from the
-- working-capital schedule the forecast itself runs on. A key this version does not recognise is treated
-- as a client measure with no targets rather than as an error — a plan must survive a newer version of the
-- app having written something this one has not learned yet.
alter table public.plan_kpis add column if not exists source_key text;

comment on column public.plan_kpis.source_key is
  'Null = the client names it and types the targets. Set = the plan already answers it (§6.125.1): the name, the unit and every rung''s figure are read, never stored, and plan_kpi_targets holds no rows for it.';

-- One row per plan per plan-held measure. Adding "Debtor days" twice would put the same read-only figure on
-- the screen twice, which is not a second opinion — it is the same opinion, taking up two rows.
create unique index if not exists plan_kpis_one_per_source
  on public.plan_kpis (plan_id, source_key) where source_key is not null;

-- ---------- a target that cannot exist ----------
--
-- A plan-held measure must never accumulate targets, including ones written before its key was set. This
-- clears any that already exist rather than trusting every future write path to remember.
delete from public.plan_kpi_targets t
 using public.plan_kpis k
 where t.kpi_id = k.id and k.source_key is not null;
