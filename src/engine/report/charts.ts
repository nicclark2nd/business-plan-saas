/**
 * The plan's charts, as SVG strings (§6.91).
 *
 * Nic: *"clients love graphs, charts, visuals. The plan is full of words and for most people it's a heavy
 * task to even open the plan and even harder to read one."* He is right, and a business plan nobody opens
 * is a business plan that did nothing.
 *
 * These are STRINGS rather than React, because the same picture has to reach two places: the screen inlines
 * the SVG, and the Word renderer rasterises it to PNG. One drawing, two uses — the same rule the whole
 * report is built on (§6.83, §6.90). A chart drawn twice is a chart that will one day disagree with itself.
 *
 * COLOURS ARE THE APP'S OWN, unchanged: `--chart-1` to `--chart-5` off `globals.css`. The set was put
 * through the palette validator rather than eyeballed — lightness band, chroma floor, CVD separation
 * (worst adjacent pair ΔE 9.2 deutan, 27.6 normal) and contrast all pass. Two of the five fall under 3:1
 * against white, which the validator flags as needing "visible labels or a table view" as relief. Every
 * chart in this plan sits directly above the table of the same figures, so that relief is structural: the
 * reader can always check the picture against the numbers.
 */

/** The app's palette, as hex, because an SVG rasterised outside a browser has no CSS variables. */
export const C = {
  ink: "#1F2933",
  muted: "#6B7A8C",
  grid: "#E7EBF0",
  axis: "#D9DEE5",
  series: ["#1F6FCB", "#EB6834", "#1BAF7A", "#4A3AA7", "#E87BA4"],
  good: "#2E7D32",
  bad: "#C62828",
  surface: "#FFFFFF",
} as const;

const FONT = "Open Sans, Helvetica, Arial, sans-serif";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r1 = (v: number) => Math.round(v * 10) / 10;

/** A chart is only ever this: a picture, and the words a reader needs to trust it. */
export type Chart = { svg: string; title: string; note?: string; alt: string; height: number };

const W = 960;                                    // the document's text measure, in SVG units
const PAD = { top: 16, right: 20, bottom: 34, left: 76 };

const text = (x: number, y: number, s: string, o: { size?: number; fill?: string; anchor?: string; bold?: boolean } = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}" font-family="${FONT}" font-size="${o.size ?? 13}" ` +
  `fill="${o.fill ?? C.muted}" text-anchor="${o.anchor ?? "start"}"${o.bold ? ' font-weight="600"' : ""}>${esc(s)}</text>`;

/**
 * A scale that lands on round numbers and ALWAYS INCLUDES ZERO.
 *
 * A bar chart that does not start at zero lies about the ratio between its bars, and a plan is not the
 * place to be clever about that. Line charts get the same treatment here for consistency of reading.
 */
function scale(values: number[]) {
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  if (lo === 0 && hi === 0) return { lo: 0, hi: 1, ticks: [0, 1] };
  const span = hi - lo;
  const step = Math.pow(10, Math.floor(Math.log10(span / 4)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => span / s <= 5) ?? step * 10;
  const bot = Math.floor(lo / nice) * nice, top = Math.ceil(hi / nice) * nice;
  const ticks: number[] = [];
  for (let v = bot; v <= top + nice / 2; v += nice) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo: bot, hi: top, ticks };
}

function frame(h: number, s: ReturnType<typeof scale>, cats: string[], money: (v: number) => string) {
  const plotH = h - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH - ((v - s.lo) / (s.hi - s.lo)) * plotH;
  const inner = W - PAD.left - PAD.right;
  const band = inner / Math.max(1, cats.length);
  const grid = s.ticks.map((t) =>
    `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${r1(y(t))}" y2="${r1(y(t))}" ` +
    `stroke="${t === 0 ? C.axis : C.grid}" stroke-width="1"/>` + text(PAD.left - 10, y(t) + 4, money(t), { anchor: "end", size: 12 }),
  ).join("");
  const labels = cats.map((c, i) => text(PAD.left + band * i + band / 2, h - 10, c, { anchor: "middle", size: 12.5 })).join("");
  return { y, band, plotH, chrome: grid + labels };
}

