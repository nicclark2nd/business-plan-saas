import type { Message } from "./prompt";

/**
 * WHAT SIMILAR BUSINESSES SOLD FOR (§6.130).
 *
 * Nic: most owners would not know a comparable multiple, so if the app is going to ask for one, the AI
 * should search for it from the Business Profile and enter it. This is that search, and it is the first
 * thing in the app that lets a model supply a FACT rather than wording. Market size stayed undraftable for
 * exactly that reason (§6.105), so the rules here are the ones that make a searched figure defensible:
 *
 * 1. **ONLY WHAT A SEARCH ENGINE MAY SEE LEAVES THE BUILDING.** The model forms the search from the whole
 *    request, so the request holds only an industry, a country and a revenue band. No business name, no
 *    products statement, no figure. There is nothing else in it to leak into a query.
 * 2. **A SOURCE IS ONLY A SOURCE IF THE SEARCH RETURNED IT.** A URL the model names that is not among the
 *    pages the search actually cited is dropped. A model will write a plausible broker's address.
 * 3. **EBITDA OR NOTHING.** The price dial divides by normalised EBITDA. Most published small-business
 *    multiples are on SDE — owner earnings with the owner's pay still in — and read lower for the same
 *    business. Averaging the two would move the dial the wrong way, so anything else is set aside and the
 *    client is told how many were.
 * 4. **TWO SITES OR NO RANGE.** One broker's blog is an opinion. Two different sites agreeing is a range.
 *    Short of that the answer is "couldn't find reliable figures", never a guess.
 *
 * §6.143, after nine live searches (Open_Items 42): a miss came from the country or the niche, never from SDE,
 * and a hit could still rest on a LinkedIn post or a mid-market deals report. So:
 *
 * 5. **ON A MISS, ONE WIDER SEARCH, SAID OUT LOUD.** The wider sector, and the one market written down
 *    below as close enough — never one the model picks. Its first live run offered Thailand for a New
 *    Zealand cafe. Each wider figure must name its market, and one outside those countries is dropped. The
 *    card says it widened; a wider comparable is never shown as a close one.
 * 6. **A POST IS NOT A PUBLICATION.** Social and forum hosts are not sources, however they are cited.
 * 7. **SIZE, NOT ONLY COUNT.** A figure the model marks as a larger deal — mid-market, private equity, a
 *    listed company — is left out and counted, because those sell at multiples a small business will not.
 *
 * 8. **SDE IS CONVERTED, IN THE OPEN, OR SET ASIDE (§6.145).** Owner earnings (SDE) are earnings before one
 *    owner is paid, so the same price is a smaller multiple of SDE than of EBITDA. With this plan's own
 *    normalised EBITDA for the sale year (E) and one owner's pay that year (P), SDE is E + P, and an SDE
 *    multiple m is m × (E + P) / E in EBITDA terms. One owner, not the leadership team: that is what SDE
 *    adds back. The owner is the largest shareholder on the payroll, or the only person on it; with
 *    neither, or with E not positive, nothing is converted and the card says what would allow it. Every
 *    converted figure keeps its SDE numbers and the factor, so the card and the report show the working.
 *
 * Pure: the same inputs give the same messages and the same reading, so what goes out and what is believed
 * are both tested rather than hoped.
 */

/**
 * `market` is the industry and country a figure is for — only kept from a wider search, where it differs.
 * `sde` is the figure as the source quoted it on owner earnings, and the factor it was converted at (rule 8).
 */
export type MultipleSource = {
  title: string; url: string; low: number; high: number; market?: string;
  sde?: { low: number; high: number; factor: number };
};

/** What converts SDE for this plan: the sale year, its normalised EBITDA, and whose pay is added back. */
export type SdeBasis = { year: number; earnings: number; owner: string; ownerPay: number; factor: number };
/** Why SDE could not be converted: no owner on the payroll, or no positive earnings to divide by. */
export type SdeBlocked = "owner" | "earnings";
export type SdeInput = { ok: true; basis: SdeBasis } | { ok: false; why: SdeBlocked };
export type OwnerCandidate = { name: string; pct: number | null; pay: number };

