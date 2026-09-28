-- 0056 — The targets the Planner agrees on the assessment (§6.165).
--
-- The Planner's assessment reads the accounts and proposes a target for each problem it finds (gross margin
-- back to 42%, debtor days back to 30, the loans spread over 60 months …). The Planner agrees each one, at the
-- proposed figure or their own. They are what the projection steps are built to, and what Financial
-- Capabilities checks the plan against. One key per kind of target:
--   { "<kind>": { "value": number, "proposed": number, "agreed_at": "YYYY-MM-DD" } }
-- kinds: grossMargin, overheadsCap, debtorDays, loanTermMonths, cashFloor, breakEven.
-- Null means the assessment has not been worked through; {} means it was, and there was nothing to agree.

alter table public.plan_settings
  add column if not exists agreed_targets jsonb;

comment on column public.plan_settings.agreed_targets is
  'Targets agreed on the Planner''s assessment, keyed by kind: { value, proposed, agreed_at } (§6.165).';
