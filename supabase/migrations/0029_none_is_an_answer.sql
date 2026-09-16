-- 0029: "the business has none of these" is an answer, not an empty screen (§6.57.1).
--
-- Three guided steps can be legitimately empty: a business that runs on its own cash raises no funding, a
-- service business owns no fixed assets, and plenty of plans have no one-offs at all. Every one of those
-- screens says so in its own empty state — and then the menu marked the step unfinished for taking it at
-- its word, because completeness counted rows and a row was the only way to answer.
--
-- So the client can say it out loud. False is not "no"; it is "has not said", which is the same thing an
-- empty table meant before. A row existing answers the question regardless, so the flag is only ever read
-- when the table is empty and never has to be cleared.
alter table plan_settings
  add column if not exists no_funding     boolean not null default false,
  add column if not exists no_fixed_assets boolean not null default false,
  add column if not exists no_one_offs    boolean not null default false;
