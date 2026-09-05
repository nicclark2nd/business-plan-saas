import type { SalaryAdjustments } from "@/engine/people/salary";

/** Management Team (was Key People) — four data areas (SaaS §6.11): People · Salaries · Roles & Capability · Risk & Succession. */
export const PERSON_ROLES = ["owner", "director", "employee", "contractor"] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];
export const ROLE_LABEL: Record<PersonRole, string> = { owner: "Owner", director: "Director", employee: "Employee", contractor: "Contractor" };

export const CAPABILITY_KINDS = ["responsibility", "skill", "strength", "expertise", "licence", "education", "development"] as const;
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];
export const KIND_LABEL: Record<CapabilityKind, string> = {
  responsibility: "Responsibility", skill: "Skill", strength: "Strength", expertise: "Expertise",
  licence: "Licence & certification", education: "Education", development: "Development area",
};

export type Person = {
  id: string; plan_id: string; first_name: string; last_name: string | null; name: string; position: string | null;
  role: PersonRole; pct_shareholding: number | null; annual_salary: number | null;
  started_on: string | null;                       // ISO date, month precision
  salary_adjustments: SalaryAdjustments | null; sort_order: number;
};
export type Capability = { id: string; person_id: string; kind: CapabilityKind; description: string; internal: boolean; sort_order: number };
export type PeopleData = { people: Person[]; capabilities: Capability[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mar 2020" / "2020-03" / "03/2020" / "2020" → "2020-03-01"; empty → null; unparseable → undefined. */
export function parseMonth(input: string | null | undefined): string | null | undefined {
  const s = (input ?? "").trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/))) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  if ((m = s.match(/^(\d{1,2})[\/\-](\d{4})$/))) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  if ((m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{4})$/i))) { const i = MONTHS.findIndex((x) => x.toLowerCase() === m![1].toLowerCase()); if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, "0")}-01`; }
  if ((m = s.match(/^(\d{4})$/))) return `${m[1]}-01-01`;
  return undefined;
}

/** "2020-03-01" → "Mar 2020" */
export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}
