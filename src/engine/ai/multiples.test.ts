import { describe, it, expect } from "vitest";
import { multiplesAsk, multiplesMessages, readMultiples, revenueBand, checkAccepted } from "./multiples";

const ask = { industry: "Concreting", country: "Australia", band: "AUD 1–5 million" };
const src = (url: string, low: number, high: number, basis = "EBITDA", title = "T") => ({ url, low, high, basis, title });
const reply = (sources: unknown[]) => JSON.stringify({ sources });

describe("what leaves the building", () => {
  it("needs an industry and a country", () => {
    expect(multiplesAsk({ industry: " ", country: null, revenue: 2e6, currency: "AUD" })).toEqual({ ok: false, missing: ["industry", "country"] });
  });
  it("sends a band, never the revenue figure", () => {
    const r = multiplesAsk({ industry: "Concreting", country: "Australia", revenue: 2_345_678, currency: "AUD" });
    expect(r.ok).toBe(true);
    const text = JSON.stringify(multiplesMessages((r as { ask: typeof ask }).ask));
    expect(text).toContain("AUD 1–5 million");
    expect(text).not.toMatch(/2,?345,?678/);
  });
  it("bands revenue", () => {
    expect(revenueBand(null, "AUD")).toBeNull();
    expect(revenueBand(0, "AUD")).toBeNull();
    expect(revenueBand(400_000, "AUD")).toBe("AUD under 0.5 million");
    expect(revenueBand(25e6, "NZD")).toBe("NZD over 20 million");
  });
  it("carries nothing but industry, country and band in the user turn", () => {
    const m = multiplesMessages(ask);
    expect(m[1].content).toBe("What EBITDA multiples have small private Concreting businesses in Australia with annual revenue of AUD 1–5 million sold for? List each published source.");
  });
});

describe("reading the reply", () => {
  const cited = ["https://www.brokerA.com.au/report/", "https://valuer-b.com/guide", "https://c.org/x"];

  it("gives a range from two sites that the search returned", () => {
    const r = readMultiples(reply([src("https://brokera.com.au/report", 2.5, 3.5), src("https://valuer-b.com/guide", 3, 4)]), cited, ask);
    expect(r).toMatchObject({ ok: true, low: 2.8, high: 3.8, setAside: 0 });
  });
  it("drops a URL the search never returned", () => {
    const r = readMultiples(reply([src("https://brokera.com.au/report", 2.5, 3.5), src("https://made-up.com/p", 3, 4)]), cited, ask);
    expect(r.ok).toBe(false);
  });
  it("sets SDE and revenue multiples aside and says how many", () => {
    const r = readMultiples(reply([
      src("https://brokera.com.au/report", 2.5, 3.5), src("https://valuer-b.com/guide", 1.8, 2.2, "SDE"), src("https://c.org/x", 0.4, 0.6, "revenue"),
    ]), cited, ask);
    expect(r).toMatchObject({ ok: false, setAside: 2 });
  });
  it("counts sites, not pages", () => {
    const r = readMultiples(reply([src("https://brokera.com.au/report", 2.5, 3.5), src("https://www.brokera.com.au/report/", 3, 4)]), cited, ask);
    expect(r.ok).toBe(false);
  });
  it("refuses impossible figures", () => {
    const r = readMultiples(reply([src("https://brokera.com.au/report", 45, 60), src("https://valuer-b.com/guide", 4, 3)]), cited, ask);
    expect(r.ok).toBe(false);
  });
  it("survives prose and a code fence", () => {
    const text = "```json\n" + reply([src("https://brokera.com.au/report", 3, 3), src("https://c.org/x", 4, 5)]) + "\n```";
    expect(readMultiples(text, cited, ask)).toMatchObject({ ok: true, low: 3.5, high: 4 });
  });
  it("says so plainly when nothing is found", () => {
    const r = readMultiples("not json", cited, ask);
    expect(r).toMatchObject({ ok: false });
    expect((r as { reason: string }).reason).toContain("Concreting businesses in Australia");
  });
  it("trusts nothing when the search cited nothing", () => {
    expect(readMultiples(reply([src("https://brokera.com.au/report", 3, 4), src("https://c.org/x", 3, 4)]), [], ask).ok).toBe(false);
  });
});

describe("what the accept action will store", () => {
  const good = { low: 3, high: 4, sources: [{ title: "A", url: "https://a.com", low: 3, high: 4 }, { title: "B", url: "https://b.com", low: 3, high: 4 }] };
  it("accepts a well-formed range", () => expect(checkAccepted(good).ok).toBe(true));
  it("refuses a range with one source", () => expect(checkAccepted({ ...good, sources: good.sources.slice(0, 1) }).ok).toBe(false));
  it("refuses low above high", () => expect(checkAccepted({ ...good, low: 5 }).ok).toBe(false));
  it("refuses a non-web URL", () => expect(checkAccepted({ ...good, sources: [good.sources[0], { ...good.sources[1], url: "javascript:alert(1)" }] }).ok).toBe(false));
});
