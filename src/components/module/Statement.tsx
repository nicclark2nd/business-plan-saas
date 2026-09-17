"use client";

/**
 * A five-year statement, and the notes that go under one (§6.76).
 *
 * Lifted out of ForecastModule when the profit and loss became its own module and needed the same table.
 * The first time two screens need the same rows is the moment to extract them, not the moment to paste
 * them — §6.32.3 said that about the funding rows, and it is just as true of a component.
 */
import { Grid, Th, Td, Row as GridRow, TOTAL_ROW, Note } from "@/components/module/DataGrid";
import { FORECAST_YEARS, type Forecast } from "@/engine/forecast/model";
import { cn } from "@/lib/utils";

export type StatementRow = [string, (y: number) => number, ("head" | "sub" | "total")?];

/** Five years across, one line per row. Money out shows in brackets, the convention a lender reads. */
export function Statement({ rows, num }: { rows: StatementRow[]; num: (v: number) => string }) {
  const money = (v: number) => (v < 0 ? `(${num(Math.abs(v))})` : v === 0 ? "—" : num(v));
  return (
    <Grid>
      <thead><tr>
        <Th style={{ width: "30%" }} />
        {FORECAST_YEARS.map((y) => <Th key={y} right style={{ width: 130 }}>Year {y}</Th>)}
      </tr></thead>
      <tbody>
        {rows.map(([label, get, weight]) => weight === "total" ? (
          // A statement's totals are not table footers: Net profit has Dividends under it (§6.40.1).
          <tr key={label} className={TOTAL_ROW}>
            <Td>{label}</Td>
            {FORECAST_YEARS.map((y) => <Td key={y} right className="num">{money(get(y))}</Td>)}
          </tr>
        ) : (
          <GridRow key={label} className={cn(weight === "sub" && "bg-secondary/50")}>
            <Td className={cn(weight ? "font-semibold" : "text-muted-foreground")}>{label}</Td>
            {FORECAST_YEARS.map((y) => {
              const v = get(y);
              return <Td key={y} right className={cn("num", weight && "font-semibold", v < 0 && "text-bad")}>{money(v)}</Td>;
            })}
          </GridRow>
        ))}
      </tbody>
    </Grid>
  );
}


export function TaxNotes({ pnl, num }: { pnl: Forecast["pnl"]; num: (v: number) => string }) {
  const relieved = FORECAST_YEARS.filter((y) => pnl[y].lossRelief > 0);
  const carried = FORECAST_YEARS.filter((y) => pnl[y].lossesCarriedForward > 0);
  const withheld = FORECAST_YEARS.filter((y) => pnl[y].dividendsWithheld > 0);
  if (!relieved.length && !carried.length && !withheld.length) return null;
  const list = (ys: number[]) => (ys.length === 1 ? `Year ${ys[0]}` : `Years ${ys.join(", ")}`);
  return (
    <Note>
      {relieved.length > 0 && (
        <>Losses from earlier years come off the profit in {list(relieved)}, so the tax is charged on what is
          left rather than on the whole year.{" "}</>
      )}
      {carried.length > 0 && (
        <><b>{num(pnl[carried[carried.length - 1]].lossesCarriedForward)}</b> of losses is still unrelieved at
          the end of {list([carried[carried.length - 1]])}.{" "}</>
      )}
      {withheld.length > 0 && (
        <span className="text-warn">
          The dividend policy asks for more than the company has made: {num(withheld.reduce((a, y) => a + pnl[y].dividendsWithheld, 0))}
          {" "}could not be paid across {list(withheld)}, because a dividend can only come out of accumulated
          profit. Set the accumulated profit the business starts with in Plan settings if it has reserves already.
        </span>
      )}
    </Note>
  );
}

