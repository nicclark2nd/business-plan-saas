import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * SVG to PNG, for the Word file (§6.91).
 *
 * THE FONTS ARE BUNDLED AND SYSTEM FONTS ARE OFF, deliberately. A serverless runtime has no fonts
 * installed: with `loadSystemFonts` the same chart renders with text locally and as a blank 268-byte image
 * in production, which is the worst kind of difference — it works on the machine it was built on. Loading
 * Open Sans from the repo makes the document identical everywhere, and Open Sans is what the app itself
 * uses, so the plan matches the screen a client typed it into.
 */
const FONT_DIR = join(process.cwd(), "src", "engine", "report", "fonts");
const FONTS = ["OpenSans-Regular.ttf", "OpenSans-SemiBold.ttf"].map((f) => join(FONT_DIR, f));

let warned = false;

/**
 * ASYNC, and the import is dynamic (§6.91). `@resvg/resvg-js` is a native binary: imported statically it
 * is pulled into the route's module graph at compile time and the route fails to build. A dynamic import
 * inside the call keeps it out of the graph, and `serverExternalPackages` keeps the bundler from trying to
 * inline the `.node` file at all. Both are needed; either alone is a 500.
 */
export async function rasterise(svg: string): Promise<Buffer | null> {
  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svg, {
      /* 2× so the picture is sharp on paper; the document places it back at its own size. */
      fitTo: { mode: "width", value: 1920 },
      font: { loadSystemFonts: false, fontFiles: FONTS, defaultFontFamily: "Open Sans" },
    });
    return Buffer.from(resvg.render().asPng());
  } catch (e) {
    /**
     * A chart that cannot be drawn must never take the plan down with it. The block falls back to its own
     * `alt` text, which says the same thing in words — so the document is poorer, never broken.
     */
    if (!warned) { warned = true; console.error("report: chart rasterise failed, falling back to text", e); }
    return null;
  }
}

/** So a caller can check the fonts are really there before blaming the renderer. */
export const fontsPresent = () => FONTS.every((f) => { try { return readFileSync(f).length > 0; } catch { return false; } });
