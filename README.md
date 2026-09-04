# Business planning platform

SaaS business-planning application: guided plan build, five-year forecast, What-If planner,
AI-drafted goals, and audience-specific business plan reports. Multi-tenant with an advisor workspace.

- Requirements and decisions: `docs/planning/SaaS_Requirements.md`
- What the previous (APeX) build did: `docs/planning/ABoS_APeX_Menu_Inventory.md`
- What is ported from APeX and what is not: `docs/planning/APeX_Code_Audit.md`
- Clickable mockup: `docs/mockup/planwell-mockup.html`

## Stack
Next.js (App Router, TypeScript) · Tailwind · shadcn/ui · Supabase · Vitest · OpenRouter (server-side only) · Vercel

## Develop
```
npm install
npm run dev      # http://localhost:3100
npm test         # engine tests
npm run lint
npm run build
```
Copy `.env.example` to `.env.local` and fill in values. Never commit `.env*` files.
