import { describe, it, expect } from "vitest";
import { buildSuggestions } from "./suggest";

const base = {
  competitors: [], position: { our_advantage: null, barriers_to_entry: null, future_threats: null, market_trends: null },
  people: [{ id: "a", name: "Jo Smith", role: "owner" }, { id: "b", name: "Sam Lee", role: "employee" }], capabilities: [],
};
const row = (over: Partial<{ person_id: string; dependency: string; successor_person_id: string | null; successor_external: boolean }>) =>
  ({ person_id: "a", dependency: "high", successor_person_id: null, successor_external: false, ...over });

describe("the succession weakness is back with its editor (§6.146)", () => {
  const succession = (s: ReturnType<typeof row>[]) => buildSuggestions({ ...base, succession: s }).filter((x) => x.key.startsWith("succession:"));

  it("offers a High dependency with no successor, citing the screen that holds it", () => {
    expect(succession([row({})])).toEqual([{ key: "succession:a", quadrant: "weakness",
      text: "The business depends heavily on Jo Smith and no successor is identified", from: "Leadership Team · Risk & Succession" }]);
  });
  it("stays quiet once someone would step in, inside or out", () => {
    expect(succession([row({ successor_person_id: "b" })])).toEqual([]);
    expect(succession([row({ successor_external: true })])).toEqual([]);
  });
  it("stays quiet below High, and for a person no longer on the team", () => {
    expect(succession([row({ dependency: "medium" })])).toEqual([]);
    expect(succession([row({ person_id: "gone" })])).toEqual([]);
  });
});
