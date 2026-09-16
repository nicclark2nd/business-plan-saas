"use client";

/**
 * Chart primitives (§6.49.2).
 *
 * Twelve modules were built before the first chart, and the look they established is flat, dense and
 * tabular. So there is no charting library here: a library brings its own opinions about padding, type and
 * colour, and the first thing anyone would do is fight them. These are a few dozen lines of SVG that take
 * the app's own tokens, and every chart in the app is built from them — one visual language, not five.
 *
 * The rules they enforce, so no caller has to remember them:
 *   · thin marks, hairline grid, no dashed chrome — the data is the loudest thing on the page
 *   · 4px rounded data-ends, anchored to the baseline; a 2px gap between adjacent marks
 *   · every chart sits directly above the table of its own figures, which is what earns the one colour
 *     below 3:1 contrast and what a screen reader is given instead of the picture
 *   · hover is not optional: a chart that cannot be interrogated is a decoration
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** The rendered width of a chart's own box. SVG text stays crisp because nothing is scaled. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(0, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A y-axis that ends on a round number, so the top gridline is readable rather than arbitrary. */
export function niceScale(min: number, max: number, ticks = 4) {
  const lo = Math.min(0, min), hi = Math.max(0, max);
  if (hi === lo) return { lo: 0, hi: 1, step: 1, values: [0, 1] };
  const raw = (hi - lo) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(hi / step) * step, bottom = Math.floor(lo / step) * step;
  const values: number[] = [];
  for (let v = bottom; v <= top + step / 2; v += step) values.push(Math.round(v * 1e6) / 1e6);
  return { lo: bottom, hi: top, step, values };
}

/** 1,240,000 → 1.2M. Axis ticks only; the table beside the chart carries the exact figure. */
export const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${(v / 1_000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(v));
};

export const PLOT = { top: 10, right: 12, bottom: 22, left: 52 };

/** The frame every plot draws inside: hairline grid, y ticks, category labels. */
export function Frame({ width, height, scale, categories, band, format = compact, children }: {
  width: number; height: number;
  scale: ReturnType<typeof niceScale>;
  categories?: string[];
  /** Where a category's label sits, in plot coordinates. Omitted for a plot with no category axis. */
  band?: (i: number) => { x: number; w: number };
  format?: (v: number) => string;
  children: React.ReactNode;
}) {
  const h = height - PLOT.top - PLOT.bottom;
  const y = (v: number) => PLOT.top + h - ((v - scale.lo) / (scale.hi - scale.lo)) * h;
  return (
    <svg width={width} height={height} role="presentation" className="block">
      {scale.values.map((v) => (
        <g key={v}>
          <line x1={PLOT.left} x2={width - PLOT.right} y1={y(v)} y2={y(v)}
            stroke={v === 0 ? "var(--input)" : "var(--chart-grid)"} strokeWidth={1} shapeRendering="crispEdges" />
          <text x={PLOT.left - 8} y={y(v)} dy="0.32em" textAnchor="end"
            className="fill-muted-foreground text-[10.5px] tabular-nums">{format(v)}</text>
        </g>
      ))}
      {categories && band && categories.map((c, i) => {
        const b = band(i);
        return <text key={c + i} x={b.x + b.w / 2} y={height - 6} textAnchor="middle"
          className="fill-muted-foreground text-[10.5px]">{c}</text>;
      })}
      {children}
    </svg>
  );
}

/** Where a chart's own figures live for anyone not looking at the picture. */
export function ChartBox({ title, note, height = 260, children, className }: {
  title: string; note?: React.ReactNode; height?: number; children: (width: number) => React.ReactNode; className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  return (
    <figure className={cn("border-b border-border px-5 py-3.5", className)}>
      <figcaption className="mb-1 flex items-baseline gap-3">
        <span className="text-[12.5px] font-semibold">{title}</span>
        {note && <span className="text-[11.5px] text-muted-foreground">{note}</span>}
      </figcaption>
      <div ref={ref} style={{ height }}>{width > 0 && children(width)}</div>
    </figure>
  );
}

/** Follows the pointer inside the plot; never leaves the chart's own box. */
export function Tip({ x, y, width, lines }: { x: number; y: number; width: number; lines: [string, string][] }) {
  const w = 150, h = 14 + lines.length * 15;
  const left = Math.min(Math.max(x - w / 2, 4), Math.max(4, width - w - 4));
  return (
    <g transform={`translate(${left} ${Math.max(4, y - h - 10)})`} pointerEvents="none">
      <rect width={w} height={h} rx={5} fill="var(--card)" stroke="var(--border)" />
      {lines.map(([k, v], i) => (
        <g key={k} transform={`translate(8 ${16 + i * 15})`}>
          <text className="fill-muted-foreground text-[11px]">{k}</text>
          <text x={w - 16} textAnchor="end" className="fill-foreground text-[11px] font-semibold tabular-nums">{v}</text>
        </g>
      ))}
    </g>
  );
}

// ---------- figures ----------

export type Severity = "accent" | "good" | "warn" | "bad";
const FILL: Record<Severity, string> = {
  accent: "var(--primary)", good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)",
};

/**
 * A single ratio against a limit. Not a dial: on an arc, 40 % and 50 % look the same, it costs a square of
 * space to say one number, and two of them side by side cannot be compared. A track reads at a glance,
 * lines up with its neighbours, and survives being printed into a lender's pack.
 */
export function Meter({ pct, severity = "accent", label }: { pct: number | null; severity?: Severity; label?: string }) {
  const filled = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-2" title={label}>
      <div className="h-[6px] w-full overflow-hidden rounded-full bg-chart-track">
        {pct !== null && <i className="block h-full rounded-full" style={{ width: `${filled}%`, background: FILL[severity] }} />}
      </div>
    </div>
  );
}

/** label · value · one line of context. The number IS the chart; a one-bar bar chart is not. */
export function StatTile({ label, value, sub, tone, children }: {
  label: string; value: string; sub?: React.ReactNode; tone?: Severity; children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 border-r border-border px-5 py-3 last:border-r-0">
      <div className="eyebrow">{label}</div>
      <div className={cn("mt-0.5 truncate text-[22px] font-semibold leading-tight",
        tone === "good" && "text-good", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>}
      {children}
    </div>
  );
}

export function TileRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] border-b border-border">{children}</div>;
}
