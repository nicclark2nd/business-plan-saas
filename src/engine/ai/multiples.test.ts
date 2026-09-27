import { describe, it, expect } from "vitest";
import { multiplesAsk, multiplesMessages, readMultiples, revenueBand, checkAccepted, afterWider, isWider, widerScope, pickOwner, sdeBasis, convertedFrom } from "./multiples";

const ask = { industry: "Concreting", country: "Australia", band: "AUD 1–5 million" };
const src = (url: string, low: number, high: number, basis = "EBITDA", title = "T", more: Record<string, string> = {}) => ({ url, low, high, basis, title, ...more });
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

describe("after nine live searches (§6.143)", () => {
  const cited = ["https://brokera.com.au/report", "https://valuer-b.com/guide", "https://au.linkedin.com/pulse/x", "https://mna-c.co.uk/snapshot"];
  const wide = { ...ask, industry: "Cafe", country: "New Zealand", wider: true };

  it("does not count a social post as a site", () => {
    const r = readMultiples(reply([src("https://brokera.com.au/report", 2, 3), src("https://au.linkedin.com/pulse/x", 2, 5)]), cited, ask);
    expect(r.ok).toBe(false);
  });
  it("leaves out larger deals and says how many", () => {
    const r = readMultiples(reply([
      src("https://brokera.com.au/report", 3, 5), src("https://valuer-b.com/guide", 2, 4.2),
      src("https://mna-c.co.uk/snapshot", 9, 12, "EBITDA", "M&A", { size: "larger" }),
    ]), cited, ask);
    expect(r).toMatchObject({ ok: true, low: 2.5, high: 4.6, tooLarge: 1 });
  });
  it("keeps a figure whose size the source does not state", () => {
    const r = readMultiples(reply([src("https://brokera.com.au/report", 3, 5, "EBITDA", "A", { size: "unclear" }), src("https://valuer-b.com/guide", 2, 4, "EBITDA", "B", { size: "small" })]), cited, ask);
    expect(r.ok).toBe(true);
  });
  it("asks the wider question with nothing more than industry, country and band", () => {
    const m = multiplesMessages(wide)[1].content;
    expect(m).toContain("wider sector Cafe belongs to");
    expect(m).toContain("in New Zealand or Australia");
    expect(m).toContain("AUD 1–5 million");
  });
  it("borrows only the market written down, never one the model picks", () => {
    const r = readMultiples(reply([
      src("https://brokera.com.au/report", 2, 3, "EBITDA", "A", { market: "Cafes, Thailand" }),
      src("https://valuer-b.com/guide", 2, 3.5, "EBITDA", "B", { market: "Food service, New Zealand" }),
      src("https://c.org/x", 2, 3, "EBITDA", "C"),
    ]), [...cited, "https://c.org/x"], wide);
    expect(r.ok).toBe(false);                                          // Thailand and the unnamed one are dropped
    expect(widerScope("New Zealand")).toBe("the wider sector and Australia");
    expect(widerScope("India")).toBe("the wider sector");
    expect(widerScope("Indonesia")).toBe("the wider sector, Malaysia and Thailand");
  });
  it("matches a market by whole words, so US is not found in Australia", () => {
    const us = { ...wide, country: "Canada" };
    const r = readMultiples(reply([
      src("https://brokera.com.au/report", 2, 3, "EBITDA", "A", { market: "Plumbing, Australia" }),
      src("https://valuer-b.com/guide", 2, 3, "EBITDA", "B", { market: "Plumbing, US" }),
      src("https://mna-c.co.uk/snapshot", 2, 3, "EBITDA", "C", { market: "Trades, Canada" }),
    ]), cited, us);
    expect((r as { sources: { market?: string }[] }).sources.map((s) => s.market)).toEqual(["Plumbing, US", "Trades, Canada"]);
  });
  it("keeps each wider figure's market, and marks the reading wider", () => {
    const r = readMultiples(reply([
      src("https://brokera.com.au/report", 2, 3, "EBITDA", "A", { market: "Cafe, Australia" }),
      src("https://valuer-b.com/guide", 2, 3.5, "EBITDA", "B", { market: "Food service, New Zealand" }),
    ]), cited, wide);
    expect(r).toMatchObject({ ok: true, wider: true });
    expect((r as { sources: { market?: string }[] }).sources.map((s) => s.market)).toEqual(["Cafe, Australia", "Food service, New Zealand"]);
    expect(isWider((r as { sources: { market?: string }[] }).sources)).toBe(true);
  });
  it("drops the market from a close search, so a close range never reads as wider", () => {
    const r = readMultiples(reply([src("https://brokera.com.au/report", 2, 3, "EBITDA", "A", { market: "Cafe, Australia" }), src("https://valuer-b.com/guide", 2, 3)]), cited, ask);
    expect(isWider((r as { sources: { market?: string }[] }).sources)).toBe(false);
  });
  it("names the wider search in a miss, and adds up what both searches left out", () => {
    const first = readMultiples(reply([src("https://brokera.com.au/report", 1.5, 2, "SDE")]), cited, ask);
    const second = readMultiples(reply([]), cited, wide);
    const r = afterWider(first, second);
    expect(r).toMatchObject({ ok: false, setAside: 1, wider: true });
    expect((r as { reason: string }).reason).toContain("or for the wider sector and Australia");
  });
  it("stores a wider source's market through the accept check", () => {
    const c = checkAccepted({ low: 2, high: 3, sources: [
      { title: "A", url: "https://a.com", low: 2, high: 3, market: "Cafe, Australia" }, { title: "B", url: "https://b.com", low: 2, high: 3 },
    ] });
    expect(c.ok && c.sources[0].market).toBe("Cafe, Australia");
    expect(c.ok && "market" in c.sources[1]).toBe(false);
  });
});