/** The largest shareholder with pay; failing that, the only paid person. A tie goes to the first listed. */
export function pickOwner(people: OwnerCandidate[]): OwnerCandidate | null {
  const paid = people.filter((p) => Number.isFinite(p.pay) && p.pay > 0);
  const owners = paid.filter((p) => (p.pct ?? 0) > 0);
  if (owners.length) return owners.reduce((a, b) => ((b.pct ?? 0) > (a.pct ?? 0) ? b : a));
  return paid.length === 1 ? paid[0] : null;
}

export function sdeBasis(earnings: number | null, owner: OwnerCandidate | null, year: number): SdeInput {
  if (earnings === null || !Number.isFinite(earnings) || earnings <= 0) return { ok: false, why: "earnings" };
  if (!owner) return { ok: false, why: "owner" };
  return { ok: true, basis: { year, earnings, owner: owner.name, ownerPay: owner.pay, factor: Math.round(((earnings + owner.pay) / earnings) * 100) / 100 } };
}

export type MultiplesAsk = { industry: string; country: string; band: string | null; wider?: boolean };

/**
 * `setAside`: quoted on a basis that was not used (revenue, other, or SDE that could not be converted).
 * `tooLarge`: from a larger deal. `converted`/`sde`: SDE figures converted and the basis used (rule 8).
 * `sdeWhy`: SDE figures were found but could not be converted, and why.
 */
type Counts = { setAside: number; tooLarge?: number; wider?: boolean; converted?: number; sde?: SdeBasis; sdeWhy?: SdeBlocked };
export type MultiplesReading =
  | ({ ok: true; low: number; high: number; sources: MultipleSource[] } & Counts)
  | ({ ok: false; reason: string } & Counts);

/** Hosts whose pages are posts, not publications (rule 6). A subdomain counts: au.linkedin.com is LinkedIn. */
export const NOT_PUBLISHED = ["linkedin.com", "facebook.com", "instagram.com", "x.com", "twitter.com", "medium.com",
  "reddit.com", "quora.com", "youtube.com", "tiktok.com", "pinterest.com"];
const isPost = (host: string) => NOT_PUBLISHED.some((d) => host === d || host.endsWith(`.${d}`));

/**
 * The market a wider search may borrow from: similar law, similar buyers, brokers who work both. A country
 * not listed widens the industry only, at home. Written down so it can be argued with, not left to a model.
 */
