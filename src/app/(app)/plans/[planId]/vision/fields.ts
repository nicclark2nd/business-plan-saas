export const VISION_FIELDS = [
  { key: "vision", n: 1, label: "Vision", sub: "where the business is going", hint: "One sentence, about the future. What does the business look like in five years if the plan works? Not what it does today \u2014 that is Mission.", placeholder: "e.g. To be the Illawarra's first-choice concreter for residential slabs and decorative work." },
  { key: "mission", n: 2, label: "Mission", sub: "what you do, for whom, every day", hint: "One to three sentences on your purpose now, who you serve and how you work. Not the list of what you sell \u2014 that is About what you sell, in Plan settings.", placeholder: "e.g. We pour, finish and guarantee residential and light-commercial concrete for builders and homeowners across the South Coast." },
  { key: "purpose", n: 3, label: "Purpose", sub: "why the business exists beyond profit", placeholder: "e.g. To give local tradespeople a company worth building a career in." },
  { key: "brand_promise", n: 4, label: "Brand promise", sub: "what you guarantee every customer, every time", hint: "A commitment you would honour at your own cost. Not what makes you better than the competition — that is Our advantage, on the Competitors step.", placeholder: "e.g. Quoted price is the final price. If we miss the pour date we wear the standing cost." },
  { key: "ai_direction", n: 5, label: "AI direction", sub: "how the business will use AI", hint: "Even \"we won't yet, and here's why\" is a valid answer.", placeholder: "e.g. Quoting from site photos; automated job scheduling; supplier price monitoring." },
  { key: "field_of_play", n: 6, label: "Field of play", sub: "what you will and won't do", placeholder: "e.g. Residential and light-commercial work within 90 minutes of Wollongong. Not: civil, high-rise, or interstate." },
  /**
   * SELLING THE BUSINESS (§6.129), and the one statement on this page AI must not write.
   *
   * Everything above is a claim about the business that a model can draft badly and a client can then fix.
   * This is a statement about the OWNER'S intentions — whether they want out, roughly when, and who they
   * would sell to — and nothing in the plan implies it. A drafted answer here would be invention presented
   * as the client's own position, in a document a buyer or a bank reads, so the field carries `draftable:
   * false` and grows no button.
   *
   * The NUMBERS that follow from it — an asking price, owner add-backs, what comparable businesses sold for
   * — are in Plan settings → Exit & sale. This is the intention; those are the arithmetic.
   */
  { key: "exit_intention", n: 7, label: "Selling the business", sub: "whether, roughly when, and to whom", draftable: false, hint: "“No plans to sell” is a complete answer and a useful one — it tells a lender the owner is staying. If a sale is the plan, say who would buy it: a competitor, a manager, family. That changes what needs fixing first.", placeholder: "e.g. Aiming to sell to a larger civil contractor in about five years, once the business runs without me on site." },
] as const;

export type VisionKey = (typeof VISION_FIELDS)[number]["key"];
export type VisionValues = Record<VisionKey, string>;

/**
 * Whether AI may offer a draft of this statement. Default yes; `draftable: false` is a deliberate refusal,
 * not an oversight, and the field that carries it says why.
 */
export const visionDraftable = (f: (typeof VISION_FIELDS)[number]) => ("draftable" in f ? f.draftable !== false : true);
