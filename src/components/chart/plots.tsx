"use client";

/**
 * The three plots this app needs (§6.49.2). Each carries ONE series, which is why none of them has a
 * legend: the title names the series, and a colour that means something (above or below break-even) is
 * free to mean it. A second series would need the categorical slots in globals.css and a legend with it.
 */
import { useState } from "react";
import { Frame, PLOT, Tip, niceScale, type Severity } from "./core";
import { cn } from "@/lib/utils";

const SEV: Record<Severity, string> = {
  accent: "var(--primary)", good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)",
};

/**
 * Columns against a threshold — revenue against the revenue it has to clear.
 *
 * The column carries the state: above the line is the accent, below it is the danger colour. That is a
 * status colour used for an actual status, which is the only thing status colours are for.
 */
export function Columns({ width, height = 260, categories, values, threshold, thresholdLabel, format, tone }: {
  width: number; height?: number;
  categories: string[]; values: number[];
  /** One threshold per category. Null where there isn't one — a year with no break-even to clear. */
  threshold?: (number | null)[];
  thresholdLabel?: string;
  format: (v: number) => string;
  tone?: (i: number) => Severity;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const all = [...values, ...(threshold ?? []).filter((v): v is number => v !== null)];
  const scale = niceScale(Math.min(...all, 0), Math.max(...all, 0));
  const h = height - PLOT.top - PLOT.bottom;
  const inner = Math.max(0, width - PLOT.left - PLOT.right);
  const step = inner / Math.max(1, categories.length);
  /**
   * A column is a MARK, not a block. Let it fill its band and five years of revenue becomes five saturated
   * slabs — loud, and the loudest thing on the page should be the data's shape, not its area. Capped and
   * centred in the band instead.
   */
  const band = (i: number) => {
    const w = Math.max(2, Math.min(56, step - 16));
    return { x: PLOT.left + i * step + (step - w) / 2, w };
  };
  const y = (v: number) => PLOT.top + h - ((v - scale.lo) / (scale.hi - scale.lo)) * h;
  const zero = y(0);

  return (
    <Frame width={width} height={height} scale={scale} categories={categories} band={band}>
      {values.map((v, i) => {
        const b = band(i);
        const top = y(Math.max(v, 0)), bottom = y(Math.min(v, 0));
        return (
          <rect key={i} x={b.x} y={top} width={b.w} height={Math.max(1, bottom - top)} rx={4}
            fill={SEV[tone?.(i) ?? "accent"]} opacity={hover === null || hover === i ? 1 : 0.45} />
        );
      })}

      {threshold && (
        <>
          {threshold.map((t, i) => t === null ? null : (
            <line key={i} x1={band(i).x - 4} x2={band(i).x + band(i).w + 4} y1={y(t)} y2={y(t)}
              stroke="var(--foreground)" strokeWidth={2} strokeLinecap="round" />
          ))}
          {/* One label, on the first threshold there is — a number on every mark is noise. */}
          {(() => {
            const i = threshold.findIndex((t) => t !== null);
            if (i === -1 || !thresholdLabel) return null;
            const b = band(i);
            return <text x={b.x} y={y(threshold[i]!) - 7} className="fill-foreground text-[10.5px] font-semibold">{thresholdLabel}</text>;
          })()}
        </>
      )}

      <line x1={PLOT.left} x2={width - PLOT.right} y1={zero} y2={zero} stroke="var(--input)" strokeWidth={1} shapeRendering="crispEdges" />

      {categories.map((c, i) => {
        const b = band(i);
        return <rect key={"hit" + i} x={b.x - 6} y={PLOT.top} width={b.w + 12} height={h} fill="transparent"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
      })}
      {hover !== null && (
        <Tip x={band(hover).x + band(hover).w / 2} y={y(Math.max(values[hover], 0))} width={width}
          lines={[[categories[hover], format(values[hover])],
                  ...(threshold?.[hover] != null ? [["Break even", format(threshold[hover]!)] as [string, string]] : [])]} />
      )}
    </Frame>
  );
}

/**
 * One series over time, with the point it crosses nil called out. Area beneath, because a single series
 * reading against a baseline is easier to judge filled than as a bare stroke.
 */
export function Trend({ width, height = 260, categories, values, cross, format, reference }: {
  width: number; height?: number; categories: string[]; values: number[];
  /** 1-based index of the month the line crosses, if it does. */
  cross?: number | null;
  format: (v: number) => string;
  /**
   * A level the line is judged against — the client's cash floor on the dashboard (§6.133). Drawn the way
   * `Lines` draws its reference, and always inside the scale, so a floor above every month still shows.
   */
  reference?: { value: number; label: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const scale = niceScale(Math.min(...values, 0, reference?.value ?? 0), Math.max(...values, 0, reference?.value ?? 0));
  const h = height - PLOT.top - PLOT.bottom;
  const inner = Math.max(0, width - PLOT.left - PLOT.right);
  const step = inner / Math.max(1, values.length);
  const px = (i: number) => PLOT.left + i * step + step / 2;
  const py = (v: number) => PLOT.top + h - ((v - scale.lo) / (scale.hi - scale.lo)) * h;
  const band = (i: number) => ({ x: PLOT.left + i * step, w: step });
  const line = values.map((v, i) => `${i ? "L" : "M"}${px(i)} ${py(v)}`).join(" ");
  const area = `${line} L${px(values.length - 1)} ${py(0)} L${px(0)} ${py(0)} Z`;

  return (
    <Frame width={width} height={height} scale={scale} categories={categories} band={band}>
      <path d={area} fill="var(--primary)" opacity={0.08} />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {reference && (
        <g>
          <line x1={PLOT.left} x2={width - PLOT.right} y1={py(reference.value)} y2={py(reference.value)}
            stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="4 3" strokeLinecap="round" opacity={0.55} />
          <text x={width - PLOT.right} y={py(reference.value) - 5} textAnchor="end"
            className="fill-foreground text-[10.5px] font-semibold">{reference.label}</text>
        </g>
      )}
      {cross != null && values[cross - 1] !== undefined && (
        <g>
          <line x1={px(cross - 1)} x2={px(cross - 1)} y1={PLOT.top} y2={PLOT.top + h} stroke="var(--good)" strokeWidth={1} />
          {/* A 2px ring in the surface colour keeps the marker readable where it sits on the line. */}
          <circle cx={px(cross - 1)} cy={py(values[cross - 1])} r={5} fill="var(--good)" stroke="var(--card)" strokeWidth={2} />
          <text x={px(cross - 1) + 8} y={PLOT.top + 11} className="fill-good text-[10.5px] font-semibold">
            {categories[cross - 1]} — breaks even
          </text>
        </g>
      )}
      {hover !== null && (
        <>
          <line x1={px(hover)} x2={px(hover)} y1={PLOT.top} y2={PLOT.top + h} stroke="var(--input)" strokeWidth={1} />
          <circle cx={px(hover)} cy={py(values[hover])} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
          <Tip x={px(hover)} y={py(values[hover])} width={width} lines={[[categories[hover], format(values[hover])]]} />
        </>
      )}
      {values.map((_, i) => (
        <rect key={i} x={band(i).x} y={PLOT.top} width={band(i).w} height={h} fill="transparent"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
      ))}
    </Frame>
  );
}

/**
 * Horizontal bars, sorted, for a handful of long-named things. Horizontal because "Garage, Granny Flat &
 * Home Extension Slabs" cannot be a column label at any width worth having.
 */
export function BarRows({ width, rows, format, height, labelShare = 0.3 }: {
  width: number;
  /**
   * `tone` when the bar carries a status (a transferability score, a margin below the business's own
   * average); `display` when the figure beside it is not a plain format of the value — "Not scored" on a
   * factor nobody has judged, which must never be drawn as a bar of nothing (§6.89).
   */
  rows: { label: string; value: number; tone?: Severity; display?: string }[];
  format: (v: number) => string;
  height?: number;
  /** How much of the width the names get. A short list of long names (six judgements) wants more. */
  labelShare?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ROW = 26, LABEL = Math.min(320, Math.max(120, Math.round(width * labelShare)));
  /* Cut to the room there is, not to a fixed count: 30 characters clipped a label with space to spare. */
  const fits = Math.max(12, Math.floor((LABEL - 12) / 6.3));
  const h = height ?? rows.length * ROW + 8;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  /*
   * ROOM FOR THE LONGEST FIGURE, NOT A FIXED 96px (§6.129.3). "28% · ends within a year" beside a full-width
   * bar ran off the edge of the chart and was cut to "ends withi". The tail is sized from what will be
   * written in it.
   */
  const longest = Math.max(...rows.map((r) => (r.display ?? format(r.value)).length), 4);
  const TAIL = Math.min(Math.round(width * 0.4), Math.max(96, Math.round(longest * 6.6) + 14));
  const inner = Math.max(10, width - LABEL - TAIL);
  return (
    <svg width={width} height={h} role="presentation" className="block">
      {rows.map((r, i) => {
        const w = (Math.abs(r.value) / max) * inner;
        const y = i * ROW + 4;
        return (
          <g key={r.label + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={0} y={y} width={width} height={ROW} fill={hover === i ? "var(--secondary)" : "transparent"} />
            <text x={0} y={y + ROW / 2} dy="0.32em" className="fill-foreground text-[12px]">
              {r.label.length > fits ? `${r.label.slice(0, fits - 1)}…` : r.label}
              <title>{r.label}</title>
            </text>
            {r.display === undefined || r.value !== 0 ? (
              <rect x={LABEL} y={y + 6} width={Math.max(2, w)} height={ROW - 14} rx={4}
                fill={r.tone ? SEV[r.tone] : r.value < 0 ? "var(--bad)" : "var(--primary)"} />
            ) : null}
            <text x={LABEL + (r.display !== undefined && r.value === 0 ? 0 : Math.max(2, w) + 8)} y={y + ROW / 2} dy="0.32em"
              className={cn("text-[11.5px] tabular-nums", r.display !== undefined && r.value === 0 ? "fill-muted-foreground" : "fill-foreground font-semibold")}>
              {r.display ?? format(r.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The legend's own height, reserved out of the caller's box rather than added on top of it. */
const LEGEND_H = 20;

/**
 * Several lines against the same scale (§6.76).
 *
 * `Trend` draws one series and fills under it, which is right when the series IS the subject — cumulative
 * cash, on Break-Even. Three lines is a different question: not "where does this go" but "how far apart do
 * these stay". So there is no fill here; the GAP between the lines is the thing being read, and shading one
 * of them would weight an answer the reader is supposed to reach themselves.
 *
 * The series slots are assigned in the fixed order §6.49.2 set and never cycled. A legend appears because
 * there is more than one line — with one, the title has already said what it is.
 */
export function Lines({ width, height = 260, categories, series, format, reference, ceiling }: {
  width: number; height?: number; categories: string[];
  /**
   * A null is a year the measure cannot be taken (§6.129.2) and BREAKS the line. Joining across it would
   * draw a value nobody computed; dropping it to zero would draw one that is false.
   */
  series: { label: string; values: (number | null)[] }[];
  format: (v: number) => string;
  /** A fixed line to read the others against — a lender's minimum cover. Labelled, never in the legend. */
  reference?: { value: number; label: string };
  /**
   * THE TOP OF THE AXIS, when the interesting part of the chart is near the bottom (§6.129.2). SEQ's debt
   * cover runs 0× to 25× as the loans are paid off, and on that scale the 1.25× lender minimum is a hairline
   * on the floor — the only line on the chart that matters became the one you could not see. Values above the
   * ceiling are DRAWN at it, with an open ring to say so, and the tooltip still gives the true figure.
   */
  ceiling?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const clip = (v: number) => (ceiling !== undefined ? Math.min(v, ceiling) : v);
  const all = [...series.flatMap((s) => s.values.filter((v): v is number => v !== null).map(clip)), ...(reference ? [reference.value] : [])];
  const scale = niceScale(Math.min(...all, 0), Math.max(...all, 0));
  /**
   * `height` is the whole chart INCLUDING its legend, because that is what the caller reserved for it.
   *
   * ChartBox fixes the height of the box these render into. Adding a legend inside that box and then asking
   * the plot for the full height pushes the plot down by exactly the legend's height, and it overflows: the
   * axis labels ended up drawn five pixels under the table header below. A component that puts furniture in
   * a fixed box has to fit inside it.
   */
  const plotHeight = Math.max(80, height - LEGEND_H);
  const h = plotHeight - PLOT.top - PLOT.bottom;
  const inner = Math.max(0, width - PLOT.left - PLOT.right);
  const n = Math.max(1, categories.length);
  const step = inner / n;
  const px = (i: number) => PLOT.left + i * step + step / 2;
  const py = (v: number) => PLOT.top + h - ((v - scale.lo) / (scale.hi - scale.lo)) * h;
  const band = (i: number) => ({ x: PLOT.left + i * step, w: step });
  const colour = (i: number) => `var(--chart-${(i % 5) + 1})`;

  return (
    <>
      <div style={{ height: LEGEND_H }} className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s, i) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <i className="inline-block h-[3px] w-4 rounded-full" style={{ background: colour(i) }} />{s.label}
          </span>
        ))}
      </div>
      <Frame width={width} height={plotHeight} scale={scale} categories={categories} band={band}>
        {reference && (
          <g>
            <line x1={PLOT.left} x2={width - PLOT.right} y1={py(reference.value)} y2={py(reference.value)}
              stroke="var(--foreground)" strokeWidth={1.5} strokeLinecap="round" opacity={0.55} />
            <text x={width - PLOT.right} y={py(reference.value) - 5} textAnchor="end"
              className="fill-foreground text-[10.5px] font-semibold">{reference.label}</text>
          </g>
        )}
        {series.map((s, si) => {
          /* A new sub-path after every gap, so a missing year leaves a hole rather than a bridge. */
          const d = s.values.map((v, i) => (v === null ? "" : `${s.values[i - 1] == null ? "M" : "L"}${px(i)} ${py(clip(v))}`)).join(" ");
          return (
            <g key={s.label}>
              <path fill="none" stroke={colour(si)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" d={d} />
              {/* A lone point between two gaps is still a reading; without a dot it would not draw at all. */}
              {s.values.map((v, i) => v !== null && s.values[i - 1] == null && s.values[i + 1] == null
                ? <circle key={i} cx={px(i)} cy={py(clip(v))} r={2.5} fill={colour(si)} /> : null)}
              {/* Off the top: an open ring at the ceiling, so a clipped point never passes for a real one. */}
              {ceiling !== undefined && s.values.map((v, i) => v !== null && v > ceiling
                ? <circle key={"c" + i} cx={px(i)} cy={py(ceiling)} r={3.5} fill="var(--card)" stroke={colour(si)} strokeWidth={1.5} /> : null)}
            </g>
          );
        })}
        {hover !== null && (
          <>
            <line x1={px(hover)} x2={px(hover)} y1={PLOT.top} y2={PLOT.top + h} stroke="var(--input)" strokeWidth={1} />
            {series.map((s, si) => s.values[hover] == null ? null : (
              <circle key={s.label} cx={px(hover)} cy={py(clip(s.values[hover] as number))} r={4} fill={colour(si)} stroke="var(--card)" strokeWidth={2} />
            ))}
            <Tip x={px(hover)} y={py(clip(Math.max(...series.map((s) => s.values[hover] ?? 0))))} width={width}
              lines={series.map((s) => [s.label, s.values[hover] == null ? "—" : format(s.values[hover] as number)] as [string, string])} />
          </>
        )}
        {categories.map((_, i) => (
          <rect key={i} x={band(i).x} y={PLOT.top} width={band(i).w} height={h} fill="transparent"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </Frame>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Financial Capabilities (§6.128)                                     *
 * ------------------------------------------------------------------ */

export type Zone = { to: number; severity: Severity };

/**
 * THE ONE DIAL THIS APP ALLOWS, AND THE ARGUMENT FOR THE EXCEPTION.
 *
 * `Meter` above rejects dials, and gives three reasons: on an arc 40% and 50% look the same; a gauge
 * spends a square of space saying one number; and two of them side by side cannot be compared. Every one
 * of those is right, and every one of them is about a SMALL metric in a GRID.
 *
 * None of the three applies here. There is exactly one of these on a screen, so there is nothing beside it
 * to compare. It is not a ratio being read precisely — it is a score out of 100, where "how far round has
 * it gone" is the whole message and the exact number is printed underneath anyway. And the square of space
 * is the point: this is the headline of the screen, not one of eight cards.
 *
 * So the rule stands and this is its exception, written down rather than quietly ignored. Anything smaller
 * than the headline still uses `Meter`.
 */
export function ScoreDial({ width, value, zones, caption }: {
  width: number;
  /** 0 to 100, or null when too little of the plan is filled in to score it. */
  value: number | null;
  zones: Zone[];
  caption?: string;
}) {
  const w = Math.min(width, 280);
  const h = w * 0.58;
  const cx = w / 2, cy = w * 0.5, r = w * 0.38, sw = w * 0.075;
  const at = (f: number, rr: number) => {
    const a = Math.PI * (1 - Math.max(0, Math.min(1, f)));
    return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const;
  };
  const arc = (f0: number, f1: number) => {
    const [x0, y0] = at(f0, r), [x1, y1] = at(f1, r);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  const bands = zones.map((z, i) => ({
    seg: [(i === 0 ? 0 : zones[i - 1].to) / 100, z.to / 100] as const,
    s: z.severity,
  }));
  const frac = value === null ? 0 : Math.max(0, Math.min(100, value)) / 100;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img"
      aria-label={value === null ? `${caption ?? "Score"}: not enough of the plan filled in to score` : `${caption ?? "Score"}: ${value} out of 100`}>
      <path d={arc(0, 1)} stroke="var(--chart-track)" strokeWidth={sw + 3} fill="none" strokeLinecap="butt" />
      {value !== null && bands.map(({ seg, s }, i) => (
        <path key={i} d={arc(seg[0], Math.max(seg[0], seg[1] - 0.006))} stroke={SEV[s]} strokeWidth={sw} fill="none" />
      ))}
      {[0, 50, 100].map((t) => {
        const [x1, y1] = at(t / 100, r + sw / 2 + 2), [x2, y2] = at(t / 100, r + sw / 2 + 7);
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border)" strokeWidth={1.5} />;
      })}
      <text x={cx - r} y={cy + 15} textAnchor="middle" className="fill-muted-foreground text-[10px]">0</text>
      <text x={cx + r} y={cy + 15} textAnchor="middle" className="fill-muted-foreground text-[10px]">100</text>
      {/*
        The needle is drawn, not animated. §6.49.2's rule is that the data is the loudest thing on the
        page; a needle that sweeps in on load makes the chrome the loudest thing for its first second.
      */}
      {value !== null && (() => {
        const [nx, ny] = at(frac, r - sw * 0.3);
        return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--foreground)" strokeWidth={3} strokeLinecap="round" />;
      })()}
      <circle cx={cx} cy={cy} r={6} fill="var(--foreground)" />
      <circle cx={cx} cy={cy} r={2.5} fill="var(--card)" />
    </svg>
  );
}

/**
 * A VALUE AGAINST THE RANGE THAT MAKES SENSE OF IT (§6.128).
 *
 * Built for one question — "the loan I want is $1.5M; what does this business actually support?" — where
 * the answer is two figures and a want, and the only thing a reader needs is which side of the line they
 * fall on. A bar chart of three numbers would be three bars of nearly equal height saying nothing.
 *
 * Marks can sit above or below the track so two close together do not collide. That is the caller's call,
 * because only the caller knows which two are close.
 */
export function RangeBar({ min, max, zones, marks, ticks, format }: {
  /* No `width`: the track is laid out in percentages, so it fits whatever box it is given. */
  min: number; max: number;
  zones: { from: number; to: number; severity: Severity }[];
  marks: { at: number; label: string; tone?: "foreground" | "bad"; below?: boolean }[];
  ticks: number[];
  format: (v: number) => string;
}) {
  const pos = (v: number) => `${(((v - min) / (max - min)) * 100).toFixed(2)}%`;
  return (
    <div className="pb-1 pt-6">
      <div className="relative h-7 rounded border border-border bg-chart-track">
        {zones.map((z, i) => (
          <div key={i} className="absolute inset-y-0 opacity-70"
            style={{ left: pos(z.from), width: `calc(${pos(z.to)} - ${pos(z.from)})`, background: SEV[z.severity] }} />
        ))}
        {marks.map((m, i) => (
          <div key={i} className="absolute -inset-y-1.5 w-0 border-l-2"
            style={{ left: pos(m.at), borderColor: m.tone === "bad" ? "var(--bad)" : "var(--foreground)" }}>
            <span className={cn("absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold",
              m.below ? "top-[calc(100%+2px)]" : "bottom-[calc(100%+2px)]")}>{m.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between text-[11px] text-muted-foreground tabular-nums">
        {ticks.map((t) => <span key={t}>{format(t)}</span>)}
      </div>
    </div>
  );
}

/**
 * THE SAME DIAL, CARD-SIZED (§6.128.3).
 *
 * `ScoreDial` above notes that gauges are an exception in this app and says why the headline earns one.
 * This is the exception widening, deliberately and on the client's own instruction after seeing the built
 * screen: three tabs where only the headline had a dial read as three different screens, and consistency
 * across a tool a consultant walks a client through is worth more than the objection it costs.
 *
 * THE OBJECTION IS REAL AND IS ANSWERED IN THE LAYOUT, not waved away. `Meter` is right that two arcs side
 * by side are hard to compare — so the number stays printed at full size next to the dial, and the dial is
 * given the job it is actually good at: showing at a glance how far through its range a value sits, and
 * which band it landed in. The reader compares the numerals; the arc carries the shape.
 *
 * A metric with no value draws its bands greyed and no needle, which is a different picture from a needle
 * at zero — "not answered" and "answered badly" must never look alike (§6.89).
 */
export function MiniDial({ width, value, min, max, zones, severity, label }: {
  width: number;
  value: number | null;
  min: number; max: number;
  zones: { to: number; severity: Severity }[];
  severity: import("./core").Severity | null;
  label: string;
}) {
  const w = Math.min(width, 150);
  const h = w * 0.56;
  const cx = w / 2, cy = w * 0.48, r = w * 0.37, sw = w * 0.085;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const frac = (v: number) => (max === min ? 0 : (clamp(v) - min) / (max - min));
  const at = (f: number, rr: number) => {
    const a = Math.PI * (1 - Math.max(0, Math.min(1, f)));
    return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const;
  };
  const arc = (f0: number, f1: number) => {
    const [x0, y0] = at(f0, r), [x1, y1] = at(f1, r);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  /* Each band starts where the previous one ended. Read from the array rather than carried in a variable,
     because a variable reassigned inside a render is a variable that can survive into the next one. */
  const bands = zones.map((z, i) => ({
    seg: [frac(i === 0 ? min : zones[i - 1].to), frac(z.to)] as const,
    s: z.severity,
  }));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label}>
      <path d={arc(0, 1)} stroke="var(--chart-track)" strokeWidth={sw + 2} fill="none" />
      {bands.map(({ seg, s }, i) => seg[1] > seg[0] && (
        <path key={i} d={arc(seg[0], Math.max(seg[0], seg[1] - 0.008))} stroke={SEV[s]} strokeWidth={sw}
          fill="none" opacity={value === null ? 0.25 : 0.9} />
      ))}
      {value !== null && (() => {
        const [nx, ny] = at(frac(value), r - sw * 0.25);
        return <>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--foreground)" strokeWidth={2} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={3.5} fill="var(--foreground)" />
        </>;
      })()}
      {value === null && <circle cx={cx} cy={cy} r={3.5} fill="var(--border)" />}
      {severity && value !== null && (
        <circle cx={cx} cy={cy} r={1.4} fill={SEV[severity]} />
      )}
    </svg>
  );
}

/**
 * THE CARD'S FIVE YEARS IN EIGHTY PIXELS (§6.129.2).
 *
 * No axis, no labels: the card's numeral is the figure and this is only its direction. Gaps stay gaps — a
 * loss year on a ratio struck on earnings is not a point — and the year the dial is judging is the one
 * marked, in the dial's own colour, so the eye can find "now" on the line without a caption.
 */
export function Spark({ values, at, severity, label }: {
  values: (number | null)[]; at: number; severity: Severity | null; label: string;
}) {
  const w = 88, h = 26, p = 4;
  const real = values.filter((v): v is number => v !== null);
  if (real.length < 2) return null;
  const mn = Math.min(...real), mx = Math.max(...real), rg = mx - mn || 1;
  const x = (i: number) => p + (i * (w - 2 * p)) / Math.max(1, values.length - 1);
  const y = (v: number) => h - p - ((v - mn) / rg) * (h - 2 * p);
  /* A point starts a new stroke when the one before it is a gap — read off the array, never a flag (§6.128.5 lint). */
  const d = values.map((v, i) => (v === null ? "" : `${values[i - 1] == null ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)).join(" ");
  const now = values[at];
  const tone = severity ? SEV[severity] : "var(--muted-foreground)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="shrink-0">
      <path d={d} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
      {values.map((v, i) => v === null ? null : (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === at ? 3.5 : 1.8}
          fill={i === at ? tone : "var(--muted-foreground)"} stroke={i === at ? "var(--card)" : "none"} strokeWidth={i === at ? 1.5 : 0} />
      ))}
      {now === null && <circle cx={x(at)} cy={h / 2} r={3} fill="none" stroke="var(--border)" strokeWidth={1.5} />}
    </svg>
  );
}
