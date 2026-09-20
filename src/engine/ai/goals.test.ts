import { describe, expect, it } from "vitest";
import type { ReportInput } from "@/engine/report/build";
import { GOAL_MARK, buildGoalMessages, goalsReadiness, parseGoals } from "./goals";

/**
 * THE PARSER IS THE RISKY PART (§6.115).
 *
 * Six passages arrive in one stream, told apart by a marker, and they are parsed WHILE THEY ARE STILL
 * ARRIVING so the panel fills in as the model writes. So every state a half-finished stream can be in is a
 * state the parser has to survive, and a model that fumbles one area must cost the client that area rather
 * than the whole set.
 */
describe("parsing six goals out of one stream", () => {
  const whole = [
    `${GOAL_MARK("financial")}`, "Lift revenue to 712,000 in year two.",
    `${GOAL_MARK("management")}`, "Hold a monthly review with the crew leaders.",
    `${GOAL_MARK("marketing")}`, "Be the first concreter builders in Gladstone ring.",
    `${GOAL_MARK("sales")}`, "Win six more slab jobs a quarter.",
    `${GOAL_MARK("operational")}`, "Add a third crew without losing the pour-date guarantee.",
    `${GOAL_MARK("ai")}`, "Put quoting on software so a quote leaves the same day.",
  ].join("\n");

  it("reads all six", () => {
    const g = parseGoals(whole);
    expect(Object.keys(g)).toHaveLength(6);
    expect(g.financial).toBe("Lift revenue to 712,000 in year two.");
    expect(g.ai).toBe("Put quoting on software so a quote leaves the same day.");
  });

  /* The reason the marker beats JSON: half a document is still readable. */
  it("reads what has arrived so far, and nothing it has not", () => {
    const half = whole.slice(0, whole.indexOf("Be the first"));
    const g = parseGoals(half);
    expect(g.financial).toBeTruthy();
    expect(g.management).toBeTruthy();
    expect(g.marketing).toBeUndefined();
    expect(g.sales).toBeUndefined();
  });

  it("throws away a preamble the model was told not to write", () => {
    const g = parseGoals(`Here are the six goals for your plan:\n\n${whole}`);
    expect(Object.keys(g)).toHaveLength(6);
    expect(g.financial).not.toContain("Here are");
  });

  it("ignores an area that is not one of the six", () => {
    const g = parseGoals(`[[strategy]]\nSomething nobody asked for.\n${whole}`);
    expect(Object.keys(g)).toHaveLength(6);
    expect(JSON.stringify(g)).not.toContain("nobody asked for");
  });

  /*
   * A DROPPED MARKER COSTS ONE GOAL, NOT SIX. The passage merges into the one above it, which the client
   * sees and rejects; the other five are untouched and still theirs to take.
   */
  it("survives a missing marker without losing the rest", () => {
    const g = parseGoals(whole.replace(`${GOAL_MARK("sales")}\n`, ""));
    expect(g.sales).toBeUndefined();
    expect(Object.keys(g)).toHaveLength(5);
    expect(g.operational).toBe("Add a third crew without losing the pour-date guarantee.");
  });

  it("returns nothing at all rather than blanks", () => {
    expect(parseGoals("")).toEqual({});
    expect(parseGoals(`${GOAL_MARK("financial")}\n\n   \n`)).toEqual({});
  });
});

const plan = (over: Partial<ReportInput> = {}): ReportInput => ({
  businessName: "BNE Concreting",
  noun: { one: "job", many: "Jobs", head: "Job", aOne: "a job" },
  money: (v: number) => String(v),
  profile: { industry: "Concreting" }, framework: {}, market: {}, position: {},
  productLines: [], segments: [], competitors: [],
  operations: { premises: [], suppliers: [], steps: [], capacity: {} },
  forecast: { pnl: { 1: { revenue: 604800, grossMargin: 42, netProfit: 88000 } }, cashFlow: { 1: { closingCash: 51000 } } },
  ...over,
} as unknown as ReportInput);

describe("what the drafter is told", () => {
  it("quotes the forecast, because a goal set without it is a wish", () => {
    const [, user] = buildGoalMessages(plan());
    expect(user.content).toContain("604800");
    expect(user.content).toContain("42%");
  });

  it("names all six areas and the marker each must use", () => {
    const [, user] = buildGoalMessages(plan());
    for (const k of ["financial", "management", "marketing", "sales", "operational", "ai"]) {
      expect(user.content, `${k} was not offered to the model`).toContain(GOAL_MARK(k));
    }
  });

  /* A draft that ignores what the client already wrote is not help, it is a replacement nobody asked for. */
  it("shows the model what the owner has already written", () => {
    const [, user] = buildGoalMessages(plan(), [], { sales: "Stop chasing tiny jobs." });
    expect(user.content).toContain("Stop chasing tiny jobs.");
  });

  it("passes on the SWOT responses as the owner's own words", () => {
    const [, user] = buildGoalMessages(plan(), [], {}, [
      { quadrant: "threat", text: "Losing the Boral deal", response: "Get a second supplier signed." },
    ]);
    expect(user.content).toContain("Get a second supplier signed.");
  });

  it("forbids an owner and a deadline in the rules, not only in the reviewer's head", () => {
    const [system] = buildGoalMessages(plan());
    expect(system.content).toContain("NEVER name a person");
    expect(system.content).toContain("Never set a quarter or a deadline");
  });

  /*
   * BOTH OF THESE WERE FOUND BY READING A REAL DRAFT AGAINST THE PLAN'S OWN P&L (§6.115.1), not by
   * reading the draft on its own — which would have shown six confident, well-written goals.
   */
  it("says the goals are for year 1, so year 2's revenue is not quoted as this year's target", () => {
    const [system] = buildGoalMessages(plan());
    expect(system.content).toContain("FOR YEAR 1");
  });

  it("forbids describing a loss as a profit", () => {
    const [system] = buildGoalMessages(plan());
    expect(system.content).toContain("LOSS");
  });
});

describe("whether a plan is ready for goals at all", () => {
  it("is ready once there is a forecast to quote", () => {
    expect(goalsReadiness(plan()).ready).toBe(true);
  });

  /*
   * NOT AN ERROR, AND NOT A BUTTON THAT FAILS WHEN PRESSED. A plan with no numbers gets the sentence the
   * screen already believes — "a target set before the forecast exists is a wish" — and somewhere to go.
   */
  it("refuses, with a reason and a next step, when there is no forecast", () => {
    const r = goalsReadiness(plan({ forecast: { pnl: {}, cashFlow: {} } as unknown as ReportInput["forecast"] }));
    expect(r.ready).toBe(false);
    expect(r.reason).toContain("sales lines");
  });
});
