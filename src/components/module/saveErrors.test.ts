import { describe, expect, it } from "vitest";
import { raiseIn, clearIn, errorSummary, type SaveError } from "./saveErrors";

const e = (key: string, message = "no", extra: Partial<SaveError> = {}): SaveError => ({ key, message, ...extra });

/**
 * The rules a failed save now follows (§6.98). Each of these is a fault the old code actually had, written
 * as the behaviour that replaces it — so the test names read as the complaint and the assertion as the fix.
 */
describe("what happens when a save fails", () => {
  it("keeps two failures as two, rather than the second erasing the first", () => {
    // Plan settings had profile, licences and the logo racing into one slot and overwriting each other.
    const list = raiseIn(raiseIn([], e("licences", "bad licence")), e("logo", "bad logo"));
    expect(list.map((x) => x.key)).toEqual(["licences", "logo"]);
    expect(list.map((x) => x.message)).toEqual(["bad licence", "bad logo"]);
  });

  it("lets a retry replace its OWN failure, and only its own", () => {
    const first = raiseIn(raiseIn([], e("profile", "first reason")), e("logo", "logo reason"));
    const again = raiseIn(first, e("profile", "second reason"));
    expect(again).toHaveLength(2);
    expect(again.find((x) => x.key === "profile")!.message).toBe("second reason");
    expect(again.find((x) => x.key === "logo")!.message).toBe("logo reason");
  });

  it("clears exactly one key when that save succeeds", () => {
    const list = raiseIn(raiseIn([], e("a")), e("b"));
    expect(clearIn(list, "a").map((x) => x.key)).toEqual(["b"]);
  });

  /**
   * THE ONE THAT COST THREE FIELDS. Eleven `edit()` handlers called `setError(undefined)` on every
   * keystroke. Nothing in this module clears on anything but an explicit `clearIn` of that key, so typing
   * cannot reach it.
   */
  it("is untouched by clearing a key that is not there — a keystroke cannot reach it", () => {
    const list = raiseIn([], e("contact_email", "needs an @"));
    expect(clearIn(list, "tagline")).toBe(list);
    expect(clearIn(list, "website")).toBe(list);
    expect(clearIn(list, "contact_email")).toEqual([]);
  });

  it("returns the same array when nothing changed, so a no-op does not re-render", () => {
    const list = raiseIn([], e("a"));
    expect(clearIn(list, "b")).toBe(list);
  });

  it("carries the field and the label, so the message can sit beside the control", () => {
    const list = raiseIn([], e("profile", "needs an @", { field: "contact_email", label: "Business profile" }));
    expect(list[0].field).toBe("contact_email");
    expect(list[0].label).toBe("Business profile");
  });
});

describe("the footer summary", () => {
  it("says nothing when nothing failed, so the status can show instead", () => {
    expect(errorSummary([])).toBeNull();
  });

  /** "an error" hides that there are four; every multi-row module used to show only the first. */
  it("counts, rather than reporting one", () => {
    expect(errorSummary([e("a")])).toBe("1 change didn't save");
    expect(errorSummary([e("a"), e("b")])).toBe("2 changes didn't save");
    expect(errorSummary([e("a"), e("b"), e("c")])).toBe("3 changes didn't save");
  });
});
