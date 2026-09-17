import { describe, expect, it } from "vitest";
import { PAGE_DIMENSIONS, defaultPageSizeFor, resolvePageSize } from "./pageSize";
import { COUNTRIES } from "@/app/(app)/plans/[planId]/settings/model";

/**
 * The paper the Word file is laid out for (§6.93). The dimensions are asserted as literal twips rather than
 * derived from the same constants they are testing — the point is that they are the real A4 and Letter, not
 * that the file agrees with itself (§6.92.1).
 */
describe("page size", () => {
  it("A4 and Letter are the real papers, in twips", () => {
    expect(PAGE_DIMENSIONS.a4).toEqual({ width: 11906, height: 16838 });     // 210 × 297 mm
    expect(PAGE_DIMENSIONS.letter).toEqual({ width: 12240, height: 15840 }); // 8.5 × 11 in
  });

  it("Letter is wider and shorter than A4 — which is why page breaks move, not columns", () => {
    expect(PAGE_DIMENSIONS.letter.width).toBeGreaterThan(PAGE_DIMENSIONS.a4.width);
    expect(PAGE_DIMENSIONS.letter.height).toBeLessThan(PAGE_DIMENSIONS.a4.height);
  });

  it("defaults Letter for the countries that use it", () => {
    expect(defaultPageSizeFor("United States")).toBe("letter");
    expect(defaultPageSizeFor("Canada")).toBe("letter");
    expect(defaultPageSizeFor("Philippines")).toBe("letter");
  });

  it("defaults A4 everywhere else, including no country at all", () => {
    expect(defaultPageSizeFor("Australia")).toBe("a4");
    expect(defaultPageSizeFor("United Kingdom")).toBe("a4");
    expect(defaultPageSizeFor("Other")).toBe("a4");
    expect(defaultPageSizeFor(null)).toBe("a4");
    expect(defaultPageSizeFor("")).toBe("a4");
  });

  it("answers for every country the settings screen offers", () => {
    for (const c of COUNTRIES) expect(["a4", "letter"]).toContain(defaultPageSizeFor(c));
  });

  it("is case and whitespace tolerant — the column is free text", () => {
    expect(defaultPageSizeFor("  united states  ")).toBe("letter");
    expect(defaultPageSizeFor("USA")).toBe("letter");
  });

  it("a stored choice wins over the country", () => {
    expect(resolvePageSize("a4", "United States")).toBe("a4");
    expect(resolvePageSize("letter", "Australia")).toBe("letter");
  });

  it("null means follow the country — that is the whole reason it is nullable", () => {
    expect(resolvePageSize(null, "United States")).toBe("letter");
    expect(resolvePageSize(null, "Australia")).toBe("a4");
    expect(resolvePageSize(undefined, "Canada")).toBe("letter");
  });

  it("an unreadable stored value falls back to the country rather than failing", () => {
    expect(resolvePageSize("A3", "United States")).toBe("letter");
    expect(resolvePageSize("", "Australia")).toBe("a4");
  });
});
