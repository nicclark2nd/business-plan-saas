import { describe, expect, it } from "vitest";
import { capTable } from "./ownership";

const john = { name: "John Frankel", pct_shareholding: 35 };
const mary = { name: "Mary Frankel", pct_shareholding: 25 };
const elon = { name: "Elon Musk", equity_percent: 5 };

describe("the cap table", () => {
  it("counts the leadership team and the investors, and says what is left", () => {
    const c = capTable([john, mary], [elon]);
    expect(c.leadership).toBe(60);
    expect(c.investors).toBe(5);
    expect(c.allocated).toBe(65);
    expect(c.unallocated).toBe(35);       // People said 60 %, Funding said 95 %; neither said this
    expect(c.complete).toBe(false);
    expect(c.over).toBe(false);
  });

  it("orders holders by size, whoever they are", () => {
    expect(capTable([john, mary], [{ name: "Fund", equity_percent: 40 }]).holders.map((h) => h.name))
      .toEqual(["Fund", "John Frankel", "Mary Frankel"]);
  });

  it("leaves out anyone holding nothing", () => {
    const c = capTable([john, { name: "Staffer", pct_shareholding: 0 }], []);
    expect(c.holders).toHaveLength(1);
    expect(c.leadership).toBe(35);
  });

  it("is complete when the whole business is accounted for", () => {
    const c = capTable([{ name: "Owner", pct_shareholding: 80 }], [{ name: "Angel", equity_percent: 20 }]);
    expect(c.complete).toBe(true);
    expect(c.unallocated).toBe(0);
  });

  it("says so when more than all of it is handed out, and never goes negative", () => {
    const c = capTable([{ name: "Owner", pct_shareholding: 90 }], [{ name: "Angel", equity_percent: 20 }]);
    expect(c.allocated).toBe(110);
    expect(c.over).toBe(true);
    expect(c.unallocated).toBe(0);        // "-10 % unallocated" is not a thing anyone can read
  });

  it("treats a nonsense holding as none of it", () => {
    const c = capTable([{ name: "Odd", pct_shareholding: -20 }], [{ name: "Blank", equity_percent: null }]);
    expect(c.allocated).toBe(0);
    expect(c.unallocated).toBe(100);
  });

  it("nobody owning anything is 100 % unallocated, not an empty answer", () => {
    const c = capTable([], []);
    expect(c.unallocated).toBe(100);
    expect(c.holders).toEqual([]);
  });
});
