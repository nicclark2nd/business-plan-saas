import Image from "next/image";

/**
 * The BizPlanHQ lockup (§6.101).
 *
 * ONE COMPONENT, TWO FILES, BECAUSE THE WORDMARK CHANGES COLOUR AND NOTHING ELSE DOES.
 *
 * The mark and "HQ" are `--primary` (#1F6FCB) in both files; "BizPlan" is `--foreground`
 * (#1F2933) on the white screens and white on the dark chrome. That is one logo with a
 * reversed wordmark, not two logos, so it is one component with a variant rather than an
 * <Image> pasted into three layouts — the §6.41 rule about a fact written down twice applies
 * to artwork as much as to figures. When the lockup changes, it changes here.
 *
 * `alt` is the product name rather than "logo", because on the landing and sign-in screens
 * this image IS where the name appears. A screen reader that announces "logo" there leaves a
 * client who cannot see it with no idea whose site they are signing in to.
 */

/** Intrinsic dimensions of both files, trimmed to the artwork. Width follows height. */
const W = 1591;
const H = 378;

export function Brand({
  height = 22,
  variant = "ink",
  className,
}: {
  height?: number;
  /** "ink" for white backgrounds, "reversed" for the dark header and sidebar. */
  variant?: "ink" | "reversed";
  className?: string;
}) {
  return (
    <Image
      src={variant === "reversed" ? "/logo-reversed.png" : "/logo.png"}
      alt="BizPlanHQ"
      width={Math.round((height * W) / H)}
      height={height}
      className={className}
      priority
    />
  );
}