const open = (h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img">` +
  `<rect width="${W}" height="${h}" fill="${C.surface}"/>`;

/** A legend, always, for two or more series — identity is never colour alone. */
const legend = (names: string[], y: number) =>
  names.map((n, i) => {
    const x = PAD.left + i * 190;
    return `<rect x="${x}" y="${y - 9}" width="11" height="11" rx="3" fill="${C.series[i % C.series.length]}"/>` +
      text(x + 17, y, n, { size: 12.5, fill: C.ink });
  }).join("");

// ---------------------------------------------------------------------------

/** Several measures over the same years. Lines, because the question is "which way is each one going". */
export function linesChart(o: {
  title: string; note?: string; categories: string[];
  series: { name: string; values: number[] }[]; money: (v: number) => string;
}): Chart {
  const h = 300;
  const all = o.series.flatMap((s) => s.values);
  const s = scale(all);
  const { y, band, chrome } = frame(h - 26, s, o.categories, o.money);
  const x = (i: number) => PAD.left + band * i + band / 2;
  const paths = o.series.map((ser, si) => {
    const d = ser.values.map((v, i) => `${i ? "L" : "M"}${r1(x(i))} ${r1(y(v))}`).join(" ");
    const dots = ser.values.map((v, i) =>
      `<circle cx="${r1(x(i))}" cy="${r1(y(v))}" r="4.5" fill="${C.series[si % 5]}" stroke="${C.surface}" stroke-width="2"/>`).join("");
    return `<path d="${d}" fill="none" stroke="${C.series[si % 5]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join("");
  return {
    title: o.title, note: o.note, height: h,
    alt: `${o.title}. ${o.series.map((x2) => `${x2.name}: ${x2.values.map(o.money).join(", ")}`).join(". ")}`,
    svg: open(h) + chrome + paths + legend(o.series.map((x2) => x2.name), h - 6) + "</svg>",
  };
}

/** One measure over time, filled to nil — the area below the line IS the shortfall when it goes negative. */
export function trendChart(o: {
  title: string; note?: string; categories: string[]; values: number[]; money: (v: number) => string;
}): Chart {
  const h = 280;
  const s = scale(o.values);
  const { y, band, chrome } = frame(h, s, o.categories, o.money);
  const x = (i: number) => PAD.left + band * i + band / 2;
  const line = o.values.map((v, i) => `${i ? "L" : "M"}${r1(x(i))} ${r1(y(v))}`).join(" ");
  const area = `${line} L${r1(x(o.values.length - 1))} ${r1(y(0))} L${r1(x(0))} ${r1(y(0))} Z`;
  const dots = o.values.map((v, i) =>
    `<circle cx="${r1(x(i))}" cy="${r1(y(v))}" r="4.5" fill="${v < 0 ? C.bad : C.series[0]}" stroke="${C.surface}" stroke-width="2"/>`).join("");
  return {
    title: o.title, note: o.note, height: h,
    alt: `${o.title}. ${o.categories.map((c, i) => `${c}: ${o.money(o.values[i])}`).join(", ")}`,
    svg: open(h) + `<path d="${area}" fill="${C.series[0]}" opacity="0.10"/>` + chrome +
      `<path d="${line}" fill="none" stroke="${C.series[0]}" stroke-width="2.5" stroke-linejoin="round"/>` + dots + "</svg>",
  };
}

/** Columns, for a magnitude per period. Negative bars take the bad colour, because a loss is a status. */
export function columnsChart(o: {
  title: string; note?: string; categories: string[]; values: number[]; money: (v: number) => string;
}): Chart {
  const h = 280;
  const s = scale(o.values);
  const { y, band, chrome } = frame(h, s, o.categories, o.money);
  const bw = Math.min(74, band * 0.52);
  const bars = o.values.map((v, i) => {
    const cx = PAD.left + band * i + band / 2;
    const top = y(Math.max(0, v)), bottom = y(Math.min(0, v));
    const hh = Math.max(1.5, bottom - top);
    return `<rect x="${r1(cx - bw / 2)}" y="${r1(top)}" width="${r1(bw)}" height="${r1(hh)}" rx="4" fill="${v < 0 ? C.bad : C.series[0]}"/>` +
      text(cx, v < 0 ? bottom + 15 : top - 7, o.money(v), { anchor: "middle", size: 12, fill: C.ink, bold: true });
  }).join("");
  return {
    title: o.title, note: o.note, height: h,
    alt: `${o.title}. ${o.categories.map((c, i) => `${c}: ${o.money(o.values[i])}`).join(", ")}`,
    svg: open(h) + chrome + bars + "</svg>",
  };
}

/**
 * Horizontal bars, sorted, for a handful of long-named things.
 *
 * Horizontal because "Garage, Granny Flat & Home Extension Slabs" is not a column label at any width, and
 * sorted because the question these answer is always "which is biggest".
 */
export function barsChart(o: {
  title: string; note?: string; rows: { label: string; value: number }[]; money: (v: number) => string;
}): Chart {
  const rows = [...o.rows].sort((a, b) => b.value - a.value);
  const ROW = 30, LABEL = 250;
  const h = Math.max(120, rows.length * ROW + 26);
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const inner = W - LABEL - 150;
  const bars = rows.map((r, i) => {
    const y = 14 + i * ROW;
    const w = Math.max(2, (Math.abs(r.value) / max) * inner);
    const label = r.label.length > 34 ? `${r.label.slice(0, 33)}…` : r.label;
    return text(0, y + 15, label, { size: 13, fill: C.ink }) +
      `<rect x="${LABEL}" y="${r1(y + 5)}" width="${r1(w)}" height="16" rx="4" fill="${r.value < 0 ? C.bad : C.series[0]}"/>` +
      text(LABEL + w + 10, y + 18, o.money(r.value), { size: 12.5, fill: C.ink, bold: true });
  }).join("");
  return {
    title: o.title, note: o.note, height: h,
    alt: `${o.title}. ${rows.map((r) => `${r.label}: ${o.money(r.value)}`).join(", ")}`,
    svg: open(h) + bars + "</svg>",
  };
}
