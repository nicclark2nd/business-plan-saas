import { describe, expect, it } from "vitest";
import { COPY } from "./content";

/**
 * The confidentiality statement (§6.95).
 *
 * The heart of this file is one test: the plan must never name another company. The wording arrived as a
 * finished legal notice written for one business, and the failure it invites is the most embarrassing kind
 * — a page ABOUT confidentiality, in a document handed to a bank, carrying somebody else's name.
 */
describe("the confidentiality statement", () => {
  it("names this plan's business, and no other", () => {
    const d = COPY.disclaimer("BNE Concreting");
    const all = d.parts.map((p) => p.body).join(" ");
    expect(all).toContain("strictly confidential to BNE Concreting");
    expect(all).toContain("BNE Concreting, its directors, advisors, and consultants");
    // The company the wording was originally written for must appear nowhere.
    expect(all).not.toMatch(/DesignOne/i);
  });

  it("carries the name into every plan, whatever it is called", () => {
    for (const name of ["Acme Pty Ltd", "O'Brien & Sons", "北京建筑"]) {
      const all = COPY.disclaimer(name).parts.map((p) => p.body).join(" ");
      expect(all).toContain(name);
    }
  });

  it("is the five parts, in order", () => {
    expect(COPY.disclaimer("X").parts.map((p) => p.heading)).toEqual([
      "Confidentiality & Intellectual Property",
      "No Offer or Invitation",
      "Accuracy of Information & No Liability",
      "Forward-Looking Statements & Projections",
      "Financial Data & Governing Law",
    ]);
  });

  /**
   * The source text ran two of these together — "...in these statements.Financial Data & Governing LawThe
   * financial statements..." — with a heading printed inside the paragraph above it. Split, and this is
   * what stops it being silently re-merged.
   */
  it("does not print a heading inside a paragraph", () => {
    for (const part of COPY.disclaimer("X").parts) {
      for (const other of COPY.disclaimer("X").parts) {
        expect(part.body).not.toContain(other.heading);
      }
      expect(part.body).toMatch(/^[A-Z]/);
      expect(part.body.trim()).toBe(part.body);
    }
  });

  /**
   * §6.95.1. The clause names the place the client actually chose, and says "local laws" only where they
   * have not chosen one — so the vague wording is the honest answer rather than the default one.
   */
  it("is governed by the laws of the place the plan names", () => {
    const body = (phrase?: string) =>
      COPY.disclaimer("X", phrase).parts.find((p) => p.heading === "Financial Data & Governing Law")!.body;
    expect(body("the laws of Australia")).toContain("in accordance with the laws of Australia.");
    expect(body("the laws of Texas, United States")).toContain("in accordance with the laws of Texas, United States.");
  });

  it("still says local laws when no country has been set", () => {
    const all = COPY.disclaimer("X").parts.map((p) => p.body).join(" ");
    expect(all).toContain("in accordance with local laws.");
  });

  /** One full stop, from the notice, never from the phrase. */
  it("does not double the full stop", () => {
    const body = COPY.disclaimer("X", "the laws of Australia").parts.at(-1)!.body;
    expect(body).not.toContain("..");
    expect(body.endsWith("laws of Australia.")).toBe(true);
  });
});
