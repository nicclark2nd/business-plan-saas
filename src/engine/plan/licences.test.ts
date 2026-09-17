import { describe, expect, it } from "vitest";
import { licenceState, formatExpiry, RENEWAL_WINDOW_DAYS } from "./licences";

const TODAY = "2026-09-17";

describe("licenceState", () => {
  it("says nothing about a licence with no expiry — plenty of registrations never run out", () => {
    expect(licenceState(null, TODAY)).toBe("no-expiry");
    expect(licenceState("", TODAY)).toBe("no-expiry");
    expect(licenceState("   ", TODAY)).toBe("no-expiry");
  });

  it("calls yesterday lapsed and today current", () => {
    expect(licenceState("2026-09-16", TODAY)).toBe("lapsed");
    expect(licenceState("2026-09-17", TODAY)).toBe("soon");
  });

  it("does not flag an annual renewal all year, which is the whole point", () => {
    // A licence renewed every year is ALWAYS inside twelve months of expiring. Eleven months out is quiet.
    expect(licenceState("2027-08-17", TODAY)).toBe("current");
    expect(licenceState("2026-12-25", TODAY)).toBe("current");
  });

  it("opens the renewal window exactly at the boundary, and not a day before it", () => {
    const iso = (offsetDays: number) =>
      new Date(Date.UTC(2026, 8, 17) + offsetDays * 86_400_000).toISOString().slice(0, 10);
    expect(licenceState(iso(RENEWAL_WINDOW_DAYS), TODAY)).toBe("soon");
    expect(licenceState(iso(RENEWAL_WINDOW_DAYS + 1), TODAY)).toBe("current");
  });

  it("classifies the same way whichever timezone the reader is in", () => {
    expect(licenceState("2026-09-18", "2026-09-17T23:30:00.000Z")).toBe("soon");
    expect(licenceState("2026-09-18", "2026-09-17T00:30:00.000Z")).toBe("soon");
  });

  it("ignores a date it cannot read rather than guessing", () => {
    expect(licenceState("next March", TODAY)).toBe("no-expiry");
  });
});

describe("formatExpiry", () => {
  it("prints the day, because a licence lapses on one", () => {
    expect(formatExpiry("2026-03-03")).toBe("3 Mar 2026");
    expect(formatExpiry("2027-12-31")).toBe("31 Dec 2027");
  });
  it("is empty when there is no date to print", () => {
    expect(formatExpiry(null)).toBe("");
    expect(formatExpiry("nope")).toBe("");
  });
});
