import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Where a totals row is allowed to sit (§6.40.1).
 *
 * This has now bitten in both directions, a day apart, and neither showed up in any other test because both
 * are about HTML the browser rewrites underneath you:
 *
 *   `<tfoot>` written INSIDE a `<tbody>` is not part of that table. The browser lays it out as its own
 *   anonymous table with its own column widths, and the totals sit 84 px out of the columns they total.
 *
 *   A bare `<tr>` written as a direct child of `<table>` is the mirror fault. The parser inserts a `<tbody>`
 *   around it, so the server's HTML and the browser's DOM disagree and React refuses to hydrate — two red
 *   issues in the corner of the app and a page that silently stops being interactive.
 *
 * So `<FootRow>` — which is a `<tfoot>` — must never appear inside a `<tbody>`. A source scan is the right
 * check here: the fault is in where the tag is written, and nothing at runtime will tell you.
 */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".tsx") ? [full] : [];
  });

describe("a totals row sits after the body, never inside it", () => {
  it("has no <FootRow> written inside a <tbody>", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const lines = readFileSync(file, "utf8").split("\n");
      let open = 0;
      lines.forEach((line, i) => {
        open += (line.match(/<tbody/g) ?? []).length;
        if (line.includes("<FootRow") && open > 0) offenders.push(`${file}:${i + 1}`);
        open -= (line.match(/<\/tbody>/g) ?? []).length;
      });
    }
    expect(offenders).toEqual([]);
  });

  it("still has totals rows to protect, so the scan is not passing by finding nothing", () => {
    const used = walk("src").filter((f) => readFileSync(f, "utf8").includes("<FootRow"));
    expect(used.length).toBeGreaterThan(5);
  });
});
