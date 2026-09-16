-- 0034: market positioning — where the business sits, not why it wins (§6.61).
--
-- 0008 added `positioning` and 0009 RENAMED it to `our_advantage`, which is a different question and the
-- one the Competitors module has asked ever since: why a customer picks you rather than the row below.
-- §6.35's dead-column audit still lists `plan_marketing.positioning`, describing a column that had not
-- existed under that name for a week — and it was read from the document rather than from the schema when
-- 0033 was written, which is how 0033 came to carry a comment on a column that was not there.
--
-- Positioning is the other half of the same section in every marketing-plan structure: luxury or no-frills,
-- premium or volume, specialist or general. `our_advantage` is written against named competitors; this is
-- written against the market. A business can be the expensive one AND win on turnaround, and a plan that
-- can only say one of those has not said where it sits.
alter table public.plan_marketing
  add column if not exists positioning text;

comment on column public.plan_marketing.positioning is
  'Where the business wants to sit in its market — premium, mid, no-frills, specialist (§6.61). Distinct from plan_marketing.our_advantage, which is why a customer picks it over a named competitor.';
