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
    /* §6.141: the general sentence would contradict the dial, so it is written from the plan's lines. */
    expect(set.note).toBe("At 12%, inside the 10% to 18% this plan marks as one to watch.");
  });

  it("keeps the measure's own sentence when the plan's range puts it in the same band", () => {
    const own = { ...m, note: "Specific sentence" };
    expect(applyRanges([own], { "grow:operatingMargin": [5, 10] }, "grow")[0].note).toBe("Specific sentence");
  });

  it("rewrites a sentence that quotes the general line, even in the same band", () => {
    const lvr: Metric = { ...m, key: "lvr", name: "Loan to value", value: 90, display: "90%", min: 0, max: 100,
      bands: [{ to: 65, s: "good" }, { to: 75, s: "watch" }, { to: 100, s: "bad" }],
      note: "Above the 75% most lenders stop at.", citesGeneral: true };
    expect(keys).toContain("lvr");
    expect(applyRanges([lvr], { "borrow:lvr": [70, 85] }, "borrow")[0].note)
      .toBe("At 90%, above the 85% this plan sets as its limit — the weak end of its own range.");
  });

  it("writes the weak and strong ends the right way round for either direction", () => {
    const low: Metric = { ...m, key: "leverage", unit: "x", value: 4, display: "4×",
      bands: [{ to: 2.5, s: "good" }, { to: 3.5, s: "watch" }, { to: 6, s: "bad" }] };
    expect(applyRanges([low], { "borrow:leverage": [4.5, 5] }, "borrow")[0].note).toContain("at or under the 4.5×");
    expect(applyRanges([m], { "grow:operatingMargin": [15, 20] }, "grow")[0].note).toContain("below the 15% this plan sets as its floor");
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
