# Forecast engine

Pure TypeScript. No imports from the app, the database, or React.

This folder receives the calculation engine ported from APeX (see `docs/planning/APeX_Code_Audit.md`
for the exact file list): the five-year forecast, funding schedules, working-capital timing,
sales/COGS/overhead maths, unit economics, and the What-If reforecast — with their tests.

Rules:
- Nothing in here may import from `@/app`, `@/components`, or Supabase.
- Every calculation change comes with a test.
- `npm test` must stay green before any merge.
