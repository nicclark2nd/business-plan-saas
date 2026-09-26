import { describe, it, expect } from "vitest";
import { groupDigits } from "./grouped";

describe("groupDigits", () => {
  it("groups thousands", () => {
    expect(groupDigits("1000000")).toBe("1,000,000");
    expect(groupDigits("85000")).toBe("85,000");
    expect(groupDigits("999")).toBe("999");
  });
  it("keeps decimals as typed", () => {
    expect(groupDigits("1234567.5")).toBe("1,234,567.5");
    expect(groupDigits("1000.")).toBe("1,000.");
  });
  it("normalises pasted money", () => {
    expect(groupDigits("$1,000,000")).toBe("1,000,000");
    expect(groupDigits(" 1 000 000 ")).toBe("1,000,000");
  });
  it("handles a minus", () => expect(groupDigits("-76054")).toBe("-76,054"));
  it("leaves blank blank (§6.89)", () => expect(groupDigits("")).toBe(""));
  it("never tidies something that is not a number", () => {
    expect(groupDigits("1m")).toBe("1m");
    expect(groupDigits("abc")).toBe("abc");
  });
});
