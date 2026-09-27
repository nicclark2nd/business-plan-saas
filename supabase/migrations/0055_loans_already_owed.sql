-- 0055 — The loans the business already owes when the plan starts (§6.150).
--
-- Historic carries the balance (bank loans due within twelve months, and after). The forecast now costs and
-- repays it, with the rate worked out from last year's interest paid, the term from what falls due within
-- twelve months, and the repayment type from whether any of it does. This column holds only what the
-- client has CHANGED from those worked-out figures:
--   { "interest_rate": number|null, "term_months": number|null, "repayment_type": "amortised"|"interest_only"|null }
-- Null (or a null key) means "use the figure from Historic". Nothing here repeats the balance itself.

alter table public.plan_settings
  add column if not exists existing_debt jsonb;

comment on column public.plan_settings.existing_debt is
  'Client changes to the worked-out terms of the loans already owed (rate, term, repayment type). Null keys = use Historic (§6.150).';
