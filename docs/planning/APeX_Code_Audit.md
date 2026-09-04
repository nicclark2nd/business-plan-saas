# APeX Code Audit — what to reuse, what to leave

Read-only review of `ABOS_26_MAY_2026` (4 Sep 2026). Nothing was modified or copied. Purpose: decide fresh-start vs port, and what "port" means precisely.

## What the repo is
- **Stack:** Vite + React 18 + TypeScript, shadcn/ui (Radix + Tailwind), TanStack Query, Supabase (auth + Postgres, 60 migrations), TipTap (report editor), @react-pdf/renderer, xlsx. Generated/iterated with Lovable, then extended by the UK team.
- **Size:** ~85 pages (30k lines), ~300 components (42k lines), ~44 utility files (6k lines), 26 hooks (6.7k lines), plus `docs/` with written specs of every financial calculation.
- **ABoS coupling:** 79 of 464 source files reference ABoS concepts (LION meetings, Frogs, Scorecard, 6 Ways / 4 Ways / Exponential, 90-day plan, KPIs, Coaching Focus). The rest is APeX.

## Verdict: fresh application, ported engine

Build the app fresh — shell, navigation, Guided/Advanced modes, every screen, multi-tenant auth, advisor workspace. **None of the APeX UI comes across.** That matches the mockup work: every screen we validated is already different from APeX.

Port the **calculation engine only**. It is small, self-contained, documented and tested — the one part of APeX that would cost months to rebuild and gain nothing from a rewrite.

## PORT (as-is, with light cleanup)

| Area | Files | Lines | Notes |
|---|---|---|---|
| Five-year forecast engine | `utils/canonicalForecastEngine.ts` (+ test) | 716 | Pure TypeScript. Inputs: annual base by year, opening balance sheet, working-capital schedule, cash-flow assumptions, tax/dividend rates, funding. Outputs: P&L, working capital, balance sheet, cash flow per year. **This is the heart.** |
| Funding engine | `fundingForecastEngine.ts`, `fundingScheduleUtils.ts`, `fundingCalculations.ts`, `fundingInterestUtils.ts`, `grantCalculationUtils.ts` (+ tests) | ~1,500 | Debt schedules, interest, equity, grants, revenue-linked funding, month-level timing. |
| Working capital & cash timing | `workingCapitalForecastUtils.ts`, `cashFlowAssumptions.ts`, `cashFlowForecastUtils.ts` | ~315 | Debtor/stock/creditor days → balances; tax timing, prepaids, accruals, CapEx. |
| Sales / COGS / overheads maths | `salesProductUtils.ts`, `salesGrowthUtils.ts`, `salesProjectionUtils.ts`, `cogs*.ts`, `fixedCogs*.ts`, `productProfitabilityUtils.ts`, `expenseUtils.ts`, `ownerSalaryProjectionUtils.ts` | ~900 | Annual → monthly distribution, growth rates, product margins. |
| Unit economics | `unitEconomicsForecastUtils.ts` | 107 | CAC, LTV, payback. |
| What-If (7 key drivers) engine | `components/optimizer/optimizerScenarioForecastEngine.ts`, `optimizer*ScopeUtils.ts`, `optimizerWorkingCapitalUtils.ts`, `optimizerBaselineUtils.ts` (+ tests) | ~2,000 (excl. UI) | Full Year 1 reforecast from lever changes, per-product / per-item scoping. The UI around it (`OptimizeDashboard.tsx` etc.) is NOT ported — the mockup replaces it. |
| Financial ratios | `financialCalculations.ts`, `balanceSheetCheckUtils.ts` | ~100 | Dashboard/Historic ratios. |
| Excel import | `excelImport.ts`, `fileValidation.ts` | ~170 | Historic upload. |
| Type definitions | `types/SalesTypes`, `CogsTypes`, `FundingTypes`, `FinancialTypes` | ~400 | The engine's contracts. |
| **Calculation docs** | `docs/*-calculations.md`, `data-model.md`, `funding-*.md`, `equity-year1-calculation.md` | — | Written specs. Port into the new repo's docs verbatim — they are the engine's manual. |

**Cleanup on port:** four utility files import Supabase `Json`/`Database` types purely for typing — replace with local types so the engine has zero dependency on the database layer. Keep every `.test.ts`; they run under Vitest and become the regression suite for the new app.

Roughly **5,500 lines of engine + tests + docs**. Everything else stays behind.

## ADAPT (use as reference, rewrite)
- **Supabase schema** (60 migrations): read for table/column names and constraints; do not apply. New schema is designed fresh, multi-tenant (Organisation → Cohort → Plan → Users) with row-level security from day one. APeX never had real client separation.
- **Report merge-field engine** (`src/reports/`, TipTap): the concept and merge-field list carry over; the implementation is rebuilt around audience templates.
- **shadcn/ui component set**: same library in the new app (fits the flat NetSuite-style look), but components are re-authored to the mockup, not copied.

## LEAVE BEHIND
- All ABoS pages and hooks (79 files): AnnualAlignment, NinetyDayPlan, CoachingFocus, LION meetings, Frogs, KPIs, Scorecard, Assessment, TodoItems, IAmStatements, all SixWays / FourWays / Exponential strategy pages, `useAbosStrategies`, `sixWaysCalculations.ts`.
- All APeX page/component UI (replaced by the mockup screens).
- Azure-era and ActionCOACH-specific auth/setup (`completeAbosAccountSetupForSession`, roles docs).
- `filemaker_export/`, `dist/`, `.lovable/`, `mockups/get-started.html`.

## Stack recommendation for the new app
- **Next.js (App Router) + TypeScript** — server routes for OpenRouter calls and report generation; Vercel-native.
- **Supabase** — Postgres, auth, storage, RLS for multi-tenancy (Nic already uses it).
- **shadcn/ui + Tailwind** — same component library as APeX so the ported forms' field logic is familiar, styled to the mockup.
- **Vitest** — keeps the ported engine tests running unchanged.
- The engine lives in its own package folder (`/packages/engine` or `/src/engine`) with no imports from the app — so it can be tested, versioned and, later, reused (e.g. a Plan Check-in service) without touching the UI.
