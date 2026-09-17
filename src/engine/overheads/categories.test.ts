import { describe, expect, it } from "vitest";
import {
  OVERHEAD_CATEGORIES, CATEGORY_LABEL, categoryForSource, categoryLabelFor,
  groupByCategory, normalizeCategory,
} from "./categories";

/**
 * The eight keys and what they are allowed to do (§6.93).
 *
 * The keys in this file and the keys in migration 0041's check constraint are the same eight; a key added
 * here without the migration would be rejected by the database on save, which is why the first test names
 * them literally rather than deriving them from the list it is testing (§6.92.1 — an output compared to
 * another copy of itself proves nothing).
 */
describe("overhead categories", () => {
  it("is the eight keys the database will accept", () => {
    expect(OVERHEAD_CATEGORIES.map((c) => c.value)).toEqual([
      "premises", "people_admin", "sales_marketing", "vehicles_travel",
      "technology", "professional_insurance", "operating_equipment", "other",
    ]);
  });

  it("every category has a label and a hint", () => {
    for (const c of OVERHEAD_CATEGORIES) {
      expect(c.label.trim()).not.toBe("");
      expect(c.hint.trim()).not.toBe("");
    }
  });

  it("rejects anything that is not one of the eight", () => {
    expect(normalizeCategory("premises")).toBe("premises");
    expect(normalizeCategory("Premises")).toBeNull();
    expect(normalizeCategory("rent")).toBeNull();
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
    expect(normalizeCategory(undefined)).toBeNull();
  });

  it("the two synced lines take their category from what they are", () => {
    expect(categoryForSource("people")).toBe("people_admin");
    expect(categoryForSource("marketing")).toBe("sales_marketing");
    expect(categoryForSource("entered")).toBeNull();
  });

  it("a synced line's own category beats anything stored against it", () => {
    // Nothing on the screen can set these, so a stale value in the column must never win.
    expect(categoryLabelFor("premises", "people")).toBe(CATEGORY_LABEL.people_admin);
    expect(categoryLabelFor(null, "marketing")).toBe(CATEGORY_LABEL.sales_marketing);
    expect(categoryLabelFor("premises", "entered")).toBe(CATEGORY_LABEL.premises);
  });

  it("an uncategorised line reads as Other, and is never invented into something else", () => {
    expect(categoryLabelFor(null)).toBe(CATEGORY_LABEL.other);
    expect(categoryLabelFor("rent")).toBe(CATEGORY_LABEL.other);
  });
});

describe("grouping for the plan", () => {
  const entered = (name: string, amount: number, category: string | null) =>
    ({ name, amount, category, source: "entered" as const });

  it("does NOT group a plan where nobody has set a category (§6.89)", () => {
    const { grouped, groups } = groupByCategory([entered("Rent", 40000, null), entered("Fuel", 9000, null)]);
    expect(grouped).toBe(false);
    // The groups are still computed, but the caller must print the flat table when `grouped` is false.
    expect(groups.map((g) => g.key)).toEqual(["other"]);
  });

  it("groups as soon as one line carries a category", () => {
    const { grouped, groups } = groupByCategory([
      entered("Rent", 40000, "premises"),
      entered("Fuel", 9000, null),
    ]);
    expect(grouped).toBe(true);
    expect(groups.map((g) => g.key)).toEqual(["premises", "other"]);
  });

  it("a synced line is NOT enough to group on its own", () => {
    // Every plan has these two the moment it has salaries or a marketing budget. If they triggered grouping,
    // every plan in the product would print three headings with everything the client typed under Other.
    const { grouped, groups } = groupByCategory([
      { name: "Leadership Team salaries", amount: 250000, category: null, source: "people" as const },
      { name: "Marketing spend", amount: 18000, category: null, source: "marketing" as const },
      entered("Rent", 40000, null),
    ]);
    expect(grouped).toBe(false);
    // It still lands in its own category once something else has made the table grouped.
    expect(groups.map((g) => g.key)).toEqual(["people_admin", "sales_marketing", "other"]);
  });

  it("one categorised entered line turns grouping on, and the synced lines then sit in their own groups", () => {
    const { grouped, groups } = groupByCategory([
      { name: "Leadership Team salaries", amount: 250000, category: null, source: "people" as const },
      entered("Rent", 40000, "premises"),
      entered("Fuel", 9000, null),
    ]);
    expect(grouped).toBe(true);
    expect(groups.map((g) => g.key)).toEqual(["premises", "people_admin", "other"]);
  });

  it("prints groups in list order with Other last, whatever order the rows arrive in", () => {
    const { groups } = groupByCategory([
      entered("Sundries", 500, "other"),
      entered("Software", 6000, "technology"),
      entered("Rent", 40000, "premises"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["premises", "technology", "other"]);
  });

  it("subtotals add to the same total as the flat list", () => {
    const rows = [
      entered("Rent", 40000, "premises"),
      entered("Rates", 3200.5, "premises"),
      entered("Software", 6000, "technology"),
      entered("Sundries", 512.25, null),
    ];
    const { groups } = groupByCategory(rows);
    const flat = Number(rows.reduce((t, r) => t + r.amount, 0).toFixed(2));
    expect(Number(groups.reduce((t, g) => t + g.total, 0).toFixed(2))).toBe(flat);
    expect(groups.find((g) => g.key === "premises")!.total).toBe(43200.5);
  });

  it("keeps every row — nothing is dropped by grouping", () => {
    const rows = [
      entered("Rent", 40000, "premises"),
      entered("Fuel", 9000, "vehicles_travel"),
      entered("Sundries", 500, null),
    ];
    const { groups } = groupByCategory(rows);
    expect(groups.flatMap((g) => g.rows).map((r) => r.name).sort()).toEqual(["Fuel", "Rent", "Sundries"]);
  });
});
