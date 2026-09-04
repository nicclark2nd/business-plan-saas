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

## Supabase setup

Use the publishable key in browser code and the secret key only in server-side code. The secret key bypasses Row Level Security and must never use a `NEXT_PUBLIC_` prefix.

```sh
cp .env.example .env.local
npx supabase@latest login
npx supabase@latest link --project-ref yzhdbikjsngqpyjhnnui
npx supabase@latest db push --dry-run
```

Review the dry run before applying migrations:

```sh
npx supabase@latest db push
```

In Vercel, configure the same variable names for Production. Do not give Preview deployments access to the Production Supabase project unless that access is explicitly required.