describe("Southeast Asia borrows from its neighbours (§6.144)", () => {
  const th = { industry: "Cafe", country: "Thailand", band: null, wider: true };
  const cited = ["https://a.com/1", "https://b.com/2", "https://c.com/3"];
  it("asks Thailand's wider question of Thailand or Malaysia only", () => {
    expect(multiplesMessages(th)[1].content).toContain("in Thailand or Malaysia");
  });
  it("keeps Malaysian figures for a Thai plan and drops Singapore's", () => {
    const r = readMultiples(reply([
      src("https://a.com/1", 2, 3, "EBITDA", "A", { market: "Cafes, Malaysia" }),
      src("https://b.com/2", 2, 4, "EBITDA", "B", { market: "Food service, Thailand" }),
      src("https://c.com/3", 5, 7, "EBITDA", "C", { market: "Cafes, Singapore" }),
    ]), cited, th);
    expect((r as { sources: { market?: string }[] }).sources.map((s) => s.market)).toEqual(["Cafes, Malaysia", "Food service, Thailand"]);
  });
  it("lets the Philippines and Indonesia borrow from Malaysia and Thailand", () => {
    expect(multiplesMessages({ ...th, country: "Philippines" })[1].content).toContain("in Philippines or Malaysia or Thailand");
  });
});

describe("owner earnings converted in the open (§6.145)", () => {
  const cited = ["https://brokera.com.au/report", "https://valuer-b.com/guide", "https://c.org/x"];
  const basis = sdeBasis(400_000, { name: "Jo", pct: 60, pay: 100_000 }, 2);

  it("adds back one owner's pay: the largest shareholder on the payroll", () => {
    expect(pickOwner([{ name: "A", pct: 20, pay: 90_000 }, { name: "B", pct: 60, pay: 120_000 }, { name: "C", pct: null, pay: 150_000 }])?.name).toBe("B");
    expect(pickOwner([{ name: "A", pct: 100, pay: 0 }, { name: "B", pct: null, pay: 80_000 }])?.name).toBe("B");   // the only one paid
    expect(pickOwner([{ name: "A", pct: null, pay: 80_000 }, { name: "B", pct: null, pay: 90_000 }])).toBeNull(); // nobody marked, two paid
  });
  it("works out SDE as earnings plus that pay, and says why when it cannot", () => {
    expect(basis).toEqual({ ok: true, basis: { year: 2, earnings: 400_000, owner: "Jo", ownerPay: 100_000, factor: 1.25 } });
    expect(sdeBasis(-5, { name: "Jo", pct: 60, pay: 100_000 }, 1)).toEqual({ ok: false, why: "earnings" });
    expect(sdeBasis(400_000, null, 1)).toEqual({ ok: false, why: "owner" });
  });
  it("converts SDE figures, keeps them as quoted, and counts them as sites", () => {
    const r = readMultiples(reply([src("https://brokera.com.au/report", 3, 4), src("https://valuer-b.com/guide", 2, 3, "SDE")]), cited, ask, basis);
    expect(r).toMatchObject({ ok: true, converted: 1, setAside: 0 });
    const conv = (r as { sources: { sde?: unknown; low: number; high: number }[] }).sources[1];
    expect(conv).toMatchObject({ low: 2.5, high: 3.8, sde: { low: 2, high: 3, factor: 1.25 } });
  });
  it("counts a site on its EBITDA figure when it quotes both", () => {
    const r = readMultiples(reply([src("https://valuer-b.com/guide", 2, 3, "SDE"), src("https://valuer-b.com/guide", 3, 4), src("https://brokera.com.au/report", 3, 4)]), cited, ask, basis);
    expect((r as { sources: { url: string; sde?: unknown }[] }).sources.every((s) => !s.sde)).toBe(true);
  });
  it("still sets revenue aside, and sets SDE aside with the reason when it cannot convert", () => {
    const list = reply([src("https://brokera.com.au/report", 3, 4), src("https://valuer-b.com/guide", 2, 3, "SDE"), src("https://c.org/x", 0.5, 0.7, "revenue")]);
    expect(readMultiples(list, cited, ask, basis)).toMatchObject({ ok: true, setAside: 1, converted: 1 });
    expect(readMultiples(list, cited, ask, { ok: false, why: "owner" })).toMatchObject({ ok: false, setAside: 2, sdeWhy: "owner" });
  });
  it("drops a figure that converts past anything a small sale fetches", () => {
    const tiny = sdeBasis(10_000, { name: "Jo", pct: 100, pay: 200_000 }, 1);   // ×21
    const r = readMultiples(reply([src("https://brokera.com.au/report", 3, 4), src("https://valuer-b.com/guide", 2, 3, "SDE")]), cited, ask, tiny);
    expect(r.ok).toBe(false);
  });
  it("keeps the working through the accept check, and reads it back", () => {
    const c = checkAccepted({ low: 2.5, high: 3.8, sources: [
      { title: "A", url: "https://a.com", low: 2.5, high: 3.8, sde: { low: 2, high: 3, factor: 1.25 } }, { title: "B", url: "https://b.com", low: 3, high: 4 },
    ] });
    expect(c.ok && c.sources[0].sde).toEqual({ low: 2, high: 3, factor: 1.25 });
    expect(convertedFrom(c.ok ? c.sources : [])).toEqual({ count: 1, factor: 1.25 });
  });
});
