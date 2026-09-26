import { describe, expect, it } from "vitest";
import { pieceFromLine, requestBody, searchBody, readSearchReply } from "./provider";
import { buildMessages, tidyDraft } from "@/engine/ai/prompt";
import { planDraft, type DraftableField } from "@/engine/ai/draft";
import type { ReportInput } from "@/engine/report/build";

const messages = [{ role: "system" as const, content: "s" }, { role: "user" as const, content: "u" }];

describe("what is actually sent", () => {
  /*
   * THE ASSERTION THIS FILE EXISTS FOR (§6.105.3). Zero retention is set per request rather than in a
   * dashboard, so it is checkable — and this is the check.
   */
  it("asks for a zero-retention endpoint on every request", () => {
    expect(requestBody(messages).provider).toEqual({ zdr: true });
  });

  it("streams, so there is never a blank wait to explain", () => {
    expect(requestBody(messages).stream).toBe(true);
  });

  it("carries no client data in the attribution headers", () => {
    /* Referer and Title are constants in the module; the body is the only thing carrying the plan. */
    const body = JSON.stringify(requestBody(messages));
    expect(body).not.toContain("bizplanhq.com");
  });
});

describe("reading the stream", () => {
  it("takes the text out of a frame", () => {
    expect(pieceFromLine('data: {"choices":[{"delta":{"content":"We pour"}}]}')).toBe("We pour");
  });

  it("ignores the end marker, keep-alives and comments", () => {
    expect(pieceFromLine("data: [DONE]")).toBeNull();
    expect(pieceFromLine(": keep-alive")).toBeNull();
    expect(pieceFromLine("")).toBeNull();
  });

  /* Half a frame arrives all the time; it must not throw and must not emit half a word as if it were whole. */
  it("survives a partial frame rather than throwing", () => {
    expect(pieceFromLine('data: {"choices":[{"delta":{"cont')).toBeNull();
  });

  it("passes a frame with no text through as nothing", () => {
    expect(pieceFromLine('data: {"choices":[{"delta":{}}]}')).toBeNull();
  });
});

describe("the passage that comes back", () => {
  it("strips a preamble the model was told not to write", () => {
    expect(tidyDraft("Here is a draft:\nWe pour and finish concrete.")).toBe("We pour and finish concrete.");
    expect(tidyDraft("Draft: We pour and finish concrete.")).toBe("We pour and finish concrete.");
  });

  it("unwraps a whole passage in quotes", () => {
    expect(tidyDraft('"We pour and finish concrete."')).toBe("We pour and finish concrete.");
  });

  /* A quotation the client would want kept is not the same as the model quoting itself. */
  it("leaves a quotation inside the passage alone", () => {
    const s = 'Builders tell us "you never miss a pour date", and we plan to keep it that way.';
    expect(tidyDraft(s)).toBe(s);
  });
});

const input = (): ReportInput => ({
  businessName: "BNE Concreting",
  productsServices: "We pour and finish residential concrete for builders.",
  noun: { one: "service", many: "Services", head: "Service", aOne: "a service" },
  currency: "AUD", money: (v: number) => String(v),
  profile: { established: null, industry: "Commercial concreting", country: "Australia", legalStructure: null, customerType: null, productType: null, taxRegion: null, tagline: null, contactEmail: null, website: null },
  framework: { vision: null, mission: null, purpose: null, brandPromise: null, fieldOfPlay: null },
  productLines: [], segments: [], competitors: [],
  market: { size: null, trends: null, positioning: null, brandValues: null, brandPersonality: null, visualIdentity: null, salesProcess: null, salesTeam: null },
  position: { ourAdvantage: null, barriers: null, futureThreats: null },
  operations: { premises: [], suppliers: [], steps: [], capacity: { operatingHours: null, capacityNow: null, capacityConstraint: null, capacityPlan: null, qualityApproach: null } },
  keyPeople: [{ name: "LEAKEDNAME", position: null, role: null, startYear: 1, salaries: [999999] }],
  people: [], capabilities: [], owners: [], overheads: [], historic: null, capital: [],
} as unknown as ReportInput);

const mission: DraftableField = {
  key: "mission", label: "Mission", sub: "what you do, for whom, every day",
  hint: "One to three sentences on your purpose now, who you serve and how you work.",
  placeholder: "e.g. We pour, finish and guarantee concrete for builders.",
  wants: ["profile", "overview", "whatYouSell"],
};

describe("the brief the model is given", () => {
  const built = () => buildMessages(mission, planDraft(input(), mission), [
    { question: "What are the main things you sell?", answer: "House slabs and driveways." },
    { question: "Who are your main customers?", answer: "   " },
  ]);

  it("is built from the field's own words, not a hand-written prompt", () => {
    const user = built()[1].content;
    expect(user).toContain("Mission — what you do, for whom, every day");
    expect(user).toContain(mission.hint!);
  });

  it("tells the model not to copy the placeholder, and drops the 'e.g.'", () => {
    const user = built()[1].content;
    expect(user).toContain("do not copy it");
    expect(user).not.toContain("e.g. We pour");
  });

  it("separates what the plan holds from what the owner just typed", () => {
    const user = built()[1].content;
    expect(user.indexOf("WHAT THE PLAN ALREADY SAYS")).toBeLessThan(user.indexOf("WHAT THE OWNER HAS JUST TOLD US"));
    expect(user).toContain("House slabs and driveways.");
  });

  it("leaves out a question the client did not answer", () => {
    expect(built()[1].content).not.toContain("Who are your main customers?");
  });

  it("forbids inventing facts, which is the rule that matters most", () => {
    expect(built()[0].content).toContain("never invent");
  });

  /* The redaction rule holds all the way to the wire, not just at the slice boundary. */
  it("carries no person and no wage into the message", () => {
    const whole = built().map((m) => m.content).join("\n");
    expect(whole).not.toContain("LEAKEDNAME");
    expect(whole).not.toContain("999999");
  });
});

describe("the one call that searches the web (§6.130)", () => {
  const body = searchBody([{ role: "user", content: "x" }], "m");
  it("is still zero-retention for the model", () => expect(body.provider).toEqual({ zdr: true }));
  it("names one search engine rather than whatever the model offers", () => expect(body.plugins).toEqual([{ id: "web", engine: "exa", max_results: 8 }]));
  it("is answered whole, not streamed", () => expect(body.stream).toBe(false));
  it("keeps only URLs the search itself cited", () => {
    const r = readSearchReply({ choices: [{ message: { content: "{}", annotations: [
      { type: "url_citation", url_citation: { url: "https://a.com" } }, { type: "file", url_citation: { url: "https://no.com" } }, { type: "url_citation" },
    ] } }] });
    expect(r).toEqual({ text: "{}", cited: ["https://a.com"] });
  });
  it("reads a broken reply as empty", () => expect(readSearchReply(null)).toEqual({ text: "", cited: [] }));
});
