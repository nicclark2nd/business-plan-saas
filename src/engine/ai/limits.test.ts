import { describe, expect, it } from "vitest";
import { MAX_ANSWERS, MAX_ANSWER_CHARS, MAX_ROW_CHARS, boundAnswers, boundRow } from "./limits";

describe("bounding what a draft request carries", () => {
  const ok = (n: number) => Array.from({ length: n }, (_, i) => ({ question: `q${i}`, answer: `a${i}` }));

  it("passes a normal request through unchanged", () => {
    expect(boundAnswers(ok(3))).toEqual(ok(3));
  });

  it("caps how many answers one request may carry", () => {
    expect(boundAnswers(ok(5000))).toHaveLength(MAX_ANSWERS);
  });

  /* The amplification that mattered: one enormous string, not many small ones. */
  it("caps how long a single answer may be", () => {
    const [a] = boundAnswers([{ question: "q", answer: "x".repeat(5_000_000) }]);
    expect(a.answer.length).toBe(MAX_ANSWER_CHARS);
  });

  it("never throws on a body that is the wrong shape", () => {
    for (const junk of [null, undefined, "hello", 42, {}, [null], [1, 2], [{ answer: 5 }]]) {
      expect(() => boundAnswers(junk)).not.toThrow();
      expect(Array.isArray(boundAnswers(junk))).toBe(true);
    }
    expect(boundAnswers([{ answer: 5 }])).toEqual([{ question: "", answer: "" }]);
  });

  it("bounds the row name too", () => {
    expect(boundRow("y".repeat(10_000))).toHaveLength(MAX_ROW_CHARS);
    expect(boundRow(undefined)).toBe("");
    expect(boundRow({ nope: true })).toBe("");
  });
});
