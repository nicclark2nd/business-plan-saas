import { describe, expect, it } from "vitest";
import { fontsPresent, rasterise } from "./rasterise";
import { linesChart } from "./charts";

/**
 * The chart pipeline, end to end (§6.91).
 *
 * Every earlier check on the Word file was structural — it is a zip, it contains document.xml. None of them
 * would have noticed the charts silently missing, and that is exactly what happened twice: once because a
 * native module cannot be bundled, and once because it was installed for the wrong platform. A plan that
 * came out the same size with ten charts as without them is the failure this test exists to catch.
 */
describe("chart rasterising", () => {
  it("has the bundled fonts", () => {
    expect(fontsPresent()).toBe(true);
  });

  it("turns a real chart into a real PNG", async () => {
    const chart = linesChart({
      title: "Revenue, gross profit and net profit",
      categories: ["Jun 2027", "Jun 2028", "Jun 2029"],
      series: [{ name: "Revenue", values: [2182240, 2310234, 2489334] }, { name: "Net profit", values: [-136681, -23324, 69795] }],
      money: (v) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(v),
    });
    const png = await rasterise(chart.svg);
    expect(png, "rasterise returned null — is the platform binary for @resvg/resvg-js installed?").not.toBeNull();
    expect(png!.subarray(1, 4).toString()).toBe("PNG");
    /**
     * A blank image is a few hundred bytes. This threshold is the one that would have caught BOTH failures:
     * text that did not draw because no font was found, and a chart that did not draw at all.
     */
    expect(png!.length, "PNG is suspiciously small — the chart probably drew blank").toBeGreaterThan(5000);
  });

  it("says in words whatever the picture says", () => {
    const chart = linesChart({
      title: "Revenue", categories: ["Y1"], series: [{ name: "Revenue", values: [100] }], money: String,
    });
    expect(chart.alt).toContain("Revenue");
    expect(chart.alt).toContain("100");
  });
});
