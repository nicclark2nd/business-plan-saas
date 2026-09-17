"use client";

/**
 * The three plots this app needs (§6.49.2). Each carries ONE series, which is why none of them has a
 * legend: the title names the series, and a colour that means something (above or below break-even) is
 * free to mean it. A second series would need the categorical slots in globals.css and a legend with it.
 */
import { useState } from "react";
import { Frame, PLOT, Tip, niceScale, type Severity } from "./core";

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
export function Trend({ width, height = 260, categories, values, cross, format }: {
  width: number; height?: number; categories: string[]; values: number[];
  /** 1-based index of the month the line crosses, if it does. */
  cross?: number | null;
  format: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const scale = niceScale(Math.min(...values, 0), Math.max(...values, 0));
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
export function BarRows({ width, rows, format, height }: {
  width: number;
  rows: { label: string; value: number }[];
  format: (v: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ROW = 26, LABEL = Math.min(240, Math.max(120, Math.round(width * 0.3)));
  const h = height ?? rows.length * ROW + 8;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const inner = Math.max(10, width - LABEL - 96);
  return (
    <svg width={width} height={h} role="presentation" className="block">
      {rows.map((r, i) => {
        const w = (Math.abs(r.value) / max) * inner;
        const y = i * ROW + 4;
        return (
          <g key={r.label + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={0} y={y} width={width} height={ROW} fill={hover === i ? "var(--secondary)" : "transparent"} />
            <text x={0} y={y + ROW / 2} dy="0.32em" className="fill-foreground text-[12px]">
              {r.label.length > 30 ? `${r.label.slice(0, 29)}…` : r.label}
              <title>{r.label}</title>
            </text>
            <rect x={LABEL} y={y + 6} width={Math.max(2, w)} height={ROW - 14} rx={4}
              fill={r.value < 0 ? "var(--bad)" : "var(--primary)"} />
            <text x={LABEL + Math.max(2, w) + 8} y={y + ROW / 2} dy="0.32em"
              className="fill-foreground text-[11.5px] font-semibold tabular-nums">{format(r.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

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
export function Lines({ width, height = 260, categories, series, format }: {
  width: number; height?: number; categories: string[];
  series: { label: string; values: number[] }[];
  format: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  const scale = niceScale(Math.min(...all, 0), Math.max(...all, 0));
  const h = height - PLOT.top - PLOT.bottom;
  const inner = Math.max(0, width - PLOT.left - PLOT.right);
  const n = Math.max(1, categories.length);
  const step = inner / n;
  const px = (i: number) => PLOT.left + i * step + step / 2;
  const py = (v: number) => PLOT.top + h - ((v - scale.lo) / (scale.hi - scale.lo)) * h;
  const band = (i: number) => ({ x: PLOT.left + i * step, w: step });
  const colour = (i: number) => `var(--chart-${(i % 5) + 1})`;

  return (
    <>
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s, i) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <i className="inline-block h-[3px] w-4 rounded-full" style={{ background: colour(i) }} />{s.label}
          </span>
        ))}
      </div>
      <Frame width={width} height={height} scale={scale} categories={categories} band={band}>
        {series.map((s, si) => (
          <path key={s.label} fill="none" stroke={colour(si)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            d={s.values.map((v, i) => `${i ? "L" : "M"}${px(i)} ${py(v)}`).join(" ")} />
        ))}
        {hover !== null && (
          <>
            <line x1={px(hover)} x2={px(hover)} y1={PLOT.top} y2={PLOT.top + h} stroke="var(--input)" strokeWidth={1} />
            {series.map((s, si) => (
              <circle key={s.label} cx={px(hover)} cy={py(s.values[hover] ?? 0)} r={4} fill={colour(si)} stroke="var(--card)" strokeWidth={2} />
            ))}
            <Tip x={px(hover)} y={py(Math.max(...series.map((s) => s.values[hover] ?? 0)))} width={width}
              lines={series.map((s) => [s.label, format(s.values[hover] ?? 0)] as [string, string])} />
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
