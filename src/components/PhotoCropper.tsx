"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { centred, moveBy, sourceRect, zoomTo, type Placement } from "@/engine/plan/crop";

const BOX = 280;      // the frame on screen
const OUT = 512;      // the saved square, in pixels
const MAX_ZOOM = 4;

/**
 * FIT A PHOTO INTO THE CIRCLE (§6.190) — drag to move it, slide (or scroll) to zoom, as every phone and app does.
 *
 * The saved file is a 512 × 512 square of exactly what sits inside the frame; the circle is drawn by the page,
 * everywhere the photo is shown. Nothing leaves the browser until Save is pressed.
 */
export function PhotoCropper({ src, onCancel, onSave }: {
  /** An object URL for a new file, or a signed URL for the original already stored. */
  src: string;
  onCancel: () => void;
  onSave: (square: Blob) => void;
}) {
  const img = useRef<HTMLImageElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [p, setP] = useState<Placement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string>();
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = new Image();
    /* A stored original is on another origin; asking for it with CORS keeps the canvas exportable. */
    el.crossOrigin = "anonymous";
    el.onload = () => { img.current = el; setSize({ w: el.naturalWidth, h: el.naturalHeight }); setP(centred(el.naturalWidth, el.naturalHeight, BOX)); };
    el.onerror = () => setError("That photo couldn't be opened. Try choosing it again.");
    el.src = src;
  }, [src]);

  const setZ = (z: number) => {
    if (!size || !p) return;
    const clamped = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(clamped);
    setP(zoomTo(p, clamped, size.w, size.h, BOX));
  };
  const move = (dx: number, dy: number) => { if (size && p) setP(moveBy(p, dx, dy, size.w, size.h, BOX)); };

  const save = () => {
    if (!img.current || !p) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setError("Your browser couldn't prepare the photo."); return; }
    const r = sourceRect(p, BOX);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.current, r.sx, r.sy, r.size, r.size, 0, 0, OUT, OUT);
    try {
      canvas.toBlob((b) => (b ? onSave(b) : setError("Your browser couldn't prepare the photo.")), "image/jpeg", 0.9);
    } catch {
      setError("That stored photo can't be edited here. Upload it again to adjust it.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Adjust your photo</DialogTitle>
          <DialogDescription>Drag to move it. Use the slider, or scroll, to zoom.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            role="application" aria-label="Photo position. Drag, or use the arrow keys." tabIndex={0}
            className="relative cursor-grab touch-none overflow-hidden rounded-md bg-secondary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            style={{ width: BOX, height: BOX }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; }}
            onPointerMove={(e) => { if (!drag.current) return; move(e.clientX - drag.current.x, e.clientY - drag.current.y); drag.current = { x: e.clientX, y: e.clientY }; }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            onWheel={(e) => setZ(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
            onKeyDown={(e) => {
              const k: Record<string, [number, number]> = { ArrowLeft: [8, 0], ArrowRight: [-8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] };
              if (k[e.key]) { e.preventDefault(); move(...k[e.key]); }
            }}
          >
            {p && size && (
              /* eslint-disable-next-line @next/next/no-img-element -- a local object URL, positioned by hand */
              <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none"
                style={{ left: p.x, top: p.y, width: size.w * p.scale, height: size.h * p.scale }} />
            )}
            {/* The circle: everything outside it is dimmed, so what will show is exactly what is bright. */}
            <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)" }} />
            <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" />
            {!p && !error && <p className="absolute inset-0 grid place-items-center text-[12.5px] text-muted-foreground">Opening…</p>}
          </div>

          <label className="flex w-full items-center gap-3 text-[12.5px] text-muted-foreground">
            <span aria-hidden>−</span>
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} disabled={!p}
              aria-label="Zoom" onChange={(e) => setZ(Number(e.target.value))} className="flex-1 accent-[var(--color-primary)]" />
            <span aria-hidden>+</span>
          </label>
          {error && <p className="text-[12.5px] font-semibold text-bad" role="alert">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} disabled={!p}>Save photo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
