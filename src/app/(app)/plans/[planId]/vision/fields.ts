export const VISION_FIELDS = [
  { key: "vision", n: 1, label: "Vision", sub: "where the business is going", hint: "One sentence, about the future. What does the business look like in five years if the plan works? Not what it does today \u2014 that is Mission.", placeholder: "e.g. To be the Illawarra's first-choice concreter for residential slabs and decorative work." },
  { key: "mission", n: 2, label: "Mission", sub: "what you do, for whom, every day", hint: "One to three sentences on your purpose now, who you serve and how you work. Not the list of what you sell \u2014 that is About what you sell, in Plan settings.", placeholder: "e.g. We pour, finish and guarantee residential and light-commercial concrete for builders and homeowners across the South Coast." },
  { key: "purpose", n: 3, label: "Purpose", sub: "why the business exists beyond profit", placeholder: "e.g. To give local tradespeople a company worth building a career in." },
  { key: "brand_promise", n: 4, label: "Brand promise", sub: "what you guarantee every customer, every time", hint: "A commitment you would honour at your own cost. Not what makes you better than the competition — that is Our advantage, on the Competitors step.", placeholder: "e.g. Quoted price is the final price. If we miss the pour date we wear the standing cost." },
  { key: "ai_direction", n: 5, label: "AI direction", sub: "how the business will use AI", hint: "Even \"we won't yet, and here's why\" is a valid answer.", placeholder: "e.g. Quoting from site photos; automated job scheduling; supplier price monitoring." },
  { key: "field_of_play", n: 6, label: "Field of play", sub: "what you will and won't do", placeholder: "e.g. Residential and light-commercial work within 90 minutes of Wollongong. Not: civil, high-rise, or interstate." },
] as const;

export type VisionKey = (typeof VISION_FIELDS)[number]["key"];
export type VisionValues = Record<VisionKey, string>;
