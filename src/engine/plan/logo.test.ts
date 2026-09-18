import { describe, expect, it } from "vitest";
import {
  LOGO_ACCEPT, LOGO_MAX_BYTES, LOGO_TYPES, checkLogo, logoExtension, logoObjectPath, logoWordType,
} from "./logo";

/**
 * What the app will take as a logo (§6.94). The point of every one of these is the same: a file the client
 * cannot use must be refused AT THE PICKER, with a sentence, rather than accepted and turned into a grey
 * box in the document they send to a bank (§6.57).
 */
describe("what counts as a logo", () => {
  it("accepts PNG and JPEG, and nothing else", () => {
    expect(LOGO_TYPES).toEqual(["image/png", "image/jpeg"]);
  });

  it("offers the picker exactly what the action accepts", () => {
    // One list, two consumers — the failure this guards is a picker offering a type the server refuses.
    for (const t of LOGO_TYPES) expect(LOGO_ACCEPT).toContain(t);
  });

  it("refuses the formats Word cannot place, and says which they are", () => {
    for (const type of ["image/webp", "image/svg+xml", "image/gif", "image/tiff", "application/pdf", ""]) {
      const r = checkLogo({ type, size: 10_000 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/PNG or JPEG/);
    }
  });

  it("refuses a file over 2 MB, and names the size it got", () => {
    const r = checkLogo({ type: "image/png", size: LOGO_MAX_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/2\.0 MB/);
  });

  it("takes a file exactly on the limit", () => {
    expect(checkLogo({ type: "image/png", size: LOGO_MAX_BYTES }).ok).toBe(true);
  });

  it("refuses an empty file rather than storing nothing", () => {
    expect(checkLogo({ type: "image/png", size: 0 }).ok).toBe(false);
  });

  it("gives back the extension the object will be stored under", () => {
    expect(checkLogo({ type: "image/png", size: 100 })).toEqual({ ok: true, ext: "png" });
    expect(checkLogo({ type: "image/jpeg", size: 100 })).toEqual({ ok: true, ext: "jpg" });
    expect(logoExtension("image/webp")).toBeNull();
  });
});

describe("where a logo lives", () => {
  const PLAN = "b4dce99b-8cfb-4de7-b0cb-9fd96ee0f252";

  /**
   * The SHAPE of this string is load-bearing, not cosmetic: migration 0042's storage policies read the plan
   * id out of the first path segment to decide who may touch the object. A path that stopped starting with
   * the plan id would not fail loudly — it would quietly stop being protected.
   */
  it("puts the plan id first, because the storage policy reads it from there", () => {
    expect(logoObjectPath(PLAN, "png")).toBe(`${PLAN}/logo.png`);
    expect(logoObjectPath(PLAN, "jpg")).toBe(`${PLAN}/logo.jpg`);
    expect(logoObjectPath(PLAN, "png").split("/")[0]).toBe(PLAN);
  });

  it("is one object per plan, so replacing a logo does not leave the old one behind", () => {
    expect(logoObjectPath(PLAN, "png")).toBe(logoObjectPath(PLAN, "png"));
  });
});

describe("what Word is told the image is", () => {
  it("reads the kind from the stored path", () => {
    expect(logoWordType("plan/logo.png")).toBe("png");
    expect(logoWordType("plan/logo.jpg")).toBe("jpg");
    expect(logoWordType("plan/logo.jpeg")).toBe("jpg");
    expect(logoWordType("plan/LOGO.PNG")).toBe("png");
  });

  it("returns null for anything else, so it never reaches the document", () => {
    for (const p of ["plan/logo.webp", "plan/logo.svg", "plan/logo", "", null, undefined]) {
      expect(logoWordType(p)).toBeNull();
    }
  });
});
