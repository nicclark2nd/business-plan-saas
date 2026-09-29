import { describe, it, expect } from "vitest";
import { centred, clampPlacement, coverScale, moveBy, sourceRect, zoomTo } from "./crop";

const BOX = 280;

describe("the photo crop (§6.190)", () => {
  it("starts covering the frame, centred, on a wide and on a tall photo", () => {
    const wide = centred(1200, 800, BOX);
    expect(wide.scale).toBeCloseTo(BOX / 800);
    expect(wide.y).toBeCloseTo(0);
    expect(wide.x).toBeCloseTo((BOX - 1200 * wide.scale) / 2);
    const tall = centred(600, 900, BOX);
    expect(tall.x).toBeCloseTo(0);
    expect(sourceRect(tall, BOX)).toEqual({ sx: 0, sy: 150, size: 600 });
  });

  it("never lets a drag open an empty edge inside the frame", () => {
    const p = centred(1200, 800, BOX);
    expect(moveBy(p, 5000, 0, 1200, 800, BOX).x).toBe(0);
    expect(moveBy(p, -5000, 0, 1200, 800, BOX).x).toBeCloseTo(BOX - 1200 * p.scale);
    expect(moveBy(p, 0, 50, 1200, 800, BOX).y).toBe(0);
  });

  it("zooms around the centre of the circle, and never below covering", () => {
    const p = centred(1000, 1000, BOX);
    const z = zoomTo(p, 2, 1000, 1000, BOX);
    expect(z.scale).toBeCloseTo(coverScale(1000, 1000, BOX) * 2);
    const s = sourceRect(z, BOX);
    expect(s.sx + s.size / 2).toBeCloseTo(500);
    expect(s.sy + s.size / 2).toBeCloseTo(500);
    expect(zoomTo(z, 0.2, 1000, 1000, BOX).scale).toBeCloseTo(coverScale(1000, 1000, BOX));
    expect(clampPlacement({ x: 10, y: 10, scale: 0.01 }, 1000, 1000, BOX)).toMatchObject({ x: 0, y: 0 });
  });

  it("saves exactly what is in the frame", () => {
    const p = moveBy(zoomTo(centred(2000, 1000, BOX), 3, 2000, 1000, BOX), -40, 25, 2000, 1000, BOX);
    const s = sourceRect(p, BOX);
    expect(s.sx).toBeGreaterThanOrEqual(0);
    expect(s.sy).toBeGreaterThanOrEqual(0);
    expect(s.sx + s.size).toBeLessThanOrEqual(2000 + 1e-9);
    expect(s.sy + s.size).toBeLessThanOrEqual(1000 + 1e-9);
  });
});
