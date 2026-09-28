-- 0057: the Planner's briefing (§6.179)
--
-- One note per plan, per Financial Capabilities tab, per view: what the Planner tells the client about
-- growing, borrowing and selling, first from the accounts and then from the plan. Drafted by AI or typed,
-- edited, and saved here, so the branded report prints the words the Planner signed off rather than
-- asking a model again at print time.
--
-- WHY A TABLE AND NOT A JSON COLUMN ON plan_settings.
--
-- Six notes of a few hundred words each is a document, not a setting, and each one has its own author and
-- its own date. A row each keeps "who saved this, and when" honest per note, and the report reads the six
-- rows it needs without pulling every other setting along.
--
-- `score` and `headline` are the tab's reading at the moment the note was saved. They are not shown as
-- facts anywhere; they let the page say "the figures have changed since this was written" when the plan
-- moves on, so a note written about a 47 is never printed beside a 62 without anyone noticing.

create table if not exists public.plan_briefings (
  plan_id    uuid not null references public.plans(id) on delete cascade,
  tab        text not null check (tab in ('grow', 'borrow', 'sell')),
  view       text not null check (view in ('actual', 'plan')),
  body       text not null check (char_length(body) between 1 and 8000),
  score      int,
  headline   text,
  -- A record of who saved it, not a link: it must outlive the person leaving the firm (same as 0044).
  saved_by   uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, tab, view)
);

do $$ begin
  create trigger plan_briefings_updated before update on public.plan_briefings
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin perform apply_plan_rls('public.plan_briefings'::regclass);
exception when duplicate_object then null; end $$;
