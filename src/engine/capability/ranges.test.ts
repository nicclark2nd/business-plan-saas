import { describe, it, expect } from "vitest";
import { adjustableMeasures, applyRanges, readRanges, validPair } from "./ranges";
import { statusOf, type Metric } from "./model";

describe("ranges set for a plan (§6.140)", () => {
  const all = adjustableMeasures();
  const keys = all.map((a) => a.key);

  it("offers the plain three-band measures and none whose lines come from the plan", () => {
    expect(keys).toContain("operatingMargin");
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);          // one row per tab and measure
    expect(keys).toContain("leverage");
    for (const k of ["dscr", "dscrStressed", "priceMultiple"]) expect(keys).not.toContain(k);
    expect(all.length).toBeGreaterThan(10);
  });

  it("reads the general lines from the engine, rising", () => {
    for (const a of all) expect(a.general[0]).toBeLessThan(a.general[1]);
  });

  it("keeps only stored pairs that would draw a sensible dial", () => {
    expect(readRanges({ a: [5, 10], b: [10, 5], c: ["1", 2], d: [1] })).toEqual({ a: [5, 10] });
    expect(readRanges(null)).toEqual({});
    expect(validPair([Number.NaN, 1])).toBe(false);
  });

  const m: Metric = {
    key: "operatingMargin", name: "Operating margin", unit: "pct", value: 12, display: "12%",
    min: -20, max: 25, bands: [{ to: 0, s: "bad" }, { to: 5, s: "watch" }, { to: 25, s: "good" }],
    note: "", bench: "general", formula: "", reveals: "", confidence: "",
  };

  it("moves the lines, so the same figure is judged against the plan's own range", () => {
    expect(statusOf(12, m.bands)).toBe("good");
    const [set] = applyRanges([m], { "grow:operatingMargin": [10, 18] }, "grow");
    expect(statusOf(12, set.bands)).toBe("watch");
    expect(set.bench).toContain("Set for this plan");
    expect(set.rangeSet).toBe(true);
  });

  it("stretches the dial when a line is set above its top", () => {
    const [set] = applyRanges([m], { "grow:operatingMargin": [20, 40] }, "grow");
    expect(set.max).toBeGreaterThanOrEqual(50);
    expect(set.bands[2].to).toBe(set.max);
  });

  it("leaves a measure alone with no range, or a nonsense one", () => {
    expect(applyRanges([m], {}, "grow")[0]).toBe(m);
    expect(applyRanges([m], { "grow:operatingMargin": [18, 10] as [number, number] }, "grow")[0]).toBe(m);
    /* The same measure on another tab keeps its own range. */
    expect(applyRanges([m], { "sell:operatingMargin": [10, 18] }, "grow")[0]).toBe(m);
  });
});
