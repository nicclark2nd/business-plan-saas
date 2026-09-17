/**
 * EVERY WORD THE PLAN SAYS IN ITS OWN VOICE, IN ONE FILE (§6.83).
 *
 * This is the one advantage a merge template had, kept: the prose is in a single place, so changing how the
 * plan reads is one file and one deploy rather than a hunt through builders.
 *
 * Two rules for anything written here.
 *
 * **It is the client's voice, not the app's.** A business plan is read by a lender, an investor or a
 * partner. It says "the business projects", never "you have not filled this in". Nothing in here nags,
 * explains the software, or refers to a screen by name.
 *
 * **A sentence that introduces a table says what the table MEANS, not what it contains.** "The table below
 * shows revenue" is worth nothing — the reader can see that. "A falling net figure on rising revenue is
 * growth being funded out of the bank" is worth the line it takes.
 */
export const COPY = {
  subtitle: "Business Plan",

  snapshot: (name: string) =>
    `This plan sets out where ${name} is today, what it intends to do over the next five years, and what those intentions come to in money. The facts below define the business the rest of the plan describes.`,

  highlights: (name: string) =>
    `${name} has projected its financial performance across the next five years. The table below sets out the net profit after tax for each year, in money and as a share of the revenue that produced it.`,

  projections: (name: string) =>
    `The five-year projection for ${name} is built from the number of units expected to sell for each line, what each is expected to sell for, and how both are expected to move year on year. The same method produces the costs. Every figure below, and every figure elsewhere in this plan, comes from that one calculation.`,

  grossMarginLead:
    "Gross margin is the share of every dollar of revenue left after the cost of delivering it, and it is the first line a lender tests: it says whether the business model works before a single overhead is argued about.",

  marginalCash:
    "The marginal cash analysis follows every 100 units of revenue through the things that consume it — the cost of goods, the money customers have not yet paid, the stock on hand, the money owed to suppliers, and the overheads — to what is left as cash.",
  marginalCashWhy:
    "It is a measure of how efficiently revenue becomes money in the bank. A falling net figure against rising revenue is the signal worth acting on: it means growth is being funded out of the business's own account, through debtors and stock, rather than paying for itself.",
  marginalCashNote:
    "Money owed to suppliers is the one line that gives back, because it is the business's own trading funded by somebody else. Every other line takes.",

  ratios: (name: string) =>
    `The ratios below are the ordinary tests applied to ${name}'s projections, in the three groups a lender reads them in. Each is arithmetic on the statements later in this plan; where a ratio cannot be calculated — a growth rate in the first year, a return on equity that is not there — it is shown as a dash rather than as zero.`,

  products: (name: string, many: string, customers: string) =>
    `The table below sets out the ${many} ${name} sells to its ${customers}, with the average value of each sale and what Year 1 is expected to produce. Together these are how the business earns.`,

  ownership: (name: string) =>
    `Ownership of ${name} is held as follows.`,

  visionLead: (name: string) => `${name} exists to reach the following:`,
  missionLead: (name: string) => `The mission below guides what ${name} does, and how decisions are made when the answer is not obvious:`,
  promiseLead: (name: string) => `What every customer of ${name} is entitled to expect:`,

  goals: (name: string) =>
    `To reach the revenue and profit set out above, ${name} has committed to the following.`,

  capital: (name: string) =>
    `The following capital expenditure is required by ${name} to deliver this plan. Each is included in the projections above, in the year shown.`,

  financialPlanIntro: (name: string) =>
    `This section sets out the projected financial position of ${name} in full: what the business earns, what it owns and owes, and what actually reaches the bank. The three statements are built from one calculation and reconcile to each other in every year.`,

  pnl: "What the business earns and what it costs, year by year. One-off income and costs sit below operating profit and above tax, so an unusual year never flatters the trading line and never escapes the tax on it.",

  balanceSheet: "What the business owns and what it owes at the end of each year. The difference between the two is what belongs to its owners.",

  cashFlow: "What actually reaches the bank, which is not the same as what is earned. A profitable business that runs out of cash is the ordinary way a good plan fails, and this is the statement a lender tests hardest.",
  cashFlowNote: "Interest is financing, not operating. Money from selling an asset is investing, never revenue. A grant is operating: it is income the business earned, not money it raised.",

  byService: (one: string) =>
    `What each ${one} line earns, and what it costs to deliver.`,
  byServiceNote: (one: string) =>
    `This stops at gross profit deliberately. Overheads — rent, wages, insurance — belong to the business rather than to any one ${one}, and splitting them across lines would need a basis nobody has agreed.`,
  noServices: (many: string) => `No ${many} have been recorded for this plan yet.`,

  overheads: (name: string) =>
    `The running costs ${name} carries whether or not it sells anything, as projected for Year 1.`,

  funding: (name: string) =>
    `The money behind ${name}, and where it comes from. Repayments and interest on any borrowing are in the projections above.`,

  oneOffs:
    "Income and costs that belong to a single year rather than to ordinary trading. They are shown separately so the trading performance can be read without them.",

  strength:
    "The measures a lender applies to the balance sheet above: what is available to meet what falls due, how much of the business is borrowed, and what would be left if it stopped.",

  // ---- the narrative sections (§6.86) -------------------------------------
  glance: (name: string) => `${name} in brief.`,
  licences: (name: string) =>
    `What ${name} is licensed, registered and insured to do. These belong to the business rather than to any individual, and they are what the business is permitted to trade on.`,
  whatWeSell: (name: string, many: string) =>
    `The ${many} ${name} sells, what each is worth, and what each costs to deliver. This is where the revenue in the financial plan comes from, line by line.`,
  margins: (one: string) =>
    `What each ${one} line earns above the cost of delivering it.`,
  marginsNote: (one: string) =>
    `This stops at gross profit deliberately. Overheads — rent, wages, insurance — belong to the business rather than to any one ${one}, and splitting them across lines would need a basis nobody has agreed.`,

  segments: (name: string) =>
    `${name} does not sell to one undifferentiated market. The table below sets out each kind of buyer, what they have in common, and what they are actually buying on.`,
  evidence:
    "What follows is not assumption. Each entry is a question the business went and answered, how it was answered, and what changed as a result.",

  competitors: (name: string) =>
    `Who a customer would consider instead of ${name}, and how each compares. A plan that names no competitor is describing a market that does not exist.`,

  spend: (name: string) =>
    `What ${name} intends to spend on being found and being chosen, and what it expects each kind of spending to do.`,
  spendNote:
    "These budgets are already in the overheads in the financial plan; they are set out here so the intent behind the figure is visible rather than buried in a total.",

  people: (name: string) =>
    `The people who run ${name}, what each is responsible for, and the experience behind it. Development areas that individuals are working on are deliberately not included.`,

  premises: (name: string) => `Where ${name} operates from.`,
  suppliers: (name: string) =>
    `Who ${name} depends on to deliver, on what terms, and what happens if one of them stops. A dependency named with its alternative is a managed risk; one named without is an open question.`,
  process: (one: string) =>
    `How ${one} is delivered once it has been won, step by step.`,

  swot: (name: string) =>
    `An honest reading of where ${name} is strong, where it is exposed, and what is being done about the second. The weaknesses and threats below are stated with their responses rather than listed alone.`,
  strengths: "What the business does better than the alternatives available to a customer, and can demonstrate.",
  opportunities: "Changes in the market, or gaps left by competitors, that the business is positioned to take.",
  weaknesses: "Where the business is exposed today. Each is shown with what is being done about it.",
  threats: "What could damage the business that it does not control. Each is shown with how it is guarded against.",

  quarters:
    "The annual goals above are delivered through the quarterly commitments below, each with a named owner.",

  omittedLead:
    "The following parts of a full business plan are not included, because the information behind them has not been recorded. Each is a section this plan will carry once it has something to put in it.",
};
