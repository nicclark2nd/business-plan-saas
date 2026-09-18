import { describe, expect, it } from "vitest";
import { checkEmail, checkWebsite, contactLine, websiteForPrint, websiteHref } from "./contact";

/**
 * The contact details printed on the cover (§6.96). Two ideas run through all of it: what a client typed is
 * theirs and is stored as typed, and what is PRINTED is tidied — and an empty field never leaves a mark.
 */
describe("contact email", () => {
  it("takes an ordinary address", () => {
    expect(checkEmail("hello@example.com")).toEqual({ ok: true, value: "hello@example.com" });
    expect(checkEmail("  nic@sub.domain.com.au  ")).toEqual({ ok: true, value: "nic@sub.domain.com.au" });
    expect(checkEmail("first.last+plan@example.co")).toEqual({ ok: true, value: "first.last+plan@example.co" });
  });

  it("treats empty as an answer, not an error — the field is optional", () => {
    expect(checkEmail("")).toEqual({ ok: true, value: null });
    expect(checkEmail("   ")).toEqual({ ok: true, value: null });
    expect(checkEmail(null)).toEqual({ ok: true, value: null });
  });

  it("refuses what is plainly not an address", () => {
    for (const bad of ["nic", "nic@", "@example.com", "nic example.com", "nic@example"]) {
      expect(checkEmail(bad).ok).toBe(false);
    }
  });
});

describe("website", () => {
  it("keeps what the client typed", () => {
    expect(checkWebsite("https://www.example.com/plan")).toEqual({ ok: true, value: "https://www.example.com/plan" });
    expect(checkWebsite("example.com")).toEqual({ ok: true, value: "example.com" });
  });

  it("refuses something with no domain in it", () => {
    for (const bad of ["example", "http://example", "my web site", "."]) {
      expect(checkWebsite(bad).ok).toBe(false);
    }
  });

  /** A cover is read, not clicked: the scheme, the www and the trailing slash are punctuation nobody needs. */
  it("prints bare", () => {
    expect(websiteForPrint("https://www.actioncoach.com/")).toBe("actioncoach.com");
    expect(websiteForPrint("http://example.com")).toBe("example.com");
    expect(websiteForPrint("WWW.Example.com")).toBe("Example.com");
    expect(websiteForPrint("example.com/plan")).toBe("example.com/plan");
    expect(websiteForPrint(null)).toBeNull();
  });

  it("is clickable on the screen, where it IS clicked", () => {
    expect(websiteHref("example.com")).toBe("https://example.com");
    expect(websiteHref("http://example.com")).toBe("http://example.com");
    expect(websiteHref(null)).toBeNull();
  });
});

describe("the line at the foot of the cover", () => {
  it("joins the two with a middle dot", () => {
    expect(contactLine("hello@example.com", "https://www.example.com")).toBe("hello@example.com · example.com");
  });

  /** The point of the function: one field set must not print a stray separator. */
  it("prints one on its own without a dangling dot", () => {
    expect(contactLine("hello@example.com", null)).toBe("hello@example.com");
    expect(contactLine(null, "example.com")).toBe("example.com");
    expect(contactLine("", "  ")).toBeNull();
  });

  it("is nothing at all when neither is set", () => {
    expect(contactLine(null, null)).toBeNull();
  });
});
