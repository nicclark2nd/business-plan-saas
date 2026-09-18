/**
 * What the app will accept as a plan's logo (§6.94).
 *
 * The rules live here rather than in the upload action because three places need the same answer: the file
 * picker (what it offers), the action (what it accepts) and the migration's bucket constraint (what the
 * database will hold). Three copies of "which file types" is how a client gets a picker that offers a format
 * the server then refuses (§6.19).
 *
 * WHY NOT EVERY IMAGE FORMAT. This is not about what a browser can draw. It is about what WORD can place:
 * a .docx image is png, jpg, gif, bmp or svg, and a WebP dropped into one is a grey box in the document a
 * client hands to a bank. Refusing the file with a sentence saying why is the only honest answer; accepting
 * it and producing a broken cover is §6.57 with a file picker in front of it.
 *
 * SVG is refused on purpose. It is a document rather than an image — it can carry script, and it would be
 * rendered by whatever opened it. A logo is not worth that.
 */
export const LOGO_TYPES = ["image/png", "image/jpeg"] as const;
export type LogoType = (typeof LOGO_TYPES)[number];

/** 2 MB. A letterhead that will print two inches wide has no business being larger. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** What the file picker offers, so it cannot drift from what the action accepts. */
export const LOGO_ACCEPT = LOGO_TYPES.join(",");
export const LOGO_TYPES_LABEL = "PNG or JPEG";
export const LOGO_MAX_LABEL = "2 MB";

/** The extension a stored object takes, which is also how the .docx decides what kind of image it is. */
export const logoExtension = (type: string): "png" | "jpg" | null =>
  type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : null;

/** The Word ImageRun type for a stored object path. Anything else must never reach the document. */
export const logoWordType = (path: string | null | undefined): "png" | "jpg" | null => {
  const ext = String(path ?? "").split(".").pop()?.toLowerCase();
  return ext === "png" ? "png" : ext === "jpg" || ext === "jpeg" ? "jpg" : null;
};

/**
 * One object per plan, named for the plan. Not a uuid per upload: a client who changes their logo four times
 * should not leave four files behind, and the storage policies read the plan id out of the first path
 * segment (0042), so the shape of this string is load-bearing rather than cosmetic.
 */
export const logoObjectPath = (planId: string, ext: "png" | "jpg") => `${planId}/logo.${ext}`;

export type LogoCheck = { ok: true; ext: "png" | "jpg" } | { ok: false; error: string };

/** One answer, given in the words a client should see. */
export function checkLogo(file: { type: string; size: number; name?: string }): LogoCheck {
  const ext = logoExtension(file.type);
  if (!ext) {
    return { ok: false, error: `That file is ${file.type || "an unknown type"}. A logo has to be ${LOGO_TYPES_LABEL} — those are the formats Word can place in the document without breaking it.` };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: "That file appears to be empty." };
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${LOGO_MAX_LABEL} — a logo printed two inches wide does not need more.` };
  }
  return { ok: true, ext };
}

/** The one bucket, named once (0042). */
export const LOGO_BUCKET = "plan-logos";

/** How long a signed URL lives. Long enough to render a page, short enough that a copied link dies. */
export const LOGO_URL_TTL_SECONDS = 60 * 30;
