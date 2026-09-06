import type { Suggestion } from "./model";

/**
 * Builds SWOT suggestions from what the plan already says, in the owner's own words. No AI, no invention:
 * every line traces to a field the user typed. Only offered — nothing enters the SWOT without a click.
 */
type Competitor = { id: string; name: string; threat: string; weaknesses: string | null; strengths: string | null; how_we_win: string | null };
type Position = { our_advantage: string | null; barriers_to_entry: string | null; future_threats: string | null; market_trends: string | null };
type Person = { id: string; name: string; role: string };
type Capability = { person_id: string; kind: string; description: string };
type Succession = { person_id: string; dependency: string; successor_person_id: string | null; successor_external: boolean };

const sentences = (t: string | null | undefined) => (t ?? "").split(/(?<=[.;!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 3);

export function buildSuggestions(p: { competitors: Competitor[]; position: Position; people: Person[]; capabilities: Capability[]; succession: Succession[] }): Suggestion[] {
  const out: Suggestion[] = [];
  const first = (t: string | null | undefined) => sentences(t)[0];

  // Strengths: our advantage, barriers to entry, how we win
  if (first(p.position.our_advantage)) out.push({ key: "position:advantage", quadrant: "strength", text: first(p.position.our_advantage)!, from: "Competitors · Our position" });
  if (first(p.position.barriers_to_entry)) out.push({ key: "position:barriers", quadrant: "strength", text: first(p.position.barriers_to_entry)!, from: "Competitors · Our position" });
  for (const c of p.competitors) if (first(c.how_we_win)) out.push({ key: `competitor:${c.id}:win`, quadrant: "strength", text: `${first(c.how_we_win)} (vs ${c.name})`, from: "Competitors" });

  // Weaknesses: development areas, high dependency without a successor
  for (const cap of p.capabilities) if (cap.kind === "development") {
    const who = p.people.find((x) => x.id === cap.person_id)?.name ?? "A key person";
    out.push({ key: `capability:${cap.person_id}:${cap.description.slice(0, 40)}`, quadrant: "weakness", text: `${who}: ${cap.description}`, from: "Leadership Team · Roles & Capability" });
  }
  for (const s of p.succession) if (s.dependency === "high" && !s.successor_person_id && !s.successor_external) {
    const who = p.people.find((x) => x.id === s.person_id)?.name ?? "A key person";
    out.push({ key: `succession:${s.person_id}`, quadrant: "weakness", text: `The business depends heavily on ${who} and no successor is identified`, from: "Leadership Team · Risk & Succession" });
  }
  if (p.people.length === 1) out.push({ key: "people:solo", quadrant: "weakness", text: "One-person leadership team — the plan rests on a single individual", from: "Leadership Team" });

  // Opportunities: competitors' weaknesses, market trends
  for (const c of p.competitors) if (first(c.weaknesses)) out.push({ key: `competitor:${c.id}:weak`, quadrant: "opportunity", text: `${c.name}: ${first(c.weaknesses)}`, from: "Competitors" });
  for (const [i, t] of sentences(p.position.market_trends).slice(0, 3).entries()) out.push({ key: `market:trend:${i}`, quadrant: "opportunity", text: t, from: "Marketing · Market" });

  // Threats: what could change, high/critical competitors
  for (const [i, t] of sentences(p.position.future_threats).slice(0, 4).entries()) out.push({ key: `position:change:${i}`, quadrant: "threat", text: t, from: "Competitors · Our position" });
  for (const c of p.competitors) if (c.threat === "high" || c.threat === "critical") out.push({ key: `competitor:${c.id}:threat`, quadrant: "threat", text: `${c.name} — rated a ${c.threat} threat${first(c.strengths) ? `: ${first(c.strengths)}` : ""}`, from: "Competitors" });

  return out;
}
