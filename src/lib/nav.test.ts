import { describe, expect, it } from "vitest";
import { NAV, GUIDED_STEPS } from "./nav";

/** What Guided mode actually renders: a numbered step, or something flagged a tool. Nothing else. */
const guided = NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.step || i.tool) })).filter((g) => g.items.length);
const flat = guided.flatMap((g) => g.items);

describe("the left menu", () => {
  /**
   * THE RULE (§6.80). A number is only a guide if the next one is the next thing down. Nic found 13 six
   * items below 12 and 14 above 6, and at that point the numbers have stopped being navigation and become
   * decoration. This is the test that stops it happening again the next time a module is added.
   */
  it("runs its numbers top to bottom, in Guided order", () => {
    const steps = flat.filter((i) => i.step).map((i) => i.step!);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it("numbers every step exactly once, with no gaps", () => {
    const steps = GUIDED_STEPS.map((i) => i.step!);
    expect(steps).toEqual(Array.from({ length: steps.length }, (_, i) => i + 1));
  });

  /**
   * An unnumbered item at the END of a group reads as "and also this". The same item between two numbered
   * ones reads as a step somebody has skipped, which is exactly what Assumptions and What-If were doing.
   * So: an unnumbered item may end a group, or live in a group that has no numbers at all, and nothing
   * else.
   */
  it("never puts an unnumbered item between two numbered ones", () => {
    const offenders: string[] = [];
    for (const g of guided) {
      const numbered = g.items.filter((i) => i.step).length;
      if (!numbered) continue;
      g.items.forEach((i, at) => {
        if (!i.step && at !== g.items.length - 1) offenders.push(`${g.group} → ${i.label}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  /** A menu item pointing at a route that does not exist is the §6.43.1 fault. Deep links say so openly. */
  it("gives every guided item either a route of its own or a declared deep link", () => {
    const linked = flat.filter((i) => i.href).map((i) => i.href!);
    for (const h of linked) expect(h).toMatch(/^[a-z-]+\?area=[a-z]+$/);
  });

  it("has no duplicate ids", () => {
    const ids = NAV.flatMap((g) => g.items).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
