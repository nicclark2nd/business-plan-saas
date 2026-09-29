/**
 * THE PHOTO CROP (§6.190) — the arithmetic behind "drag it into the circle and zoom", kept pure so it is tested
 * rather than trusted.
 *
 * The frame is a square `box` pixels wide; the circle is drawn inside it. The image is placed with its top-left
 * corner at (x, y) in frame pixels and drawn at `scale` frame pixels per image pixel. Two rules hold at all
 * times, and every function here keeps them:
 *
 *   1. The image always COVERS the frame — no empty corner can end up inside the circle.
 *   2. Zooming keeps the point under the centre of the circle where it is, as every photo app does.
 */
export type Placement = { x: number; y: number; scale: number };

/** The smallest scale at which the image covers the frame: its shorter side exactly fills it. */
export const coverScale = (w: number, h: number, box: number) => box / Math.min(w, h);

/** Keep the image over the whole frame. */
export function clampPlacement(p: Placement, w: number, h: number, box: number): Placement {
  const scale = Math.max(p.scale, coverScale(w, h, box));
  const dw = w * scale, dh = h * scale;
  return {
    scale,
    x: Math.min(0, Math.max(box - dw, p.x)),
    y: Math.min(0, Math.max(box - dh, p.y)),
  };
}

/** The starting placement: covering, and centred. */
export function centred(w: number, h: number, box: number): Placement {
  const scale = coverScale(w, h, box);
  return { scale, x: (box - w * scale) / 2, y: (box - h * scale) / 2 };
}

/** Zoom to `zoom` × the cover scale, holding the frame's centre still. */
export function zoomTo(p: Placement, zoom: number, w: number, h: number, box: number): Placement {
  const next = coverScale(w, h, box) * Math.max(1, zoom);
  const c = box / 2;
  const k = next / p.scale;
  return clampPlacement({ scale: next, x: c - (c - p.x) * k, y: c - (c - p.y) * k }, w, h, box);
}

/** Move by a drag of (dx, dy) frame pixels. */
export const moveBy = (p: Placement, dx: number, dy: number, w: number, h: number, box: number) =>
  clampPlacement({ ...p, x: p.x + dx, y: p.y + dy }, w, h, box);

/** The part of the original image inside the frame — what is drawn to the saved square. */
export function sourceRect(p: Placement, box: number) {
  /* `+ 0` turns a -0 from a zero offset into 0. */
  return { sx: -p.x / p.scale + 0, sy: -p.y / p.scale + 0, size: box / p.scale };
}
