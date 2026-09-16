-- 0033: the half of Marketing that was never asked for (§6.61).
--
-- §6.13 cut APeX's seven tabs to three and the cuts went further than they should have. Reviewed against
-- APeX and against a standard marketing-plan structure, four things had no home anywhere in the app:
--
--   positioning       — 0008 added this name, but 0009 renamed it to `our_advantage` for Competitors.
--                       The existing Competitors field is kept; this migration adds no duplicate.
--   brand             — 0008 dropped four brand columns, arguing brand purpose duplicates Vision & Purpose.
--                       True of brand PURPOSE. Values, personality and visual identity have no twin
--                       anywhere, and were dropped on an argument that covered a quarter of them.
--   sales process     — how a prospect becomes a customer. Never collected, in any module.
--   research          — 0008 folded APeX's four research fields into two, concatenating topic with method
--                       and findings with recommendations. What a business DECIDED off the back of its own
--                       research — the only part that changes anything — had nowhere to go.
--
-- Brand purpose stays out. It is Vision & Purpose's Purpose and Brand promise, and re-adding it would be
-- the one thing 0008 got right, undone.
alter table public.plan_marketing
  -- Who they are and what they care about, split out of the one target-market box that held both.
  add column if not exists demographics     text,
  add column if not exists psychographics   text,
  -- The brand platform, less its purpose.
  add column if not exists brand_values     text,
  add column if not exists brand_personality text,
  add column if not exists visual_identity  text,
  -- Marketing brings them to the door; this is what happens next.
  add column if not exists sales_process    text,
  add column if not exists sales_team       text;

-- Research: the question, how it was answered, what it showed, and what the business will DO about it.
alter table public.plan_marketing_evidence
  add column if not exists method   text,
  add column if not exists decision text;

comment on column public.plan_marketing_evidence.source is
  'The question, or where the answer came from. Rows created by migration 0008 hold the old topic AND method concatenated; they are left as typed rather than guessed apart (§6.61).';
comment on column public.plan_marketing_evidence.decision is
  'What the business will do because of this finding. The only part of a research record that changes anything.';
