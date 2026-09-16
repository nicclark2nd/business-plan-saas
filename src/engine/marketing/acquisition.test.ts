import { describe, expect, it } from "vitest";
import { acquisitionByYear, customersWonByYear } from "./acquisition";
import type { AnyProduct } from "../sales/product";

const slab: AnyProduct = {
  id: "slab", name: "House slabs", sold_as: "one_off", average_price: 16_800, units_sold: 36,
  start_selling_year: 1, yearly_growth: {}, monthly_distribution: null,
} as AnyProduct;
const care: AnyProduct = {
  id: "care", name: "Maintenance plan", sold_as: "recurring", average_price: 1_200, units_sold: 10,
  start_selling_year: 1, yearly_growth: {}, monthly_distribution: null,
  opening_clients: 0, client_life_months: 24,
} as AnyProduct;

describe("what it costs to win a customer", () => {
  it("adds new jobs to new clients — both are one customer deciding to buy", () => {
    expect(customersWonByYear([slab, care])[0]).toBe(46);
  });

  it("leaves out a line whose clients come from another line", () => {
    // Every maintenance client IS a slab job arriving a second time. Counting both would halve the cost.
    const linked = { ...care, clients_from_product_id: "slab" } as AnyProduct;
    expect(customersWonByYear([slab, linked])[0]).toBe(36);
    expect(customersWonByYear([slab, linked])[0]).toBeLessThan(customersWonByYear([slab, care])[0]);
  });

  it("divides the plan's own spend by the plan's own count", () => {
    const a = acquisitionByYear([slab], [18_000, 18_000, 18_000, 18_000, 18_000]);
    expect(a[0].won).toBe(36);
    expect(a[0].spend).toBe(18_000);
    expect(a[0].costPerWin).toBe(500);
  });

  it("says nothing rather than infinity when nobody is won", () => {
    const later = { ...slab, start_selling_year: 3 } as AnyProduct;
    const a = acquisitionByYear([later], [18_000, 18_000, 18_000, 18_000, 18_000]);
    expect(a[0].won).toBe(0);
    expect(a[0].costPerWin).toBeNull();
    expect(a[2].costPerWin).toBe(500);
  });

  it("costs nothing per customer when nothing is spent", () => {
    expect(acquisitionByYear([slab], [0, 0, 0, 0, 0])[0].costPerWin).toBe(0);
  });

  it("falls as the plan wins more on the same spend", () => {
    const growing = { ...slab, yearly_growth: { "2": { units: 50 } } } as unknown as AnyProduct;
    const a = acquisitionByYear([growing], Array(5).fill(18_000));
    expect(a[1].won).toBeGreaterThan(a[0].won);
    expect(a[1].costPerWin!).toBeLessThan(a[0].costPerWin!);
  });
});
