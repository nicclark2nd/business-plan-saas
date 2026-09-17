import { describe, expect, it } from "vitest";
import { NAV, GUIDED_STEPS, stepAfter, stepBefore, nextHref, backHref } from "./nav";

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

  /**
   * THE ONE THAT WOULD HAVE CAUGHT IT (§6.81). Before the path was defined once, "Save and continue" was a
   * hard-coded module name in each of thirteen action files. Marketing's said `swot` — so a client
   * finishing step 3 was carried past Competitors to step 5, and had been for as long as it existed,
   * silently, because nothing ever compared the redirect to the number.
   */
  it("walks the whole path forwards and backwards without skipping a step", () => {
    const ids = GUIDED_STEPS.map((i) => i.id);
    const walked: string[] = [ids[0]];
    for (let at = ids[0]; stepAfter(at); ) { at = stepAfter(at)!; walked.push(at); }
    expect(walked).toEqual(ids);
    for (let i = 1; i < ids.length; i++) expect(stepBefore(ids[i])).toBe(ids[i - 1]);
  });

  it("stops at both ends rather than wrapping round", () => {
    const ids = GUIDED_STEPS.map((i) => i.id);
    expect(stepBefore(ids[0])).toBeNull();
    expect(stepAfter(ids[ids.length - 1])).toBeNull();
  });

  /** A module that is not on the path has no next and no previous, and must not borrow somebody else's. */
  it("gives a non-step module no place on the path", () => {
    expect(stepAfter("break-even")).toBeNull();
    expect(stepBefore("what-if")).toBeNull();
  });

  it("sends both ends of the path to the dashboard rather than nowhere", () => {
    const ids = GUIDED_STEPS.map((i) => i.id);
    expect(nextHref("p1", ids[ids.length - 1])).toBe("/plans/p1/dashboard");
    expect(backHref("p1", ids[0])).toBe("/plans/p1/dashboard");
  });

  it("has no duplicate ids", () => {
    const ids = NAV.flatMap((g) => g.items).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
