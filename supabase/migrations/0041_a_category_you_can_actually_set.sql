-- 0041: a category you can actually set, and two decisions about how the plan prints (§6.93).
--
-- WHY THE CATEGORY COLUMN GETS A CONSTRAINT RATHER THAN JUST AN EDITOR.
--
-- `plan_overheads.category` has existed since 0003 as free `text` and no screen has ever written to it.
-- §6.88 grouped the report's overheads table by it; §6.89 tore that out, because a column nobody can set
-- is not data and the plan must not be built on one. This migration answers that the other way round: the
-- column gets an editor, so it becomes data.
--
-- It does NOT stay free text. Free text means "Rent", "rent" and "Premises" are three different groups in
-- a document a client hands to a bank, and a grouped table whose groups are typos is worse than no grouping
-- at all. Eight keys, checked here, so nothing but those eight can ever land in the column whichever screen
-- or script writes it. The labels live in `engine/overheads/categories.ts` — one list (§6.19); the database
-- holds the key, the app holds the words.
--
-- NOTHING IS BACK-FILLED. Every existing row stays null, which reads as "uncategorised" and prints under
-- Other. Inventing a category for a line a client never categorised is exactly the §6.89 fault wearing a
-- different hat: structure the client cannot account for, in their name.

alter table public.plan_overheads
  add constraint plan_overheads_category_check
  check (category is null or category in (
    'premises', 'people_admin', 'sales_marketing', 'vehicles_travel',
    'technology', 'professional_insurance', 'operating_equipment', 'other'
  ));

-- ---------- How the plan prints ----------
--
-- Two per-plan decisions, because both differ between two plans the same consultant writes in the same week.

-- Whether the Financial Plan prints each key person's salary against their NAME.
--
-- It does not hide the money and must never be described as though it does: the "Leadership Team salaries"
-- line still prints in Overheads and the figure still sits in the profit and loss whichever way this is set.
-- What it controls is attribution — the bank copy names people, the copy that goes to staff or a prospective
-- partner does not.
--
-- DEFAULT TRUE. Off-by-default would mean a client types every salary and silently never sees them in the
-- plan, which is the complaint this whole pass exists to answer (§6.87). The plan is complete unless someone
-- decides otherwise.
alter table public.plan_settings
  add column if not exists print_key_people_salaries boolean not null default true;

-- Paper size for the Word download. NULL means "whatever this plan's country ordinarily uses", which is the
-- answer for almost every plan and the reason this is nullable rather than defaulted: a stored 'a4' cannot
-- be told apart from a client who chose A4, and a plan that later moves country should follow it.
--
-- This was not a setting before, and that was the bug: `docx.ts` set margins and never set a page size, so
-- every plan on the platform printed A4 by accident of the library's default. A client in Dallas got a 210mm
-- document out of a Letter printer and nobody had ever decided that.
alter table public.plan_settings
  add column if not exists page_size text
  check (page_size is null or page_size in ('a4', 'letter'));
