-- 0044: permission to use a model, and a record that it was given (§6.106).
--
-- WHY THIS IS THREE COLUMNS AND NOT ONE.
--
-- A boolean answers "is the feature on". It cannot answer "did this client agree to their plan being sent
-- to a third party, and when" — which is the only question anyone will actually ask later, and the reason
-- the toggle exists at all. `ai_enabled` alone would be a preference. With the other two it is a consent.
--
-- `ai_enabled_by` is the profile that turned it on, not the plan's owner: an advisor writing a plan for a
-- client is the person who clicked, and the record should say so rather than implying the client did.

-- WHY PER PLAN AND NOT PER ACCOUNT.
--
-- The same reason `print_key_people_salaries` and `page_size` are per plan (0041): these decisions differ
-- between two plans the same consultant writes in the same week. A café and a defence subcontractor are not
-- the same answer, and an account-level switch would force the cautious answer onto every plan or the
-- relaxed one onto a plan that should never have had it.

-- DEFAULT FALSE, WHICH IS THE OPPOSITE OF 0041's SALARIES TOGGLE, AND DELIBERATELY SO.
--
-- Salaries default to printing because otherwise a client types every figure and never sees them in the
-- plan — the app failing to deliver something they entered. Nothing is lost by AI being off: the fields
-- work exactly as they do today.
--
--   A DEFAULT THAT ADDS IS NOT A DEFAULT THAT DISCLOSES.
--
-- Sending a client's strategy to a third party is something they turn on, never something they fail to turn
-- off. No existing plan is opted in by this migration, and there is no back-fill for the same reason: a
-- consent nobody gave is not a consent.

alter table public.plan_settings
  add column if not exists ai_enabled boolean not null default false;

alter table public.plan_settings
  add column if not exists ai_enabled_at timestamptz;

-- No foreign key to profiles on purpose: this is a RECORD of who agreed, and it must survive that person
-- leaving the organisation. A consent that deletes itself when its signatory closes their account is not a
-- record of anything.
alter table public.plan_settings
  add column if not exists ai_enabled_by uuid;

-- The three move together or not at all. Off with a timestamp is a plan that was switched off and keeps its
-- history, which is fine and wanted; ON with no record of who or when is a consent with nobody's name on
-- it, which is the state this constraint exists to make impossible.
alter table public.plan_settings
  add constraint plan_settings_ai_consent_check
  check (ai_enabled = false or (ai_enabled_at is not null and ai_enabled_by is not null));
