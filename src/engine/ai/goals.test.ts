import { describe, expect, it } from "vitest";
import type { ReportInput } from "@/engine/report/build";
import { GOAL_MARK, buildGoalMessages, goalsReadiness, parseGoals } from "./goals";

/**
 * THE PARSER IS THE RISKY PART (§6.115, §6.125).
 *
 * Three lists arrive in one stream, told apart by a marker, and they are parsed WHILE THEY ARE STILL
 * ARRIVING so the panel fills in as the model writes. So every state a half-finished stream can be in is a
 * state the parser has to survive, and a model that fumbles one rung must cost the client that rung rather
 * than the whole ladder.
 */
describe("parsing the ladder out of one stream", () => {
  const whole = [
    `${GOAL_MARK("year1")}`,
    "Turn the year one operating loss into a monthly profit.",
    "Win six more slab jobs a quarter.",
    `${GOAL_MARK("year3")}`,
    "Three crews running, with the pour-date guarantee intact.",
    `${GOAL_MARK("year5")}`,
    "The concreter builders in the region ring first.",
  ].join("\n");

  it("reads all three rungs", () => {
    const g = parseGoals(whole);
    expect(Object.keys(g)).toHaveLength(3);
    expect(g.year1).toContain("operating loss");
    expect(g.year5).toBe("The concreter builders in the region ring first.");
  });

  /**
   * ONE LINE IS ONE GOAL, and that is a contract between this parser and the screen. The screen splits a
   * rung on newlines to create a row per line, so a rung holding two goals must come back as two LINES —
   * not as one paragraph the client would then have to break up by hand.
   */
  it("keeps one goal per line, so the screen can make a row of each", () => {
    expect(parseGoals(whole).year1?.split("\n")).toEqual([
      "Turn the year one operating loss into a monthly profit.",
      "Win six more slab jobs a quarter.",
    ]);
  });

  /*
   * A RULE IN A SYSTEM MESSAGE IS A REQUEST, NOT A GUARANTEE. The prompt forbids bullets; this is what
   * decides what the client actually sees. A stray "- " left in would be saved into the plan as part of
   * the goal's own wording and printed that way in the report.
   */
  it("strips a bullet or a number the model was told not to write", () => {
    const g = parseGoals(`${GOAL_MARK("year1")}\n- Win six more slab jobs.\n2) Hold margin at 32%.`);
    expect(g.year1).toBe("Win six more slab jobs.\nHold margin at 32%.");
  });

  /* The reason the marker beats JSON: half a document is still readable. */
  it("reads what has arrived so far, and nothing it has not", () => {
    const half = whole.slice(0, whole.indexOf("Three crews"));
    const g = parseGoals(half);
    expect(g.year1).toBeTruthy();
    expect(g.year3).toBeUndefined();
    expect(g.year5).toBeUndefined();
  });

  it("throws away a preamble the model was told not to write", () => {
    const g = parseGoals(`Here is the ladder for your plan:\n\n${whole}`);
    expect(Object.keys(g)).toHaveLength(3);
    expect(g.year1).not.toContain("Here is");
  });

  it("ignores a rung that is not one of the three", () => {
    const g = parseGoals(`[[year10]]\nSomething nobody asked for.\n${whole}`);
    expect(Object.keys(g)).toHaveLength(3);
    expect(JSON.stringify(g)).not.toContain("nobody asked for");
  });

  /**
   * THE 90 DAYS ARE NOT DRAFTED AT ALL (§6.125), so a model that offers them is ignored rather than
   * obeyed. Every line on that rung carries a name and a date, which makes it a commitment — and a
   * commitment is not a model's to invent.
   */
  it("refuses a 90-day list even when the model writes one", () => {
    const g = parseGoals(`${GOAL_MARK("ninety")}\nRing every builder by Friday.\n${whole}`);
    expect(g.ninety).toBeUndefined();
    expect(JSON.stringify(g)).not.toContain("Ring every builder");
  });

  /*
   * A DROPPED MARKER COSTS ONE RUNG, NOT THREE. The passage merges into the one above it, which the client
   * sees and rejects; the others are untouched and still theirs to take.
   */
  it("survives a missing marker without losing the rest", () => {
    const g = parseGoals(whole.replace(`${GOAL_MARK("year3")}\n`, ""));
    expect(g.year3).toBeUndefined();
    expect(Object.keys(g)).toHaveLength(2);
    expect(g.year5).toBe("The concreter builders in the region ring first.");
  });

  it("returns nothing at all rather than blanks", () => {
    expect(parseGoals("")).toEqual({});
    expect(parseGoals(`${GOAL_MARK("year1")}\n\n   \n`)).toEqual({});
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

  it("names all three rungs and the marker each must use", () => {
    const [, user] = buildGoalMessages(plan());
    for (const k of ["year1", "year3", "year5"]) {
      expect(user.content, `${k} was not offered to the model`).toContain(GOAL_MARK(k));
    }
  });

  /** The 90-day rung is never offered, so the model is never in a position to fill it. */
  it("never offers the 90-day rung", () => {
    const [, user] = buildGoalMessages(plan());
    expect(user.content).not.toContain(GOAL_MARK("ninety"));
  });

  /* A draft that ignores what the client already wrote is not help, it is a replacement nobody asked for. */
  it("shows the model what the owner has already written at a rung", () => {
    const [, user] = buildGoalMessages(plan(), [], { year1: "Stop chasing tiny jobs." });
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
    expect(system.content).toContain("Never set a deadline");
  });

  /*
   * BOTH OF THESE WERE FOUND BY READING A REAL DRAFT AGAINST THE PLAN'S OWN P&L (§6.115.1), not by
   * reading the draft on its own — which would have shown confident, well-written goals.
   *
   * The year rule had to CHANGE with the ladder rather than simply survive it: pinning every goal to year
   * 1 was right when there was one rung and wrong the moment there were three, because the 5-year list is
   * supposed to quote year 5. What the rule protects is unchanged — a figure must belong to the year it
   * is quoted against.
   */
  it("pins each rung to its own year, so year 3's revenue is never quoted as this year's target", () => {
    const [system] = buildGoalMessages(plan());
    expect(system.content).toContain("EACH RUNG IS ITS OWN YEAR");
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