export const NEARBY: Record<string, string[]> = {
  "Australia": ["New Zealand"], "New Zealand": ["Australia"],
  "United Kingdom": ["Ireland"], "Ireland": ["United Kingdom"],
  "United States": ["Canada"], "Canada": ["United States"],
  "Singapore": ["Malaysia"],
  /*
   * Southeast Asia (§6.144). Malaysia and Thailand are the nearest in income and have the most published
   * small-business sales, so they are what Indonesia and the Philippines borrow from. Singapore stays
   * Malaysia's only: its prices would flatter the others.
   */
  "Malaysia": ["Singapore", "Thailand"], "Thailand": ["Malaysia"],
  "Indonesia": ["Malaysia", "Thailand"], "Philippines": ["Malaysia", "Thailand"],
};
const ALIASES: Record<string, string[]> = {
  "New Zealand": ["NZ", "Aotearoa"], "United Kingdom": ["UK", "Britain", "England", "Scotland", "Wales"],
  "United States": ["USA", "US", "America"],
};
const nearby = (country: string) => NEARBY[country] ?? [];
/** "the wider sector" or "the wider sector and Australia" — the same words on the card and in the reason. */
export const widerScope = (country: string) => {
  const n = nearby(country);
  if (!n.length) return "the wider sector";
  return n.length === 1 ? `the wider sector and ${n[0]}` : `the wider sector, ${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
};
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Does a figure's stated market sit in one of these countries? Whole words, so "US" is not found in "Australia". */
const inMarket = (market: string, countries: string[]) =>
  countries.flatMap((c) => [c, ...(ALIASES[c] ?? [])]).some((name) => new RegExp(`\\b${esc(name)}\\b`, "i").test(market));

/** Sites needed before a range is offered. */
export const MIN_SOURCES = 2;
/** Shown at most — the card is a list a client reads, not a bibliography. */
export const MAX_SOURCES = 5;
/** Above this a "multiple" is a typo, a revenue figure or a listed company, not a small private sale. */
const CEILING = 30;

/**
 * Size moves a multiple more than anything but industry: a 400k business and a 15m one in the same trade
 * sell years apart. Sent as a band, never the figure — a band is a size, a figure is this business.
 */
export function revenueBand(revenue: number | null, currency: string): string | null {
  if (revenue === null || !Number.isFinite(revenue) || revenue <= 0) return null;
  const m = revenue / 1_000_000;
  const range = m < 0.5 ? "under 0.5 million" : m < 1 ? "0.5–1 million" : m < 5 ? "1–5 million" : m < 20 ? "5–20 million" : "over 20 million";
  return `${currency} ${range}`;
}

const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

/** Industry and country are required: a multiple for "a business" is not a comparable of anything. */
export function multiplesAsk(p: { industry: string | null; country: string | null; revenue: number | null; currency: string }):
  { ok: true; ask: MultiplesAsk } | { ok: false; missing: ("industry" | "country")[] } {
  const industry = clip(p.industry ?? "", 80), country = clip(p.country ?? "", 60);
  const missing = [...(industry ? [] : ["industry" as const]), ...(country ? [] : ["country" as const])];
  if (missing.length) return { ok: false, missing };
  return { ok: true, ask: { industry, country, band: revenueBand(p.revenue, p.currency) } };
}

const SYSTEM = [
  "You find published figures for what small private businesses have sold for. You search the web and report what sources say. You never estimate.",
  "",
  "Rules:",
  "- Report only multiples a source actually states. Never calculate, average, adjust or infer one.",
  "- Give each figure's basis exactly as the source states it: \"EBITDA\" for EBITDA or EBIT-before-owner-adjustments multiples; \"SDE\" for seller's discretionary earnings, owner's earnings or owner benefit; \"revenue\" for multiples of sales; \"other\" for anything else or unclear.",
  "- Prefer business brokers' market reports, valuation firms, accountants' industry guides and transaction databases. Prefer the country asked about; a source from elsewhere is allowed but say so in its title.",
  "- Give each figure's size: \"small\" when it is for small or owner-run businesses; \"larger\" when it comes from mid-market, private-equity or M&A deal data, or listed companies; \"unclear\" when the source does not say.",
  "- Give each figure's market: the industry and country the source says it is for, e.g. \"Food service, Australia\".",
  "- Social media posts and forum threads are not sources. Leave them out.",
  "- A news report of one company's sale is not a market figure, and a sale to a large corporate or overseas buyer is \"larger\". Leave news reports out.",
  "- A source that gives one figure has low and high equal.",
  "- Reply with JSON only, no prose and no code fence, in exactly this shape:",
  '{"sources":[{"title":"Publisher — page title","url":"https://...","low":2.5,"high":3.5,"basis":"EBITDA","size":"small","market":"Plumbing, Australia"}]}',
  '- If you find nothing that states a multiple, reply {"sources":[]}.',
].join("\n");

/** The user turn reads as a search, because it is what the search is built from. */
export function multiplesMessages(ask: MultiplesAsk): Message[] {
  const size = ask.band ? ` with annual revenue of ${ask.band}` : "";
  const where = [ask.country, ...nearby(ask.country)].join(" or ");
  const content = ask.wider
    ? `There are too few published figures for small private ${ask.industry} businesses in ${ask.country}. What EBITDA multiples have small private ${ask.industry} businesses, or small private businesses in the wider sector ${ask.industry} belongs to, sold for in ${where}${size}? Only figures for ${where}, and only for a sector a buyer of a ${ask.industry} business would compare it with — leave out any other. List each published source and the industry and country its figure is for.`
    : `What EBITDA multiples have small private ${ask.industry} businesses in ${ask.country}${size} sold for? List each published source.`;
  return [{ role: "system", content: SYSTEM }, { role: "user", content }];
}

/** Hosts compare without "www." and without case; paths without a trailing slash, query or fragment. */
function norm(url: string): { host: string; key: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return { host, key: `${host}${u.pathname.replace(/\/+$/, "")}` };
  } catch { return null; }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

/** The model's reply, held to the four rules above. `cited` is every URL the search itself returned. */
export function readMultiples(text: string, cited: string[], ask: MultiplesAsk, sde: SdeInput | null = null): MultiplesReading {
  const where = ask.wider
    ? `${ask.industry} businesses in ${ask.country}, or for ${widerScope(ask.country)}`
    : `${ask.industry} businesses in ${ask.country}`;
  const none = (setAside = 0, tooLarge = 0): MultiplesReading => ({
    ok: false, setAside, tooLarge, wider: !!ask.wider, ...(sde?.ok ? { sde: sde.basis } : {}),
    ...(sdeSeen && sde && !sde.ok ? { sdeWhy: sde.why } : {}),
    reason: `Couldn't find at least ${MIN_SOURCES} published sources giving EBITDA multiples for ${where}. A business broker or your accountant will know the range.`,
  });

  let raw: unknown;
  try {
    const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    raw = a >= 0 && b > a ? JSON.parse(t.slice(a, b + 1)) : null;
  } catch { raw = null; }
  const basisOf = (x: unknown) => String((x as { basis?: unknown } | null)?.basis ?? "").trim().toUpperCase();
  /* EBITDA figures first, so a site quoting both is counted on the figure that needs no conversion. */
  const list = (raw && typeof raw === "object" && Array.isArray((raw as { sources?: unknown }).sources)
    ? (raw as { sources: unknown[] }).sources : [])
    .map((x, i) => ({ x, i })).sort((a, b) => Number(basisOf(a.x) !== "EBITDA") - Number(basisOf(b.x) !== "EBITDA") || a.i - b.i)
    .map(({ x }) => x);
  const conv = sde?.ok ? sde.basis : null;
  let sdeSeen = false;

  const returned = new Set(cited.map((u) => norm(u)?.key).filter(Boolean) as string[]);
  const seenHosts = new Set<string>();
  const kept: MultipleSource[] = [];
  let setAside = 0, tooLarge = 0;

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const n = typeof s.url === "string" ? norm(s.url) : null;
    if (!n || !returned.has(n.key)) continue;                         // rule 2: not a page the search found
    if (isPost(n.host)) continue;                                     // rule 6: a post, not a publication
    const lo = Number(s.low), hi = s.high === undefined || s.high === null ? lo : Number(s.high);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi > CEILING || lo > hi) continue;
    const basis = basisOf(s);
    if (basis === "SDE") sdeSeen = true;
    if (basis !== "EBITDA" && !(basis === "SDE" && conv)) { setAside++; continue; }             // rules 3 and 8
    if (String(s.size ?? "").trim().toLowerCase() === "larger") { tooLarge++; continue; }     // rule 7
    const market = ask.wider && typeof s.market === "string" ? clip(s.market, 80) : "";
    if (ask.wider && !inMarket(market, [ask.country, ...nearby(ask.country)])) continue;   // rule 5: unnamed or too far
    const fromSde = basis === "SDE" && !!conv;
    const f = fromSde ? conv!.factor : 1;
    if (hi * f > CEILING) continue;                                   // converted past anything a small sale fetches
    if (seenHosts.has(n.host)) continue;                              // rule 4 counts sites, not pages
    seenHosts.add(n.host);
    kept.push({
      title: clip(String(s.title ?? n.host), 140) || n.host, url: String(s.url), low: r1(lo * f), high: r1(hi * f),
      ...(market ? { market } : {}), ...(fromSde ? { sde: { low: r1(lo), high: r1(hi), factor: f } } : {}),
    });
  }

  if (kept.length < MIN_SOURCES) return none(setAside, tooLarge);
  const sources = kept.slice(0, MAX_SOURCES);
  const low = r1(median(sources.map((s) => s.low)));
  const high = Math.max(low, r1(median(sources.map((s) => s.high))));
  const used = sources.filter((x) => x.sde).length;
  return { ok: true, low, high, sources, setAside, tooLarge, wider: !!ask.wider,
    ...(conv ? { sde: conv } : {}), ...(used ? { converted: used } : {}), ...(sdeSeen && sde && !sde.ok ? { sdeWhy: sde.why } : {}) };
}

