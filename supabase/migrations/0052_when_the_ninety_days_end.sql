-- 0052: when the ninety days end (§6.137, open item 23).
--
-- The 90-day rung has an end date and nothing happened when it passed: the same goals, the same statuses,
-- no prompt, no history — a list that quietly goes stale, and the dashboard panel with it.
--
-- Now a period is CLOSED by a review. Each 90-day goal is marked done, carried forward, or dropped; done and
-- dropped goals are kept, stamped with the period they closed under, and leave the live list; carried goals
-- stay live; and the next end date is set. Nothing is deleted — what a business said it would do last
-- quarter, and whether it did, is the most useful history a plan can hold.
--
-- Two columns on the goal rather than a periods table: a period is fully described by the date it ended,
-- and every question anybody asks ("what did we close in September, and how much of it got done") is a
-- filter on that date. Both or neither, and only on the 90-day rung.
alter table public.plan_goals add column if not exists closed_period_end date;
alter table public.plan_goals add column if not exists outcome text;

alter table public.plan_goals drop constraint if exists plan_goals_outcome_values;
alter table public.plan_goals add constraint plan_goals_outcome_values
  check (outcome is null or outcome in ('done', 'dropped'));

alter table public.plan_goals drop constraint if exists plan_goals_closed_together;
alter table public.plan_goals add constraint plan_goals_closed_together
  check ((closed_period_end is null) = (outcome is null)
     and (closed_period_end is null or horizon = 'ninety'));

comment on column public.plan_goals.closed_period_end is
  'The 90-day period this goal was closed under (§6.137). Null = live. Set by the end-of-period review, with outcome.';
comment on column public.plan_goals.outcome is
  'How the review closed it: done or dropped. Carried-forward goals are not closed and have neither.';

create index if not exists plan_goals_closed on public.plan_goals (plan_id, closed_period_end) where closed_period_end is not null;
