-- 0043: what goes on the cover (§6.96).
--
-- Three fields the front cover asks for and the app had nowhere to keep. All three are optional, and every
-- one of them disappears from the cover when it is empty — a cover with a blank line where a website should
-- be is worse than a cover with one line fewer.

-- The line under the business name: "CONCRETING & CIVIL WORKS". NOT the industry, which the app already
-- holds and which reads as a category rather than as something a business would say about itself.
alter table public.plan_settings add column if not exists tagline text;

-- How a reader gets in touch, printed at the foot of the cover.
--
-- This is the BUSINESS's own contact, published on the front of its own plan by the person who owns it. It
-- is not an account address: the only other email in the schema belongs to plan invitations, and the two
-- must not be confused — one is a login, the other is meant to be read by a lender.
alter table public.plan_settings add column if not exists contact_email text;
alter table public.plan_settings add column if not exists website text;

-- ---------- The state of operation ----------
--
-- NO COLUMN IS ADDED FOR IT, and that is the decision worth recording.
--
-- `plan_settings.tax_region` already holds a state or province. It was added because sales tax in the United
-- States and Canada depends on it (§6.39), so it has only ever been ASKED for in those two countries — but
-- the column is plain text and has never been restricted to them.
--
-- A second "main state of operation" beside it would be two fields meaning one thing (§6.41), and a plan in
-- Texas would then have two answers to one question, with the legal notice and the tax rates each reading a
-- different one depending on where the client happened to type.
--
-- So the FIELD widens instead of the schema: the screen now asks every plan for it, a picker where the app
-- has a list of states and free text where it does not, and the tax regime goes on reading exactly the
-- column it always read. Nothing to migrate, because there is nothing new to store.
