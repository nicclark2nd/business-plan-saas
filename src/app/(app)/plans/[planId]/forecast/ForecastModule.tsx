"use client";

import { ModuleFrame, ModuleReadOnlyFooter } from "@/components/module/ModuleFrame";
import { Grid, Th, Td, Row as GridRow, Toolbar, Meta, Note } from "@/components/module/DataGrid";
import { StatTile, TileRow } from "@/components/chart/core";
import { useMoney } from "@/components/MoneyProvider";
import { GUIDED_STEPS, navGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { FORECAST_YEARS, type Forecast } from "@/engine/forecast/model";
import { checkGroups, type CheckGroup } from "@/engine/forecast/checks";

/**
 * Review forecast (§6.32.3, §6.79) — every check the plan is judged on, and whether it passed.
 *
 * It began as four tabs, on the rule that **three statements that must agree belong on one screen.** All
 * three have left for modules of their own (§6.76, §6.77, §6.78) and the assumptions grid has gone up to
 * Financials where the inputs live (§6.79). What is left is the thing the rule was actually protecting,
 * which was never the adjacency: it was the CHECK.
 *
 * And the check had never been shown. A hundred and one of them run on this plan — the balance sheet
 * balancing, the profit explaining the cash, the cash agreeing with the balance sheet, each year opening
 * where the last one closed, and sixteen monthly lines adding to their own year, in all five years — and a
 * client saw one green strip saying "the statements agree". That is the right thing to say FIRST. It is not
 * the only thing worth saying: a check nobody can inspect is a check nobody can trust, and a lender who
 * asks "what did you verify" deserves an answer longer than a tick.
 */
const STEP = GUIDED_STEPS.find((s) => s.id === "forecast")?.step ?? 13;

const TITLES: Record<CheckGroup["key"], { title: string; blurb: string }> = {
  statements: {
    title: "The statements agree with each other",
    blurb: "Four tests, in each of the five years. These are the ones that catch a forecast built out of figures that do not come from the same place.",
  },
  months: {
    title: "The twelve months add to their year",
    blurb: "Every line of the cash flow, in each of the five years. A month series that drifts from its own year is how a monthly view starts telling a different story from the annual one.",
  },
  engine: {
    title: "The engine settled",
    blurb: "The overdraft's cost lowers the tax, which raises the cash, which lowers the draw. It has to stop moving before the plan can be read.",
  },
};

export function ForecastModule({ planId, mode, forecast, gstLabel }: {
  planId: string; mode: "guided" | "advanced"; forecast: Forecast;
  /**
   * What this country calls its sales tax (§6.79). The engine labels that row "Sales tax paid over" because
   * an engine has no business knowing it is Australian — the row was hard-coded to "GST" while nothing ever
   * displayed it, and the moment a screen did, a British plan would have been shown a check about a tax it
   * does not have.
   */
  gstLabel: string;
}) {
  const num = useMoney();
  const groups = checkGroups(forecast.invariants);
  const total = forecast.invariants.length;
  const failed = forecast.invariants.filter((i) => !i.passed).length;
  const rows = groups.reduce((a, g) => a + g.rows.length, 0);

  return (
    <ModuleFrame
      step={STEP} total={GUIDED_STEPS.length} group={navGroup("forecast")} title="Review forecast"
      subtitle="Every check the plan is judged on, and whether it passed" mode={mode}
      areas={[{ key: "checks", label: "Checks", count: rows, ...(failed ? { tag: `${failed} failing` } : {}) }]}
      area="checks" onArea={() => {}} scope={{ label: "Five years" }}
      footer={<ModuleReadOnlyFooter planId={planId} moduleId="forecast" />}
      help={<>
        <h3>What this screen is for</h3>
        <p>A forecast is not one calculation, it is three statements that have to agree with each other and with themselves. These checks are how the plan proves it — and they run on the same figures the statements show, not on a second copy of them.</p>
        <p><b>The balance sheet balances</b> — what is owned equals what is owed plus what is left over. It is the oldest test there is and the one that catches almost everything.</p>
        <p><b>Profit explains the cash</b> — the profit and loss and the cash flow reach operating cash two different ways, and they have to land on the same figure. <b>Where the cash went</b> on the Cash Flow shows that working.</p>
        <p><b>Each year opens where the last one closed</b> — no money appears between Year 2 and Year 3.</p>
        <h3>If something fails</h3>
        <p>The figure shown is how far out it is, in the year it is out. Nothing on the three statements can be relied on until it passes, and every one of them says so at the top when it does not.</p>
      </>}
    >

      <TileRow>
        <StatTile label="Checks run" value={String(total)} sub={`${rows} tests, across ${FORECAST_YEARS.length} years`} />
        <StatTile label="Passing" value={String(total - failed)} tone={failed ? undefined : "good"}
          sub={failed ? "Not all of them" : "Every one" } />
        <StatTile label="Failing" value={String(failed)} tone={failed ? "bad" : "good"}
          sub={failed ? "The statements cannot be relied on" : "Nothing is out" } />
        <StatTile label="Verdict" value={forecast.reconciled ? "Holds together" : "Does not agree"}
          tone={forecast.reconciled ? "good" : "bad"}
          sub={forecast.reconciled ? "The plan is ready to be read" : "Fix these before printing the plan"} />
      </TileRow>

      {forecast.reconciled ? (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded border border-good/40 bg-good-soft px-3 py-1.5 text-[12.5px]">
          <b className="text-good">✓ The statements agree</b>
          <span className="text-muted-foreground">The balance sheet balances, profit explains the cash, and each year opens where the last one closed — in all five years.</span>
        </div>
      ) : (
        <div className="mx-5 mt-3 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12.5px]">
          <b className="text-bad">The statements do not agree</b>
          <span className="ml-2 text-muted-foreground">
            {failed === 1 ? "One check is failing" : `${failed} checks are failing`}, marked below. Until they
            pass, the profit and loss, the balance sheet and the cash flow cannot be relied on.
          </span>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.key} className="mt-3">
          <Toolbar>
            <Meta className="ml-0">
              <b className={cn(g.passed ? "text-foreground" : "text-bad")}>{TITLES[g.key].title}</b>
              <span className="ml-2">{TITLES[g.key].blurb}</span>
            </Meta>
          </Toolbar>
          <Grid>
            <thead><tr>
              <Th style={{ width: "44%" }}>Check</Th>
              {FORECAST_YEARS.map((y) => <Th key={y} right style={{ width: 110 }}>Year {y}</Th>)}
            </tr></thead>
            <tbody>
              {g.rows.map((r) => (
                <GridRow key={r.row} className={cn(!r.passed && "bg-bad-soft")}>
                  <Td className={cn(!r.passed && "font-semibold text-bad")}>
                    {r.row.replace("Sales tax", gstLabel)}
                  </Td>
                  {r.cells.map((c, i) => (
                    <Td key={i} right className="num">
                      {c === null
                        /* Not tested is not the same answer as tested and fine, and must not look like one. */
                        ? <span className="text-faint">—</span>
                        : c.passed
                          ? <span className="text-good" title={`Year ${c.year}: agrees`}>✓</span>
                          : <span className="font-semibold text-bad" title={`Year ${c.year}: out by ${c.difference}`}>
                              {num(Math.abs(c.difference))}
                            </span>}
                    </Td>
                  ))}
                </GridRow>
              ))}
            </tbody>
          </Grid>
        </div>
      ))}

      <Note>
        A tick means the two figures being compared agreed to within half a unit of currency — rounding, and
        nothing more. A number is how far apart they were, in that year. These run on the same forecast the
        statements are drawn from, so a check passing here is a check passing on the screen you read next.
      </Note>
    </ModuleFrame>
  );
}