/**
 * What the accept action will store, checked on the server (§6.106): the browser sends back the range it
 * was shown, and a tampered or stale one is refused rather than saved as if a search had produced it.
 */
export function checkAccepted(x: { low: unknown; high: unknown; sources: unknown }):
  { ok: true; low: number; high: number; sources: MultipleSource[] } | { ok: false } {
  const low = Number(x.low), high = Number(x.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high > CEILING || low > high) return { ok: false };
  if (!Array.isArray(x.sources) || x.sources.length < MIN_SOURCES || x.sources.length > MAX_SOURCES) return { ok: false };
  const sources: MultipleSource[] = [];
  for (const s of x.sources as Record<string, unknown>[]) {
    const n = typeof s?.url === "string" ? norm(s.url) : null;
    const lo = Number(s?.low), hi = Number(s?.high);
    if (!n || !Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi > CEILING || lo > hi) return { ok: false };
    const market = typeof s.market === "string" ? clip(s.market, 80) : "";
    const d = s.sde as { low?: unknown; high?: unknown; factor?: unknown } | undefined;
    const sde = d && [d.low, d.high, d.factor].every((v) => Number.isFinite(Number(v)) && Number(v) > 0)
      ? { low: r1(Number(d.low)), high: r1(Number(d.high)), factor: Number(d.factor) } : null;
    sources.push({ title: clip(String(s.title ?? n.host), 140), url: String(s.url), low: r1(lo), high: r1(hi), ...(market ? { market } : {}), ...(sde ? { sde } : {}) });
  }
  return { ok: true, low: r1(low), high: r1(high), sources };
}

/** A range is "wider" when any of its figures names a market of its own (rule 5), so every screen can say so. */
export const isWider = (sources: { market?: unknown }[] | null | undefined): boolean =>
  !!sources?.some((s) => typeof s?.market === "string" && s.market.trim() !== "");

/** The two readings of a search that widened, told as one: the wider result, with both searches' left-outs. */
export function afterWider(first: MultiplesReading, wider: MultiplesReading): MultiplesReading {
  const why = wider.sdeWhy ?? first.sdeWhy;
  return { ...wider, setAside: first.setAside + wider.setAside, tooLarge: (first.tooLarge ?? 0) + (wider.tooLarge ?? 0), ...(why ? { sdeWhy: why } : {}) };
}

/** How many of a stored range's figures were converted from SDE, and at what factor (rule 8). */
export function convertedFrom(sources: { sde?: { factor?: unknown } }[] | null | undefined): { count: number; factor: number } | null {
  const c = (sources ?? []).filter((s) => s?.sde && Number.isFinite(Number(s.sde.factor)));
  return c.length ? { count: c.length, factor: Number(c[0].sde!.factor) } : null;
}
