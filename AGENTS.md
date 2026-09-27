<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Product rules that override screen design

**Never ask the client for the same information twice** (Nic, 27 Sep 2026 — full rule in
`docs/planning/SaaS_Requirements.md` §0). Uploaded data counts as entered. If a figure is in what the client
has entered or uploaded, or can be calculated from it, read or derive it — never add a box for it elsewhere.
Ask only when it genuinely cannot be found, once, where it naturally belongs; show derived figures with their
source. Before adding any input field, check the plan does not already hold it.
