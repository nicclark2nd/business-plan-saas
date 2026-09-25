import { describe, expect, it } from "vitest";
import { goalsAndMilestones } from "./narrative";
import type { ReportInput } from "./build";
import type { Ladder } from "@/engine/plan/ladder";

/**
 * WHAT A LENDER READS OFF THE LADDER (§6.125.2).
 *
 * Open item 22 was this section not existing: §6.125 gave clients three rungs to fill in and the report
 * carried only one of them. These tests hold the new section to the two things it must never get wrong —
 * saying a loss in words, and never presenting a figure the plan computed as a target somebody set.
 *
 * THE FIXTURE IS PARTIAL AND CAST, deliberately, for the reason the file above it gives: `ReportInput`
 * carries the whole plan and this section reads three fields of it.
 */
const ladder = (over: Partial<Ladder> = {}): Ladder => ({
  bigGoal: "",
  northStar: null,
  ninetyEndsOn: null,
  rungs: [
    { key: "year1", label: "1-Year", endsOn: "2027-06-30", revenue: 2182240, profit: -136681, loss: true, goals: [] },
    { key: "year3", label: "3-Year", endsOn: "2029-06-30", revenue: 2489334, profit: 69795, loss: false, goals: [] },
    { key: "year5", label: "5-Year", endsOn: "2031-06-30", revenue: 2892354, profit: 216950, loss: false, goals: [] },
  ],
  measures: [],
  ninety: [],
  ...over,
});

const input = (l: Ladder): ReportInput => ({
  businessName: "BNE Concreting",
  currency: "AUD",
  money: (v: number) => v.toFixed(0),
  ladder: l,
} as unknown as ReportInput);

/** Every string anywhere in the section, so a claim cannot hide in a cell nobody looked at. */
const allText = (i: ReportInput): string => JSON.stringify(goalsAndMilestones(i) ?? {});

describe("the ladder in the report", () => {
  /*
   * A HEADING WITH NOTHING UNDER IT IS THE §6.57 FAULT AT ITS MOST EXPENSIVE — in the document a client
   * hands to a bank. The rungs always carry figures, so "is there anything here" has to mean the words,
   * not the numbers.
   */
  it("is absent when the client has written nothing, even though the forecast has figures", () => {
    expect(goalsAndMilestones(input(ladder()))).toBeNull();
  });

  it("appears once a single rung has been written at", () => {
    const l = ladder();
    l.rungs[1].goals = ["Three crews running, with the pour-date guarantee intact."];
    expect(goalsAndMilestones(input(l))).not.toBeNull();
  });

  /**
   * THE ONE THAT MATTERS (§6.115.1, and it has now been caught three times).
   *
   * The AI drafter called a loss a profit. The Goals screen showed "-136,681" under a label reading "Net
   * profit". This is the third surface the same figure passes through, and the only one a bank reads.
   */
  it("says a loss in words rather than leaving it to a minus sign", () => {
    const l = ladder();
    l.rungs[0].goals = ["Turn the operating loss into a monthly profit."];
    const text = allText(input(l));
    expect(text).toContain("Loss of 136681");
    expect(text).not.toContain("-136681");
    /* And the profitable rungs say so in the same breath, so the column reads as one kind of statement. */
    expect(text).toContain("Profit of 69795");
  });

  it("marks which measures the plan answers and which the client set", () => {
    const l = ladder({
      measures: [
        { name: "Debtor days", unit: "days", fromPlan: true, money: false, values: [46, 46, 46] },
        { name: "Jobs won per month", unit: null, fromPlan: false, money: false, values: [4, null, null] },
      ],
    });
    l.rungs[0].goals = ["Win six more slab jobs a quarter."];
    const text = allText(input(l));
    expect(text).toContain("Debtor days (from the plan)");
    /* A target the client set must NOT be dressed up as something the plan worked out. */
    expect(text).toContain("Jobs won per month");
    expect(text).not.toContain("Jobs won per month (from the plan)");
  });

  /* Blank is not nought (§6.89): a measure with no target at a rung shows a dash, never a zero. */
  it("shows a dash where no target was set, not a nought", () => {
    const l = ladder({
      measures: [{ name: "Jobs won per month", unit: null, fromPlan: false, money: false, values: [4, null, null] }],
    });
    l.rungs[0].goals = ["Win six more slab jobs a quarter."];
    const rows = JSON.stringify(goalsAndMilestones(input(l)));
    expect(rows).toContain('"—"');
    expect(rows).not.toContain('"0"');
  });

  /*
   * THE SENTENCE THAT STOPS THE TABLE BEING MISREAD. Nothing in the horizon table was typed by anybody,
   * and a reader who assumes otherwise has been told the business promised something it did not.
   */
  it("tells the reader the horizon figures come from the forecast, not from targets", () => {
    const l = ladder();
    l.rungs[2].goals = ["The concreter builders in the region ring first."];
    expect(allText(input(l))).toContain("read from this plan's own forecast");
  });

  it("carries the big goal and the north star when they are written, and neither when they are not", () => {
    const bare = ladder();
    bare.rungs[0].goals = ["Hold cash above 50,000 every month."];
    expect(allText(input(bare))).not.toContain("steers by");

    const full = ladder({
      bigGoal: "We will be the concreter builders in South East Queensland ring first.",
      northStar: { metric: "slabs poured on the promised date", value: "98%", why: "It is the only thing a builder remembers." },
    });
    full.rungs[0].goals = ["Hold cash above 50,000 every month."];
    const text = allText(input(full));
    expect(text).toContain("South East Queensland");
    expect(text).toContain("slabs poured on the promised date");
    expect(text).toContain("98%");
    expect(text).toContain("It is the only thing a builder remembers.");
  });

  /** A 90-day goal with nobody's name on it still prints — as a dash, so the gap is visible (§6.88). */
  it("prints the ninety-day list with its gaps showing", () => {
    const l = ladder({
      ninetyEndsOn: "2026-12-31",
      ninety: [
        { title: "Agree 30-day terms with the two main concrete suppliers", area: "Financial", owner: "John Frankel", due: "2026-11-30", status: "in_progress" },
        { title: "Review the marketing plan", area: null, owner: null, due: null, status: "not_started" },
      ],
    });
    const text = allText(input(l));
    expect(text).toContain("31 December 2026");
    expect(text).toContain("John Frankel");
    expect(text).toContain("Agree 30-day terms");
    expect(text).toContain('"—"');
  });

  /* The dates are the plan's, written the way a person says them — never the ISO the database holds. */
  it("writes the horizon dates in words", () => {
    const l = ladder();
    l.rungs[0].goals = ["Hold cash above 50,000 every month."];
    const text = allText(input(l));
    expect(text).toContain("30 June 2027");
    expect(text).not.toContain("2027-06-30");
  });
});
