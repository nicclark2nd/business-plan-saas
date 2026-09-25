import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

/**
 * THE CASES THAT MATTER ARE THE ONES THAT LOOK LIKE PATHS (§6.119).
 *
 * `//evil.com` and `/\evil.com` both begin with a slash and both leave the site. They are the reason the
 * previous guard failed, so they are the first tests here.
 */
describe("safeNext", () => {
  it("keeps an ordinary path, with its query and hash", () => {
    expect(safeNext("/setup")).toBe("/setup");
    expect(safeNext("/plans/abc/marketing?area=brand")).toBe("/plans/abc/marketing?area=brand");
    expect(safeNext("/reports#contents")).toBe("/reports#contents");
  });

  it("refuses everything that leaves the site", () => {
    for (const bad of [
      "https://evil.com",
      "http://evil.com/x",
      "//evil.com",
      "//evil.com/setup",
      "/\\evil.com",
      "\\\\evil.com",
      "https://bizplanhq.com.evil.com",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
    ]) {
      expect(safeNext(bad), `${bad} was allowed`).toBe("/setup");
    }
  });

  it("refuses nothing at all", () => {
    expect(safeNext(null)).toBe("/setup");
    expect(safeNext(undefined)).toBe("/setup");
    expect(safeNext("")).toBe("/setup");
    expect(safeNext("   ")).toBe("/setup");
    expect(safeNext(123 as unknown as string)).toBe("/setup");
  });

  it("takes the caller's own fallback", () => {
    expect(safeNext("https://evil.com", "/login")).toBe("/login");
  });

  /*
   * The whole point: whatever comes back is a PATH, so the caller supplies the origin and a caller cannot
   * reintroduce the bug by pasting the result somewhere that resolves it differently.
   */
  it("always returns a relative path", () => {
    for (const input of ["/a", "//evil.com", "https://evil.com", "", "/x?y=1#z"]) {
      expect(safeNext(input).startsWith("/"), input).toBe(true);
      expect(safeNext(input).startsWith("//"), input).toBe(false);
    }
  });
});
